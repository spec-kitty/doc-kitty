/**
 * Results on the page (ADR-0052): a `::gherkin` include and a generated feature
 * page rendered through the REAL Markdown chain a docs page takes (the harness
 * of `gherkin-fence.test.ts`: Astro's content-entry renderer, the plugins
 * `defineDocKittyIntegrations` registers, then Starlight's directive parser and
 * Expressive Code), plus the agent Markdown of an include.
 *
 * The project root is the vitest root (`src/`): the include root, the report
 * and the generated page's source are all under
 * `tests/fixtures/gherkin/results/`, whose report URIs (`features/…`) are
 * relative to that directory, i.e. `results.root`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import remarkDirective from 'remark-directive';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import gherkinFence, { type GherkinFenceOptions } from '../lib/remark/gherkin-fence.js';
import { AGENT_INCLUDES_KEY } from '../lib/gherkin/agent-includes.mjs';
import { listFatal, resetFatal } from '../lib/gherkin/errors.mjs';
import { clearIncludeMemo } from '../lib/gherkin/include.mjs';
import { clearReportMemo } from '../lib/gherkin/results-load.mjs';
import { parseGherkin } from '../lib/gherkin/parse.mjs';
import { renderFeatureBody } from '../lib/gherkin/render.mjs';
import { docKittyIntegrations, runSetup } from './helpers/remark-stack.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');
type DocKittyOptions = Parameters<typeof defineDocKittyIntegrations>[0];

const FIX = 'tests/fixtures/gherkin/results';
const FEATURE = `${FIX}/features/checkout.feature`;
const CHECKOUT = readFileSync(FEATURE, 'utf8');

// ---------------------------------------------------------------------------
// The real chain (as in gherkin-fence.test.ts)
// ---------------------------------------------------------------------------

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}
interface Heading {
  depth: number;
  slug: string;
  text: string;
}
interface EntryType {
  getEntryInfo: (o: { contents: string; fileUrl: URL }) => Promise<{ body: string; data: Record<string, unknown> }>;
  getRenderFunction: (config: Record<string, unknown>) => Promise<
    (entry: { id: string; data: Record<string, unknown>; body: string; filePath: string }) => Promise<{
      html: string;
      metadata: { headings: Heading[] };
    }>
  >;
}

const req = createRequire(import.meta.url);
const astroDir = path.dirname(req.resolve('astro/package.json'));
const { markdownContentEntryType } = (await import(
  pathToFileURL(path.join(astroDir, 'dist/vite-plugin-markdown/content-entry-type.js')).href
)) as { markdownContentEntryType: EntryType };
const { markdownConfigDefaults } = (await import(
  createRequire(path.join(astroDir, 'package.json')).resolve('@astrojs/markdown-remark')
)) as { markdownConfigDefaults: Record<string, unknown> };

function docKittyRemark(options: Partial<DocKittyOptions>): { remark: unknown[]; rehype: unknown[] } {
  const stack = { remark: [] as unknown[], rehype: [] as unknown[] };
  for (const entry of docKittyIntegrations(defineDocKittyIntegrations({ title: 'Docs', ...options }))) {
    if (!entry.hooks?.['astro:config:setup']) continue;
    for (const cfg of runSetup(entry)) {
      stack.remark.push(...(cfg.markdown?.remarkPlugins ?? []));
      stack.rehype.push(...(cfg.markdown?.rehypePlugins ?? []));
    }
  }
  return stack;
}

async function render(contents: string, options: Partial<DocKittyOptions>, filePath = 'docs/page.md') {
  const { remark, rehype } = docKittyRemark(options);
  let hast: HastNode = { type: 'root' };
  const capture = () => (tree: HastNode) => {
    hast = structuredClone(tree);
  };
  const absPath = path.resolve(filePath);
  const { body, data } = await markdownContentEntryType.getEntryInfo({ contents, fileUrl: pathToFileURL(absPath) });
  const renderFn = await markdownContentEntryType.getRenderFunction({
    markdown: { ...markdownConfigDefaults, syntaxHighlight: false, remarkPlugins: [...remark, remarkDirective], rehypePlugins: [...rehype, capture] },
  });
  const out = await renderFn({ id: 'page', data, body, filePath: absPath });
  return { html: out.html, headings: out.metadata.headings, hast };
}

const classes = (n: HastNode): string[] => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c.map(String) : [];
};
function all(root: HastNode, match: (n: HastNode) => boolean, out: HastNode[] = []): HastNode[] {
  if (match(root)) out.push(root);
  for (const c of root.children ?? []) all(c, match, out);
  return out;
}
const text = (n: HastNode): string => (n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(text).join(''));
const elements = (n: HastNode) => (n.children ?? []).filter((c) => c.type === 'element');
const byClass = (root: HastNode, cls: string) => all(root, (n) => n.type === 'element' && classes(n).includes(cls));

/** Each heading's text followed by the text of the element right after it, when that is a result line. */
function headingResults(root: HastNode): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (node: HastNode) => {
    const kids = elements(node);
    kids.forEach((k, i) => {
      if (/^h[1-6]$/.test(k.tagName ?? '')) {
        const next = kids[i + 1];
        out.push([text(k), next && classes(next).includes('dk-gherkin__result') ? text(next) : '']);
      }
    });
    for (const k of kids) walk(k);
  };
  walk(root);
  return out;
}

const RESULTS = { report: `${FIX}/messages.ndjson`, root: FIX };
const ON = (results?: unknown): Partial<DocKittyOptions> =>
  ({ gherkin: { includeRoots: [`${FIX}/features`], ...(results ? { results } : {}) } }) as Partial<DocKittyOptions>;
const include = (attrs = '') => ['# Guide', '', `::gherkin{src="${FEATURE}"${attrs}}`, ''].join('\n');

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetFatal();
  clearIncludeMemo();
  clearReportMemo();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
  resetFatal();
});

// ===========================================================================
// An include
// ===========================================================================

describe('an include shows its results (ADR-0052)', () => {
  it('a result line right after each scenario heading; the headings themselves are untouched', async () => {
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
    const plain = await render(include(), ON());
    expect(out.headings).toEqual(plain.headings);
  });

  it('the badge: the status word in a span with data-status, after a visually hidden lead', async () => {
    const out = await render(include(), ON(RESULTS));
    const badges = byClass(out.hast, 'dk-gherkin__status');
    expect(badges.map((b) => [b.properties?.dataStatus, text(b)])).toEqual([
      ['passed', 'Result: Passed'],
      ['failed', 'Result: Failed'],
      ['passed', 'Passed'],
      ['failed', 'Failed'],
      ['passed', 'Result: Passed on retry'],
    ]);
    expect(byClass(out.hast, 'dk-gherkin__sr').map(text)).toEqual(['Result: ', 'Result: ', 'Result: ']);
    expect(out.html).toContain('<span class="dk-gherkin__status" data-status="failed">');
  });

  it('an Examples table gains a Result column, one status per row', async () => {
    const out = await render(include(), ON(RESULTS));
    const [examples] = all(out.hast, (n) => n.tagName === 'table');
    const rows = all(examples, (n) => n.tagName === 'tr').map((tr) => elements(tr).map(text));
    expect(rows).toEqual([
      ['code', 'total', 'Result'],
      ['SAVE10', '18.00', 'Passed'],
      ['EXPIRED', '20.00', 'Failed'],
    ]);
  });

  it('the feature header gains a results summary with the run date and short commit', async () => {
    const out = await render(include(), ON(RESULTS));
    const [summary] = byClass(out.hast, 'dk-gherkin__results');
    expect(text(summary)).toBe('Results: 1 failed, 3 passed · as of 2026-10-14 · commit 3f1c2a9');
    const [time] = all(summary, (n) => n.tagName === 'time');
    expect(time.properties?.dateTime).toBe('2026-10-14T13:30:03.455Z');
  });

  it('nothing else from the report reaches the page', async () => {
    const { html } = await render(include(), ON(RESULTS));
    for (const leak of ['AssertionError', 'steps.js', '/home/runner', 'example-org', '3f1c2a9b7e']) expect(html).not.toContain(leak);
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

  it('a JSON report gives the same page, less the retry and the commit', async () => {
    const out = await render(include(), ON({ report: `${FIX}/cucumber-js.json`, root: FIX }));
    expect(headingResults(out.hast).map(([, r]) => r)).toEqual(['', '', '', 'Result: Passed', 'Result: Failed (1 failed, 1 passed)', '', 'Result: Passed']);
    expect(text(byClass(out.hast, 'dk-gherkin__results')[0])).toBe('Results: 1 failed, 3 passed');
  });

  it('a fence never shows results, even of a file the report covers', async () => {
    const fence = ['# Guide', '', '```gherkin', CHECKOUT, '```', ''].join('\n');
    const out = await render(fence, ON(RESULTS));
    expect(byClass(out.hast, 'dk-gherkin__status')).toEqual([]);
    expect(byClass(out.hast, 'dk-gherkin__results')).toEqual([]);
  });
});

describe('when results are not shown', () => {
  it('without gherkin.results the page is byte-identical to before; with a missing report too', async () => {
    const plain = await render(include(), ON());
    const missing = await render(include(), ON({ report: `${FIX}/none.ndjson`, root: FIX }));
    expect(missing.html).toBe(plain.html);
    expect(plain.html).not.toContain('dk-gherkin__result');
  });

  it('a file the report does not name gets nothing', async () => {
    const out = await render(include(), ON({ report: `${FIX}/messages.ndjson`, root: 'elsewhere' }));
    expect(out.html).not.toContain('dk-gherkin__result');
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
  });
});

// ===========================================================================
// The agent Markdown of an include
// ===========================================================================

describe('the agent Markdown of an include carries the same results', () => {
  function agentMarkdown(markdown: string, options: GherkinFenceOptions): string {
    const processor = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).use(gherkinFence as never, { warn: () => {}, ...options });
    const file = { path: path.resolve('docs/page.md'), value: markdown, data: { astro: { frontmatter: {} as Record<string, unknown> } } };
    processor.runSync(processor.parse(markdown), file as never);
    const records = file.data.astro.frontmatter[AGENT_INCLUDES_KEY] as Array<{ markdown: string }>;
    return records[0].markdown;
  }
  const opts: GherkinFenceOptions = { includeRoots: [`${FIX}/features`], results: { report: `${FIX}/messages.ndjson`, root: FIX } };

  it('result lines, the Result column and the summary, as the HTML shows them', () => {
    const md = agentMarkdown(include(), opts);
    expect(md).toContain('*1 rule · 3 scenarios · 2 example rows*\n\n**Results:** 1 failed, 3 passed · as of 2026-10-14 · commit `3f1c2a9`');
    expect(md).toContain('## Scenario: Paying by card\n\nResult: **Passed**');
    expect(md).toContain('## Scenario Outline: Applying a discount code\n\nResult: **Failed** (1 failed, 1 passed)');
    // As in the HTML: the result line, then the tags.
    expect(md).toContain('### Example: Paying with a gift card\n\nResult: **Passed on retry**\n\n`@flaky`');
    expect(md).toContain(['| code | total | Result |', '| --- | --- | --- |', '| SAVE10 | 18.00 | Passed |', '| EXPIRED | 20.00 | Failed |'].join('\n'));
  });

  it('without a report the agent Markdown is what it was', () => {
    const md = agentMarkdown(include(), { includeRoots: [`${FIX}/features`] });
    expect(md).not.toContain('Result');
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

  it('only the rendering changes: the headings (TOC) are the page’s own', async () => {
    const withResults = await render(generatedPage(), GEN(), 'docs/behaviour/checkout.md');
    const without = await render(generatedPage(), { gherkin: true }, 'docs/behaviour/checkout.md');
    expect(withResults.headings).toEqual(without.headings);
    expect(without.html).not.toContain('dk-gherkin__result');
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
// The config-time check (ADR-0052 decision 9) and the loader's report name
// ===========================================================================

describe('defineDocKittyIntegrations({ gherkin: { results } })', () => {
  /** Run the in-page stage's config hook, returning its warnings and watch files. */
  function setup(results: unknown) {
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
      config: {},
      addWatchFile: (p: string) => watched.push(p),
      logger: { warn: (m: string) => warnings.push(m), info: () => {} },
    });
    return { warnings, watched };
  }
  afterEach(() => {
    delete process.env.DK_GHERKIN_RESULTS;
  });

  it('a readable report: no warning, and it is watched', () => {
    const { warnings, watched } = setup(RESULTS);
    expect(warnings).toEqual([]);
    expect(watched).toEqual([path.resolve(FIX, 'messages.ndjson')]);
  });

  it('a missing report is a warning: a local build has no CI report', () => {
    expect(setup(`${FIX}/none.ndjson`).warnings).toEqual([
      `[dk-gherkin] gherkin.results report not found: ${FIX}/none.ndjson; scenarios render without results`,
    ]);
  });

  it('a dry run is a warning', () => {
    expect(setup({ report: `${FIX}/dry.ndjson`, root: FIX }).warnings).toEqual([
      `[dk-gherkin] every step in ${FIX}/dry.ndjson is skipped; it looks like a --dry-run, so every scenario shows Skipped`,
    ]);
  });

  it('an unreadable report fails the build at config time', () => {
    expect(() => setup(`${FIX}/features/checkout.feature`)).toThrow(
      `[dk-gherkin] ${FIX}/features/checkout.feature is not a Cucumber report`,
    );
  });

  it('a bad option fails at definition time', () => {
    expect(() =>
      defineDocKittyIntegrations({ title: 'Docs', gherkin: { results: '/abs/r.ndjson' } } as DocKittyOptions),
    ).toThrow('[dk-gherkin] gherkin.results must be a report path or { report, root? }');
  });

  it('names the report to the docs loader, and clears it when results are off', () => {
    defineDocKittyIntegrations({ title: 'Docs', gherkin: { results: RESULTS } } as DocKittyOptions);
    expect(process.env.DK_GHERKIN_RESULTS).toBe(RESULTS.report);
    defineDocKittyIntegrations({ title: 'Docs', gherkin: true });
    expect(process.env.DK_GHERKIN_RESULTS).toBeUndefined();
  });
});
