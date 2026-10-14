/**
 * `/api/pages/<id>.json` expands `::gherkin` includes (ADR-0051; 02 §Agent
 * surface; 05 verification row "Agent payload expands includes; route never
 * imports the parser").
 *
 * The page goes through Astro's OWN Markdown content-entry type
 * (`astro/dist/vite-plugin-markdown/content-entry-type.js`), the code the glob
 * loader calls: `getEntryInfo` makes `entry.body` (frontmatter stripped, then
 * trimmed) and its render function runs the fence stage inside
 * `@astrojs/markdown-remark` and returns `metadata.frontmatter`, which the
 * loader stores as `entry.rendered`. That rendered value is round-tripped
 * through JSON (the data store serialises it) and handed to the REAL route
 * through a mocked `astro:content`. So the test exercises the actual seam the
 * stage writes through and the route reads from, with frontmatter present
 * (body offsets ≠ file offsets).
 *
 * The real-build proof is `gherkin-fence-build.test.ts` (it mounts the route on
 * a fixture site); the import-scan below proves the route stays parser-free.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import remarkDirective from 'remark-directive';
import gherkinFence, { type GherkinFenceOptions } from '../lib/remark/gherkin-fence.js';
import { AGENT_INCLUDES_KEY, readAgentIncludes, spliceAgentIncludes } from '../lib/gherkin/agent-includes.mjs';
import { renderSourceLine } from '../lib/gherkin/render.mjs';
import { runtimeGraph } from './helpers/module-graph.js';

type Entry = { id: string; data: Record<string, unknown>; body?: string; rendered?: unknown };
const { entries } = vi.hoisted(() => ({ entries: [] as Entry[] }));
vi.mock('astro:content', () => ({ getCollection: async () => entries }));

const { agentPageRoute } = await import('../lib/routes/agent-page.js');

// Astro's Markdown content-entry type, from its own file (not in astro's exports map).
const req = createRequire(import.meta.url);
let astroDir = path.dirname(req.resolve('astro'));
while (path.basename(astroDir) !== 'astro') astroDir = path.dirname(astroDir);
const { markdownContentEntryType } = (await import(
  pathToFileURL(path.join(astroDir, 'dist', 'vite-plugin-markdown', 'content-entry-type.js')).href
)) as {
  markdownContentEntryType: {
    getEntryInfo(a: { contents: string; fileUrl: URL }): Promise<{ data: Record<string, unknown>; body: string }>;
    getRenderFunction(config: unknown): Promise<
      (entry: { id: string; data: Record<string, unknown>; body: string; filePath: string }) => Promise<{
        html: string;
        metadata: { frontmatter: Record<string, unknown> };
      }>
    >;
  };
};

const ROOT = fileURLToPath(new URL('./fixtures/gherkin/include/', import.meta.url)).replace(/[\\/]$/, '');
const OPTS: GherkinFenceOptions = { root: ROOT, includeRoots: ['features'], warn: () => {} };
const SITE = new URL('https://docs.example/');

const render = await markdownContentEntryType.getRenderFunction({
  image: {},
  markdown: { syntaxHighlight: false, remarkPlugins: [remarkDirective, [gherkinFence, OPTS]] },
});

/**
 * Load `contents` the way the glob loader does, store it the way the data
 * store does (JSON), then GET its agent payload.
 */
async function load(id: string, contents: string) {
  const filePath = path.join(ROOT, 'docs', `${id}.md`);
  const { data, body } = await markdownContentEntryType.getEntryInfo({ contents, fileUrl: pathToFileURL(filePath) });
  const dataBefore = JSON.stringify(data);
  const rendered = JSON.parse(JSON.stringify(await render({ id, data, body, filePath })));
  // The stage must not write into the loader's `data` (the validated entry's source).
  expect(JSON.stringify(data)).toBe(dataBefore);
  const entry: Entry = { id, data: { ...data, doc_status: 'active' }, body, rendered };
  entries.splice(0, entries.length, entry);
  const payload = await get(entry);
  return { body, rendered, entry, payload };
}

async function get(entry: Entry) {
  const { GET } = agentPageRoute();
  const ctx = { props: { id: entry.id, body: entry.body ?? '' }, site: SITE };
  const res = await (GET as unknown as (c: typeof ctx) => Promise<Response>)(ctx);
  return JSON.parse(await res.text()) as Record<string, unknown> & { markdown: string };
}

const FENCED_DIRECTIVE = ['```markdown', '::gherkin{src="features/shipping.feature" scenario="Refund in full"}', '```'].join(
  '\n',
);

const PAGE = [
  '---',
  'title: Booking guide',
  'description: How booking works, with its scenarios.',
  '---',
  '',
  '# Booking guide',
  '',
  'Intro.',
  '',
  '::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}',
  '',
  'Write an include like this:',
  '',
  FENCED_DIRECTIVE,
  '',
  '## Everything',
  '',
  '::gherkin{src="features/shipping.feature"}',
  '',
  '> ::gherkin{src="features/shipping.feature" tags="@happy"}',
  '',
  'Outro.',
  '',
].join('\n');

describe('the agent payload of a page with includes', () => {
  it('replaces each directive with its scenarios and source line, and lists the includes', async () => {
    const { payload } = await load('guides/booking', PAGE);
    const md = payload.markdown;

    // The selected scenario, at B = 2 (after `# Booking guide`), no feature header.
    expect(md).toContain(
      [
        'Intro.',
        '',
        '## Background',
        '',
        '- **Given** a sailing `"NLRTM to GBFXT"` with free capacity',
        '',
        '## Scenario: Book space on a sailing',
        '',
        '`@smoke`',
        '',
        '- **When** I book a consignment of 2 TEU',
        '- **Then** the booking is confirmed',
        '',
        'From Book a consignment, `features/shipping.feature`',
        '',
        'Write an include like this:',
      ].join('\n'),
    );
    // The whole file under `## Everything`: full header at B = 3, source line last.
    expect(md).toContain('## Everything\n\n### Book a consignment\n\n`@shipping`\n\nAs a shipper\\\n');
    expect(md).toContain('#### Rule: Refunds');
    expect(md).toContain('- **Then** I am refunded in full\n\nSource: `features/shipping.feature`\n\n> ');
    // Inside a blockquote every line of the expansion stays in the quote, and
    // headings are bold lines, as the HTML renders p[role=heading] there.
    const quoted = md.slice(md.indexOf('Source: `features/shipping.feature`\n\n> ') + 37, md.indexOf('\n\nOutro.'));
    expect(quoted).toContain('> **Scenario Outline: Book &lt;n&gt; boxes**');
    expect(quoted).not.toMatch(/^> #/m);
    for (const line of quoted.split('\n')) expect(line).toMatch(/^>( |$)/);

    // No directive left as a line of its own; the one shown in a fence is intact.
    expect(md.split('\n').filter((l) => /^(> )?::gherkin/.test(l))).toEqual([
      '::gherkin{src="features/shipping.feature" scenario="Refund in full"}',
    ]);
    expect(md).toContain(FENCED_DIRECTIVE);

    expect(payload.includes).toEqual([
      { src: 'features/shipping.feature', scenario: 'Book space on a sailing' },
      { src: 'features/shipping.feature' },
      { src: 'features/shipping.feature', tags: '@happy' },
    ]);
    // Next to slice C's `sources`, before the body.
    const keys = Object.keys(payload);
    expect(keys.indexOf('includes')).toBe(keys.indexOf('markdown') - 1);
  });

  it('records body offsets: each span is exactly its directive, with frontmatter above it', async () => {
    const { body, rendered } = await load('guides/booking', PAGE);
    const records = readAgentIncludes((rendered as { metadata: { frontmatter: unknown } }).metadata.frontmatter);
    expect(records.map((r) => body.slice(r.start, r.end))).toEqual([
      '::gherkin{src="features/shipping.feature" scenario="Book space on a sailing"}',
      '::gherkin{src="features/shipping.feature"}',
      '::gherkin{src="features/shipping.feature" tags="@happy"}',
    ]);
    // The file offsets differ (the frontmatter is not in the body).
    expect(PAGE.indexOf(records[0].markdown)).toBe(-1);
    expect(PAGE.indexOf('::gherkin')).not.toBe(records[0].start);
  });

  it('lists the same tags as the HTML, in the same places, with no @dk:* in either', async () => {
    const contents = ['---', 'title: Billing', '---', '', '# Billing', '', '::gherkin{src="features/metadata.feature"}', ''].join('\n');
    const { payload, rendered } = await load('guides/billing', contents);
    const html = (rendered as { html: string }).html;
    // HTML: each p.dk-gherkin__tags, in document order.
    const htmlTags = [...html.matchAll(/<p class="dk-gherkin__tags">(.*?)<\/p>/g)].map((m) =>
      [...m[1].matchAll(/<code>(.*?)<\/code>/g)].map((c) => c[1]),
    );
    // Agent Markdown: each line's tag code spans, in document order.
    const mdTags = payload.markdown
      .split('\n')
      .map((line) => [...line.matchAll(/`(@[^`]*)`/g)].map((c) => c[1]))
      .filter((t) => t.length > 0);
    expect(htmlTags).toEqual([['@billing'], ['@smoke'], ['@nightly'], ['@edge']]);
    expect(mdTags).toEqual(htmlTags);
    // And in the same place: right after the heading they belong to.
    expect(payload.markdown).toContain('## Invoice a consignment\n\n`@billing`\n\nInvoices follow departure.');
    expect(payload.markdown).toContain('### Scenario: Invoice on departure\n\n`@smoke`\n\n- **Given**');
    expect(payload.markdown).toContain('### Rule: Credit notes\n\n`@nightly`\n\n');
  });

  it('keeps the records out of the validated data', async () => {
    const { entry, rendered } = await load('guides/booking', PAGE);
    expect(entry.data).not.toHaveProperty(AGENT_INCLUDES_KEY);
    expect((rendered as { metadata: { frontmatter: object } }).metadata.frontmatter).toHaveProperty(AGENT_INCLUDES_KEY);
  });
});

describe('a page without includes', () => {
  const PLAIN = [
    '---',
    'title: Plain',
    'description: No includes here.',
    '---',
    '',
    '# Plain',
    '',
    FENCED_DIRECTIVE,
    '',
    '```gherkin',
    'Scenario: A fence, not an include',
    '  Given a step',
    '```',
    '',
  ].join('\n');

  it('gets no key in its rendered frontmatter and an unchanged payload', async () => {
    const { body, rendered, entry, payload } = await load('guides/plain', PLAIN);
    expect((rendered as { metadata: { frontmatter: object } }).metadata.frontmatter).not.toHaveProperty(
      AGENT_INCLUDES_KEY,
    );
    expect(payload.markdown).toBe(body);
    expect(payload).not.toHaveProperty('includes');
    // Byte-identical to the payload of the same entry with no render at all.
    const bare = await get({ ...entry, rendered: undefined });
    expect(JSON.stringify(payload)).toBe(JSON.stringify(bare));
  });
});

describe('spliceAgentIncludes', () => {
  const rec = (start: number, end: number, markdown = 'X') => ({ start, end, src: 'a.feature', markdown });

  it('skips a record whose span is not a directive in this body (stale), out of range or overlapping', () => {
    const body = 'a\n::gherkin{src="a.feature"}\nb';
    const span = [2, 2 + '::gherkin{src="a.feature"}'.length] as const;
    expect(spliceAgentIncludes(body, [rec(0, 5)]).markdown).toBe(body);
    expect(spliceAgentIncludes(body, [rec(2, body.length + 1)]).markdown).toBe(body);
    expect(spliceAgentIncludes(body, [rec(...span), rec(span[0], span[1] - 1)])).toEqual({
      markdown: 'a\nX\nb',
      includes: [{ src: 'a.feature' }],
    });
  });

  it('splices in reverse, so several records on one body all land', () => {
    const body = '::gherkin{src="a"}\n\n::gherkin{src="b"}\n';
    expect(spliceAgentIncludes(body, [rec(20, 38, 'B1\nB2'), rec(0, 18, 'A')]).markdown).toBe('A\n\nB1\nB2\n');
  });

  it('indents continuation lines to a list item content column', () => {
    const body = '- item\n\n  1. ::gherkin{src="a"}\n';
    const start = body.indexOf('::');
    expect(spliceAgentIncludes(body, [rec(start, start + 18, '## S\n\n- step')]).markdown).toBe(
      '- item\n\n  1. ## S\n\n     - step\n',
    );
  });

  it('reads only well-formed records', () => {
    expect(readAgentIncludes(undefined)).toEqual([]);
    expect(readAgentIncludes({ [AGENT_INCLUDES_KEY]: 'x' })).toEqual([]);
    expect(
      readAgentIncludes({ [AGENT_INCLUDES_KEY]: [{ start: 0, end: 1, src: 'a', markdown: 'm', tags: '@t' }, { start: 'x' }] }),
    ).toEqual([{ start: 0, end: 1, src: 'a', tags: '@t', markdown: 'm' }]);
  });
});

describe('renderSourceLine', () => {
  it('matches the HTML source line text, escaping the title and linking the path', () => {
    expect(renderSourceLine({ path: 'f/a.feature', featureTitle: 'T', selected: false })).toBe('Source: `f/a.feature`');
    expect(renderSourceLine({ path: 'f/a.feature', featureTitle: '*T*', selected: true })).toBe(
      'From \\*T\\*, `f/a.feature`',
    );
    expect(
      renderSourceLine({ path: 'f/a b.feature', href: 'https://x/f/a b.feature', featureTitle: 'T', selected: false }),
    ).toBe('Source: [`f/a b.feature`](<https://x/f/a b.feature>)');
  });
});

describe('agent-page.ts module graph', () => {
  it('reaches the include splicer but never the Gherkin parser or the fence stage', () => {
    const route = fileURLToPath(new URL('../lib/routes/agent-page.ts', import.meta.url));
    const { files, packages } = runtimeGraph(route);
    const rel = [...files].map((f) => path.relative(path.dirname(route), f).split(path.sep).join('/'));
    // Non-vacuity: the walk reached the splicer.
    expect(rel).toContain('../gherkin/agent-includes.mjs');
    expect(rel).not.toContain('../remark/gherkin-fence.ts');
    expect(rel.filter((f) => f.startsWith('../gherkin/'))).toEqual(['../gherkin/agent-includes.mjs']);
    expect([...packages].filter((p) => p.startsWith('@cucumber/'))).toEqual([]);
  });
});
