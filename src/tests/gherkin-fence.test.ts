/**
 * The in-page Gherkin stage (ADR-0051; rendering contract 03 §1, §3, §4, §5),
 * through the REAL Markdown chain a docs page takes.
 *
 * Pages are rendered by Astro's own content-entry renderer for `.md`
 * (`astro/dist/vite-plugin-markdown/content-entry-type.js`, resolved off the
 * installed `astro`): `getEntryInfo` splits the frontmatter and TRIMS the body
 * exactly as the content-layer `glob()` loader does, and `getRenderFunction`
 * builds `createMarkdownProcessor` (remark-parse → gfm → smartypants → the
 * plugins → remark-rehype → … → rehypeHeadingIds → rehype-raw). The remark and
 * rehype plugins are the ones `defineDocKittyIntegrations` registers (every
 * `doc-kitty:` integration's `astro:config:setup`, in array order), followed by
 * what Starlight adds after them on every site: `remark-directive` and Expressive
 * Code (`rehype-expressive-code`, resolved through `@astrojs/starlight` →
 * `astro-expressive-code`, with Astro's own highlighter off, as Starlight sets
 * it). So "no `<pre>` ancestor" and "one Expressive Code block per doc string"
 * are checked against the code that runs in a build, not a hand-built tree.
 *
 * The real-build exit code (Astro's loader swallows the stage's throw) is proven
 * separately in `gherkin-fence-build.test.ts` (build project).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import remarkDirective from 'remark-directive';
import gherkinFence from '../lib/remark/gherkin-fence.js';
import { drainFatal, formatFatal, listFatal, recordFatal, resetFatal } from '../lib/gherkin/errors.mjs';
import { docKittyIntegrations, runSetup } from './helpers/remark-stack.js';

// Keep the glossary seam out (no `.contextive` probe of the runner's cwd), as
// the other config-level suites do; Starlight's factory only has to return an
// object (its own plugins are added explicitly below).
vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({ name: '@astrojs/starlight', __starlightConfig: config, hooks: {} }),
}));
vi.mock('../lib/glossary/load.js', () => ({
  isGlossaryActive: vi.fn(() => false),
  loadGlossary: vi.fn(() => ({ present: false })),
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');

type DocKittyOptions = Parameters<typeof defineDocKittyIntegrations>[0];

// ---------------------------------------------------------------------------
// The real chain
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

interface Rendered {
  html: string;
  headings: Heading[];
  /** The hast tree after every rehype plugin the page gets (Expressive Code included). */
  hast: HastNode;
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

async function astroModules() {
  const { markdownContentEntryType } = (await import(
    pathToFileURL(path.join(astroDir, 'dist/vite-plugin-markdown/content-entry-type.js')).href
  )) as { markdownContentEntryType: EntryType };
  const remarkEntry = createRequire(path.join(astroDir, 'package.json')).resolve('@astrojs/markdown-remark');
  const { markdownConfigDefaults } = (await import(remarkEntry)) as { markdownConfigDefaults: Record<string, unknown> };
  // Starlight → astro-expressive-code → rehype-expressive-code (the build's own copy).
  const fromStarlight = createRequire(req.resolve('@astrojs/starlight'));
  const fromAec = createRequire(fromStarlight.resolve('astro-expressive-code'));
  const { default: rehypeExpressiveCode } = (await import(fromAec.resolve('rehype-expressive-code'))) as {
    default: unknown;
  };
  return { markdownContentEntryType, markdownConfigDefaults, rehypeExpressiveCode };
}
const astro = await astroModules();

interface DocKittyMarkdown {
  remark: unknown[];
  rehype: unknown[];
  /** The `doc-kitty:` integration names, in array order. */
  names: string[];
}
const stacks = new Map<string, DocKittyMarkdown>();

/**
 * The markdown plugins the doc-kitty integrations register for `options`, in
 * order (memoised per option set: building the array logs the drafts notice).
 */
function docKittyMarkdown(options: Partial<DocKittyOptions>): DocKittyMarkdown {
  const key = JSON.stringify(options);
  const cached = stacks.get(key);
  if (cached) return cached;
  const stack: DocKittyMarkdown = { remark: [], rehype: [], names: [] };
  for (const entry of docKittyIntegrations(defineDocKittyIntegrations({ title: 'Docs', ...options }))) {
    stack.names.push(entry.name);
    if (!entry.hooks?.['astro:config:setup']) continue;
    for (const cfg of runSetup(entry)) {
      stack.remark.push(...(cfg.markdown?.remarkPlugins ?? []));
      stack.rehype.push(...(cfg.markdown?.rehypePlugins ?? []));
    }
  }
  stacks.set(key, stack);
  return stack;
}

/** Render one `.md` file through the content-layer renderer with `options`' stack. */
async function render(contents: string, options: Partial<DocKittyOptions>, filePath = 'docs/page.md'): Promise<Rendered> {
  const { remark, rehype } = docKittyMarkdown(options);
  let hast: HastNode = { type: 'root' };
  const capture = () => (tree: HastNode) => {
    hast = structuredClone(tree);
  };
  const absPath = path.resolve(filePath);
  const { body, data } = await astro.markdownContentEntryType.getEntryInfo({
    contents,
    fileUrl: pathToFileURL(absPath),
  });
  const renderFn = await astro.markdownContentEntryType.getRenderFunction({
    markdown: {
      ...astro.markdownConfigDefaults,
      // Starlight turns Astro's highlighter off and highlights with Expressive Code.
      syntaxHighlight: false,
      // Starlight appends `remark-directive` after every integration's plugins.
      remarkPlugins: [...remark, remarkDirective],
      rehypePlugins: [astro.rehypeExpressiveCode, ...rehype, capture],
    },
  });
  const out = await renderFn({ id: 'page', data, body, filePath: absPath });
  return { html: out.html, headings: out.metadata.headings, hast };
}

const ON: Partial<DocKittyOptions> = { gherkin: true };

// ---------------------------------------------------------------------------
// hast helpers
// ---------------------------------------------------------------------------

const classes = (n: HastNode): string[] => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(/\s+/) : [];
};
const isEl = (tag: string, cls?: string) => (n: HastNode) =>
  n.type === 'element' && n.tagName === tag && (cls === undefined || classes(n).includes(cls));

/** Every node matching `match`, with its ancestors. */
function findAll(root: HastNode, match: (n: HastNode) => boolean): Array<{ node: HastNode; ancestors: HastNode[] }> {
  const out: Array<{ node: HastNode; ancestors: HastNode[] }> = [];
  const walk = (node: HastNode, ancestors: HastNode[]) => {
    if (match(node)) out.push({ node, ancestors });
    for (const c of node.children ?? []) walk(c, [...ancestors, node]);
  };
  walk(root, []);
  return out;
}
const within = (root: HastNode, match: (n: HastNode) => boolean) => findAll(root, match).map((m) => m.node);
const textOf = (n: HastNode): string =>
  n.type === 'text' ? (n.value ?? '') : (n.children ?? []).map(textOf).join('');

const blocks = (r: Rendered) => findAll(r.hast, isEl('div', 'dk-gherkin'));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURE_FENCE = [
  '```gherkin',
  'Feature: Book a consignment',
  '  As a shipper',
  '  I want to book space',
  '',
  '  Scenario: Book space on a sailing',
  '    Given a sailing "NLRTM to GBFXT" with free capacity',
  '    And these containers:',
  '      | size | count |',
  '      | 20ft | 2     |',
  '    When I book with the payload:',
  '      """json',
  '      {"teu": "2"}',
  '      """',
  '    Then the booking is confirmed',
  '',
  '  Scenario: Cancel a booking',
  '    Given a booking',
  '    When I cancel it with the note:',
  '      """',
  '      "no longer needed"',
  '      """',
  '    Then the space is released',
  '```',
].join('\n');

const page = (...parts: string[]) => ['---', 'title: Guide', '---', '', ...parts, ''].join('\n');

beforeEach(() => resetFatal());
afterEach(() => resetFatal());

// ===========================================================================
// Off ⇒ byte-identical
// ===========================================================================

describe('preset off: a gherkin fence renders exactly as before', () => {
  // The doc-kitty integration names with no gherkin option: the in-page stage
  // must not appear, and `{ fences: false }` must give the SAME list (the
  // `PINNED_BOTH_OFF_BASELINE` pattern of `markua-attributes.test.ts`).
  const PINNED_OFF_BASELINE = [
    'doc-kitty:draft-publication',
    'doc-kitty:route-shaping',
    'doc-kitty:toc-rail',
    'doc-kitty:deck-split',
    'doc-kitty:base-absolute-links',
    'doc-kitty:sitemap-order',
    'doc-kitty:manifest',
    'doc-kitty:favicon',
  ];

  it('registers no fence stage when the preset is absent or `fences: false`', () => {
    expect(docKittyMarkdown({}).names).toEqual(PINNED_OFF_BASELINE);
    expect(docKittyMarkdown({ gherkin: { fences: false } }).names).toEqual(PINNED_OFF_BASELINE);
    expect(docKittyMarkdown({}).remark).toEqual(docKittyMarkdown({ gherkin: { fences: false } }).remark);
  });

  it('absent and `fences: false` render the same HTML: a plain code block', async () => {
    const md = page('# Guide', '', FEATURE_FENCE);
    const absent = await render(md, {});
    const fencesOff = await render(md, { gherkin: { fences: false } });
    expect(fencesOff.html).toBe(absent.html);
    expect(absent.html).not.toContain('dk-gherkin');
    expect(blocks(absent)).toHaveLength(0);
    // The fence is ONE Expressive Code block holding the source verbatim.
    expect(within(absent.hast, isEl('div', 'expressive-code'))).toHaveLength(1);
    expect(absent.headings.map((h) => h.text)).toEqual(['Guide']);
  });
});

// ===========================================================================
// On: structure through the real chain
// ===========================================================================

describe('preset on: a gherkin fence renders as a structured scenario', () => {
  it('replaces the fence with div.dk-gherkin, which has NO pre ancestor', async () => {
    const r = await render(page('# Guide', '', FEATURE_FENCE), ON);
    const found = blocks(r);
    expect(found).toHaveLength(1);
    expect(found[0].ancestors.some((a) => a.tagName === 'pre')).toBe(false);
    // …and is not itself inside an Expressive Code frame.
    expect(found[0].ancestors.some((a) => classes(a).includes('expressive-code'))).toBe(false);
  });

  it('holds h2/h3 headings, ul > li > strong.dk-gherkin__kw steps and a table', async () => {
    const r = await render(page('# Guide', '', FEATURE_FENCE), ON);
    const [{ node: block }] = blocks(r);
    expect(within(block, isEl('h2')).map(textOf)).toEqual(['Book a consignment']);
    expect(within(block, isEl('h3')).map(textOf)).toEqual(['Scenario: Book space on a sailing', 'Scenario: Cancel a booking']);
    const lists = within(block, isEl('ul', 'dk-gherkin__steps'));
    expect(lists).toHaveLength(2);
    const keywords = lists.flatMap((ul) =>
      (ul.children ?? []).filter(isEl('li')).map((li) => within(li, isEl('strong', 'dk-gherkin__kw')).map(textOf)[0]),
    );
    expect(keywords).toEqual(['Given', 'And', 'When', 'Then', 'Given', 'When', 'Then']);
    const table = within(block, isEl('table'));
    expect(table).toHaveLength(1);
    expect(within(table[0], isEl('th')).map(textOf)).toEqual(['size', 'count']);
  });

  it('renders the example site\'s init.feature, pasted into a fence, in full and without its comments', async () => {
    // The motivating file of #120 (example/scenarios/init/init.feature), as an
    // author would paste it: comments, narrative, two long scenarios.
    const feature = readFileSync(new URL('../../example/scenarios/init/init.feature', import.meta.url), 'utf8');
    const r = await render(page('# Guide', '', '```gherkin', feature.trimEnd(), '```'), ON);
    const [{ node: block }] = blocks(r);
    expect(within(block, isEl('h2')).map(textOf)).toEqual(['Set up Spec Kitty in a repository']);
    const [narrative] = within(block, isEl('p'));
    expect(textOf(narrative)).toBe(
      [
        'As a developer adopting Spec Kitty',
        'I want spec-kitty init to set up my project without touching my git history',
        'So that I can add Spec Kitty to a new or existing repository, and re-run it to repair a damaged setup',
      ].join('\n'),
    );
    expect(within(block, isEl('h3')).map(textOf)).toEqual([
      'Scenario: Re-running init repairs a missing agent skill folder and keeps the rest of the project as it was',
      'Scenario: Setting up a new project inside an existing repository leaves its git history alone',
    ]);
    // Every step is a list item, its text exactly as written (quoted arguments
    // are code, so smartypants leaves `--non-interactive` and the quotes alone).
    const steps = feature
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(Given|When|Then|And|But) /.test(l));
    expect(steps).toHaveLength(19);
    expect(within(block, isEl('li')).map(textOf)).toEqual(steps);
    expect(r.html).not.toContain('Maintainer notes');
    expect(r.html).not.toContain('Copied verbatim');
  });

  it('renders exactly one Expressive Code block per doc string, content verbatim', async () => {
    const r = await render(page('# Guide', '', FEATURE_FENCE), ON);
    const [{ node: block }] = blocks(r);
    const frames = within(block, isEl('div', 'expressive-code'));
    expect(frames).toHaveLength(2);
    // Code is never curled: the doc strings keep their straight quotes.
    expect(textOf(frames[0])).toContain('{"teu": "2"}');
    expect(textOf(frames[1])).toContain('"no longer needed"');
  });

  it('keeps a quoted step argument verbatim in <code> while smartypants still runs on the prose', async () => {
    const r = await render(
      page('# Guide', '', '```gherkin', 'Scenario: S', '  When I run "spec-kitty init --force" -- it\'s quick', '```'),
      ON,
    );
    const [{ node: block }] = blocks(r);
    const [step] = within(block, isEl('li'));
    expect(within(step, isEl('code')).map(textOf)).toEqual(['"spec-kitty init --force"']);
    // Outside the argument, typography applies as on the rest of the page.
    expect(textOf(step)).toBe('When I run "spec-kitty init --force" — it’s quick');
  });

  it('keeps a quoted argument in a data-table or Examples cell verbatim in <code>', async () => {
    const r = await render(
      page(
        '# Guide',
        '',
        '```gherkin',
        'Scenario Outline: S',
        '  When I run <cmd> with:',
        '    | flag      | note             |',
        '    | "--force" | say "a\\|b" -- now |',
        '  Examples:',
        '    | cmd           |',
        '    | "init --dry-run" |',
        '```',
      ),
      ON,
    );
    const [{ node: block }] = blocks(r);
    const cells = within(block, isEl('td'));
    expect(cells.map((c) => within(c, isEl('code')).map(textOf))).toEqual([['"--force"'], ['"a|b"'], ['"init --dry-run"']]);
    // Outside the argument, typography applies as on the rest of the page.
    expect(textOf(cells[1])).toBe('say "a|b" — now');
  });

  it('puts the embedded headings in the TOC (file.data headings)', async () => {
    const r = await render(page('# Guide', '', FEATURE_FENCE), ON);
    expect(r.headings.map((h) => [h.depth, h.text])).toEqual([
      [1, 'Guide'],
      [2, 'Book a consignment'],
      [3, 'Scenario: Book space on a sailing'],
      [3, 'Scenario: Cancel a booking'],
    ]);
  });

  it('gives two identical fences slugger-unique heading ids', async () => {
    const r = await render(page('# Guide', '', FEATURE_FENCE, '', 'Again:', '', FEATURE_FENCE), ON);
    expect(blocks(r)).toHaveLength(2);
    const slugs = r.headings.map((h) => h.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain('book-a-consignment');
    expect(slugs).toContain('book-a-consignment-1');
    // The ids in the HTML are the TOC's (none preset by the stage).
    for (const slug of slugs) expect(r.html).toContain(`id="${slug}"`);
  });

  it('outlines under the nearest preceding root heading (B = d + 1, capped at 6)', async () => {
    const r = await render(page('# Guide', '', '### Deep', '', FEATURE_FENCE), ON);
    const [{ node: block }] = blocks(r);
    expect(within(block, isEl('h4')).map(textOf)).toEqual(['Book a consignment']);
    expect(within(block, isEl('h5'))).toHaveLength(2);
    const capped = await render(page('# Guide', '', '###### Deepest', '', FEATURE_FENCE), ON);
    const [{ node: cappedBlock }] = blocks(capped);
    expect(within(cappedBlock, isEl('h6')).map(textOf)).toEqual([
      'Book a consignment',
      'Scenario: Book space on a sailing',
      'Scenario: Cancel a booking',
    ]);
  });

  it('renders a steps-only fragment with no synthetic headings', async () => {
    const r = await render(page('# Guide', '', '```gherkin', 'Given a step', 'Then it "works"', '```'), ON);
    const [{ node: block }] = blocks(r);
    expect(within(block, (n) => n.type === 'element' && /^h[1-6]$/.test(n.tagName ?? ''))).toHaveLength(0);
    expect(within(block, isEl('li')).map(textOf)).toEqual(['Given a step', 'Then it "works"']);
    expect(r.headings.map((h) => h.text)).toEqual(['Guide']);
  });

  it('leaves an empty or comment-only fence a code block (no error)', async () => {
    const r = await render(page('# Guide', '', '```gherkin', '# just a comment', '```', '', '```gherkin', '```'), ON);
    expect(blocks(r)).toHaveLength(0);
    expect(within(r.hast, isEl('div', 'expressive-code'))).toHaveLength(2);
    expect(listFatal()).toEqual([]);
  });
});

// ===========================================================================
// Containers: p[role=heading], kept out of the TOC
// ===========================================================================

describe('a fence inside a container', () => {
  const indented = (prefix: string, first = prefix) =>
    FEATURE_FENCE.split('\n').map((l, i) => (i === 0 ? first : prefix) + l);

  it.each([
    ['a list item', ['- Item:', '', ...indented('  ')]],
    ['a blockquote', ['> Quote:', '>', ...indented('> ')]],
    ['an aside', [':::note', ...FEATURE_FENCE.split('\n'), ':::']],
  ])('inside %s emits p[role=heading] and adds no TOC entry', async (_label, lines) => {
    const r = await render(page('# Guide', '', ...lines), ON);
    const found = blocks(r);
    expect(found).toHaveLength(1);
    const [{ node: block }] = found;
    expect(within(block, (n) => n.type === 'element' && /^h[1-6]$/.test(n.tagName ?? ''))).toHaveLength(0);
    const roleHeadings = within(block, (n) => isEl('p')(n) && n.properties?.role === 'heading');
    expect(roleHeadings.map((p) => [textOf(p), p.properties?.ariaLevel])).toEqual([
      ['Book a consignment', 2],
      ['Scenario: Book space on a sailing', 3],
      ['Scenario: Cancel a booking', 3],
    ]);
    expect(r.headings.map((h) => h.text)).toEqual(['Guide']);
  });
});

// ===========================================================================
// Skips: raw, generated pages, decks
// ===========================================================================

describe('fences and pages the stage leaves alone', () => {
  it('a `raw` fence stays a code block', async () => {
    const raw = FEATURE_FENCE.replace('```gherkin', '```gherkin raw');
    const md = page('# Guide', '', raw);
    const on = await render(md, ON);
    expect(on.html).toBe((await render(md, {})).html);
    expect(blocks(on)).toHaveLength(0);
  });

  it('a generated feature page is unchanged (its doc strings stay code)', async () => {
    const md = [
      '---',
      'title: Generated',
      'generated:',
      '  by: doc-kitty/gherkin',
      '  at: abc123',
      '---',
      '',
      '# Generated',
      '',
      FEATURE_FENCE,
      '',
    ].join('\n');
    const on = await render(md, ON);
    expect(on.html).toBe((await render(md, {})).html);
    expect(blocks(on)).toHaveLength(0);

    // An include on a generated page is skipped too; the same include on an authored page is processed.
    const rel = path.relative(process.cwd(), path.join(import.meta.dirname, 'fixtures/gherkin/include')).split(path.sep).join('/');
    const include = `::gherkin{src="${rel}/features/shipping.feature"}`;
    const withRoots: Partial<DocKittyOptions> = { gherkin: { includeRoots: [`${rel}/features`] } };
    const generatedMd = md.replace(FEATURE_FENCE, include);
    expect(blocks(await render(generatedMd, withRoots))).toHaveLength(0);
    expect(blocks(await render(generatedMd.replace(/generated:\n {2}by: .*\n {2}at: .*\n/, ''), withRoots)).length).toBeGreaterThan(0);
  });

  it('a deck page is unchanged (fences on a slide stay code)', async () => {
    const md = ['---', 'title: Deck', 'kind: Presentation', '---', '', '## Slide', '', FEATURE_FENCE, ''].join('\n');
    const on = await render(md, ON);
    expect(on.html).toBe((await render(md, {})).html);
    expect(blocks(on)).toHaveLength(0);
  });
});

// ===========================================================================
// Errors and warnings
// ===========================================================================

describe('errors are fatal at the page line; warnings name the page line', () => {
  let dir: string;
  let quiet: { mockRestore: () => void };
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'dk-gherkin-fence-'));
    // Astro's processor `console.error`s a render error before rethrowing it.
    quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    quiet.mockRestore();
    rmSync(dir, { recursive: true, force: true });
  });

  /** Write `contents` to `<dir>/page.md` (the stage reads it back to map body
   * lines to file lines) and render it with the file's absolute path. */
  async function renderFile(contents: string) {
    const file = path.join(dir, 'page.md');
    writeFileSync(file, contents);
    return render(contents, ON, file);
  }
  const display = () => path.relative(process.cwd(), path.join(dir, 'page.md')).split(path.sep).join('/');

  // Lines: 1 `---`, 2 title, 3 `---`, 4-5 blank (Astro trims them off the body),
  // 6 `# Guide`, 7 blank, 8 fence, 9 Feature, 10 Scenario, 11 step, 12 `| a |`,
  // 13 the row with the wrong cell count; the list's fence opens at 18 and its
  // bad row is line 23, indented two more columns.
  const BROKEN = [
    '---',
    'title: Guide',
    '---',
    '',
    '',
    '# Guide',
    '',
    '```gherkin',
    'Feature: Broken',
    '  Scenario: One',
    '    Given a step',
    '      | a |',
    '      | b | c |',
    '```',
    '',
    '- In a list:',
    '',
    '  ```gherkin',
    '  Feature: Also broken',
    '    Scenario: Two',
    '      Given a step',
    '        | a |',
    '        | b | c |',
    '  ```',
    '',
  ].join('\n');

  it('throws ONE error naming every broken fence at <page>:<abs line>:<col>, in source order', async () => {
    const err = await renderFile(BROKEN).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(err).toBeInstanceOf(Error);
    const lines = err!.message.split('\n').filter((l) => l.startsWith('[dk-gherkin]'));
    expect(lines).toEqual([
      `[dk-gherkin] ${display()}:13:7 inconsistent cell count within the table`,
      `[dk-gherkin] ${display()}:23:9 inconsistent cell count within the table`,
    ]);
  });

  it('records the page in the error sink before throwing, and clears it on a clean render', async () => {
    await renderFile(BROKEN).catch(() => {});
    expect(listFatal()).toEqual([
      {
        page: display(),
        messages: [
          `[dk-gherkin] ${display()}:13:7 inconsistent cell count within the table`,
          `[dk-gherkin] ${display()}:23:9 inconsistent cell count within the table`,
        ],
      },
    ]);
    await renderFile(page('# Guide', '', FEATURE_FENCE));
    expect(listFatal()).toEqual([]);
  });

  it('warns once per block about @dk:* metadata tags, at the fence line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await renderFile(
        page('# Guide', '', '```gherkin', '@dk:status=draft', 'Feature: Tagged', '  @dk:x=y', '  Scenario: S', '    Given a step', '```'),
      );
      const dk = warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('metadata tags'));
      // Fence opening line: 1 `---`, 2 title, 3 `---`, 4 blank, 5 `# Guide`, 6 blank, 7 fence.
      expect(dk).toEqual([`[dk-gherkin] ${display()}:7 metadata tags have no effect in an embedded feature`]);
    } finally {
      warn.mockRestore();
    }
  });

  it.each([
    ['prose', ['Book a sailing first.']],
    ['a bare table', ['| sku | qty |', '| A-1 | 2   |']],
    ['Examples: and a table', ['Examples:', '  | n |', '  | 1 |']],
  ])('a fence that holds only %s is fatal (it would render as nothing), naming `gherkin raw`', async (_label, body) => {
    const err = await renderFile(page('# Guide', '', '```gherkin', ...body, '```')).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    // Fence opening line: 1 `---`, 2 title, 3 `---`, 4 blank, 5 `# Guide`, 6 blank, 7 fence.
    expect(err?.message.split('\n').filter((l) => l.startsWith('[dk-gherkin]'))).toEqual([
      `[dk-gherkin] ${display()}:7 gherkin fence has no scenario or steps; mark it \`\`\`gherkin raw\`\`\` to show it as source`,
    ]);
  });

  it('warns when steps follow a real Feature: line with no Scenario: line (they render as description)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = await renderFile(page('# Guide', '', '```gherkin', 'Feature: Steps', '', '  Given a step', '  Then another', '```'));
      expect(blocks(r)).toHaveLength(1);
      const msgs = warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('without a Scenario'));
      // Fence at line 7; the first step is content line 3 → page line 10.
      expect(msgs).toEqual([
        `[dk-gherkin] ${display()}:10 steps after Feature: without a Scenario: line render as description`,
      ]);
      warn.mockClear();
      // A user-story narrative is skipped: the steps after it still warn.
      await renderFile(
        page('# Guide', '', '```gherkin', 'Feature: Story', '  As a shipper', '  I want to book', '', '  Given a step', '```'),
      );
      // Fence at line 7; the step is content line 5 → page line 12.
      expect(warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('without a Scenario'))).toEqual([
        `[dk-gherkin] ${display()}:12 steps after Feature: without a Scenario: line render as description`,
      ]);
      warn.mockClear();
      // A description that is prose, or a `* ` bullet list, is not a step.
      await renderFile(
        page('# Guide', '', '```gherkin', 'Feature: Prose', '  As a shipper', '  * a bullet', '  Scenario: S', '    Given x', '```'),
      );
      await renderFile(page('# Guide', '', '```gherkin', 'Feature: Bullets', '  * a bullet', '  Scenario: S', '    Given x', '```'));
      expect(warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('without a Scenario'))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn on a valid feature whose description opens with a step keyword', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // Dutch: the narrative `Als verlader wil ik …` opens with the step keyword `Als `.
      const nl = readFileSync(path.join(import.meta.dirname, 'fixtures/gherkin/render/i18n-nl.feature'), 'utf8');
      const r = await renderFile(page('# Guide', '', '```gherkin', ...nl.trimEnd().split('\n'), '```'));
      expect(blocks(r)).toHaveLength(1);
      // English: a description that happens to start with `When `, above a scenario.
      await renderFile(
        page('# Guide', '', '```gherkin', 'Feature: Book', '  When a shipper books a sailing, the line confirms it.', '', '  Scenario: S', '    Given x', '```'),
      );
      expect(warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('without a Scenario'))).toEqual([]);
    } finally {
      warn.mockRestore();
    }
  });

  it('warns about duplicate scenario names at their page lines (fragments included)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // A Feature-less fragment: the wrap shifts AST lines by one, the warning must not.
      await renderFile(page('# Guide', '', '```gherkin', 'Scenario: Same', '  Given a', 'Scenario: Same', '  Given b', '```'));
      const dup = warn.mock.calls.map(([m]) => String(m)).filter((m) => m.includes('duplicate scenario'));
      // Fence at line 7; scenarios at content lines 1 and 3 → page lines 8 and 10.
      expect(dup).toEqual([
        `[dk-gherkin] ${display()}:10 duplicate scenario name "Same" (also at line 8) — markdownlint MD024 will reject the duplicate heading`,
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});

// ===========================================================================
// The plugin on its own (no Astro): defaults for a bare unified run
// ===========================================================================

describe('gherkinFence without Astro file data', () => {
  it('names the page `<page>` when the file has no path', async () => {
    const { unified } = await import('unified');
    const { default: remarkParse } = await import('remark-parse');
    // Astro types remark plugins loosely; a bare unified `.use` wants unist types.
    const processor = unified().use(remarkParse).use(gherkinFence as never);
    const tree = processor.parse('```gherkin\nFeature: X\n  Scenario: Y\n    Given z\n    | a |\n    | b | c |\n```\n');
    expect(() => processor.runSync(tree)).toThrow('[dk-gherkin] <page>:6:5 inconsistent cell count within the table');
  });
});

// ===========================================================================
// The error sink (gherkin/errors.mjs)
// ===========================================================================

describe('the process-wide error sink', () => {
  it('lists pages in path order, each with its messages in recorded (source) order', () => {
    recordFatal('docs/z.md', ['[dk-gherkin] docs/z.md:3:1 a', '[dk-gherkin] docs/z.md:9:1 b']);
    recordFatal('docs/a.md', ['[dk-gherkin] docs/a.md:5:1 c']);
    expect(listFatal()).toEqual([
      { page: 'docs/a.md', messages: ['[dk-gherkin] docs/a.md:5:1 c'] },
      { page: 'docs/z.md', messages: ['[dk-gherkin] docs/z.md:3:1 a', '[dk-gherkin] docs/z.md:9:1 b'] },
    ]);
  });

  it('a later render of a page replaces its record; an empty one clears it', () => {
    recordFatal('docs/a.md', ['[dk-gherkin] docs/a.md:1:1 old']);
    recordFatal('docs/a.md', ['[dk-gherkin] docs/a.md:2:1 new']);
    expect(listFatal()).toEqual([{ page: 'docs/a.md', messages: ['[dk-gherkin] docs/a.md:2:1 new'] }]);
    recordFatal('docs/a.md', []);
    expect(listFatal()).toEqual([]);
  });

  it('drain empties it; reset empties it', () => {
    recordFatal('docs/a.md', ['x']);
    expect(drainFatal()).toHaveLength(1);
    expect(listFatal()).toEqual([]);
    recordFatal('docs/a.md', ['x']);
    resetFatal();
    expect(listFatal()).toEqual([]);
  });

  it('is ONE sink per process (keyed on globalThis), whatever the module instance', () => {
    recordFatal('docs/a.md', ['x']);
    const map = (globalThis as Record<symbol, unknown>)[Symbol.for('doc-kitty.gherkin.fatal')];
    expect(map).toBeInstanceOf(Map);
    expect((map as Map<string, string[]>).get('docs/a.md')).toEqual(['x']);
  });

  it('formats one aggregate: a summary line, then every message', () => {
    expect(formatFatal([])).toBe('');
    expect(
      formatFatal([
        { page: 'docs/a.md', messages: ['[dk-gherkin] docs/a.md:5:1 c'] },
        { page: 'docs/z.md', messages: ['[dk-gherkin] docs/z.md:3:1 a', '[dk-gherkin] docs/z.md:9:1 b'] },
      ]),
    ).toBe(
      [
        '[dk-gherkin] 3 Gherkin error(s) on 2 pages; they rendered empty, so the build fails:',
        '[dk-gherkin] docs/a.md:5:1 c',
        '[dk-gherkin] docs/z.md:3:1 a',
        '[dk-gherkin] docs/z.md:9:1 b',
      ].join('\n'),
    );
  });
});
