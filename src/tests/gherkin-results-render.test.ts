/**
 * Results on the page (ADR-0055): a `::gherkin` include and a generated feature
 * page rendered through the REAL Markdown chain a docs page takes
 * (`helpers/gherkin-render-harness.ts`), plus the agent Markdown of an include.
 *
 * The project root is the vitest root (`src/`): the include root, the report
 * and the generated page's source are all under
 * `tests/fixtures/gherkin/results/`, whose report URIs (`features/…`) are
 * relative to that directory, i.e. `results.root`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { GherkinFenceOptions } from '../lib/remark/gherkin-fence.js';
import { listFatal, resetFatal } from '../lib/gherkin/errors.mjs';
import { clearIncludeMemo } from '../lib/gherkin/include.mjs';
import { clearReportMemo } from '../lib/gherkin/results-load.mjs';
import { parseGherkin } from '../lib/gherkin/parse.mjs';
import { renderFeatureBody } from '../lib/gherkin/render.mjs';
import { docKittyIntegrations } from './helpers/remark-stack.js';
import {
  agentMarkdown, all, byClass, defineDocKittyIntegrations, elements, headingResults, render, text, type DocKittyOptions,
} from './helpers/gherkin-render-harness.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

const FIX = 'tests/fixtures/gherkin/results';
const FEATURE = `${FIX}/features/checkout.feature`;
const CHECKOUT = readFileSync(FEATURE, 'utf8');

const RESULTS = { report: `${FIX}/messages.ndjson`, root: FIX };
const ON = (results?: unknown): Partial<DocKittyOptions> =>
  ({ gherkin: { includeRoots: [`${FIX}/features`], ...(results ? { results } : {}) } }) as Partial<DocKittyOptions>;
const include = (attrs = '') => ['# Guide', '', `::gherkin{src="${FEATURE}"${attrs}}`, ''].join('\n');

// GitHub Actions sets CI=true, which makes a missing report fatal (FR-006):
// every case here pins CI (unset by default) and restores it.
let ci: string | undefined;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  ci = process.env.CI;
  process.env.CI = '';
  resetFatal();
  clearIncludeMemo();
  clearReportMemo();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  resetFatal();
  if (ci === undefined) delete process.env.CI;
  else process.env.CI = ci;
});

// ===========================================================================
// An include
// ===========================================================================

describe('an include shows its results (ADR-0055)', () => {
  it('result line after each scenario heading, badges, a Result column per Examples row, a summary; nothing else from the report', async () => {
    const out = await render(include(), ON(RESULTS));
    expect(headingResults(out.hast)).toEqual([
      ['Guide', ''],
      ['Checkout', ''],
      ['Background', ''],
      ['Scenario: Paying by card', 'Result: Passed'],
      ['Scenario Outline: Applying a discount code', 'Result: Failed (1 failed, 1 passed)'],
      ['Rule: Gift cards cover part of the total', ''],
      ['Example: Paying with a gift card', 'Result: Passed on retry'],
    ]);
    // The TOC and the slugs are what they are without results.
    expect(out.headings).toEqual((await render(include(), ON())).headings);
    const badges = byClass(out.hast, 'dk-gherkin__status');
    expect(badges.map((b) => b.properties?.dataStatus)).toEqual(['passed', 'failed', 'passed', 'failed', 'passed']);
    expect(byClass(out.hast, 'dk-gherkin__sr').map(text)).toEqual(['Result: ', 'Result: ', 'Result: ']);
    expect(out.html).toContain('<span class="dk-gherkin__status" data-status="failed">');
    const [examples] = all(out.hast, (n) => n.tagName === 'table');
    expect(all(examples, (n) => n.tagName === 'tr').map((tr) => elements(tr).map(text))).toEqual([
      ['code', 'total', 'Result'],
      ['SAVE10', '18.00', 'Passed'],
      ['EXPIRED', '20.00', 'Failed'],
    ]);
    const [summary] = byClass(out.hast, 'dk-gherkin__results');
    expect(text(summary)).toBe('Results: 1 failed, 3 passed · as of 2026-10-14 · commit 3f1c2a9');
    expect(all(summary, (n) => n.tagName === 'time')[0].properties?.dateTime).toBe('2026-10-14T13:30:03.455Z');
    for (const leak of ['AssertionError', 'steps.js', '/home/runner', 'example-org', '3f1c2a9b7e']) expect(out.html).not.toContain(leak);
  });

  it('a selection shows its scenarios’ results, without a summary', async () => {
    const out = await render(include(' scenario="Paying by card"'), ON(RESULTS));
    expect(headingResults(out.hast)).toEqual([
      ['Guide', ''],
      ['Background', ''],
      ['Scenario: Paying by card', 'Result: Passed'],
    ]);
    expect(byClass(out.hast, 'dk-gherkin__results')).toEqual([]);
  });

  it('without gherkin.results, with a missing report, or for a fence, a file the report does not name: no results at all', async () => {
    const plain = await render(include(), ON());
    const missing = await render(include(), ON({ report: `${FIX}/none.ndjson`, root: FIX }));
    expect(missing.html).toBe(plain.html);
    expect(plain.html).not.toContain('dk-gherkin__result');
    expect((await render(include(), ON({ report: `${FIX}/messages.ndjson`, root: 'elsewhere' }))).html).not.toContain('dk-gherkin__result');
    const fence = await render(['# Guide', '', '```gherkin', CHECKOUT, '```', ''].join('\n'), ON(RESULTS));
    expect(byClass(fence.hast, 'dk-gherkin__status')).toEqual([]);
    expect(byClass(fence.hast, 'dk-gherkin__results')).toEqual([]);
  });

  describe('a report made from another version of the file', () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(path.join(process.cwd(), 'tests/fixtures/gherkin/results/.tmp-'));
      mkdirSync(path.join(dir, 'features'));
      writeFileSync(path.join(dir, 'features', 'checkout.feature'), CHECKOUT.replace('@billing\n', '@billing\n# moved\n'));
      copyFileSync(path.join(FIX, 'messages.ndjson'), path.join(dir, 'messages.ndjson'));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it('shows no badge, says so in the summary, and warns', async () => {
      const rel = path.relative(process.cwd(), dir).split(path.sep).join('/');
      const options = {
        gherkin: { includeRoots: [`${rel}/features`], results: { report: `${rel}/messages.ndjson`, root: rel } },
      } as Partial<DocKittyOptions>;
      const page = ['# Guide', '', `::gherkin{src="${rel}/features/checkout.feature"}`, ''].join('\n');
      const out = await render(page, options);
      expect(byClass(out.hast, 'dk-gherkin__status')).toEqual([]);
      expect(text(byClass(out.hast, 'dk-gherkin__results')[0])).toBe(
        'Results not shown: the test report was made from a different version of this file.',
      );
      const stale = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('different version'));
      expect(stale).toEqual([
        `[dk-gherkin] ${rel}/messages.ndjson holds results for a different version of ${rel}/features/checkout.feature; ` +
          'its scenarios show no results until the tests run again',
      ]);
    });

    it('a single-scenario include says so on its result line, whether or not the report names the scenario', async () => {
      const rel = path.relative(process.cwd(), dir).split(path.sep).join('/');
      const options = {
        gherkin: { includeRoots: [`${rel}/features`], results: { report: `${rel}/messages.ndjson`, root: rel } },
      } as Partial<DocKittyOptions>;
      const note = 'Results not shown: the test report was made from a different version of this file.';
      // 'Paying by card' is in the report; 'Applying a discount code' is a different shape: both get the note.
      for (const scenario of ['Paying by card', 'Applying a discount code']) {
        const page = ['# Guide', '', `::gherkin{src="${rel}/features/checkout.feature" scenario="${scenario}"}`, ''].join('\n');
        const out = await render(page, options);
        expect(byClass(out.hast, 'dk-gherkin__status')).toEqual([]);
        expect(byClass(out.hast, 'dk-gherkin__results')).toEqual([]);
        expect(byClass(out.hast, 'dk-gherkin__result').map(text)).toEqual([note]);
      }
      // Control: the same selection against a current report keeps its status and no note.
      const fresh = await render(include(' scenario="Paying by card"'), ON(RESULTS));
      expect(byClass(fresh.hast, 'dk-gherkin__result').map(text)).toEqual(['Result: Passed']);
      expect(fresh.html).not.toContain('Results not shown');
      // The agent Markdown carries the same note, directly after the heading.
      const md = agentMarkdown(['# Guide', '', `::gherkin{src="${rel}/features/checkout.feature" scenario="Paying by card"}`, ''].join('\n'), {
        includeRoots: [`${rel}/features`],
        results: { report: `${rel}/messages.ndjson`, root: rel },
      });
      expect(md).toContain('## Scenario: Paying by card\n\n**Results not shown:** the test report was made from a different version of this file.');
    });
  });
});

// ===========================================================================
// The agent Markdown of an include
// ===========================================================================

describe('the agent Markdown of an include carries the same results', () => {
  const opts: GherkinFenceOptions = { includeRoots: [`${FIX}/features`], results: { report: `${FIX}/messages.ndjson`, root: FIX } };

  it('result lines, the Result column and the summary, as the HTML shows them', () => {
    const md = agentMarkdown(include(), opts);
    expect(md).toContain('*1 rule · 3 scenarios · 2 example rows*\n\n**Results:** 1 failed, 3 passed · as of 2026-10-14 · commit `3f1c2a9`');
    expect(md).toContain('## Scenario: Paying by card\n\nResult: **Passed**');
    expect(md).toContain('## Scenario Outline: Applying a discount code\n\nResult: **Failed** (1 failed, 1 passed)');
    // As in the HTML: the result line, then the tags.
    expect(md).toContain('### Example: Paying with a gift card\n\nResult: **Passed on retry**\n\n`@flaky`');
    expect(md).toContain(['| code | total | Result |', '| --- | --- | --- |', '| SAVE10 | 18.00 | Passed |', '| EXPIRED | 20.00 | Failed |'].join('\n'));
    // Without a report the agent Markdown is what it was.
    expect(agentMarkdown(include(), { includeRoots: [`${FIX}/features`] })).not.toContain('Result');
  });

  it('an unreadable report fails the page, naming the report', () => {
    const bad = path.join(FIX, 'bad.ndjson');
    writeFileSync(bad, '{"meta": {}}\nnot json\n');
    try {
      expect(() => agentMarkdown(include(), { ...opts, results: { report: `${FIX}/bad.ndjson`, root: FIX } })).toThrow(
        `[dk-gherkin] ${FIX}/bad.ndjson:2 is not a Cucumber Messages envelope`,
      );
      expect(listFatal()[0].messages[0]).toMatch(/bad\.ndjson:2 is not a Cucumber Messages envelope .* \(shown on docs\/page\.md\)$/);
    } finally {
      rmSync(bad, { force: true });
    }
  });
});

// ===========================================================================
// A generated feature page
// ===========================================================================

describe('a generated feature page gets its results at render time', () => {
  /** The page as `generate-feature-pages` writes it, stamped with `source`'s hash. */
  function generatedPage(source = CHECKOUT, resource = FEATURE): string {
    const { document } = parseGherkin(CHECKOUT, { display: 'x' });
    const at = `sha256:${createHash('sha256').update(source).digest('hex').slice(0, 12)}`;
    return [
      '---',
      'title: "Checkout"',
      'kind: Specification',
      'doc_status: active',
      'sources:',
      `  - resource: "${resource}"`,
      '    title: "Gherkin source"',
      'generated:',
      '  by: "doc-kitty/gherkin"',
      `  at: "${at}"`,
      '---',
      '',
      renderFeatureBody(document!),
    ].join('\n');
  }
  const GEN = (results: unknown = RESULTS, extra: Record<string, unknown> = {}) =>
    // No `sources`: the codegen hook would write pages into the vitest root. The
    // overlay only needs the page's own frontmatter and the stage.
    ({ gherkin: { results, ...extra } }) as Partial<DocKittyOptions>;

  it('the same result lines, Result column and summary as an include', async () => {
    const out = await render(generatedPage(), GEN(), 'docs/behaviour/checkout.md');
    // Only the rendering changes: the headings (TOC) are the page's own.
    const without = await render(generatedPage(), { gherkin: true }, 'docs/behaviour/checkout.md');
    expect(out.headings).toEqual(without.headings);
    expect(without.html).not.toContain('dk-gherkin__result');
    expect(headingResults(out.hast)).toEqual([
      ['Checkout', ''],
      ['Background', ''],
      ['Scenario: Paying by card', 'Result: Passed'],
      ['Scenario Outline: Applying a discount code', 'Result: Failed (1 failed, 1 passed)'],
      ['Rule: Gift cards cover part of the total', ''],
      ['Example: Paying with a gift card', 'Result: Passed on retry'],
    ]);
    const [examples] = all(out.hast, (n) => n.tagName === 'table');
    expect(elements(all(examples, (n) => n.tagName === 'tr')[2]).map(text)).toEqual(['EXPIRED', '20.00', 'Failed']);
    const summary = byClass(out.hast, 'dk-gherkin__results');
    expect(summary.map(text)).toEqual(['Results: 1 failed, 3 passed · as of 2026-10-14 · commit 3f1c2a9']);
    // Right after the `*4 scenarios · 2 example rows*` line.
    const top = elements(out.hast);
    const at = top.indexOf(summary[0]);
    expect(text(top[at - 1])).toBe('1 rule · 3 scenarios · 2 example rows');
  });

  it('a page out of date with its source shows no results, and warns', async () => {
    const out = await render(generatedPage('an older version\n'), GEN(), 'docs/behaviour/checkout.md');
    expect(out.html).not.toContain('dk-gherkin__status');
    expect(warn.mock.calls.map((c: unknown[]) => String(c[0]))).toContainEqual(
      `[dk-gherkin] docs/behaviour/checkout.md is out of date with ${FEATURE}; it shows no results until it is regenerated`,
    );
  });

  it('with fences: false the stage still adds results to generated pages, and leaves fences and includes alone', async () => {
    const options = GEN(RESULTS, { fences: false });
    const out = await render(generatedPage(), options, 'docs/behaviour/checkout.md');
    expect(byClass(out.hast, 'dk-gherkin__status')).toHaveLength(5);
    // The directive is not claimed (Starlight's restoration, mocked out here,
    // turns it back into text in a real build: gherkin-include.test.ts).
    const guide = await render(include(), options);
    expect(guide.html).not.toContain('dk-gherkin');
  });

  it('the scenario index’s source URL form is understood (sourceUrlPrefix)', async () => {
    const prefix = 'https://github.com/o/r/blob/main/';
    const options = GEN(RESULTS, { sourceUrlPrefix: prefix });
    const out = await render(generatedPage(CHECKOUT, `${prefix}${FEATURE}`), options, 'docs/behaviour/checkout.md');
    expect(byClass(out.hast, 'dk-gherkin__status')).toHaveLength(5);
  });
});

// ===========================================================================
// The config-time check (ADR-0055 decision 9) and the loader's report name
// ===========================================================================

describe('defineDocKittyIntegrations({ gherkin: { results } })', () => {
  /** Run the in-page stage's config hook, returning its warnings and watch files. */
  function setup(results: unknown, config: Record<string, unknown> = {}) {
    const integrations = defineDocKittyIntegrations({
      title: 'Docs',
      gherkin: { includeRoots: [`${FIX}/features`], results },
    } as DocKittyOptions);
    const stage = docKittyIntegrations(integrations).find((i) => i.name === 'doc-kitty:gherkin-fence');
    const warnings: string[] = [];
    const watched: string[] = [];
    const hook = stage?.hooks?.['astro:config:setup'] as (ctx: Record<string, unknown>) => void;
    hook({
      updateConfig: () => {},
      config,
      addWatchFile: (p: string) => watched.push(p),
      logger: { warn: (m: string) => warnings.push(m), info: () => {} },
    });
    return { warnings, watched };
  }
  afterEach(() => {
    delete process.env.DK_GHERKIN_RESULTS;
    delete process.env.DK_GHERKIN_ROUTE;
  });

  it('a readable report: no warning, and it is watched', () => {
    const { warnings, watched } = setup(RESULTS);
    expect(warnings).toEqual([]);
    expect(watched).toEqual([path.resolve(FIX, 'messages.ndjson')]);
  });

  it.each([
    [`${FIX}/none.ndjson`, `[dk-gherkin] gherkin.results report not found: ${FIX}/none.ndjson; scenarios render without results`],
    [{ report: `${FIX}/dry.ndjson`, root: FIX }, `[dk-gherkin] every step in ${FIX}/dry.ndjson is skipped; it looks like a --dry-run, so every scenario shows Skipped`],
  ])('a missing report, or a dry run, is a warning', (results, message) => {
    expect(setup(results).warnings).toEqual([message]);
  });

  const NOT_FOUND = `[dk-gherkin] gherkin.results report not found: ${FIX}/none.ndjson`;
  it.each(['true', '1', 'yes', ' TRUE '])('a missing report with CI=%j fails the build, naming the opt-out', (value) => {
    process.env.CI = value;
    expect(() => setup(`${FIX}/none.ndjson`)).toThrow(
      `${NOT_FOUND} (CI is set; set gherkin.results.required: false to build without results)`,
    );
  });

  it.each(['', ' ', 'false', 'FALSE', '0'])('a missing report with CI=%j only warns (control)', (value) => {
    process.env.CI = value;
    expect(setup(`${FIX}/none.ndjson`).warnings).toEqual([`${NOT_FOUND}; scenarios render without results`]);
  });

  it('required: false keeps a missing report a warning in CI; required: true is the default', () => {
    process.env.CI = 'true';
    expect(setup({ report: `${FIX}/none.ndjson`, root: FIX, required: false }).warnings).toEqual([
      `${NOT_FOUND}; scenarios render without results`,
    ]);
    expect(() => setup({ report: `${FIX}/none.ndjson`, root: FIX, required: true })).toThrow('CI is set');
  });

  it('a present report is unaffected by CI, and an unreadable or empty one throws with CI unset or set', () => {
    for (const value of ['', 'true']) {
      process.env.CI = value;
      expect(setup(RESULTS).warnings).toEqual([]);
      expect(() => setup({ report: `${FIX}/features/checkout.feature`, root: FIX, required: false })).toThrow('is not a Cucumber report');
    }
  });

  it('an unreadable report fails the build at config time', () => {
    expect(() => setup(`${FIX}/features/checkout.feature`)).toThrow(
      `[dk-gherkin] ${FIX}/features/checkout.feature is not a Cucumber report`,
    );
  });

  it('tells the scenario route which file the site mounted itself, and nothing when it mounts none (FR-008)', () => {
    const dir = mkdtempSync(path.join(process.cwd(), 'tests/fixtures/gherkin/results/.tmp-route-'));
    try {
      const rel = path.relative(process.cwd(), dir).split(path.sep).join('/');
      const srcDir = pathToFileURL(`${dir}${path.sep}src${path.sep}`);
      mkdirSync(path.join(dir, 'src', 'pages', 'api'), { recursive: true });
      // Control first: nothing mounted, nothing published (and a stale value is cleared).
      process.env.DK_GHERKIN_ROUTE = 'stale';
      setup(RESULTS, { srcDir });
      expect(process.env.DK_GHERKIN_ROUTE).toBeUndefined();
      writeFileSync(path.join(dir, 'src', 'pages', 'api', 'scenarios.json.ts'), 'export const GET = () => new Response();\n');
      setup(RESULTS, { srcDir });
      expect(process.env.DK_GHERKIN_ROUTE).toBe(`${rel}/src/pages/api/scenarios.json.ts`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('names the report to the docs loader, and clears it when results are off', () => {
    defineDocKittyIntegrations({ title: 'Docs', gherkin: { results: RESULTS } } as DocKittyOptions);
    expect(process.env.DK_GHERKIN_RESULTS).toBe(RESULTS.report);
    defineDocKittyIntegrations({ title: 'Docs', gherkin: true });
    expect(process.env.DK_GHERKIN_RESULTS).toBeUndefined();
  });
});
