// @ts-check
/**
 * Tiny builders for the evidence-index (TOM annex) tests: each test states its
 * own content graph and catalog. The node and edge shapes mirror what
 * `buildContentGraph` writes (`src/lib/docs-index.ts`): page nodes carry an
 * unbased `href`, measure nodes are `catalog:measure:<id>`, and a
 * `classified-as` edge always carries its `scope`.
 */

/**
 * @param {string} id the page node id (also used to derive a default href)
 * @param {Record<string, unknown>} [fields]
 */
export function page(id, fields = {}) {
  return { id, kind: 'page', title: `Title of ${id}`, href: `/${id}/`, doc_status: 'active', ...fields };
}

/**
 * @typedef {{ id: string, label: string, nature: string, frameworks: Array<{ framework: string, ref: string }>, dpv?: string }} FixtureRecord
 */

/**
 * The measure record a catalog holds.
 *
 * @param {string} id
 * @param {Partial<FixtureRecord>} [fields]
 * @returns {FixtureRecord}
 */
export function record(id, fields = {}) {
  return {
    id,
    label: `Label ${id}`,
    nature: 'technical',
    frameworks: [{ framework: 'ISO27001', ref: `A.${id.length}` }],
    ...fields,
  };
}

/**
 * The measure node `classifiedEdges` writes for a record.
 *
 * @param {FixtureRecord} rec
 */
export function measureNode(rec) {
  return {
    id: `catalog:measure:${rec.id}`,
    kind: 'catalog',
    title: rec.label,
    ...(rec.dpv ? { url: rec.dpv } : {}),
    measure: { nature: rec.nature, frameworks: rec.frameworks },
  };
}

/**
 * A `classified-as` edge, with the id format the graph sink uses.
 *
 * @param {string} pageId
 * @param {string} measureId
 * @param {{ note?: string, scope?: 'system' | 'organisation' }} [opts]
 */
export function classified(pageId, measureId, { note, scope = 'system' } = {}) {
  const target = `catalog:measure:${measureId}`;
  return {
    id: `${pageId}|classified-as|${target}`,
    source: pageId,
    target,
    rel: 'classified-as',
    ...(note ? { note } : {}),
    scope,
  };
}

/**
 * The catalog argument `buildTomAnnex` takes.
 *
 * @param {FixtureRecord[]} records
 * @param {{ source?: string, isDefault?: boolean }} [opts]
 */
export function catalog(records, { source = 'test catalog', isDefault = false } = {}) {
  return { records, source, isDefault };
}

/**
 * A minimal content graph around the given nodes and edges.
 *
 * @param {Array<Record<string, unknown>>} nodes
 * @param {Array<Record<string, unknown>>} edges
 */
export function graph(nodes, edges) {
  return { schema: 'doc-kitty/content-graph', okf_version: '0.2', generatedFrom: 'doc-kitty', nodes, edges };
}

/**
 * The canonical fixture: four measures, three pages, one page classifying two
 * measures, one organisation-scope entry, and one uncovered measure (`backup`).
 */
export function canonical() {
  const records = [
    record('events-logging', { dpv: 'https://w3id.org/dpv#Logging' }),
    record('incident-response', { nature: 'organisational' }),
    record('access-control', { dpv: 'https://w3id.org/dpv#AccessControlMethod' }),
    record('backup', { nature: 'technical' }),
  ];
  const audit = page('architecture/audit-logging', {
    title: 'Audit logging',
    description: 'Where audit events go.',
    updated: '2026-11-20T00:00:00Z',
    verified: [{ by: 'human:alex', at: '2026-11-21T00:00:00Z', content_hash: 'sha256:0123456789ab' }],
  });
  const incidents = page('context/incident-handling', { title: 'Incident handling' });
  const access = page('guides/access', { title: 'Access', description: 'Who can sign in.' });
  const other = page('guides/unrelated', { title: 'Unrelated' });
  const nodes = [audit, incidents, access, other, ...records.slice(0, 3).map(measureNode)];
  const edges = [
    classified(audit.id, 'events-logging', { note: 'Audit events\nare kept\tfor 13 months.' }),
    classified(audit.id, 'access-control'),
    classified(incidents.id, 'incident-response', { scope: 'organisation', note: 'Runbook owned by the SRE team.' }),
    classified(access.id, 'access-control', { note: 'SSO only.' }),
  ];
  return { graph: graph(nodes, edges), catalog: catalog(records), records };
}
