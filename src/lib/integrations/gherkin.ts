/**
 * The opt-in Gherkin integrations (ADR-0046, ADR-0051, ADR-0055). Moved out of
 * `config.ts` verbatim (#115); imports only leaf modules, never `../config`.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import type { DocKittyGherkinOption } from './shared.js';
import { BUILD_GENERATED_SECTION_IDS } from '../sections.js';
import { GHERKIN_LOG_PREFIX, loadFeatures } from '../gherkin/load.mjs';
import { generateFeaturePages } from '../gherkin/generate.mjs';
import { normalizeGherkinOptions } from '../gherkin/options.mjs';
import { drainFatal, formatFatal, resetFatal } from '../gherkin/errors.mjs';
import gherkinFence, { type GherkinFenceOptions } from '../remark/gherkin-fence.js';
import { loadReport } from '../gherkin/results-load.mjs';
import { DK_GHERKIN_ROUTE_ENV, deleteInternalEnv, setInternalEnv } from '../internal-env.mjs';

/** The normalised `gherkin` option (see {@link resolveGherkinOptions}). */
export type ResolvedGherkinOptions = ReturnType<typeof normalizeGherkinOptions>;

/** Its generated-pages part, present only when `sources` is set (ADR-0046). */
export type ResolvedGherkinPages = NonNullable<ResolvedGherkinOptions['pages']>;

/**
 * Normalise + validate the `gherkin` option EAGERLY, at `defineDocKittyIntegrations`
 * time, so a misconfiguration fails before any hook runs (house posture: config
 * errors are build-fatal and name the feature). The rules (`true` or a known-key
 * object; with `sources`: non-empty `sources`, `section` ONE safe folder name, not
 * `_meta` and not another generator's section) live ONCE in
 * `./gherkin/options.mjs`, shared with the bare-Node `generate-feature-pages.mjs`
 * CLI; this passes the reserved list derived from `BUILD_GENERATED_SECTION_IDS`
 * (a parity test pins the CLI's default to it).
 */
export function resolveGherkinOptions(
  raw: DocKittyGherkinOption,
): ResolvedGherkinOptions {
  return normalizeGherkinOptions(raw, {
    reservedSections: ['_meta', ...BUILD_GENERATED_SECTION_IDS],
  });
}

/**
 * The opt-in Gherkin feature-page seam (ADR-0046), registered ONLY when
 * `defineDocKittyIntegrations({ gherkin: { sources, … } })` is set (`gherkin:
 * true`, or an object without `sources`, generates no pages). It adds NO markdown
 * plugins: its single `astro:config:setup` hook (the glossary's generate-before-
 * glob seam — the content-layer `sync` runs after every config hook) does
 *   (a) `loadFeatures`: walk + parse every `*.feature` under `sources` (resolved
 *       against the site root, `process.cwd()`, like the glossary's root) exactly
 *       once. A malformed file throws ONE `[dk-gherkin] <path>:<line>:<col> …`
 *       Error; it is deliberately NOT caught, so the build fails.
 *   (b) `generateFeaturePages`: codegen into `<docsDir>/<section>/**`. The writer
 *       is deterministic and only rewrites changed bytes, so the dev-server restart
 *       triggered by (c) regenerates identically and never loops; stale OWNED pages
 *       are pruned, and an AUTHORED file in the section is fatal.
 *   (c) `addWatchFile` for every loaded source, in model (sorted) order, so editing
 *       a `.feature` in dev restarts the server and re-runs (a)–(b). A NEW file is
 *       only picked up on the next restart (documented limit).
 * One `[dk-gherkin]` info line reports the counts (when the logger supports it).
 *
 * (d) `injectRoute` mounts `/api/scenarios.json` (#126, ADR-0054), so the
 *     `llms.txt` line that advertises it never points at a 404 and a site adds no
 *     route file. A site that already mounts its own `src/pages/api/scenarios.json.*`
 *     (or `scenarios.json/index.*`) keeps it: the injection is skipped, so the two routes never meet at one
 *     address (`hasOwnScenarioIndexPage`). The route reads `sourceRoot` and
 *     `sourceUrlPrefix` (and `results`, ADR-0055) from
 *     `virtual:doc-kitty/gherkin-scenario-index`, so it resolves sources the way
 *     the generator did.
 */
export function gherkinIntegration(
  opts: ResolvedGherkinPages,
  docsDir: string,
  indexBasename: IndexBasenameOption | undefined,
  results?: ResolvedGherkinOptions['results'],
): AstroIntegration {
  return {
    name: 'doc-kitty:gherkin',
    hooks: {
      'astro:config:setup': ({ addWatchFile, logger, injectRoute, updateConfig, config }) => {
        const root = process.cwd();
        const warn = (message: string) => logger.warn(message);
        const model = loadFeatures({ sources: opts.sources, root, warn });
        const docsRoot = path.resolve(root, docsDir);
        const { written, unchanged, removed } = generateFeaturePages(model, {
          sources: opts.sources,
          docsRoot,
          outDir: path.resolve(docsRoot, opts.section),
          section: opts.section,
          indexBasename,
          sourceRoot: path.resolve(root, opts.sourceRoot),
          sourceUrlPrefix: opts.sourceUrlPrefix,
          allowEmpty: opts.allowEmpty,
          titles: opts.titles,
          warn,
        });
        for (const file of model.files) addWatchFile(file.absPath);
        if (hasOwnScenarioIndexPage(config?.srcDir, root)) {
          if (typeof logger.info === 'function') {
            logger.info(
              `${GHERKIN_LOG_PREFIX} src/pages/api/scenarios.json.* is mounted by the site: not injecting the scenario index`,
            );
          }
        } else {
          const resolved = `\0${SCENARIO_INDEX_MODULE_ID}`;
          const options = {
            sourceRoot: opts.sourceRoot,
            ...(opts.sourceUrlPrefix !== undefined ? { sourceUrlPrefix: opts.sourceUrlPrefix } : {}),
            // ADR-0055: the injected index carries the same results as the pages.
            ...(results ? { results } : {}),
          };
          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'doc-kitty:gherkin-scenario-index',
                  resolveId: (id: string) => (id === SCENARIO_INDEX_MODULE_ID ? resolved : null),
                  load: (id: string) =>
                    id === resolved
                      ? `export const scenarioIndexOptions = ${JSON.stringify(options)};\n`
                      : null,
                },
              ],
            },
          });
          // `prerender`: the route reads feature files at build, so it stays static
          // even when the site sets `output: 'server'`.
          injectRoute({
            pattern: '/api/scenarios.json',
            entrypoint: SCENARIO_INDEX_ENTRYPOINT,
            prerender: true,
          });
        }
        if (typeof logger.info === 'function') {
          logger.info(
            `${GHERKIN_LOG_PREFIX} ${model.files.length} feature file(s) → ${docsDir}/${opts.section}: ` +
              `${written.length} written, ${unchanged.length} unchanged, ${removed.length} removed`,
          );
        }
      },
    },
  };
}

/** The virtual module the injected scenario-index route reads its options from. */
export const SCENARIO_INDEX_MODULE_ID = 'virtual:doc-kitty/gherkin-scenario-index';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
const SCENARIO_INDEX_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/scenario-index-injected';

/** Page extensions Astro treats as an endpoint file. */
const ENDPOINT_EXTENSIONS = ['ts', 'js', 'mts', 'mjs', 'cts', 'cjs', 'tsx', 'jsx'];

/**
 * True when the site mounts its own `api/scenarios.json` endpoint under
 * `<srcDir>/pages` (the hand-mounted route older sites were told to add). Astro
 * fails on two routes for one address, so the integration then leaves the
 * site's route alone.
 */
export function hasOwnScenarioIndexPage(srcDir: URL | string | undefined, root: string): boolean {
  return findOwnScenarioIndexPage(srcDir, root) !== undefined;
}

/**
 * The site's own scenario-index endpoint, as a project-root-relative POSIX path
 * (`src/pages/api/scenarios.json.ts`), or `undefined` when it mounts none.
 */
export function findOwnScenarioIndexPage(srcDir: URL | string | undefined, root: string): string | undefined {
  const src = srcDir ? fileURLToPath(srcDir) : path.join(root, 'src');
  const api = path.join(src, 'pages', 'api');
  for (const ext of ENDPOINT_EXTENSIONS) {
    for (const candidate of [path.join(api, `scenarios.json.${ext}`), path.join(api, 'scenarios.json', `index.${ext}`)]) {
      if (existsSync(candidate)) return path.relative(root, candidate).split(path.sep).join('/');
    }
  }
  return undefined;
}

/** `CI` is set: trimmed and lower-cased, non-empty and not `false` or `0`. */
function isCiEnv(): boolean {
  const value = (process.env.CI ?? '').trim().toLowerCase();
  return value !== '' && value !== 'false' && value !== '0';
}

/**
 * Read the configured Cucumber report once at config time (ADR-0055 decision 9),
 * so a broken pipeline fails before any page renders:
 *  - missing: a warning, and the site builds without results (a local build has
 *    no CI report), unless CI is set and `required` is not `false`: THROWN;
 *  - not a file, too large, or not a Cucumber report: THROWN, so the build fails
 *    with the report's path (and line, for an NDJSON envelope);
 *  - every step skipped: a warning, since that is what `--dry-run` writes.
 * The report is also a watch file: replacing it restarts a dev server, whose
 * content layer then re-renders the pages that show results (`schema.ts`).
 */
function checkResultsReport(
  results: NonNullable<ResolvedGherkinOptions['results']>,
  { addWatchFile, logger }: { addWatchFile?: (path: string) => void; logger: { warn: (m: string) => void } },
): void {
  const root = process.cwd();
  addWatchFile?.(path.resolve(root, results.report));
  const loaded = loadReport(results, { projectRoot: root });
  if (!loaded.ok) {
    if (results.required !== false && isCiEnv()) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} gherkin.results report not found: ${results.report} ` +
          '(CI is set; set gherkin.results.required: false to build without results)',
      );
    }
    logger.warn(
      `${GHERKIN_LOG_PREFIX} gherkin.results report not found: ${results.report}; scenarios render without results`,
    );
    return;
  }
  if (loaded.report.allSkipped) {
    logger.warn(
      `${GHERKIN_LOG_PREFIX} every step in ${results.report} is skipped; it looks like a --dry-run, ` +
        `so every scenario shows Skipped`,
    );
  }
}

/**
 * The in-page Gherkin stage (ADR-0051 decisions 2, 3, 5), registered ONLY when the
 * `gherkin` option is set and `fences !== false`. A SEPARATE integration from the
 * `doc-kitty:gherkin` codegen hook: that one reads the filesystem in
 * `astro:config:setup` and is pinned as adding no markdown plugins, while this one
 * is a pure markdown stage (02 §Pipeline). Two hooks:
 *
 *  - `astro:config:setup` empties the process-wide error sink (a long-lived dev
 *    process must not carry errors across config reloads) and appends the
 *    `gherkinFence` remark plugin, with the normalised `includeRoots`,
 *    `sourceRoot` and `sourceUrlPrefix` the include directive needs. Its array
 *    position (after the glossary and the codegen hook, immediately before
 *    Starlight) puts it after Astro's smartypants and the glossary, and before
 *    Starlight's directive restoration, Expressive Code and `deckSplit`;
 *    `config-invariants.test.ts` pins it.
 *  - `astro:build:done` fails the build when any page recorded a fatal Gherkin
 *    error. Astro's content loader only LOGS a render error and stores the page
 *    with no HTML, so without this check a broken fence builds an empty page and
 *    exits 0 (02 §Making errors fatal). The thrown aggregate lists every page and
 *    message; `gherkin-fence-build.test.ts` proves the non-zero exit on a real
 *    build. In dev nothing exits: the throw in the stage already shows the
 *    page's error.
 *
 *    A failed render must not be cached as a hit, or a second build (or a build
 *    after `astro sync`) would skip the page and pass. Two mechanisms, because
 *    the content store is per collection but this integration is not:
 *     - primary: `docKittyDocsLoader` stores a failed Gherkin render under a
 *       digest that never matches (`createGherkinTracker` in `schema.ts`), so
 *       every later sync renders the page again and refills the sink. It also
 *       covers `astro sync`/`astro check` before a build and a build that died
 *       before this hook;
 *     - fallback: before throwing, this hook DELETES the build's content data
 *       store (`<cacheDir>/data-store.json`). That covers a page in a collection
 *       on any other loader (a plain `glob()`), which the loader-side digest
 *       never sees: the next build re-renders everything and fails again. It
 *       cannot cover an `astro sync` before the build for such a collection
 *       (the sync never reaches this hook). Dropping the store only costs the
 *       next build a full re-render, and only after a failure. It leans on
 *       Astro 5 internals, as decision 11 does (#119).
 *    `gherkin-fence-build.test.ts` pins both.
 */
export function gherkinFenceIntegration(opts: ResolvedGherkinOptions): AstroIntegration {
  // What the include directive needs (03 §2.3, §4.6), resolved against the site
  // root at transform time, like `gherkin.sources`.
  const fenceOptions: GherkinFenceOptions = {
    includeRoots: opts.includeRoots,
    sourceRoot: opts.sourceRoot,
    ...(opts.sourceUrlPrefix !== undefined ? { sourceUrlPrefix: opts.sourceUrlPrefix } : {}),
    // `fences: false` with `results`: the stage runs for generated pages only.
    ...(opts.fences ? {} : { fences: false }),
    ...(opts.results ? { results: opts.results } : {}),
  };
  let cacheDir: URL | undefined;
  return {
    name: 'doc-kitty:gherkin-fence',
    hooks: {
      'astro:config:setup': ({ updateConfig, config, addWatchFile, logger }) => {
        resetFatal();
        cacheDir = config?.cacheDir;
        if (opts.results) checkResultsReport(opts.results, { addWatchFile, logger });
        // FR-008: a site's own scenario route is told apart from the injected
        // one HERE, not in the codegen hook, because that one exists only with
        // `gherkin.sources` while `results` can be set without it. The route
        // names the file in its warning when it is given no `results`. The path is
        // relative to the Astro project root (`--root`), not to the process cwd.
        const ownRoute = opts.results ? findOwnScenarioIndexPage(config?.srcDir, config?.root ? fileURLToPath(config.root) : process.cwd()) : undefined;
        if (ownRoute) setInternalEnv(DK_GHERKIN_ROUTE_ENV, ownRoute);
        else deleteInternalEnv(DK_GHERKIN_ROUTE_ENV);
        updateConfig({ markdown: { remarkPlugins: [[gherkinFence, fenceOptions]] } });
      },
      'astro:build:done': () => {
        const report = formatFatal(drainFatal());
        if (!report) return;
        // The fallback for collections not on `docKittyDocsLoader` (see above).
        if (cacheDir) rmSync(new URL('data-store.json', cacheDir), { force: true });
        throw new Error(report);
      },
    },
  };
}
