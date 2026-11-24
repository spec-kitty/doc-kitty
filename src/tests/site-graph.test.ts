/**
 * The shared site graph (WP02, #401): `/api/content-graph.json` and
 * `/api/tom-annex.json` share one content-graph build per site build (C-004,
 * NFR-002). The extraction is behaviour-preserving: the route's bytes are
 * pinned by a ratchet captured on the code before the extraction.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/** The docs collection the mocked `astro:content` serves, per test file. */
const docs: Array<{ id: string; data: Record<string, unknown>; body?: string }> = [];

vi.mock('astro:content', () => ({
  getCollection: async (name: string) => (name === 'docs' ? docs : []),
}));

const buildSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../lib/docs-index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/docs-index.js')>();
  return {
    ...original,
    buildContentGraph: (...args: Parameters<typeof original.buildContentGraph>) => {
      buildSpy.calls += 1;
      return original.buildContentGraph(...args);
    },
  };
});

const { contentGraphRoute } = await import('../lib/routes/content-graph.js');

let docsDir: string;

/** A small docs tree: a hub, a classified page, an unclassified page and a draft. */
const FILES: Record<string, Record<string, unknown>> = {
  'README.md': { title: 'Home', doc_status: 'active' },
  'security/README.md': { title: 'Security', doc_status: 'active', kind: 'Hub' },
  'security/audit-log.md': {
    title: 'Audit log',
    description: 'Where audit events go.',
    doc_status: 'active',
    updated: '2026-11-20T00:00:00Z',
    tom_classification: [{ measure: 'events-logging', note: 'Kept for 13 months.' }],
  },
  'security/tls.md': { title: 'TLS', doc_status: 'active' },
  'drafts/wip.md': {
    title: 'Work in progress',
    doc_status: 'draft',
    tom_classification: [{ measure: 'user-identification-authorisation' }],
  },
};

const frontmatter = (data: Record<string, unknown>) =>
  `---\n${Object.entries(data)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')}\n---\n\nBody.\n`;

beforeAll(() => {
  docsDir = mkdtempSync(path.join(tmpdir(), 'dk-site-graph-'));
  for (const [rel, data] of Object.entries(FILES)) {
    mkdirSync(path.dirname(path.join(docsDir, rel)), { recursive: true });
    writeFileSync(path.join(docsDir, rel), frontmatter(data));
    const id = rel.replace(/\.md$/, '').replace(/(^|\/)README$/, '');
    docs.push({ id: id === '' ? 'index' : id, data });
  }
});

afterAll(() => rmSync(docsDir, { recursive: true, force: true }));

const SITE = new URL('https://docs.example.org');

async function routeText(): Promise<string> {
  const route = contentGraphRoute({ docsDir });
  const response = await route({ site: SITE } as never);
  return response.text();
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('content-graph.json ratchet (WP02 T007)', () => {
  it('serves the same bytes as before the shared-graph extraction', async () => {
    const text = await routeText();
    const graph = JSON.parse(text);
    // Structure first, so a failure explains itself.
    expect(graph.nodes.some((n: { id: string }) => n.id === 'catalog:measure:events-logging')).toBe(true);
    expect(graph.edges.some((e: { rel: string }) => e.rel === 'classified-as')).toBe(true);
    expect(graph.nodes.some((n: { id: string }) => n.id.includes('wip'))).toBe(false);
    expect(text.endsWith('}\n')).toBe(true);
    // The pinned bytes, captured on the unchanged route.
    expect(sha256(text)).toBe(RATCHET_SHA256);
  });
});

/** sha256 of the route's response on the pre-extraction code (WP02 T007). */
const RATCHET_SHA256 = 'caf7982e446282d9db05d09f0cee703a3701047b71d021ea49f791170825a4ba';

afterEach(async () => {
  buildSpy.calls = 0;
  vi.unstubAllEnvs();
  delete process.env.DK_OPENAPI;
  const { resetSiteContentGraph } = await import('../lib/routes/site-graph.js');
  resetSiteContentGraph();
});

describe('siteContentGraph (WP02 T008)', () => {
  it('returns the graph with the catalog, the docs root and the page locations', async () => {
    const { siteContentGraph } = await import('../lib/routes/site-graph.js');
    const site = await siteContentGraph({ docsDir });
    expect(site.graph.edges.some((e) => e.rel === 'classified-as')).toBe(true);
    expect(site.measures.source).toBe('the shipped default catalog');
    expect(site.measures.isDefault).toBe(true);
    expect(site.measures.records.length).toBeGreaterThan(0);
    expect(site.measures.index.has('events-logging')).toBe(true);
    expect(site.docsRoot).toBe(path.resolve(docsDir));
    const audit = Object.values(site.locations).find((l) => l.route.includes('audit-log'));
    expect(audit?.file).toMatch(/security[/\\]audit-log\.md$/);
  });

  it('builds the graph once per site in a production build', async () => {
    vi.stubEnv('DEV', false);
    const { siteContentGraph } = await import('../lib/routes/site-graph.js');
    const [a, b] = await Promise.all([siteContentGraph({ docsDir }), siteContentGraph({ docsDir })]);
    const c = await siteContentGraph({ docsDir });
    expect(buildSpy.calls).toBe(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('rebuilds on every call in dev, so edits are never served stale', async () => {
    vi.stubEnv('DEV', true);
    const { siteContentGraph } = await import('../lib/routes/site-graph.js');
    await siteContentGraph({ docsDir });
    await siteContentGraph({ docsDir });
    expect(buildSpy.calls).toBe(2);
  });

  it('rebuilds after resetSiteContentGraph()', async () => {
    vi.stubEnv('DEV', false);
    const { siteContentGraph, resetSiteContentGraph } = await import('../lib/routes/site-graph.js');
    await siteContentGraph({ docsDir });
    resetSiteContentGraph();
    await siteContentGraph({ docsDir });
    expect(buildSpy.calls).toBe(2);
  });
});

describe('content-graph.json routes through the shared graph (WP02 T009)', () => {
  it('builds the graph once when both the route and another caller ask for it', async () => {
    vi.stubEnv('DEV', false);
    const { siteContentGraph } = await import('../lib/routes/site-graph.js');
    await siteContentGraph({ docsDir });
    await routeText();
    expect(buildSpy.calls).toBe(1);
  });

  it('never mutates the shared graph when it appends the OpenAPI nodes', async () => {
    vi.stubEnv('DEV', false);
    const publication = path.join(docsDir, '..', `${path.basename(docsDir)}-openapi.json`);
    writeFileSync(
      publication,
      JSON.stringify({
        section: 'api',
        versions: [{ label: 'v1', title: 'API v1', rawRoute: '/api/v1.json', sha256: 'abc', released: true }],
      }),
    );
    process.env.DK_OPENAPI = publication;
    try {
      const { siteContentGraph } = await import('../lib/routes/site-graph.js');
      const shared = await siteContentGraph({ docsDir });
      const before = shared.graph.nodes.length;
      Object.freeze(shared.graph);
      const graph = JSON.parse(await routeText());
      // The route still serves the OpenAPI node (the positive control) ...
      expect(graph.nodes.some((n: { id: string }) => n.id === 'openapi:v1')).toBe(true);
      // ... but the shared graph, which the annex route also reads, does not carry it.
      expect(shared.graph.nodes).toHaveLength(before);
      expect(shared.graph.nodes.some((n) => n.id === 'openapi:v1')).toBe(false);
    } finally {
      rmSync(publication, { force: true });
    }
  });
});
