/**
 * gherkin-feature-pages WP08 (ADR-0046) — the example site's on-switch stays in
 * lock-step with its bare-Node drift gate.
 *
 * `pnpm validate:features` (the CI doc-sanity lane) cannot evaluate
 * `example/astro.config.mjs` — it imports Astro — so it restates the `gherkin`
 * option as CLI flags. If the two drift, CI would drift-check a different
 * section/source set than the build generates, and pass while the committed pages
 * were stale. This suite pins:
 *   1. the `validate:features` flags EQUAL the example's `gherkin` option, titles
 *      included (and the
 *      site's `indexBasename` / default `docsDir`), parsed from source TEXT — the
 *      option object literal is read with a brace-balanced scan and evaluated as
 *      a plain data literal, so any non-literal value fails loudly here;
 *   2. `generate:features` is the same command without `--check`;
 *   3. the committed `example/docs/behaviour/**` is regeneration-clean against
 *      `example/features/**` (the same `loadFeatures` → `planFeaturePages` →
 *      `diffFeaturePages` the CLI's `--check` runs), and non-vacuously so.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import { planFeaturePages } from '../lib/gherkin/generate.mjs';
import { FLAG, parseArgs } from '../scripts/generate-feature-pages.mjs';
import { GHERKIN_PAGES_KEYS, validateGherkinPages } from '../lib/gherkin/options.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const EXAMPLE_ROOT = path.join(REPO_ROOT, 'example');
const CONFIG_TEXT = readFileSync(path.join(EXAMPLE_ROOT, 'astro.config.mjs'), 'utf8');
const SCRIPTS = (
  JSON.parse(readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;

/**
 * The value of the `<key>:` property in the config source, as a data literal.
 * Matches the key only at the start of a line (so prose in `//` comments never
 * matches), then takes the balanced `{…}` / `[…]` literal that follows.
 */
function configLiteral(key: string): unknown {
  const m = new RegExp(`^\\s*${key}\\s*:\\s*([[{])`, 'm').exec(CONFIG_TEXT);
  if (!m) throw new Error(`example/astro.config.mjs has no \`${key}:\` property`);
  const start = m.index + m[0].length - 1;
  const close = m[1] === '{' ? '}' : ']';
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < CONFIG_TEXT.length; i++) {
    const ch = CONFIG_TEXT[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === m[1]) depth++;
    else if (ch === close && --depth === 0) {
      const literal = CONFIG_TEXT.slice(start, i + 1);
      try {
        // A pure data literal (strings, arrays, objects) — anything else throws.
        return new Function(`"use strict"; return (${literal});`)();
      } catch (err) {
        throw new Error(
          `\`${key}\` in example/astro.config.mjs is not a plain data literal (${(err as Error).message}); ` +
            'update gherkin-example.test.ts alongside it',
          { cause: err },
        );
      }
    }
  }
  throw new Error(`unbalanced \`${key}\` literal in example/astro.config.mjs`);
}

/** `pnpm` script → argv the CLI's `parseArgs` takes (`node <script> …flags`). */
function scriptArgv(name: string): string[] {
  const script = SCRIPTS[name];
  expect(script, `root package.json has no "${name}" script`).toBeTypeOf('string');
  const words = (script as string).trim().split(/\s+/);
  expect(words.slice(0, 2)).toEqual(['node', 'src/scripts/generate-feature-pages.mjs']);
  return words;
}

const gherkin = configLiteral('gherkin') as {
  sources: string[];
  section?: string;
  sourceUrlPrefix?: string;
  sourceRoot?: string;
  titles?: Record<string, string>;
};
const indexBasename = configLiteral('indexBasename') as string[];

describe('validate:features mirrors the example gherkin option', () => {
  it('the example config turns the gherkin preset on', () => {
    expect(gherkin.sources).toEqual(['features']);
    expect(gherkin.section).toBe('behaviour');
  });

  it('every flag equals the option (sources, section, index basename, docs dir, source root/prefix)', () => {
    // parseArgs resolves paths against cwd; a root package.json script runs at the
    // repo root, while the build's integration resolves against the SITE root
    // (example/, `process.cwd()` of `pnpm --filter example build`). Compare the
    // paths relative to cwd, i.e. relative to the repo root the script runs in.
    // The script passes no index names (FR-007): the CLI reads them from the site config
    // beside `--root`, found relative to cwd. Run it where `pnpm validate:features` runs,
    // the repo root; vitest's own cwd is `src/`, where `example/` does not resolve.
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(REPO_ROOT);
    const opts = parseArgs(scriptArgv('validate:features'));
    cwd.mockRestore();
    const rel = (p: string) => path.relative(REPO_ROOT, p);
    expect(opts.check).toBe(true);
    expect(rel(opts.root)).toBe('example');
    expect(opts.sources).toEqual(gherkin.sources);
    expect(opts.section).toBe(gherkin.section ?? 'behaviour');
    expect(opts.indexBasename).toEqual(indexBasename);
    // The example sets no `docsDir`, so the build uses the default `docs`.
    expect(CONFIG_TEXT).not.toMatch(/^\s*docsDir\s*:/m);
    expect(rel(opts.docsRoot)).toBe(path.join('example', 'docs'));
    expect(rel(opts.sourceRoot)).toBe(path.join('example', gherkin.sourceRoot ?? '.'));
    expect(opts.sourceUrlPrefix).toBe(gherkin.sourceUrlPrefix);
    expect(opts.titles).toEqual(gherkin.titles);
  });

  it('every gherkin setting has a CLI flag and every flag a setting (FR-004a)', () => {
    // Both lists are read from the code, so adding a setting without its flag (or
    // the reverse) fails here instead of drifting. `allowEmpty` ↔ `--allow-empty`.
    const kebab = (key: string) => `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    expect(Object.entries(FLAG).sort()).toEqual(
      GHERKIN_PAGES_KEYS.map((key) => [key, kebab(key)]).sort(),
    );
    // ...and the validator must carry every key through: a key it does not
    // destructure would be dropped silently with the lists above still in step.
    const valid = {
      sources: ['f'],
      section: 'docs-x',
      sourceUrlPrefix: 'u',
      sourceRoot: 'r',
      allowEmpty: true,
      titles: { hr: 'HR' },
    };
    expect(Object.keys(valid).sort()).toEqual([...GHERKIN_PAGES_KEYS].sort());
    const validated = validateGherkinPages(valid);
    for (const key of GHERKIN_PAGES_KEYS) expect(validated).toHaveProperty(key);
  });

  it('generate:features is the same command without --check', () => {
    const generate = scriptArgv('generate:features');
    const validate = scriptArgv('validate:features');
    expect(validate.filter((w) => w !== '--check')).toEqual(generate);
    expect(parseArgs(generate).check).toBe(false);
  });
});

describe('the example features are authored warning-free', () => {
  it('loading and planning example/features raises no warning', () => {
    const warnings: string[] = [];
    const model = loadFeatures({
      sources: gherkin.sources,
      root: EXAMPLE_ROOT,
      warn: (msg: string) => warnings.push(msg),
    });
    const docsRoot = path.join(EXAMPLE_ROOT, 'docs');
    const section = gherkin.section ?? 'behaviour';
    planFeaturePages(model, {
      docsRoot,
      section,
      indexBasename,
      sourceRoot: path.resolve(EXAMPLE_ROOT, gherkin.sourceRoot ?? '.'),
      sourceUrlPrefix: gherkin.sourceUrlPrefix,
      titles: gherkin.titles,
      warn: (msg: string) => warnings.push(msg),
    });
    // The example's features are authored warning-free (no unknown tags,
    // truncations or missing descriptions).
    expect(warnings).toEqual([]);
  });
});
