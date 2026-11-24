/**
 * The evidence-index route `/api/tom-annex.json` (WP03 T011, T016, #401).
 * Unit level: the shared site graph is mocked; the real build is WP05's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import { annexConfig, annexInputs, annexInstant, contentHash, evidenceSourceFiles, sourceDigest } from '../lib/tom-annex/stamp.mjs';
import { canonical, catalog, graph, page, record } from './fixtures/tom-annex/graph.mjs';

const state = vi.hoisted(() => ({ site: undefined as unknown, calls: [] as unknown[] }));

vi.mock('../lib/routes/site-graph.js', () => ({
  siteContentGraph: async (options: unknown) => {
    state.calls.push(options);
    return state.site;
  },
}));

const { tomAnnexRoute } = await import('../lib/routes/tom-annex.js');

const SITE = new URL('https://docs.example.org');

/**
 * The shared-graph shape the route reads, around a fixture graph and catalog,
 * with every page's source file written under a temporary docs root (the stamp
 * reads evidence pages' bytes, WP06).
 */
function siteGraph(g: ReturnType<typeof graph>, c: ReturnType<typeof catalog>, docsRoot = '/abs/docs') {
  const pages = g.nodes.filter((n: { kind: string }) => n.kind === 'page') as Array<{ id: string }>;
  return {
    graph: g,
    measures: { index: new Map(c.records.map((r) => [r.id, r])), records: c.records, source: c.source, isDefault: c.isDefault },
    docsRoot,
    locations: Object.fromEntries(pages.map((n) => [n.id, { id: n.id, route: `/${n.id}/`, index: false, file: `${n.id}.md` }])),
  };
}

/** A docs root on disk holding one source file per fixture page. */
function docsTree(g: ReturnType<typeof graph>, text = (id: string) => `# ${id}\n`) {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-tom-route-'));
  for (const n of g.nodes.filter((x: { kind: string }) => x.kind === 'page') as Array<{ id: string }>) {
    mkdirSync(path.dirname(path.join(root, `${n.id}.md`)), { recursive: true });
    writeFileSync(path.join(root, `${n.id}.md`), text(n.id));
  }
  // The fixture catalogs are consumer catalogs (`isDefault: false`), so the file is an input.
  mkdirSync(path.join(root, '_meta'));
  writeFileSync(path.join(root, '_meta', 'measures.yaml'), 'measures: []\n');
  return root;
}

const served = async () =>
  (await tomAnnexRoute({ docsDir: 'docs' })({ site: SITE } as never)).text();

afterEach(() => {
  state.calls.length = 0;
  vi.unstubAllEnvs();
});

describe('tomAnnexRoute (WP03 T011)', () => {
  it('serves the core bytes for the shared graph, as JSON', async () => {
    const { graph: g, catalog: c } = canonical();
    state.site = siteGraph(g, c, docsTree(g));
    const response = await tomAnnexRoute({ docsDir: 'docs', indexBasename: 'README' })({ site: SITE } as never);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    const { generated, ...body } = JSON.parse(await response.text());
    expect(generated).toBeDefined();
    expect(`${JSON.stringify(body, null, 2)}\n`).toBe(serializeTomAnnex(buildTomAnnex(g, c, { site: SITE, base: '/' })));
    expect(state.calls).toEqual([{ docsDir: 'docs', indexBasename: 'README' }]);
  });

  it('builds URLs under the configured base', async () => {
    vi.stubEnv('BASE_URL', '/docs/');
    const { graph: g, catalog: c } = canonical();
    state.site = siteGraph(g, c, docsTree(g));
    const body = JSON.parse(await (await tomAnnexRoute({ docsDir: 'docs' })({ site: SITE } as never)).text());
    expect(body.scopes.system[0].evidence[0].url).toBe('https://docs.example.org/docs/architecture/audit-logging/');
  });
});

describe('the served index carries the ADR-0087 stamp (WP06 T029)', () => {
  it('stamps source_digest over the evidence pages and the configuration, and content_hash over the body', async () => {
    const { graph: g, catalog: c } = canonical();
    const root = docsTree(g);
    state.site = siteGraph(g, c, root);
    const text = await served();
    const annex = JSON.parse(text);
    const rel = (f: string) => path.relative(process.cwd(), path.join(root, f)).split(path.sep).join('/');
    const evidencePages = evidenceSourceFiles(g, (state.site as ReturnType<typeof siteGraph>).locations).map((f: string) => ({
      path: rel(f),
      bytes: readFileSync(path.join(root, f)),
    }));
    const inputs = annexInputs({
      evidencePages,
      catalogFile: { path: rel('_meta/measures.yaml'), bytes: readFileSync(path.join(root, '_meta', 'measures.yaml')) },
      config: annexConfig({ site: SITE, base: '/', catalog: c }),
    });
    expect(annex.generated.source_digest).toBe(sourceDigest(inputs));
    expect(annex.generated.content_hash).toBe(contentHash(annex));
    expect(annex.generated.at).toBe(annexInstant(annex));
    expect(Object.keys(annex).indexOf('generated')).toBe(Object.keys(annex).indexOf('notice') + 1);
  });

  it('a change to an evidence page changes source_digest; a change to an unclassified page does not', async () => {
    const { graph: g, catalog: c } = canonical();
    const root = docsTree(g);
    const digestWith = async (text: (id: string) => string) => {
      // One root, so the input paths stay the same and only the bytes differ.
      for (const id of ['guides/unrelated', 'guides/access']) writeFileSync(path.join(root, `${id}.md`), text(id));
      state.site = siteGraph(g, c, root);
      return JSON.parse(await served()).generated.source_digest;
    };
    const base = await digestWith((id) => `# ${id}\n`);
    expect(await digestWith((id) => (id === 'guides/unrelated' ? `# ${id}\n\n` : `# ${id}\n`))).toBe(base);
    expect(await digestWith((id) => (id === 'guides/access' ? `# ${id}\n\n` : `# ${id}\n`))).not.toBe(base);
  });

  it('reads the consumer catalog file as an input', async () => {
    const { graph: g, catalog: c } = canonical();
    const root = docsTree(g);
    const digestWith = async (yaml: string) => {
      writeFileSync(path.join(root, '_meta', 'measures.yaml'), yaml);
      state.site = siteGraph(g, { ...c, isDefault: false }, root);
      return JSON.parse(await served()).generated.source_digest;
    };
    expect(await digestWith('measures: []\n')).not.toBe(await digestWith('measures: []\n# edited\n'));
  });
});

describe('the mount and the graph must agree (WP03 T016)', () => {
  it('throws when it is mounted but the graph has no classified-as edge', async () => {
    state.site = siteGraph(graph([page('p')], []), catalog([record('m')]));
    await expect(tomAnnexRoute({ docsDir: 'docs' })({ site: SITE } as never)).rejects.toThrow(
      /\[dk-tom-annex\].*no classified-as edge.*\/abs\/docs/,
    );
  });
});

describe('tomAnnexIntegration mounts the route only for a classified site (WP03 T012)', () => {
  const setup = async (files: Record<string, string>) => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const root = mkdtempSync(path.join(tmpdir(), 'dk-tom-int-'));
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    const { tomAnnexIntegration } = await import('../lib/integrations/tom-annex.js');
    const injected: Array<{ pattern: string; entrypoint: string; prerender?: boolean }> = [];
    const plugins: unknown[] = [];
    const hook = tomAnnexIntegration(root, undefined).hooks['astro:config:setup'] as (args: unknown) => void;
    hook({
      injectRoute: (r: (typeof injected)[number]) => injected.push(r),
      updateConfig: (c: { vite?: { plugins?: unknown[] } }) => plugins.push(...(c.vite?.plugins ?? [])),
    });
    return { injected, plugins };
  };
  const page = (data: string) => `---\ntitle: "T"\ndoc_status: "active"\n${data}---\n\nBody.\n`;

  it('injects /api/tom-annex.json, prerendered, when a published page is classified', async () => {
    const { injected, plugins } = await setup({
      'README.md': page(''),
      'security/audit.md': page('tom_classification:\n  - measure: events-logging\n'),
    });
    expect(injected).toEqual([
      { pattern: '/api/tom-annex.json', entrypoint: '@spec-kitty/doc-toolkit/routes/tom-annex-injected', prerender: true },
    ]);
    expect(plugins).toHaveLength(1);
  });

  it('injects nothing and adds no plugin for a site with no classified page (same tree, unclassified)', async () => {
    const { injected, plugins } = await setup({ 'README.md': page(''), 'security/audit.md': page('') });
    expect(injected).toEqual([]);
    expect(plugins).toEqual([]);
  });
});

describe('package export (WP03 T015)', () => {
  it('exports the injected entrypoint the integration names', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.exports['./routes/tom-annex-injected']).toBe('./lib/routes/tom-annex-injected.ts');
  });
});
