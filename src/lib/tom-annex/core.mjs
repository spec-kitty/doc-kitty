// @ts-check
/**
 * The evidence index (TOM annex) core, format 1.0 (#401, ADR-0080, ADR-0087).
 *
 * **Evidence index, not the contractual annex.** It lists, per catalog measure,
 * the published pages that evidence it, grouped by `scope`, and the measures
 * no page evidences. The annex of a data processing agreement stays the
 * parties' own document. Not legal advice.
 *
 * Pure: no `node:fs`, no Astro. The route (`/api/tom-annex.json`), the OKF
 * export and the snapshot CLI all call {@link buildTomAnnex} and
 * {@link serializeTomAnnex}; none of them re-derives the index (C-004). Its
 * input is the built content graph (its `classified-as` edges, ADR-0080 D6),
 * which already leaves drafts out, and the effective measures catalog.
 *
 * The format is documented in `docs/guides/tom-annex.md` and described by the
 * shipped `tom-annex.schema.json`. A field rename or removal is a major version
 * change; an addition is a minor one.
 *
 * @module tom-annex/core
 */

import { compareCodeUnit } from '../vocabulary-core.mjs';

/** @typedef {import('../measures-core.mjs').MeasureRecord} MeasureRecord */
/** @typedef {import('../measures-core.mjs').MeasureNature} MeasureNature */
/** @typedef {import('../measures-core.mjs').MeasureScope} MeasureScope */
/** @typedef {{ framework: string, ref: string }} FrameworkRef */

/**
 * @typedef {object} EvidenceRef
 * @property {string} title
 * @property {string | null} description
 * @property {string} url
 * @property {string | null} updated
 * @property {string} doc_status
 * @property {Array<{ by: string, at: string }>} verified
 * @property {string | null} note
 */

/**
 * @typedef {object} MeasureEntry
 * @property {string} id
 * @property {string} label
 * @property {MeasureNature} nature
 * @property {FrameworkRef[]} frameworks
 * @property {string} [dpv]
 * @property {EvidenceRef[]} evidence
 */

/**
 * @typedef {object} TomAnnex
 * @property {string} format
 * @property {string} format_version
 * @property {string} label
 * @property {string} notice
 * @property {{ by: string, at: string | null, source_digest: string, content_hash: string }} [generated]
 * @property {{ source: string, default: boolean }} catalog
 * @property {{ system: MeasureEntry[], organisation: MeasureEntry[] }} scopes
 * @property {Array<{ id: string, label: string, nature: MeasureNature }>} uncovered
 * @property {string[]} counsel
 */

/**
 * The catalog argument: the effective measures catalog, as
 * `loadMeasuresCatalog` returns it (only the fields the index needs).
 *
 * @typedef {object} AnnexCatalog
 * @property {readonly MeasureRecord[]} records
 * @property {string} source
 * @property {boolean} isDefault
 */

/**
 * @typedef {object} AnnexGraph
 * @property {ReadonlyArray<Record<string, any>>} nodes
 * @property {ReadonlyArray<Record<string, any>>} edges
 */

/** The format identifier. */
export const TOM_ANNEX_FORMAT = 'doc-kitty/tom-annex';

/** The format version: major.minor (NFR-003). */
export const TOM_ANNEX_FORMAT_VERSION = '1.0';

/** The label every generated surface carries (FR-004). ⚖ wording awaits counsel. */
export const TOM_ANNEX_LABEL = 'Evidence index, not the contractual annex.';

/** The notice every generated surface carries (FR-004, C-001). ⚖ wording awaits counsel. */
export const TOM_ANNEX_NOTICE =
  "Not legal advice: this index lists documentation that evidences each measure; the annex of a data processing agreement remains the parties' own document.";

/** The items that await data-protection counsel, in a fixed order. */
export const TOM_ANNEX_COUNSEL = Object.freeze([
  '⚖ The wording "evidence index, not the contractual annex" and the notice on every generated surface.',
  '⚖ Whether a data processing agreement may reference this living index, or needs a dated snapshot.',
  '⚖ Whether the uncovered list may be shown to third parties, since it can reveal gaps.',
]);

/** The prefix every evidence-index error carries. */
const TAG = '[dk-tom-annex]';

/** The scopes, in serialised order. */
const SCOPES = /** @type {const} */ (['system', 'organisation']);

const MEASURE_NODE_PREFIX = 'catalog:measure:';

/**
 * The site's base path, normalised as `withBase` does (`src/lib/with-base.ts`):
 * `''` for no base, else `/seg` with no trailing slash.
 *
 * @param {string | undefined} raw
 */
function normaliseBase(raw) {
  if (!raw || raw === '/') return '';
  return ('/' + raw + '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

/**
 * An absolute page URL: `site` + `base` + the page's unbased `href`. It must
 * match `absolute()` in `src/lib/routes/shared.ts`, which this fs-free module
 * cannot import; the build tests cross-check the two (WP05).
 *
 * @param {URL | undefined} site
 * @param {string | undefined} base `import.meta.env.BASE_URL`
 * @param {string} href a root-absolute, unbased route such as `/a/b/`
 * @returns {string}
 */
export function absoluteUrl(site, base, href) {
  const prefix = normaliseBase(base);
  const based = prefix === '' || href === prefix || href.startsWith(`${prefix}/`) ? href : `${prefix}${href}`;
  return new URL(based, site ?? new URL('http://localhost:4321')).href;
}

/**
 * Authored free text (a note) as one line: runs of whitespace become one space.
 * The OKF export flattens measure notes the same way.
 *
 * @param {unknown} text
 * @returns {string | null}
 */
function flatten(text) {
  if (typeof text !== 'string') return null;
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat === '' ? null : flat;
}

/** @param {unknown} value */
const stringOrNull = (value) => (typeof value === 'string' && value !== '' ? value : null);

/**
 * A page's verifications as `{by, at}` pairs; anything else in a graph stamp
 * (such as `content_hash`) is not part of the format.
 *
 * @param {unknown} verified
 */
function verifiedPairs(verified) {
  if (!Array.isArray(verified)) return [];
  return verified
    .filter((v) => v && typeof v.by === 'string' && typeof v.at === 'string')
    .map((v) => ({ by: v.by, at: v.at }));
}

/**
 * Build the evidence index from the content graph and the catalog.
 *
 * @param {AnnexGraph} graph the built content graph (drafts already left out)
 * @param {AnnexCatalog} catalog the effective measures catalog
 * @param {{ site?: URL, base?: string }} context the site and base, for absolute URLs
 * @returns {TomAnnex}
 */
export function buildTomAnnex(graph, catalog, { site, base } = {}) {
  const records = new Map(catalog.records.map((r) => [r.id, r]));
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  /** @type {Record<MeasureScope, Map<string, Map<string, EvidenceRef>>>} measure id -> url -> ref */
  const grouped = { system: new Map(), organisation: new Map() };

  for (const edge of graph.edges) {
    if (edge.rel !== 'classified-as') continue;
    const target = String(edge.target);
    const measureId = target.startsWith(MEASURE_NODE_PREFIX) ? target.slice(MEASURE_NODE_PREFIX.length) : target;
    if (!records.has(measureId)) {
      throw new Error(`${TAG} a classified-as edge from "${edge.source}" names measure "${measureId}", which the catalog (${catalog.source}) does not hold`);
    }
    const pageNode = nodes.get(edge.source);
    if (!pageNode) {
      throw new Error(`${TAG} a classified-as edge to "${measureId}" starts at "${edge.source}", which the content graph does not hold`);
    }
    /** @type {MeasureScope} */
    const scope = edge.scope === 'organisation' ? 'organisation' : 'system';
    const ref = evidenceRef(pageNode, edge.note, site, base);
    const byUrl = grouped[scope].get(measureId) ?? new Map();
    byUrl.set(ref.url, ref);
    grouped[scope].set(measureId, byUrl);
  }

  const scopes = { system: entriesOf(grouped.system, records), organisation: entriesOf(grouped.organisation, records) };
  const covered = new Set([...grouped.system.keys(), ...grouped.organisation.keys()]);
  const uncovered = [...records.values()]
    .filter((r) => !covered.has(r.id))
    .sort((a, b) => compareCodeUnit(a.id, b.id))
    .map((r) => ({ id: r.id, label: r.label, nature: r.nature }));

  return {
    format: TOM_ANNEX_FORMAT,
    format_version: TOM_ANNEX_FORMAT_VERSION,
    label: TOM_ANNEX_LABEL,
    notice: TOM_ANNEX_NOTICE,
    catalog: { source: catalog.source, default: catalog.isDefault },
    scopes,
    uncovered,
    counsel: [...TOM_ANNEX_COUNSEL],
  };
}

/**
 * A page node's route. The content graph always writes it (`pageNode` in
 * `docs-index.ts`); the index never builds an address by hand.
 *
 * @param {Record<string, any>} node
 * @returns {string}
 */
function pageHref(node) {
  if (typeof node.href !== 'string' || node.href === '') {
    throw new Error(`${TAG} the page node "${node.id}" has no href, so the evidence index cannot give it a URL`);
  }
  return node.href;
}

/**
 * @param {Record<string, any>} node a page node
 * @param {unknown} note the classification entry's note
 * @param {URL | undefined} site
 * @param {string | undefined} base
 * @returns {EvidenceRef}
 */
function evidenceRef(node, note, site, base) {
  return {
    title: typeof node.title === 'string' ? node.title : String(node.id),
    description: stringOrNull(node.description),
    url: absoluteUrl(site, base, pageHref(node)),
    updated: stringOrNull(node.updated),
    doc_status: typeof node.doc_status === 'string' ? node.doc_status : 'active',
    verified: verifiedPairs(node.verified),
    note: flatten(note),
  };
}

/**
 * @param {Map<string, Map<string, EvidenceRef>>} group
 * @param {Map<string, MeasureRecord>} records
 * @returns {MeasureEntry[]}
 */
function entriesOf(group, records) {
  return [...group.keys()].sort(compareCodeUnit).map((id) => {
    const rec = /** @type {MeasureRecord} */ (records.get(id));
    const byUrl = /** @type {Map<string, EvidenceRef>} */ (group.get(id));
    return {
      id,
      label: rec.label,
      nature: rec.nature,
      frameworks: rec.frameworks.map((f) => ({ framework: f.framework, ref: f.ref })),
      ...(rec.dpv ? { dpv: rec.dpv } : {}),
      evidence: [...byUrl.keys()].sort(compareCodeUnit).map((url) => /** @type {EvidenceRef} */ (byUrl.get(url))),
    };
  });
}

// --- canonical serialisation ------------------------------------------------
// Keys are written in schema order, whatever order the input object has, so
// the bytes depend only on the content (FR-007, NFR-001).

/** @param {EvidenceRef} r */
const orderedRef = (r) => ({
  title: r.title,
  description: r.description,
  url: r.url,
  updated: r.updated,
  doc_status: r.doc_status,
  verified: r.verified.map((v) => ({ by: v.by, at: v.at })),
  note: r.note,
});

/** @param {MeasureEntry} m */
const orderedEntry = (m) => ({
  id: m.id,
  label: m.label,
  nature: m.nature,
  frameworks: m.frameworks.map((f) => ({ framework: f.framework, ref: f.ref })),
  ...(m.dpv !== undefined ? { dpv: m.dpv } : {}),
  evidence: m.evidence.map(orderedRef),
});

/**
 * The canonical bytes of an evidence index: two-space JSON, keys in schema
 * order, and a final newline.
 *
 * @param {TomAnnex} annex
 * @returns {string}
 */
export function serializeTomAnnex(annex) {
  const g = annex.generated;
  const ordered = {
    format: annex.format,
    format_version: annex.format_version,
    label: annex.label,
    notice: annex.notice,
    ...(g ? { generated: { by: g.by, at: g.at, source_digest: g.source_digest, content_hash: g.content_hash } } : {}),
    catalog: { source: annex.catalog.source, default: annex.catalog.default },
    scopes: Object.fromEntries(SCOPES.map((s) => [s, annex.scopes[s].map(orderedEntry)])),
    uncovered: annex.uncovered.map((u) => ({ id: u.id, label: u.label, nature: u.nature })),
    counsel: [...annex.counsel],
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
