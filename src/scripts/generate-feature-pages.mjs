#!/usr/bin/env node
/**
 * generate-feature-pages.mjs — generate (or drift-check) the Gherkin feature
 * pages a site's `gherkin` option writes into its docs tree (ADR-0046).
 *
 * Usage:
 *   node src/scripts/generate-feature-pages.mjs \
 *     --root example --sources features --docs docs --section behaviour \
 *     [--index-basename README,index] [--astro-config <path>] [--source-root <dir>] \
 *     [--source-url-prefix <url>] [--titles <dir>=<title> ...] [--check] [--allow-empty]
 *
 *   --root               Site directory every other path is relative to (default: cwd).
 *   --sources            Comma-separated `.feature` source directories (required).
 *   --docs               The site's docs directory (default: `docs`).
 *   --section            Section folder the pages land under (default: `behaviour`).
 *   --index-basename     Comma-separated index basename(s); the hub is `<first>.md`.
 *                        Read from `<root>/astro.config.*`; the flag is only for a
 *                        site without one (default: `README`) and must agree with a
 *                        config when there is one.
 *   --astro-config       Site config file to read the index names from, when it is not
 *                        `<root>/astro.config.*`. Missing or unloadable: exit 2. With no
 *                        config at all the names are README, with a warning.
 *   --source-root        Directory `sources[0].resource` paths are relative to
 *                        (default: `--root`, matching the integration's site root).
 *   --source-url-prefix  Optional browse-URL prefix for `sources[0].resource`.
 *   --titles             A hub title for one source directory, as `<dir>=<title>`
 *                        (`hr=HR`, `"shipping/edi=EDI messages"`); repeat the flag
 *                        for each directory. The twin of `gherkin.titles`.
 *   --check              Compare in memory, write nothing; exit 1 on any drift.
 *   --allow-empty        Remove the generated pages when no source yields a feature.
 *                        Without it, write mode stops (exit 1) and removes nothing:
 *                        an uninitialised git submodule looks exactly like that.
 *                        Has no effect with `--check`.
 *   --help, -h           Print this usage block and exit 0.
 *
 * WHY a bare-Node twin of the build step: `astro.config.mjs` cannot be evaluated
 * outside Astro, so CI's build-free doc-sanity lane needs its own entry point.
 * It calls the SAME `loadFeatures` → `planFeaturePages` / `generateFeaturePages`
 * the integration calls, so the bytes it compares are the bytes the build
 * writes (parity by construction). The flags mirror the astro.config option;
 * a separate test keeps the two equal.
 *
 * Option validation is SHARED with the integration (`../lib/gherkin/options.mjs`
 * `validateGherkinPages`): `--section` must be ONE safe folder name, not
 * `_meta`/`glossary`, so `--section ../../x` is refused here exactly as
 * `gherkin.section: '../../x'` is refused in astro.config.
 *
 * `--check` is a lockfile-style gate (cf. `generate-adr-index.mjs --check`): it
 * lists every planned page that is missing (`added`) or differs (`changed`),
 * every owned page no source produces any more (`stale`), and every
 * non-generated file inside the section (`authored` — a generated section has
 * a single owner). Exit codes: 0 in sync, 1 drift or any `[dk-gherkin]` error
 * (missing source dir, parse error, output collision, authored intrusion).
 */
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import { announceIndexNames, resolveSiteIndexBasenames } from './site-index-names.mjs';
import {
  diffFeaturePages,
  generateFeaturePages,
  planFeaturePages,
} from '../lib/gherkin/generate.mjs';
import {
  DEFAULT_GHERKIN_SECTION,
  validateGherkinPages,
  validateIndexBasenames,
} from '../lib/gherkin/options.mjs';

/** The diff kinds, in the order they are reported. */
const DRIFT_KINDS = /** @type {const} */ (['added', 'changed', 'stale', 'authored']);

/**
 * How a shared-validator error names each option: the CLI flag.
 *
 * @internal Exported only so a parity test can compare it with the option keys;
 * not part of the package's API.
 */
export const FLAG = /** @type {const} */ ({
  sources: '--sources',
  section: '--section',
  sourceUrlPrefix: '--source-url-prefix',
  sourceRoot: '--source-root',
  allowEmpty: '--allow-empty',
  titles: '--titles',
});

/**
 * The usage block of this file's header comment (from `Usage:` up to the
 * paragraph that starts with `WHY`), with the comment markers removed. Read from
 * the file itself so `--help` and the header cannot differ.
 *
 * @returns {string}
 */
function usage() {
  const header = readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0] ?? '';
  const block = header.slice(header.indexOf('Usage:'), header.indexOf('WHY')).replace(/^ \* ?/gm, '');
  return block.trimEnd();
}

/**
 * Split a comma list, trimming and dropping empties.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function list(value) {
  return String(value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse argv into resolved options. Throws a usage error on an unknown flag or
 * a flag missing its value, and a `[dk-gherkin]` error for an option the shared
 * validator rejects (e.g. `--section ../x`).
 *
 * @param {string[]} argv `process.argv`-shaped (the first two entries are skipped).
 * @returns {{ root: string, sources: string[], docsRoot: string, section: string,
 *   outDir: string, indexBasename: string[], indexNames: ReturnType<typeof resolveSiteIndexBasenames>, sourceRoot: string,
 *   sourceUrlPrefix: string | undefined, check: boolean, allowEmpty: boolean,
 *   titles: Record<string, string> | undefined }}
 */
export function parseArgs(argv) {
  const raw = {
    root: '.',
    sources: '',
    docs: 'docs',
    section: DEFAULT_GHERKIN_SECTION,
    indexBasename: undefined,
    sourceRoot: undefined,
    sourceUrlPrefix: undefined,
    check: false,
    allowEmpty: false,
    astroConfig: undefined,
  };
  /** `--titles <dir>=<title>`, in the order given (repeatable). */
  /** @type {string[]} */
  const titleArgs = [];
  /** @type {Record<string, keyof typeof raw>} */
  const valued = {
    '--root': 'root',
    '--sources': 'sources',
    '--docs': 'docs',
    '--section': 'section',
    '--index-basename': 'indexBasename',
    '--astro-config': 'astroConfig',
    '--source-root': 'sourceRoot',
    '--source-url-prefix': 'sourceUrlPrefix',
  };
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--check') {
      raw.check = true;
      continue;
    }
    if (flag === '--allow-empty') {
      raw.allowEmpty = true;
      continue;
    }
    if (flag === '--titles') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
      titleArgs.push(value);
      i++;
      continue;
    }
    const key = valued[flag];
    if (!key) throw new Error(`unknown argument: ${flag}`);
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`);
    raw[key] = value;
    i++;
  }
  const sourceList = list(raw.sources);
  if (sourceList.length === 0) throw new Error('--sources is required (comma-separated directories)');
  const { sources, section, allowEmpty, titles } = validateGherkinPages(
    {
      sources: sourceList,
      section: raw.section,
      sourceUrlPrefix: raw.sourceUrlPrefix,
      ...(raw.sourceRoot === undefined ? {} : { sourceRoot: raw.sourceRoot }),
      allowEmpty: raw.allowEmpty,
      ...(titleArgs.length > 0 ? { titles: parseTitles(titleArgs) } : {}),
    },
    { optionName: (key) => FLAG[key] },
  );

  const flagIndexBasename = raw.indexBasename === undefined ? undefined : list(raw.indexBasename);
  validateIndexBasenames(flagIndexBasename, '--index-basename');

  const root = path.resolve(raw.root);
  const docsRoot = path.resolve(root, raw.docs);
  // The site config (`<root>/astro.config.*`) is the source of the index names
  // (FR-007); the flag must agree with it (FR-008), and is the value for a site
  // with no config. The hub is `<first>.md`, so the config's order matters.
  let indexNames;
  try {
    indexNames = resolveSiteIndexBasenames(docsRoot, {
      flag: flagIndexBasename,
      configPath: raw.astroConfig,
      siteDir: root,
      tool: 'generate-feature-pages',
    });
  } catch (err) {
    // A site config that is missing, will not load, or disagrees with the flag
    // is a setup problem, not a drift or usage error: exit 2 like the other gates.
    throw Object.assign(/** @type {Error} */ (err), { exitCode: 2 });
  }
  return {
    root,
    sources,
    docsRoot,
    section,
    outDir: path.join(docsRoot, section),
    indexBasename: indexNames.names,
    indexNames,
    sourceRoot: raw.sourceRoot === undefined ? root : path.resolve(root, raw.sourceRoot),
    sourceUrlPrefix: raw.sourceUrlPrefix,
    check: raw.check,
    allowEmpty: allowEmpty === true,
    titles,
  };
}

/**
 * Turn the `--titles <dir>=<title>` values into the `gherkin.titles` object.
 * Each value splits on its FIRST `=`, so a title may hold `=`, commas and
 * spaces. The shared validator then checks the keys and titles.
 *
 * @param {readonly string[]} values
 * @returns {Record<string, string>}
 */
function parseTitles(values) {
  /** @type {Record<string, string>} */
  const titles = {};
  for (const value of values) {
    const eq = value.indexOf('=');
    if (eq === -1) throw new Error(`--titles expects <dir>=<title>; got ${JSON.stringify(value)}`);
    const dir = value.slice(0, eq);
    if (Object.hasOwn(titles, dir)) throw new Error(`--titles names ${JSON.stringify(dir)} twice`);
    // defineProperty, not assignment: `titles['__proto__'] = …` sets the prototype and drops the key.
    Object.defineProperty(titles, dir, {
      value: value.slice(eq + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return titles;
}

/**
 * Run the CLI. Returns the process exit code instead of exiting, so tests can
 * drive it in-process if they want to.
 *
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  if (argv.slice(2).some((arg) => arg === '--help' || arg === '-h')) {
    console.log(usage());
    return 0;
  }
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    console.error(`✖ generate-feature-pages: ${/** @type {Error} */ (err).message}`);
    return /** @type {{ exitCode?: number }} */ (err).exitCode ?? 1;
  }
  announceIndexNames(opts.indexNames);
  const warn = (/** @type {string} */ msg) => console.warn(`⚠ ${msg}`);
  const genOpts = {
    sources: opts.sources,
    docsRoot: opts.docsRoot,
    outDir: opts.outDir,
    section: opts.section,
    indexBasename: opts.indexBasename,
    sourceRoot: opts.sourceRoot,
    sourceUrlPrefix: opts.sourceUrlPrefix,
    allowEmpty: opts.allowEmpty,
    titles: opts.titles,
    warn,
  };
  // cwd-relative when the section is under cwd (the `pnpm validate:features`
  // case), else absolute — never a `../../..` chain.
  const fromCwd = path.relative(process.cwd(), opts.outDir);
  const outLabel = fromCwd === '' ? '.' : fromCwd.startsWith('..') ? opts.outDir : fromCwd;

  try {
    const model = loadFeatures({ sources: opts.sources, root: opts.root, warn });

    if (opts.check) {
      const diff = diffFeaturePages(planFeaturePages(model, genOpts), opts.outDir);
      const lines = DRIFT_KINDS.flatMap((kind) => diff[kind].map((rel) => `  ${kind}: ${rel}`));
      if (lines.length > 0) {
        console.error(
          `✖ ${outLabel} is out of sync with the Gherkin sources (${lines.length} path(s)):\n` +
            `${lines.join('\n')}\n` +
            '  Run the same command without `--check` (e.g. `pnpm generate:features`) and commit ' +
            'the result; move any authored file out of the generated section.',
        );
        return 1;
      }
      console.log(
        `✓ ${outLabel} is regeneration-clean (${model.files.length} feature file(s) in sync).`,
      );
      return 0;
    }

    const { written, unchanged, removed } = generateFeaturePages(model, genOpts);
    console.log(
      `✓ ${outLabel}: ${model.files.length} feature file(s) → ` +
        `${written.length} written, ${unchanged.length} unchanged, ${removed.length} removed.`,
    );
    for (const rel of written) console.log(`  written: ${rel}`);
    for (const rel of removed) console.log(`  removed: ${rel}`);
    return 0;
  } catch (err) {
    // `[dk-gherkin]` errors (missing source dir, parse errors, collisions,
    // authored intrusion) already carry their own prefix and location.
    console.error(`✖ ${/** @type {Error} */ (err).message}`);
    return 1;
  }
}

// Run the CLI only when invoked directly, so the module can be imported by tests.
// CLI guard. Compare against the REAL path of argv[1]: when the package is
// installed behind a symlink (pnpm's node_modules, or a node_modules/.bin shim),
// import.meta.url is the resolved path while argv[1] keeps the symlink path, so a
// plain comparison would never match and the gate would exit 0 having done nothing.
/** @returns {boolean} */
function invokedDirectly() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  process.exitCode = main(process.argv);
}
