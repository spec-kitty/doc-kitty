// @ts-check
/**
 * The artifact gate's checks for the evidence index (#401, WP05): what a real
 * build must hold. Pure, so the gate (`assert-build-artifacts.mjs`) and its
 * unit tests run the same rules.
 *
 * - A site whose content graph has `classified-as` edges must build
 *   `api/tom-annex.json` and link it from `api/index.json` as
 *   `_links.tomAnnex`; the file must be format `doc-kitty/tom-annex` 1.x with
 *   the exact label; every evidence page must be a built page; and its
 *   (measure, scope, page) triples must equal the graph's edges, so drafts and
 *   unclassified pages cannot slip in or fall out (FR-006).
 * - A site with no such edge must build neither the file nor the link (FR-012).
 *
 * @module tom-annex/verify
 */

import { TOM_ANNEX_FORMAT, TOM_ANNEX_LABEL } from './core.mjs';

const MEASURE_PREFIX = 'catalog:measure:';

/**
 * @typedef {object} TomAnnexBuild
 * @property {{ nodes: Array<Record<string, any>>, edges: Array<Record<string, any>> }} graph the built content graph
 * @property {Record<string, { href?: string }>} indexLinks `api/index.json`'s `_links`
 * @property {string | undefined} annexText the built `api/tom-annex.json`, or undefined when absent
 * @property {(url: string) => boolean} pageBuilt whether an absolute page URL names a built page
 * @property {string} [sitePrefix] the site's origin and base with a trailing slash, as the gate derives it; by default it is read from `_links.self`, which assumes the index sits at `api/index.json`
 */

/**
 * @param {TomAnnexBuild} build
 * @returns {string[]} the problems, empty when the build is right
 */
export function tomAnnexProblems({ graph, indexLinks, annexText, pageBuilt, sitePrefix }) {
  const edges = graph.edges.filter((e) => e.rel === 'classified-as');
  const linked = indexLinks?.tomAnnex !== undefined;
  if (edges.length === 0) {
    const problems = [];
    if (annexText !== undefined) problems.push('evidence index: the content graph has no classified-as edge, yet api/tom-annex.json was built');
    if (linked) problems.push('evidence index: the content graph has no classified-as edge, yet api/index.json has _links.tomAnnex');
    return problems;
  }

  const problems = [];
  if (!linked) problems.push('evidence index: the content graph has classified-as edges, but api/index.json has no _links.tomAnnex');
  if (annexText === undefined) {
    problems.push('evidence index: the content graph has classified-as edges, but api/tom-annex.json was not built');
    return problems;
  }
  /** @type {any} */
  let annex;
  try {
    annex = JSON.parse(annexText);
  } catch (err) {
    return [...problems, `evidence index: api/tom-annex.json is not valid JSON (${err instanceof Error ? err.message : String(err)})`];
  }
  if (annex?.format !== TOM_ANNEX_FORMAT) problems.push(`evidence index: format is ${JSON.stringify(annex?.format)}, expected "${TOM_ANNEX_FORMAT}"`);
  if (typeof annex?.format_version !== 'string' || !/^1\.\d+$/.test(annex.format_version)) {
    problems.push(`evidence index: format_version is ${JSON.stringify(annex?.format_version)}, expected 1.x`);
  }
  if (annex?.label !== TOM_ANNEX_LABEL) problems.push(`evidence index: label is ${JSON.stringify(annex?.label)}, expected "${TOM_ANNEX_LABEL}"`);

  const prefix = sitePrefix ?? prefixFromSelf(indexLinks);
  const pages = new Map(graph.nodes.map((n) => [n.id, n]));
  /** @type {Set<string>} */
  const expected = new Set();
  for (const edge of edges) {
    const href = pages.get(edge.source)?.href;
    if (typeof href !== 'string') {
      problems.push(`evidence index: the content graph's page ${edge.source} has no href`);
      continue;
    }
    expected.add(triple(String(edge.target).slice(MEASURE_PREFIX.length), edge.scope === 'organisation' ? 'organisation' : 'system', new URL(href.replace(/^\//, ''), prefix).href));
  }

  /** @type {Set<string>} */
  const actual = new Set();
  for (const scope of ['system', 'organisation']) {
    for (const entry of Array.isArray(annex?.scopes?.[scope]) ? annex.scopes[scope] : []) {
      for (const ref of Array.isArray(entry?.evidence) ? entry.evidence : []) {
        actual.add(triple(entry.id, scope, ref.url));
        if (!pageBuilt(ref.url)) problems.push(`evidence index: ${entry.id} cites ${ref.url}, which is not a built page`);
      }
    }
  }
  for (const t of actual) if (!expected.has(t)) problems.push(`evidence index: an entry is not in the content graph (${show(t)})`);
  for (const t of expected) if (!actual.has(t)) problems.push(`evidence index: a classified-as edge is missing from the evidence index (${show(t)})`);
  return problems;
}

/**
 * The site prefix (origin + base, with a trailing slash), read from the index's own `self` link.
 *
 * @param {Record<string, { href?: string }>} indexLinks
 */
function prefixFromSelf(indexLinks) {
  const self = indexLinks?.self?.href ?? 'http://localhost:4321/api/index.json';
  return self.replace(/api\/index\.json$/, '');
}

/** @param {string} measure @param {string} scope @param {string} url */
const triple = (measure, scope, url) => `${measure}\0${scope}\0${url}`;

/** @param {string} t */
const show = (t) => t.split('\0').join(', ');
