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
 *
 * gherkin-authoring-aids WP07 (research R-09) makes the example the live demo of
 * #197 and #196:
 *   4. SC-001: the folder default, not a tag, gives every generated page its
 *      glossary context — the HR page resolves `policy` to `hr`, and the shipping
 *      pages keep `shipping` with no `@dk:context` in their sources;
 *   5. NFR-002 / SC-002: the example corpus (every `.feature` and every in-page
 *      fence of `example/docs/**`) has zero imperative-step findings under the
 *      example's own `gherkin.lint`, while the authoring guide's two "reads badly"
 *      steps give exactly two (the positive control).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFeatures } from '../lib/gherkin/load.mjs';
import { planFeaturePages } from '../lib/gherkin/generate.mjs';
import { compileRules, lintSteps } from '../lib/gherkin/imperative.mjs';
import { parseGherkin } from '../lib/gherkin/parse.mjs';
import { featureView } from '../lib/gherkin/view.mjs';
import { FLAG, parseArgs } from '../scripts/generate-feature-pages.mjs';
import { GHERKIN_PAGES_KEYS, normalizeGherkinOptions, validateGherkinPages } from '../lib/gherkin/options.mjs';
import { render } from './helpers/gherkin-render-harness.js';

// The fence check renders pages through the real Markdown chain (as
// gherkin-fence.test.ts does): Starlight's factory only has to return an object,
// and the glossary's remark stage stays out (`isGlossaryActive` false) while
// `loadGlossary` stays real, so the page plan below checks the example's actual
// context names.
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/glossary/load.js')>()),
  isGlossaryActive: vi.fn(() => false),
}));
const { loadGlossary } = await import('../lib/glossary/load.js');

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
  defaultGlossaryContext?: Record<string, string>;
  includeRoots?: string[];
  lint?: { imperativeSteps?: unknown };
};
const indexBasename = configLiteral('indexBasename') as string[];

describe('validate:features mirrors the example gherkin option', () => {
  it('the example config turns the gherkin preset on', () => {
    expect(gherkin.sources).toEqual(['features']);
    expect(gherkin.section).toBe('behaviour');
    // R-09: the folder defaults and the imperative-step lint are on in the demo.
    expect(gherkin.defaultGlossaryContext).toEqual({ shipping: 'shipping', hr: 'hr' });
    expect(gherkin.lint).toEqual({ imperativeSteps: true });
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
    expect(opts.defaultGlossaryContext).toEqual(gherkin.defaultGlossaryContext);
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
      defaultGlossaryContext: { shipping: 'shipping' },
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

/** The example's option as the build normalises it (pages + lint). */
const normalised = normalizeGherkinOptions(gherkin);
const lintOption = normalised.lint;
const docsRoot = path.join(EXAMPLE_ROOT, 'docs');
const behaviourDir = path.join(docsRoot, gherkin.section ?? 'behaviour');
const featureModel = () => loadFeatures({ sources: gherkin.sources, root: EXAMPLE_ROOT });

describe('the example features are authored warning-free', () => {
  it('loading and planning example/features raises no warning', () => {
    const warnings: string[] = [];
    const model = loadFeatures({
      sources: gherkin.sources,
      root: EXAMPLE_ROOT,
      warn: (msg: string) => warnings.push(msg),
    });
    const glossary = loadGlossary(EXAMPLE_ROOT);
    expect(glossary.present).toBe(true);
    const plan = planFeaturePages(model, {
      docsRoot,
      section: gherkin.section ?? 'behaviour',
      indexBasename,
      sourceRoot: path.resolve(EXAMPLE_ROOT, gherkin.sourceRoot ?? '.'),
      sourceUrlPrefix: gherkin.sourceUrlPrefix,
      titles: gherkin.titles,
      defaultGlossaryContext: normalised.pages?.defaultGlossaryContext,
      // The build's own inputs: the glossary's context names (an unknown context
      // would warn) and the resolved lint (an imperative step would warn).
      ...(glossary.present ? { knownContexts: new Set(glossary.index.contexts.keys()) } : {}),
      ...(lintOption ? { lint: lintOption } : {}),
      warn: (msg: string) => warnings.push(msg),
    });
    // Non-vacuity: every example feature was planned.
    expect(plan.size).toBeGreaterThanOrEqual(model.files.length);
    // The example's features are authored warning-free (no unknown tags,
    // truncations, missing descriptions, unknown contexts or imperative steps).
    expect(warnings).toEqual([]);
  });
});

/** The committed frontmatter's `glossary_context`, or `undefined`. */
function committedContext(rel: string): string | undefined {
  const page = readFileSync(path.join(behaviourDir, rel), 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(page);
  expect(fm, `${rel} has no frontmatter`).not.toBeNull();
  const m = /^glossary_context:\s*"([^"]*)"\s*$/m.exec((fm as RegExpExecArray)[1]);
  return m?.[1];
}

describe('folder defaults supply the glossary context (SC-001, #197)', () => {
  const shippingFeatures = readdirSync(path.join(EXAMPLE_ROOT, 'features', 'shipping'))
    .filter((n) => n.endsWith('.feature'))
    .sort();

  it('the HR page resolves its terms in the hr context', () => {
    // `policy` is defined in both `shipping` and `hr`; this is what disambiguates it.
    expect(committedContext('hr/request-leave.md')).toBe('hr');
  });

  it('the shipping pages keep "shipping", and no shipping source carries a @dk:context tag', () => {
    expect(shippingFeatures.length).toBe(3);
    for (const name of shippingFeatures) {
      expect(committedContext(`shipping/${name.replace(/\.feature$/, '.md')}`), name).toBe('shipping');
      const source = readFileSync(path.join(EXAMPLE_ROOT, 'features', 'shipping', name), 'utf8');
      expect(source, `${name} still tags its context`).not.toMatch(/@dk:context/);
    }
  });
});

describe('the example corpus has zero imperative-step findings (NFR-002, SC-002, #196)', () => {
  let originalCwd: string | undefined;
  afterEach(() => {
    if (originalCwd) process.chdir(originalCwd);
    originalCwd = undefined;
  });

  /** Every Markdown page under `example/docs/` holding an in-page Gherkin fence. */
  function fencePages(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) walk(abs);
        else if (/\.mdx?$/.test(e.name) && /^\s*(?:`{3,}|~{3,})\s*gherkin\b/m.test(readFileSync(abs, 'utf8'))) out.push(abs);
      }
    };
    walk(docsRoot);
    return out.sort();
  }

  /** Render a page through the real chain with the example's fence + lint option; the lint lines it logs. */
  async function fenceLintLines(file: string, contents = readFileSync(file, 'utf8')): Promise<{ lines: string[]; html: string }> {
    originalCwd ??= process.cwd();
    process.chdir(EXAMPLE_ROOT);
    // Fences, includes and lint only: no `sources`, so the setup hook generates
    // (writes) no pages; `results` only adds badges and is not a lint input.
    const option = { includeRoots: gherkin.includeRoots, lint: gherkin.lint } as const;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { html } = await render(contents, { gherkin: option } as never, file);
      return { lines: warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('[dk-gherkin]')), html };
    } finally {
      warn.mockRestore();
    }
  }

  it('every example .feature and every in-page fence lints clean; the guide\'s bad steps give exactly two', async () => {
    expect(lintOption, 'the example turns gherkin.lint on').toBeDefined();
    const rules = compileRules(lintOption!.imperativeSteps);

    // 1. Every example feature (the page sources), through the lint core.
    const warnings: string[] = [];
    let steps = 0;
    const model = featureModel();
    expect(model.files.length).toBe(4);
    for (const file of model.files) {
      const view = featureView(file.document);
      expect(view).not.toBeNull();
      for (const child of view!.children) {
        const sections = child.kind === 'rule' ? child.children : [child];
        for (const section of sections) steps += section.steps.length;
      }
      lintSteps(view!, {
        rules,
        file: `features/${file.relPath}`,
        warn: (m: string) => warnings.push(m),
        language: file.document.feature?.language,
        checkFeatureAllow: true,
      });
    }
    expect(steps).toBeGreaterThan(20); // non-vacuity: the corpus has real steps
    expect(warnings).toEqual([]);

    // 2. Every in-page fence of example/docs/**, through the real Markdown chain.
    const pages = fencePages();
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page, 'the fence chain renders .md pages only').toMatch(/\.md$/);
      const { lines, html } = await fenceLintLines(page);
      expect(html, `${page} rendered no gherkin block`).toContain('dk-gherkin');
      expect(lines, page).toEqual([]);
    }

    // 3. Positive control (SC-002): the authoring guide's two "reads badly" steps,
    //    with the same rules, give exactly two warnings — on a feature and in a fence.
    const control = ['Feature: Book', '  Scenario: Book by clicking', '    When I click "#book-button"', '    And I fill in "size" with "12"', ''].join('\n');
    const { document } = parseGherkin(control, { display: 'control.feature' });
    const controlWarnings: string[] = [];
    lintSteps(featureView(document!)!, { rules, file: 'control.feature', warn: (m: string) => controlWarnings.push(m) });
    expect(controlWarnings).toHaveLength(2);
    expect(controlWarnings[0]).toContain('control.feature:3');
    expect(controlWarnings[1]).toContain('control.feature:4');
    const fenced = await fenceLintLines(path.join(docsRoot, 'control.md'), `# Control\n\n\`\`\`gherkin\n${control}\`\`\`\n`);
    expect(fenced.lines.filter((m) => m.includes('describe the behaviour instead'))).toHaveLength(2);
  });
});
