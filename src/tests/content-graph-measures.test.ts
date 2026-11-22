/**
 * The `classified-as` relation of the content graph (ADR-0080, FR-005, FR-007,
 * FR-010, NFR-001). In-memory like `content-graph.test.ts`: `astro:content` is
 * neutralised, the builder folds entries into nodes and edges.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DocEntry, DocKittyFrontmatter } from '../lib/metadata.js';
import { buildCatalog } from '../lib/catalog.js';
import { buildMeasuresIndex, parseMeasuresCatalog } from '../lib/measures-core.mjs';

vi.mock('astro:content', () => ({ getCollection: async () => [] }));

const { buildContentGraph, locatePages } = await import('../lib/docs-index.js');

const page = (slug: string, data: Partial<DocKittyFrontmatter> = {}): DocEntry => ({
  slug,
  data: { title: `T ${slug || 'home'}`, doc_status: 'active', ...data } as DocKittyFrontmatter,
});

const PATHS = ['README.md', 'security/README.md', 'security/audit-log.md', 'security/tls.md', 'drafts/wip.md'];

const measures = {
  index: buildMeasuresIndex(
    parseMeasuresCatalog(
      [
        {
          id: 'transmission-protection',
          label: 'Protection of data during transmission',
          nature: 'technical',
          frameworks: [{ framework: 'eu-scc-2021-914-annex-ii', ref: '6' }],
          dpv: 'https://w3id.org/dpv#EncryptionInTransfer',
        },
        {
          id: 'events-logging',
          label: 'Events logging',
          nature: 'technical',
          frameworks: [{ framework: 'eu-scc-2021-914-annex-ii', ref: '9' }],
          dpv: 'https://w3id.org/dpv#ActivityMonitoring',
        },
        {
          id: 'accountability',
          label: 'Accountability',
          nature: 'organisational',
          frameworks: [{ framework: 'eu-scc-2021-914-annex-ii', ref: '16' }],
        },
      ],
      'test catalog',
    ).records,
  ),
  source: 'test catalog',
};

const plain = (): DocEntry[] => [
  page('', { title: 'Home' }),
  page('security', { title: 'Security' }),
  page('security/audit-log', { title: 'Audit log' }),
  page('security/tls', { title: 'TLS' }),
];

const classified = (): DocEntry[] => [
  page('', { title: 'Home' }),
  page('security', { title: 'Security' }),
  page('security/audit-log', {
    title: 'Audit log',
    tom_classification: [
      'transmission-protection',
      { measure: 'events-logging', note: 'Every admin action is logged.' },
      { measure: 'accountability', scope: 'organisation' },
    ],
  }),
  page('security/tls', { title: 'TLS', tom_classification: ['transmission-protection'] }),
];

const ctx = (withMeasures = true, draftRoutes: string[] = []) => ({
  locations: locatePages(PATHS),
  draftRoutes: new Set(draftRoutes),
  catalog: buildCatalog([], []),
  ...(withMeasures ? { measures } : {}),
});

const build = (list: DocEntry[], withMeasures = true, drafts: string[] = []) =>
  buildContentGraph(list, ctx(withMeasures, drafts));

describe('content graph: classified-as', () => {
  it('adds one edge per measure, with scope always written and the note when given', () => {
    const g = build(classified());
    expect(g.edges.filter((e) => e.source === 'security/audit-log' && e.rel === 'classified-as')).toEqual([
      {
        id: 'security/audit-log|classified-as|catalog:measure:accountability',
        source: 'security/audit-log',
        target: 'catalog:measure:accountability',
        rel: 'classified-as',
        scope: 'organisation',
      },
      {
        id: 'security/audit-log|classified-as|catalog:measure:events-logging',
        source: 'security/audit-log',
        target: 'catalog:measure:events-logging',
        rel: 'classified-as',
        note: 'Every admin action is logged.',
        scope: 'system',
      },
      {
        id: 'security/audit-log|classified-as|catalog:measure:transmission-protection',
        source: 'security/audit-log',
        target: 'catalog:measure:transmission-protection',
        rel: 'classified-as',
        scope: 'system',
      },
    ]);
  });

  it('adds one measure node per used measure, carrying label, DPV IRI, nature and frameworks', () => {
    const g = build(classified());
    const nodes = g.nodes.filter((n) => n.id.startsWith('catalog:measure:'));
    expect(nodes.map((n) => n.id)).toEqual([
      'catalog:measure:accountability',
      'catalog:measure:events-logging',
      'catalog:measure:transmission-protection',
    ]);
    expect(nodes[2]).toEqual({
      id: 'catalog:measure:transmission-protection',
      kind: 'catalog',
      title: 'Protection of data during transmission',
      url: 'https://w3id.org/dpv#EncryptionInTransfer',
      measure: { nature: 'technical', frameworks: [{ framework: 'eu-scc-2021-914-annex-ii', ref: '6' }] },
    });
    expect(nodes[0]).not.toHaveProperty('url');
    expect(Object.keys(nodes[2]!)).toEqual(['id', 'kind', 'title', 'url', 'measure']);
    // Two pages on one measure: one node, two edges.
    expect(g.edges.filter((e) => e.target === 'catalog:measure:transmission-protection')).toHaveLength(2);
  });

  it('fails on an unknown id, naming the page file and the id', () => {
    const list = classified();
    list[3] = page('security/tls', { title: 'TLS', tom_classification: ['transmision-protection'] });
    expect(() => build(list)).toThrow(
      '[dk-measures] security/tls.md: unknown measure id "transmision-protection" (not in test catalog)',
    );
  });

  it('fails without a catalog in the context rather than silently skipping', () => {
    expect(() => build(classified(), false)).toThrow(/unknown measure id "transmission-protection"/);
  });

  it('resolves draft pages too, but emits nothing for them', () => {
    const bad = [...plain(), page('drafts/wip', { title: 'WIP', doc_status: 'draft', tom_classification: ['nope'] })];
    expect(() => build(bad, true, ['/drafts/wip/'])).toThrow(/drafts\/wip\.md: unknown measure id "nope"/);
    const ok = [...plain(), page('drafts/wip', { title: 'WIP', doc_status: 'draft', tom_classification: ['accountability'] })];
    const g = build(ok, true, ['/drafts/wip/']);
    expect(g.edges.some((e) => e.rel === 'classified-as')).toBe(false);
    expect(g.nodes.some((n) => n.id.startsWith('catalog:measure:'))).toBe(false);
  });

  it('leaves an unclassified corpus byte-identical, with or without a catalog (FR-010)', () => {
    const without = JSON.stringify(build(plain(), false));
    expect(JSON.stringify(build(plain(), true))).toBe(without);
    // Positive control on the same fixture: classifying a page adds edges.
    expect(JSON.stringify(build(classified(), true))).not.toBe(without);
  });

  it('is byte-identical for any entry order', () => {
    const a = JSON.stringify(build(classified()));
    expect(JSON.stringify(build([...classified()].reverse()))).toBe(a);
  });
});
