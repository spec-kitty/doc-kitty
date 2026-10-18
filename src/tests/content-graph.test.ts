/**
 * #176 — the content graph builder (`buildContentGraph`, FR-010..FR-013, C-010,
 * C-011, NFR-001). Pure and in-memory: the route does the collection and file
 * reads, the builder only folds entries into nodes and edges. `docs-index.ts`
 * statically imports `astro:content`, which does not resolve under bare vitest,
 * so it is neutralised like `collect-doc-entries-order.test.ts` does.
 */
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { DocEntry, DocKittyFrontmatter } from '../lib/metadata.js';
import { resolveCitation, resolveProfile, resolveRelated } from '../lib/metadata.js';
import { buildCatalog } from '../lib/catalog.js';

vi.mock('astro:content', () => ({ getCollection: async () => [] }));

const { buildContentGraph, buildDocsIndex, locatePages } = await import('../lib/docs-index.js');

const page = (slug: string, data: Partial<DocKittyFrontmatter> = {}): DocEntry => ({
  slug,
  data: { title: `T ${slug || 'home'}`, doc_status: 'active', ...data } as DocKittyFrontmatter,
});

// File paths as the shared walk reports them. `drafts/README.md` is a section README
// whose bundle id (`drafts/README`) differs from its slug and route (`drafts`, `/drafts/`).
const PATHS = [
  'README.md',
  'guides/README.md',
  'guides/setup.md',
  'guides/deploy.md',
  'drafts/README.md',
  'context/audience/maintainer.md',
];

const catalog = buildCatalog(
  [{ id: 'b1', title: 'A Book', url: 'https://books.example/b1', authors: ['Ann'] }],
  [{ id: 't1', name: 'A Tool', url: 'https://tool.example' }],
);

const entries = (): DocEntry[] => [
  page('', { title: 'Home' }),
  page('guides', { title: 'Guides' }),
  page('guides/deploy', { title: 'Deploy', description: 'Ship it.' }),
  page('guides/setup', {
    title: 'Setup',
    kind: 'How-To',
    updated: '2026-10-18',
    related: ['guides/deploy', { ref: 'drafts', note: 'to a draft' }, { ref: 'guides/deploy', note: 'again' }],
    audience: [
      { profile: 'maintainer', guidance_text: 'Read this first.' },
      { profile: 'nobody', guidance_text: 'soft miss' },
    ],
    external_references: [
      { type: 'biblio', id: 'b1' },
      { type: 'tool', id: 't1' },
      { url: 'https://x.example/a', title: 'Inline A' },
    ],
    sources: [
      { resource: 'guides/deploy.md', title: 'a bundle page' },
      { resource: 'features/x.feature', title: 'Gherkin source' },
    ],
    verified: { by: 'human:ann', at: '2026-10-01T10:00:00Z' } as never,
    stale_after: '2027-01-01',
    authors: ['stijn@sddevelopment.be', 'human:ann', 'not an actor', 'a+b@x.io'],
    generated: { by: 'doc-kitty-gherkin/0.3.0', at: '2026-10-02T09:30:00Z' },
  }),
  page('drafts', { title: 'Hidden', doc_status: 'draft' }),
  page('context/audience/maintainer', { title: 'Maintainer', kind: 'Persona' }),
];

const options = () => {
  const locations = locatePages(PATHS);
  return { locations, draftRoutes: new Set(['/drafts/']), catalog };
};

const build = (list = entries()) => buildContentGraph(list, options());
const edgesOf = (g: ReturnType<typeof build>, source: string) => g.edges.filter((e) => e.source === source);

describe('buildContentGraph', () => {
  it('is byte-identical for any input order and sorts nodes and edges by code unit', () => {
    const forward = JSON.stringify(build());
    expect(JSON.stringify(build([...entries()].reverse()))).toBe(forward);
    const g = build();
    const ids = g.nodes.map((n) => n.id);
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    const keys = g.edges.map((e) => `${e.source}\0${e.rel}\0${e.target}`);
    expect(keys).toEqual([...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('gives every edge the id source|rel|target, with no duplicates', () => {
    const g = build();
    for (const e of g.edges) expect(e.id).toBe(`${e.source}|${e.rel}|${e.target}`);
    expect(new Set(g.edges.map((e) => e.id)).size).toBe(g.edges.length);
  });

  it('drops a draft section README and every edge touching it (id and route differ)', () => {
    const g = build();
    // The draft's bundle id is `drafts/README`; its route is `/drafts/`. A comparison of
    // ids against the route set would keep it, so both spellings are asserted absent.
    for (const dead of ['drafts', 'drafts/README']) {
      expect(g.nodes.map((n) => n.id)).not.toContain(dead);
      expect(g.edges.some((e) => e.source === dead || e.target === dead)).toBe(false);
    }
    // Positive control: the same page IS a node when its route is not a draft route.
    const open = buildContentGraph(entries(), { ...options(), draftRoutes: new Set() });
    expect(open.nodes.map((n) => n.id)).toContain('drafts/README');
  });

  it('emits exactly one related edge per distinct target, keyed by bundle path', () => {
    const related = edgesOf(build(), 'guides/setup').filter((e) => e.rel === 'related');
    expect(related).toEqual([
      // Duplicates collapse by id and the first reference wins (a bare slug carries no note).
      { id: 'guides/setup|related|guides/deploy', source: 'guides/setup', target: 'guides/deploy', rel: 'related' },
    ]);
  });

  it('matches the rendered Related, Audience and External-references blocks (SC-001)', () => {
    const g = build();
    const setup = entries().find((e) => e.slug === 'guides/setup')!;
    const index = buildDocsIndex(entries());
    const targets = (rel: string) => edgesOf(g, 'guides/setup').filter((e) => e.rel === rel).map((e) => e.target);

    const related = (setup.data.related ?? []).map((r) => resolveRelated(r, index).ref);
    const publishedRelated = related.filter((slug) => slug !== 'drafts');
    expect(targets('related')).toEqual([...new Set(publishedRelated)].map((slug) => `${slug}`));

    const audience = (setup.data.audience ?? []).flatMap((a) => {
      const resolved = resolveProfile(a.profile, index);
      return resolved ? [`context/audience/${a.profile}`] : [];
    });
    expect(targets('audience')).toEqual(audience);

    const cites = (setup.data.external_references ?? []).map((ref) => {
      const resolved = resolveCitation(ref, catalog);
      return 'name' in resolved ? 'catalog:tool:t1' : 'id' in resolved ? 'catalog:biblio:b1' : `resource:${resolved.url}`;
    });
    expect(targets('cites')).toEqual([...cites].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('reads in-section from the nearest published index and derived-from from sources', () => {
    const g = build();
    expect(edgesOf(g, 'guides/setup').find((e) => e.rel === 'in-section')?.target).toBe('guides/README');
    expect(edgesOf(g, 'guides/README').find((e) => e.rel === 'in-section')?.target).toBe('README');
    expect(edgesOf(g, 'README').some((e) => e.rel === 'in-section')).toBe(false);
    const derived = edgesOf(g, 'guides/setup').filter((e) => e.rel === 'derived-from').map((e) => e.target);
    expect(derived).toEqual(['guides/deploy', 'resource:features/x.feature']);
    expect(g.nodes.find((n) => n.id === 'resource:features/x.feature')?.kind).toBe('resource');
  });

  it('normalises verified to a list and instants to Z (FR-021, FR-022)', () => {
    const node = build().nodes.find((n) => n.id === 'guides/setup')!;
    expect(node.verified).toEqual([{ by: 'human:ann', at: '2026-10-01T10:00:00Z' }]);
    expect(node.stale_after).toBe('2027-01-01T00:00:00Z');
    expect(node.updated).toBe('2026-10-18T00:00:00Z');
    expect(node.generated).toEqual({ by: 'doc-kitty-gherkin/0.3.0', at: '2026-10-02T09:30:00Z' });
    expect(node.status).toBe('stable');
    expect(node.doc_kind).toBe('How-To');
    expect(build().nodes.find((n) => n.id === 'context/audience/maintainer')?.kind).toBe('persona');
  });

  it('rewrites an email author to human:<local-part> and drops unparseable ones (data-model Actor)', () => {
    const node = build().nodes.find((n) => n.id === 'guides/setup')!;
    expect(node.authors).toEqual(['human:stijn', 'human:ann']);
  });

  it('validates against the content-graph schema', () => {
    const actor = z.string().regex(/^(human:[A-Za-z0-9._-]+|process:[A-Za-z0-9._-]+|[a-z0-9][a-z0-9-]*\/\S+)$/);
    const instant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    const stamp = z.object({ by: actor, at: instant, content_hash: z.string().optional() }).strict();
    const node = z
      .object({
        id: z.string().min(1),
        kind: z.enum(['page', 'persona', 'catalog', 'resource']),
        type: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        resource: z.string().optional(),
        tags: z.array(z.string()).optional(),
        status: z.enum(['draft', 'stable', 'deprecated']).optional(),
        generated: stamp.optional(),
        verified: z.array(z.object({ by: actor, at: instant })).optional(),
        stale_after: instant.optional(),
        sources: z.array(z.object({ resource: z.string(), title: z.string() })).optional(),
        doc_status: z.string().optional(),
        doc_kind: z.string().optional(),
        section: z.string().optional(),
        href: z.string().optional(),
        url: z.string().optional(),
        authors: z.array(actor).optional(),
        updated: instant.optional(),
      })
      .strict();
    const edge = z
      .object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
        rel: z.enum(['related', 'audience', 'cites', 'in-section', 'derived-from']),
        note: z.string().optional(),
      })
      .strict();
    const graph = z
      .object({
        schema: z.literal('dockitty.content-graph/1'),
        okf_version: z.literal('0.2'),
        generatedFrom: z.literal('doc-kitty'),
        nodes: z.array(node),
        edges: z.array(edge),
      })
      .strict();
    expect(graph.parse(build())).toBeTruthy();
    // Every edge ends on a node of the graph (the artifact gate relies on it).
    const g = build();
    const nodeIds = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) expect([nodeIds.has(e.source), nodeIds.has(e.target)]).toEqual([true, true]);
  });
});
