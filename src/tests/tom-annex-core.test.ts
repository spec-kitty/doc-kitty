import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  TOM_ANNEX_COUNSEL,
  TOM_ANNEX_FORMAT,
  TOM_ANNEX_FORMAT_VERSION,
  TOM_ANNEX_LABEL,
  TOM_ANNEX_NOTICE,
  absoluteUrl,
  buildTomAnnex,
  serializeTomAnnex,
} from '../lib/tom-annex/core.mjs';
import { canonical, catalog, classified, graph, measureNode, page, record } from './fixtures/tom-annex/graph.mjs';

const SITE = new URL('https://docs.example.org');
const ctx = { site: SITE, base: '/' };

const build = (g: unknown, c: unknown, context = ctx) => buildTomAnnex(g as never, c as never, context);

describe('per-measure records grouped by scope (FR-001, FR-002)', () => {
  it('lists a classified page under its measure with the evidence fields and the note', () => {
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    const logging = annex.scopes.system.find((m: { id: string }) => m.id === 'events-logging');
    expect(logging).toBeDefined();
    expect(logging!.evidence).toEqual([
      {
        title: 'Audit logging',
        description: 'Where audit events go.',
        url: 'https://docs.example.org/architecture/audit-logging/',
        updated: '2026-11-20T00:00:00Z',
        doc_status: 'active',
        verified: [{ by: 'human:alex', at: '2026-11-21T00:00:00Z' }],
        note: 'Audit events are kept for 13 months.',
      },
    ]);
  });

  it('takes the measure fields from the catalog record, keeps framework order, and omits a missing dpv', () => {
    const rec = record('m', {
      label: 'Catalog label',
      nature: 'legal',
      frameworks: [
        { framework: 'Z', ref: '9' },
        { framework: 'A', ref: '1' },
      ],
    });
    const p = page('p');
    // The graph node's title deliberately differs: the catalog record is the source.
    const node = { ...measureNode(rec), title: 'Graph title' };
    const annex = build(graph([p, node], [classified('p', 'm')]), catalog([rec]));
    const [entry] = annex.scopes.system;
    expect(entry.label).toBe('Catalog label');
    expect(entry.nature).toBe('legal');
    expect(entry.frameworks).toEqual([
      { framework: 'Z', ref: '9' },
      { framework: 'A', ref: '1' },
    ]);
    expect('dpv' in entry).toBe(false);
  });

  it('lists an organisation-scope measure once, with every page that evidences it', () => {
    const rec = record('incident-response');
    const a = page('a');
    const b = page('b');
    const g = graph(
      [a, b, measureNode(rec)],
      [classified('a', rec.id, { scope: 'organisation' }), classified('b', rec.id, { scope: 'organisation' })],
    );
    const annex = build(g, catalog([rec]));
    expect(annex.scopes.organisation).toHaveLength(1);
    expect(annex.scopes.organisation[0].evidence.map((e: { url: string }) => e.url)).toEqual([
      'https://docs.example.org/a/',
      'https://docs.example.org/b/',
    ]);
    expect(annex.scopes.system).toEqual([]);
  });

  it('puts a measure in both groups when pages classify it under both scopes', () => {
    const rec = record('m');
    const g = graph(
      [page('sys'), page('org'), measureNode(rec)],
      [classified('sys', 'm'), classified('org', 'm', { scope: 'organisation' })],
    );
    const annex = build(g, catalog([rec]));
    expect(annex.scopes.system.map((m: { id: string }) => m.id)).toEqual(['m']);
    expect(annex.scopes.organisation.map((m: { id: string }) => m.id)).toEqual(['m']);
    expect(annex.scopes.system[0].evidence.map((e: { url: string }) => e.url)).toEqual(['https://docs.example.org/sys/']);
    expect(annex.scopes.organisation[0].evidence.map((e: { url: string }) => e.url)).toEqual([
      'https://docs.example.org/org/',
    ]);
  });

  it('defaults an edge with no scope to system (ADR-0080)', () => {
    const rec = record('m');
    const edge: Record<string, unknown> = { ...classified('p', 'm') };
    delete edge.scope;
    const annex = build(graph([page('p'), measureNode(rec)], [edge]), catalog([rec]));
    expect(annex.scopes.system.map((m: { id: string }) => m.id)).toEqual(['m']);
  });

  it('turns missing optional page fields into null and always gives verified as a list', () => {
    const rec = record('m');
    const annex = build(graph([page('p'), measureNode(rec)], [classified('p', 'm')]), catalog([rec]));
    const [ref] = annex.scopes.system[0].evidence;
    expect(ref.description).toBeNull();
    expect(ref.updated).toBeNull();
    expect(ref.note).toBeNull();
    expect(ref.verified).toEqual([]);
  });

  it('ignores edges that are not classified-as', () => {
    const rec = record('m');
    const g = graph(
      [page('p'), page('q'), measureNode(rec)],
      [{ id: 'p|related|q', source: 'p', target: 'q', rel: 'related' }, classified('p', 'm')],
    );
    const annex = build(g, catalog([rec]));
    expect(annex.scopes.system[0].evidence).toHaveLength(1);
  });

  it('throws, naming the id, when an edge targets a measure the catalog does not hold', () => {
    const g = graph([page('p')], [classified('p', 'ghost')]);
    expect(() => build(g, catalog([record('m')]))).toThrow(/\[dk-tom-annex\].*ghost/);
  });

  it('throws, naming the page, when an edge starts at a node the graph does not hold', () => {
    const rec = record('m');
    const g = graph([measureNode(rec)], [classified('missing-page', 'm')]);
    expect(() => build(g, catalog([rec]))).toThrow(/\[dk-tom-annex\].*missing-page/);
  });
});

describe('uncovered measures (FR-003)', () => {
  it('names a catalog measure with no evidence, and not a covered one (same fixture)', () => {
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    expect(annex.uncovered).toEqual([{ id: 'backup', label: 'Label backup', nature: 'technical' }]);
    const uncoveredIds = annex.uncovered.map((m: { id: string }) => m.id);
    expect(uncoveredIds).not.toContain('events-logging');
    expect(uncoveredIds).not.toContain('incident-response');
  });

  it('lists every catalog measure as uncovered when the graph has no classified-as edge', () => {
    const records = [record('b'), record('a')];
    const annex = build(graph([page('p')], []), catalog(records));
    expect(annex.uncovered.map((m: { id: string }) => m.id)).toEqual(['a', 'b']);
    expect(annex.scopes).toEqual({ system: [], organisation: [] });
  });
});

describe('labelling and the counsel items (FR-004)', () => {
  it('carries the label, the notice and the ⚖ items verbatim', () => {
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    expect(TOM_ANNEX_LABEL).toBe('Evidence index, not the contractual annex.');
    expect(annex.label).toBe(TOM_ANNEX_LABEL);
    expect(annex.notice).toBe(TOM_ANNEX_NOTICE);
    expect(TOM_ANNEX_NOTICE).toMatch(/^Not legal advice/);
    expect(annex.counsel).toEqual([...TOM_ANNEX_COUNSEL]);
    expect(TOM_ANNEX_COUNSEL).toHaveLength(3);
    for (const item of TOM_ANNEX_COUNSEL) expect(item.startsWith('⚖ ')).toBe(true);
  });

  it('names the format and its version, and the catalog it was built from', () => {
    const { graph: g } = canonical();
    const annex = build(g, catalog(canonical().records, { source: 'the shipped default catalog', isDefault: true }));
    expect(annex.format).toBe(TOM_ANNEX_FORMAT);
    expect(annex.format).toBe('doc-kitty/tom-annex');
    expect(annex.format_version).toBe(TOM_ANNEX_FORMAT_VERSION);
    expect(annex.format_version).toBe('1.0');
    expect(annex.catalog).toEqual({ source: 'the shipped default catalog', default: true });
  });
});

describe('URLs, notes and ordering (FR-007)', () => {
  it('builds absolute URLs the way the agent API does, with a base and with no site', () => {
    expect(absoluteUrl(SITE, '/', '/a/b/')).toBe('https://docs.example.org/a/b/');
    expect(absoluteUrl(SITE, '/docs/', '/a/b/')).toBe('https://docs.example.org/docs/a/b/');
    expect(absoluteUrl(SITE, '/docs', '/a/')).toBe('https://docs.example.org/docs/a/');
    expect(absoluteUrl(undefined, '/', '/a/')).toBe('http://localhost:4321/a/');
  });

  it('flattens whitespace in notes and trims them', () => {
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    const logging = annex.scopes.system.find((m: { id: string }) => m.id === 'events-logging');
    expect(logging!.evidence[0].note).toBe('Audit events are kept for 13 months.');
  });

  it('sorts measures by id and evidence by url, by code unit', () => {
    const recs = [record('b-measure'), record('B-upper'), record('a-measure')];
    const g = graph(
      [page('z'), page('Y'), page('a'), ...recs.map(measureNode)],
      [
        classified('z', 'b-measure'),
        classified('Y', 'b-measure'),
        classified('a', 'b-measure'),
        classified('a', 'B-upper'),
        classified('a', 'a-measure'),
      ],
    );
    const annex = build(g, catalog(recs));
    // Code-unit order: uppercase sorts before lowercase.
    expect(annex.scopes.system.map((m: { id: string }) => m.id)).toEqual(['B-upper', 'a-measure', 'b-measure']);
    expect(annex.scopes.system[2].evidence.map((e: { url: string }) => e.url)).toEqual([
      'https://docs.example.org/Y/',
      'https://docs.example.org/a/',
      'https://docs.example.org/z/',
    ]);
  });

  it('gives the same bytes when the input nodes and edges are shuffled', () => {
    const { graph: g, catalog: c } = canonical();
    const reversed = { ...g, nodes: [...g.nodes].reverse(), edges: [...g.edges].reverse() };
    const shuffledCatalog = { ...c, records: [...c.records].reverse() };
    expect(serializeTomAnnex(build(reversed, shuffledCatalog))).toBe(serializeTomAnnex(build(g, c)));
  });
});

describe('canonical serialiser and the shipped schema (FR-013)', () => {
  it('serialises the canonical fixture to the expected bytes, keys in schema order', () => {
    const { graph: g, catalog: c } = canonical();
    const frameworks = (id: string) => [{ framework: 'ISO27001', ref: `A.${id.length}` }];
    const audit = {
      title: 'Audit logging',
      description: 'Where audit events go.',
      url: 'https://docs.example.org/architecture/audit-logging/',
      updated: '2026-11-20T00:00:00Z',
      doc_status: 'active',
      verified: [{ by: 'human:alex', at: '2026-11-21T00:00:00Z' }],
    };
    const expected = {
      format: 'doc-kitty/tom-annex',
      format_version: '1.0',
      label: TOM_ANNEX_LABEL,
      notice: TOM_ANNEX_NOTICE,
      catalog: { source: 'test catalog', default: false },
      scopes: {
        system: [
          {
            id: 'access-control',
            label: 'Label access-control',
            nature: 'technical',
            frameworks: frameworks('access-control'),
            dpv: 'https://w3id.org/dpv#AccessControlMethod',
            evidence: [
              { ...audit, note: null },
              {
                title: 'Access',
                description: 'Who can sign in.',
                url: 'https://docs.example.org/guides/access/',
                updated: null,
                doc_status: 'active',
                verified: [],
                note: 'SSO only.',
              },
            ],
          },
          {
            id: 'events-logging',
            label: 'Label events-logging',
            nature: 'technical',
            frameworks: frameworks('events-logging'),
            dpv: 'https://w3id.org/dpv#Logging',
            evidence: [{ ...audit, note: 'Audit events are kept for 13 months.' }],
          },
        ],
        organisation: [
          {
            id: 'incident-response',
            label: 'Label incident-response',
            nature: 'organisational',
            frameworks: frameworks('incident-response'),
            evidence: [
              {
                title: 'Incident handling',
                description: null,
                url: 'https://docs.example.org/context/incident-handling/',
                updated: null,
                doc_status: 'active',
                verified: [],
                note: 'Runbook owned by the SRE team.',
              },
            ],
          },
        ],
      },
      uncovered: [{ id: 'backup', label: 'Label backup', nature: 'technical' }],
      counsel: [...TOM_ANNEX_COUNSEL],
    };
    expect(serializeTomAnnex(build(g, c))).toBe(`${JSON.stringify(expected, null, 2)}\n`);
  });

  it('writes keys in schema order even when the input object was built in another order', () => {
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    const scrambled = Object.fromEntries(Object.entries(annex).reverse());
    expect(serializeTomAnnex(scrambled as never)).toBe(serializeTomAnnex(annex));
  });

  it('builds objects whose keys the shipped schema declares, with every required key present', () => {
    const schema = JSON.parse(readFileSync(new URL('../lib/tom-annex/tom-annex.schema.json', import.meta.url), 'utf8'));
    const { graph: g, catalog: c } = canonical();
    const annex = build(g, c);
    const check = (obj: Record<string, unknown>, def: { properties: Record<string, unknown>; required: string[] }) => {
      for (const key of Object.keys(obj)) expect(Object.keys(def.properties)).toContain(key);
      for (const key of def.required) expect(obj).toHaveProperty(key);
    };
    check(annex, schema);
    for (const scope of ['system', 'organisation'] as const) {
      for (const entry of annex.scopes[scope]) {
        check(entry, schema.$defs.measureEntry);
        for (const ref of entry.evidence) check(ref, schema.$defs.evidenceRef);
      }
    }
    for (const u of annex.uncovered) check(u, schema.properties.uncovered.items);
    expect(annex.format_version).toMatch(new RegExp(schema.properties.format_version.pattern));
    // WP01 ships the schema with `generated` described but not yet required (WP06 makes it required).
    expect(schema.properties.generated).toBeDefined();
    expect(schema.required).not.toContain('generated');
  });
});
