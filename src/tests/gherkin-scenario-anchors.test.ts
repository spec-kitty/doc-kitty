/**
 * Scenario anchors through the REAL Astro Markdown pipeline (ADR-0046, mapping
 * contract §5; final-review finding 1).
 *
 * `scenario-index.test.ts` stubs `render(entry).headings`, so it cannot see what
 * Astro actually does to a heading's `text`. This suite closes that gap: each
 * feature is rendered with the real `renderFeatureBody`, the Markdown is run
 * through Astro's own `createMarkdownProcessor` (from the `@astrojs/markdown-remark`
 * the installed `astro` resolves — the exact pinned build pass) configured like
 * the toolkit (Astro's defaults `gfm: true` + `smartypants: true`, plus the single
 * `remark-directive` owner `config.ts` registers), and the resulting
 * `metadata.headings` are fed to `scenarioRecords`.
 *
 * Two transforms that a stubbed heading list hides:
 *
 *  - `rehypeHeadingIds` (`rehype-collect-headings.js`) does
 *    `text += child.value.replace(/\{/g, "${")` for every non-MDX heading, so
 *    `Scenario: GET /orders/{id}` arrives as `Scenario: GET /orders/${id}`;
 *  - `remark-smartypants` curls quotes (including ``` ``x'' ``` → `“x”`), turns
 *    `--`/`---` into dashes and `...`/`. . .` into `…`.
 *
 * Every scenario must resolve to its OWN heading's id — the oracle is purely
 * positional (the n-th scenario heading at the scenario depth), never a key
 * computed by the code under test.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin';
import { IdGenerator, type GherkinDocument } from '@cucumber/messages';
import remarkDirective from 'remark-directive';
import { renderFeatureBody } from '../lib/gherkin/render.mjs';
import { GENERATED_BY } from '../lib/gherkin/feature-core.mjs';
import gherkinFence from '../lib/remark/gherkin-fence.js';
import type { RenderedHeading } from '../lib/routes/scenario-index.js';

// `scenario-index.ts` imports `astro:content` (unused by the pure
// `scenarioRecords`), which only exists inside an Astro build.
vi.mock('astro:content', () => ({ getCollection: async () => [], render: async () => ({}) }));
const { scenarioRecords } = await import('../lib/routes/scenario-index.js');

type MarkdownProcessor = {
  render: (
    md: string,
    opts?: { frontmatter?: Record<string, unknown> },
  ) => Promise<{ code: string; metadata: { headings: RenderedHeading[] } }>;
};
type MarkdownRemark = {
  createMarkdownProcessor: (opts: Record<string, unknown>) => Promise<MarkdownProcessor>;
  markdownConfigDefaults: Record<string, unknown>;
};

/**
 * Resolve `@astrojs/markdown-remark` off the installed `astro` (it is a
 * transitive dependency under pnpm's strict layout — the same chain
 * `markua-crosslink.test.ts` and `remark-version-pin.test.ts` use), so the
 * processor is the one the build runs.
 */
async function astroMarkdown(): Promise<MarkdownRemark> {
  const req = createRequire(import.meta.url);
  const entry = createRequire(req.resolve('astro/package.json')).resolve('@astrojs/markdown-remark');
  return (await import(entry)) as MarkdownRemark;
}

/**
 * The toolkit's Markdown configuration: Astro defaults + `remark-directive`, and
 * optionally the in-page Gherkin stage (`gherkin` on, ADR-0051) after it.
 */
async function toolkitProcessor({ fences = false } = {}): Promise<MarkdownProcessor> {
  const { createMarkdownProcessor, markdownConfigDefaults } = await astroMarkdown();
  expect(markdownConfigDefaults.gfm).toBe(true);
  expect(markdownConfigDefaults.smartypants).toBe(true);
  return createMarkdownProcessor({
    ...markdownConfigDefaults,
    remarkPlugins: fences ? [remarkDirective, gherkinFence] : [remarkDirective],
  });
}

function parseGherkin(source: string): GherkinDocument {
  return new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher()).parse(
    source,
  );
}

/** Scenario names that the pipeline rewrites (or that the escapers touch). */
const NAMES = [
  'GET /orders/{id}',
  'render {{x}} twice',
  'a template ${name} literal',
  "a ``quoted'' value",
  'a "double" quote',
  "a 'single' quote",
  "it's the shipper's list",
  'wait . . . then go',
  'trailing dots...',
  'an en -- dash',
  'an em --- dash',
  'markup <b>bold</b>',
  'a & b',
  'a `code` span',
  '*emph* and _under_',
  '[x] box',
  'visit www.example.com now',
  'mail bob@example.com',
  // Duplicate-ish pairs: identical after folding, so only document order can
  // tell them apart — each must still land on its OWN heading.
  'Retry -- once',
  'Retry — once',
  'Same name',
  'Same name',
];

function flatFeature(): string {
  return [
    'Feature: Anchors',
    '',
    '  Background:',
    '    Given a site',
    '',
    ...NAMES.flatMap((n) => [`  Scenario: ${n}`, '    Given a step', '']),
  ].join('\n');
}

function ruleFeature(): string {
  return [
    'Feature: Anchors in rules',
    '',
    '  Rule: Everything inside a rule',
    '',
    ...NAMES.flatMap((n, i) =>
      i % 2 === 0
        ? [`    Scenario: ${n}`, '      Given a step', '']
        : [
            `    Scenario Outline: ${n}`,
            '      Given <n> steps',
            '',
            '      Examples:',
            '        | n |',
            '        | 1 |',
            '',
          ],
    ),
  ].join('\n');
}

/** Render `source` and run the body through the toolkit's Astro processor. */
async function pipelineHeadings(source: string) {
  const doc = parseGherkin(source);
  const body = renderFeatureBody(doc, { file: 'anchors.feature' });
  const { metadata } = await (await toolkitProcessor()).render(body);
  return { doc, headings: metadata.headings };
}

async function anchorsThroughPipeline(source: string, depth: number) {
  const { doc, headings } = await pipelineHeadings(source);
  // Positional oracle: the scenario headings, in document order, at the
  // scenario depth (a Background/Rule heading never starts with "Scenario").
  const expected = headings.filter((h) => h.depth === depth && h.text.startsWith('Scenario'));
  expect(expected).toHaveLength(NAMES.length);
  const records = scenarioRecords(doc, headings, { page: 'p/anchors', source: 'anchors.feature' });
  return { records, expected };
}

describe('scenario anchors through the real Astro Markdown pipeline', () => {
  it('the pipeline really does rewrite these headings (non-vacuity)', async () => {
    const { headings } = await pipelineHeadings(flatFeature());
    const texts = headings.map((h) => h.text);
    expect(texts).toContain('Scenario: GET /orders/${id}');
    expect(texts).toContain('Scenario: render ${${x}} twice');
    expect(texts).toContain('Scenario: a “quoted” value');
    expect(texts).toContain('Scenario: wait … then go');
  });

  it.each(NAMES.filter((n, i) => NAMES.indexOf(n) === i))(
    'a lone scenario named %j resolves to its heading id',
    async (name) => {
      const { doc, headings } = await pipelineHeadings(
        `Feature: One\n\n  Scenario: ${name}\n    Given a step\n`,
      );
      const [scenarioHeading] = headings.filter((h) => h.depth === 2);
      const [record] = scenarioRecords(doc, headings, { page: 'p/one', source: 'one.feature' });
      expect(record.anchor).toBe(scenarioHeading.slug);
    },
  );

  it('every scenario outside a rule resolves to its own heading id', async () => {
    const { records, expected } = await anchorsThroughPipeline(flatFeature(), 2);
    expect(records.map((r) => r.name)).toEqual(NAMES);
    expect(records.map((r) => r.anchor)).toEqual(expected.map((h) => h.slug));
    // The duplicate-ish pairs got distinct anchors.
    expect(new Set(records.map((r) => r.anchor)).size).toBe(NAMES.length);
  });

  it('every scenario inside a rule resolves to its own heading id', async () => {
    const { records, expected } = await anchorsThroughPipeline(ruleFeature(), 3);
    expect(records.map((r) => r.anchor)).toEqual(expected.map((h) => h.slug));
    expect(records.every((r) => r.rule === 'Everything inside a rule')).toBe(true);
  });
});

/**
 * LOCK-DOWN (ADR-0051 decision 7; 02 §Generated pages and nested Gherkin): a
 * generated page renders a `gherkin` doc string as a ```` ```gherkin ```` fence.
 * With the in-page stage on, that fence would grow a nested structured scenario
 * whose headings `scenarioRecords` would mistake for the page's own. The stage
 * skips any page stamped `generated.by: doc-kitty/gherkin`, so the page renders
 * byte-identically with the stage on or off, and every anchor still resolves.
 */
describe('generated pages are skipped by the in-page Gherkin stage', () => {
  const NESTED = [
    'Feature: Generated with a nested feature',
    '',
    '  Scenario: Write a feature file',
    '    Given the file:',
    '      """gherkin',
    '      Feature: Nested',
    '        Scenario: Nested scenario',
    '          Given a nested step',
    '      """',
    '',
    '  Scenario: Read it back',
    '    Given a step',
    '',
  ].join('\n');

  it('renders the same HTML and headings with the stage on, and its anchors resolve', async () => {
    const doc = parseGherkin(NESTED);
    const body = renderFeatureBody(doc, { file: 'nested.feature' });
    expect(body).toContain('```gherkin'); // non-vacuity: the page really has a gherkin fence
    const frontmatter = { title: 'Generated', generated: { by: GENERATED_BY, at: 'abc1234' } };
    const off = await (await toolkitProcessor()).render(body, { frontmatter });
    const on = await (await toolkitProcessor({ fences: true })).render(body, { frontmatter });
    expect(on.code).toBe(off.code);
    expect(on.metadata.headings).toEqual(off.metadata.headings);
    expect(on.code).not.toContain('dk-gherkin');
    expect(on.metadata.headings.map((h) => h.text)).not.toContain('Nested');
    const records = scenarioRecords(doc, on.metadata.headings, { page: 'p/nested', source: 'nested.feature' });
    const expected = on.metadata.headings.filter((h) => h.depth === 2 && h.text.startsWith('Scenario'));
    expect(records.map((r) => r.anchor)).toEqual(expected.map((h) => h.slug));
  });

  it('non-vacuity: WITHOUT the generated stamp the same body does grow a nested block', async () => {
    const body = renderFeatureBody(parseGherkin(NESTED), { file: 'nested.feature' });
    const on = await (await toolkitProcessor({ fences: true })).render(body, { frontmatter: { title: 'Authored' } });
    expect(on.code).toContain('<div class="dk-gherkin">');
  });
});
