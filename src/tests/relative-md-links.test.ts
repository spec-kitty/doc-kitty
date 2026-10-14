/**
 * WP04 (FR-011..FR-014, FR-021, C-007) — the remark pass that rewrites a
 * relative `.md`/`.mdx` link to the target page's published route.
 *
 * Driven through Astro's real Markdown processor with `fileURL` set, so
 * `file.path` is what the content layer provides. The resolution matrix
 * (index vs leaf source, README target, query/fragment, outside the root,
 * drafts, encoding) lives in `route-table.test.ts`; this file only covers what
 * a rule-level test cannot show: the plugin through the pipeline, the node
 * kinds it touches, its no-op rules, and the integration's freshness.
 */
import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import relativeMdLinks from '../lib/remark/relative-md-links.js';
import { defineDocKittyIntegrations } from '../lib/config.js';

type MarkdownProcessor = {
  render: (md: string, opts?: { fileURL?: URL }) => Promise<{ code: string }>;
};
type MarkdownRemark = {
  createMarkdownProcessor: (opts: Record<string, unknown>) => Promise<MarkdownProcessor>;
  markdownConfigDefaults: Record<string, unknown>;
};

const tmpRoots: string[] = [];
// `defineDocKittyIntegrations` publishes DK_INDEX_BASENAME; a leaked value would reach the next file.
const originalIndexEnv = process.env.DK_INDEX_BASENAME;
afterEach(() => {
  if (originalIndexEnv === undefined) delete process.env.DK_INDEX_BASENAME;
  else process.env.DK_INDEX_BASENAME = originalIndexEnv;
});
afterAll(() => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true });
});

/** Astro's own processor, resolved off the installed `astro` (as the other pipeline tests do). */
async function astroMarkdown(): Promise<MarkdownRemark> {
  const req = createRequire(import.meta.url);
  const entry = createRequire(req.resolve('astro/package.json')).resolve('@astrojs/markdown-remark');
  return (await import(entry)) as MarkdownRemark;
}

const DOCS = path.join(tmpdir(), 'dk-rml-docs');
const ROUTES = { 'adr/0001-x.md': '/adr/0001-x/', 'context/product.md': '/context/product/' };

async function render(md: string, opts: { file?: string | null; plugin?: Record<string, unknown> | null } = {}) {
  const { createMarkdownProcessor, markdownConfigDefaults } = await astroMarkdown();
  const options = opts.plugin === undefined ? { routes: ROUTES, base: '/site', docsRoot: DOCS } : opts.plugin;
  const processor = await createMarkdownProcessor({
    ...markdownConfigDefaults,
    remarkPlugins: [[relativeMdLinks, options]],
  });
  const file = opts.file === undefined ? 'context/product.md' : opts.file;
  const fileURL = file === null ? undefined : pathToFileURL(path.join(DOCS, file));
  return (await processor.render(md, { fileURL })).code;
}

describe('relativeMdLinks through the real Markdown processor', () => {
  it('rewrites the issue acceptance case to the based route', async () => {
    const html = await render('[x](../adr/0001-x.md#status)\n');
    expect(html).toContain('href="/site/adr/0001-x/#status"');
  });

  it('rewrites a reference-style definition, and leaves an image and an unresolvable link as written', async () => {
    const html = await render(
      ['[ref][r]', '', '![pic](../adr/0001-x.md)', '', '[gone](../adr/missing.md)', '', '[r]: ../adr/0001-x.md', ''].join('\n'),
    );
    expect(html).toContain('<a href="/site/adr/0001-x/">ref</a>');
    expect(html).toContain('&#x22;src&#x22;:&#x22;../adr/0001-x.md&#x22;'); // Astro's image placeholder keeps the src
    expect(html).toContain('href="../adr/missing.md"');
  });

  it('leaves the tree alone for a file with no path and for a plugin with no options', async () => {
    const md = '[x](../adr/0001-x.md)\n';
    expect(await render(md, { file: null })).toContain('href="../adr/0001-x.md"');
    expect(await render(md, { plugin: null })).toContain('href="../adr/0001-x.md"');
    expect(await render(md, { plugin: { routes: {}, base: '/site', docsRoot: DOCS } })).toContain(
      'href="../adr/0001-x.md"',
    );
  });

  it('leaves a file outside the docs root alone', async () => {
    const { createMarkdownProcessor, markdownConfigDefaults } = await astroMarkdown();
    const processor = await createMarkdownProcessor({
      ...markdownConfigDefaults,
      remarkPlugins: [[relativeMdLinks, { routes: ROUTES, base: '/site', docsRoot: DOCS }]],
    });
    const out = await processor.render('[x](../adr/0001-x.md)\n', {
      fileURL: pathToFileURL(path.join(tmpdir(), 'elsewhere', 'context', 'product.md')),
    });
    expect(out.code).toContain('href="../adr/0001-x.md"');
  });
});

describe('relativeMdLinks on .mdx (hand-built file)', () => {
  it('rewrites inline and reference-style links, not a raw <a>', async () => {
    // `@mdx-js/mdx` is Starlight's `@astrojs/mdx` dependency, reached through the real path.
    const req = createRequire(import.meta.url);
    const starlight = createRequire(req.resolve('@astrojs/starlight'));
    const mdx = createRequire(starlight.resolve('@astrojs/mdx'));
    const mdxEntry = mdx.resolve('@mdx-js/mdx');
    const { createProcessor } = (await import(mdxEntry)) as {
      createProcessor: (o: Record<string, unknown>) => { process: (f: unknown) => Promise<unknown> };
    };
    const { VFile } = (await import(createRequire(mdxEntry).resolve('vfile'))) as {
      VFile: new (o: { path: string; value: string }) => unknown;
    };
    const processor = createProcessor({
      remarkPlugins: [[relativeMdLinks, { routes: ROUTES, base: '/site', docsRoot: DOCS }]],
    });
    const file = new VFile({
      path: path.join(DOCS, 'context', 'product.mdx'),
      value: '[a](../adr/0001-x.md) and [b][r] <a href="../adr/0001-x.md">raw</a>\n\n[r]: ../adr/0001-x.md\n',
    });
    const code = String(await processor.process(file));
    expect(code).toContain('href: "/site/adr/0001-x/"');
    expect(code.match(/\/site\/adr\/0001-x\//g)).toHaveLength(2);
    expect(code).toContain('href: "../adr/0001-x.md"');
  });
});

describe('integration freshness (FR-021)', () => {
  function tree(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-rml-'));
    tmpRoots.push(root);
    const docs = path.join(root, 'docs');
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(docs, rel)), { recursive: true });
      writeFileSync(path.join(docs, rel), body);
    }
    return docs;
  }

  /** Run the base-absolute-links setup hook over a tree; return the plugin options it registers. */
  function optionsFor(docs: string, publish: 'on' | 'off', indexBasename = 'README') {
    const integrations = defineDocKittyIntegrations({
      docsDir: path.relative(process.cwd(), docs),
      base: '/site',
      indexBasename,
    } as never) as Array<{ name: string; hooks?: Record<string, (a: unknown) => void> }>;
    const integration = integrations.find((i) => i.name === 'doc-kitty:base-absolute-links')!;
    let captured: { markdown: { remarkPlugins: Array<[unknown, unknown]> } } | undefined;
    const previous = process.env.DK_PUBLISH_DRAFTS_RESOLVED;
    process.env.DK_PUBLISH_DRAFTS_RESOLVED = publish;
    try {
      integration.hooks!['astro:config:setup']({ updateConfig: (c: typeof captured) => (captured = c), config: {} });
    } finally {
      if (previous === undefined) delete process.env.DK_PUBLISH_DRAFTS_RESOLVED;
      else process.env.DK_PUBLISH_DRAFTS_RESOLVED = previous;
    }
    const entry = captured!.markdown.remarkPlugins.find(([p]) => p === relativeMdLinks)!;
    return JSON.stringify(entry[1]);
  }

  const routesOf = (json: string) => (JSON.parse(json) as { routes: Record<string, string> }).routes;

  const page = (status: string) => `---\ntitle: T\ndoc_status: ${status}\n---\n\nBody.\n`;

  it('changes the plugin options when a target is renamed or its draft state flips, and is deterministic', () => {
    const docs = tree({ 'a.md': page('published'), 'b.md': page('published') });
    const before = optionsFor(docs, 'on');
    expect(optionsFor(docs, 'on')).toBe(before);
    renameSync(path.join(docs, 'b.md'), path.join(docs, 'c.md'));
    expect(optionsFor(docs, 'on')).not.toBe(before);

    const withDraft = tree({ 'a.md': page('published'), 'b.md': page('draft') });
    // Drafts withheld: the draft target leaves the table; drafts published: it stays.
    expect(optionsFor(withDraft, 'off')).not.toBe(optionsFor(withDraft, 'on'));
  });

  it('wires the configured index name into the route table and the draft withholding', () => {
    const docs = tree({
      'home.md': page('draft'),
      'guides/home.md': page('published'),
    });
    const routes = routesOf(optionsFor(docs, 'off', 'home'));
    // Only the configured index name makes `guides/home.md` the folder's page.
    expect(routes['guides/home.md']).toBe('/guides/');
    // The root page is never withheld: present with drafts off even though it is a draft.
    expect(routes['home.md']).toBe('/');
  });

  it('stops the build on a route collision, drafts included; the tree minus one file passes (FR-004)', () => {
    const run = (docs: string) => optionsFor(docs, 'off');
    const clash = tree({ 'x/README.md': page('published'), 'x/index.md': page('published') });
    expect(() => run(clash)).toThrow(/x\/README\.md[\s\S]*x\/index\.md/);
    // A draft counts even though drafts are withheld in this build (US2 scenario 5).
    const draftClash = tree({ 'x/README.md': page('draft'), 'x/index.md': page('published') });
    expect(() => run(draftClash)).toThrow(/x\/README\.md[\s\S]*x\/index\.md/);
    // Positive control: one file less builds.
    expect(() => run(tree({ 'x/README.md': page('published') }))).not.toThrow();
  });
});
