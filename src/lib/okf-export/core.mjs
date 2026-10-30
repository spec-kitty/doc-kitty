// @ts-check
/**
 * OKF v0.2 export core (#178, FR-015..FR-017, FR-019, FR-025, C-003, C-010).
 *
 * A pure function: `(graph, sourceFiles, options) -> Map<path, text>`. No I/O and
 * no relation resolution: every relation is read from `graph.edges` (C-010), and
 * the source tree is filtered to graph node membership, so drafts (which the graph
 * never holds) cannot appear. The CLI and the `astro:build:done` hook (WP08) read
 * the files and write the map; both share this one core.
 *
 * Values are UTF-8 text with LF endings. Keys are sorted with `compareCodeUnit`
 * and nothing depends on time, so two runs over the same input are identical.
 *
 * @module okf-export/core
 */

import matter from 'gray-matter';
import {
  OKF_VERSION,
  SECTION_TYPE,
  compareCodeUnit,
  formatInstant,
  normalizeIndexBasenames,
  toActor,
} from '../vocabulary-core.mjs';
import { idIndex, rewriteBodyLinks, routeIndex } from './links.mjs';
import { okfGenerated } from '../generator-stamp.mjs';
import { SCHEMATIC_KIND, schematicHref } from '../schematic/core.mjs';

/** `generated.by` of a page that has neither a stamp nor an author (FR-025). */
export const EXPORT_PROCESS_ACTOR = 'process:dockitty-export';

/**
 * Relation sections in their fixed order: graph `rel`, then the heading.
 * `in-section` is not here: the index entry lists express it.
 */
const RELATION_SECTIONS = /** @type {const} */ ([
  ['related', 'Related'],
  ['audience', 'Audience'],
  ['cites', 'References'],
  ['derived-from', 'Derived from'],
]);

/**
 * @typedef {object} ExportGraph
 * @property {Array<Record<string, any>>} nodes
 * @property {Array<{source: string, target: string, rel: string, note?: string}>} edges
 */

/**
 * @typedef {object} ExportOptions
 * @property {string | string[]} [indexBasename] the site's index file name(s), default `README`
 * @property {string} [base] site base path (e.g. `/docs`) that graph `href`s and body links may carry
 * @property {string} [siteUrl] absolute site origin (e.g. `https://docs.example.org`); the `base` is added to it, and a URL that already ends in the base is accepted as is. Internal links that are not bundle pages become absolute against it
 */

// --- paths ------------------------------------------------------------------

/**
 * @param {string} id a graph node id (bundle path without `.md`)
 * @param {string[]} indexNames
 * @returns {boolean}
 */
const isIndexId = (id, indexNames) => indexNames.includes(id.slice(id.lastIndexOf('/') + 1));

/**
 * The bundle path a page or persona node is exported to: `<id>.md`, except an
 * index file, which is always `<dir>/index.md`.
 *
 * @param {string} id
 * @param {string | string[]} [indexBasename]
 * @returns {string}
 */
export function bundlePathOf(id, indexBasename) {
  const names = normalizeIndexBasenames(indexBasename);
  if (!isIndexId(id, names)) return `${id}.md`;
  const slash = id.lastIndexOf('/');
  return slash < 0 ? 'index.md' : `${id.slice(0, slash)}/index.md`;
}

/**
 * The bundle path of an index node's overview page (#238): `<id>.md`, the
 * sibling that carries the README body. `undefined` when `id` is not an index
 * id, or when `<id>.md` would be the index file itself (basename `index`).
 *
 * @param {string} id
 * @param {string | string[]} [indexBasename]
 * @returns {string | undefined}
 */
export function overviewPathOf(id, indexBasename) {
  const names = normalizeIndexBasenames(indexBasename);
  if (!isIndexId(id, names)) return undefined;
  const overview = `${id}.md`;
  return overview === bundlePathOf(id, names) ? undefined : overview;
}

// --- YAML (deterministic subset: scalars, lists, mappings) -------------------

/** @param {unknown} v */
const scalar = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

/** @param {unknown} v */
const isMap = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

/**
 * @param {string} key
 * @param {unknown} value
 * @param {number} indent
 * @returns {string[]}
 */
function emitEntry(key, value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`];
    return [`${pad}${key}:`, ...value.flatMap((item) => emitItem(item, indent + 2))];
  }
  if (isMap(value)) {
    const inner = emitMap(/** @type {Record<string, unknown>} */ (value), indent + 2);
    return inner.length === 0 ? [`${pad}${key}: {}`] : [`${pad}${key}:`, ...inner];
  }
  return [`${pad}${key}: ${scalar(value)}`];
}

/**
 * @param {unknown} item
 * @param {number} indent
 * @returns {string[]}
 */
function emitItem(item, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(item)) return [`${pad}- ${JSON.stringify(item)}`];
  if (!isMap(item)) return [`${pad}- ${scalar(item)}`];
  const lines = emitMap(/** @type {Record<string, unknown>} */ (item), indent + 2);
  return lines.length === 0 ? [`${pad}- {}`] : [`${pad}- ${lines[0].slice(indent + 2)}`, ...lines.slice(1)];
}

/**
 * @param {Record<string, unknown>} map insertion order is the output order
 * @param {number} [indent]
 * @returns {string[]}
 */
function emitMap(map, indent = 0) {
  return Object.entries(map)
    .filter(([, v]) => v !== undefined)
    .flatMap(([k, v]) => emitEntry(k, v, indent));
}

/**
 * Serialise a mapping as YAML in insertion order.
 *
 * @param {Record<string, unknown>} map
 * @returns {string} lines joined with LF, no trailing newline
 */
function toYaml(map) {
  return emitMap(map).join('\n');
}

/**
 * Deep copy with every mapping's keys sorted and dates as canonical instants.
 *
 * @param {unknown} v
 * @returns {unknown}
 */
function sortedPlain(v) {
  if (v instanceof Date) return formatInstant(v);
  if (Array.isArray(v)) return v.map(sortedPlain);
  if (!isMap(v)) return v;
  return Object.fromEntries(
    Object.keys(/** @type {object} */ (v))
      .sort(compareCodeUnit)
      .map((k) => [k, sortedPlain(/** @type {Record<string, unknown>} */ (v)[k])]),
  );
}

const fence = (/** @type {string} */ yaml) => `---\n${yaml}\n---\n`;

// --- concept frontmatter ----------------------------------------------------

/**
 * FR-025: `generated.by` = an ownership stamp's `by`, else the first author,
 * else the export process; `at` = the stamp's, else `updated`, else a
 * non-ownership stamp's `at` (#226). The author consumed as `by` leaves `authors`.
 *
 * @param {Record<string, any>} node
 * @returns {{generated: Record<string, string>, authors: string[]}}
 */
export function generatedFor(node) {
  const authors = /** @type {string[]} */ ((node.authors ?? []).flatMap((/** @type {unknown} */ a) => toActor(a) ?? []));
  const { stamp, at } = okfGenerated(node);
  const fromAuthor = stamp?.by === undefined && authors.length > 0;
  return {
    generated: {
      by: stamp?.by ?? authors[0] ?? EXPORT_PROCESS_ACTOR,
      ...(at === undefined ? {} : { at }),
      ...(stamp?.content_hash === undefined ? {} : { content_hash: stamp.content_hash }),
    },
    authors: fromAuthor ? authors.slice(1) : authors,
  };
}

/**
 * @param {Record<string, any>} node
 * @returns {string}
 */
const typeOf = (node) => node.type || SECTION_TYPE[node.section] || 'Concept';

/**
 * @param {Record<string, any>} node
 * @param {Array<Record<string, string>>} extraSources sources the body cannot link (catalog entries without a URL)
 * @param {string | undefined} resource the concept's `resource`
 * @returns {Record<string, unknown>} frontmatter in its fixed key order
 */
function conceptFrontmatter(node, extraSources, resource) {
  const { generated, authors } = generatedFor(node);
  const sources = [...(node.sources ?? []), ...extraSources];
  return {
    type: typeOf(node),
    title: node.title,
    description: node.description,
    status: node.status,
    generated,
    authors: authors.length > 0 ? authors : undefined,
    tags: node.tags,
    resource,
    verified: node.verified,
    stale_after: node.stale_after,
    sources: sources.length > 0 ? sources : undefined,
  };
}

// --- relation sections ------------------------------------------------------

/** @param {string} text */
const escapeLabel = (text) => text.replace(/([[\]])/g, '\\$1');

/**
 * One list line, `- [label](href)suffix`; the single place a label is escaped.
 *
 * @param {string} label raw (unescaped) link text
 * @param {string} href
 * @param {string} suffix already formatted (` - note`) or ''
 * @returns {string}
 */
const linkLine = (label, href, suffix) => `- [${escapeLabel(label)}](${href})${suffix}`;

/**
 * Render one edge as a list line, or `null` when it has no linkable form.
 * Pages and personas link as bundle paths; a catalog or inline citation links to
 * its external URL; a non-URL `derived-from` resource is plain text.
 *
 * @param {{target: string, rel: string, note?: string}} edge
 * @param {Record<string, any> | undefined} target
 * @param {string[]} indexNames
 * @returns {string | null}
 */
function relationLine(edge, target, indexNames) {
  if (!target) return null;
  const label = target.title ?? target.id;
  const note = edge.note ? ` - ${edge.note}` : '';
  if (target.kind === 'page' || target.kind === 'persona') {
    return linkLine(label, `/${bundlePathOf(target.id, indexNames)}`, note);
  }
  const external = [target.url, target.resource].find((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  if (external) return linkLine(label, external, note);
  if (edge.rel === 'derived-from' && target.resource) return `- ${escapeLabel(label)} (\`${target.resource}\`)${note}`;
  return null;
}

/**
 * @param {Record<string, any>} edgeTarget
 * @returns {Record<string, string>}
 */
const unlinkedSource = (edgeTarget) => ({
  id: edgeTarget.id.replace(/^catalog:/, '').replace(/:/g, '-'),
  resource: edgeTarget.id,
  title: edgeTarget.title ?? edgeTarget.id,
});

/**
 * The generated relation sections of one page and the `sources` entries for the
 * citations the body cannot link.
 *
 * @param {Array<{target: string, rel: string, note?: string}>} edges the page's outgoing edges
 * @param {Map<string, Record<string, any>>} nodes
 * @param {string[]} indexNames
 * @returns {{markdown: string, extraSources: Array<Record<string, string>>}}
 */
function relationSections(edges, nodes, indexNames) {
  const sections = [];
  const extraSources = [];
  for (const [rel, heading] of RELATION_SECTIONS) {
    const lines = [];
    for (const edge of edges.filter((e) => e.rel === rel)) {
      const target = nodes.get(edge.target);
      const line = relationLine(edge, target, indexNames);
      if (line !== null) lines.push(line);
      else if (target && rel === 'cites') extraSources.push(unlinkedSource(target));
    }
    if (lines.length > 0) sections.push(`## ${heading}\n\n${[...new Set(lines)].join('\n')}\n`);
  }
  return { markdown: sections.join('\n'), extraSources };
}

// --- files ------------------------------------------------------------------

/**
 * @param {Map<string, string> | Record<string, string>} sourceFiles
 * @param {string} id
 * @returns {string | undefined}
 */
function sourceOf(sourceFiles, id) {
  const get = sourceFiles instanceof Map ? (/** @type {string} */ k) => sourceFiles.get(k) : (/** @type {string} */ k) => sourceFiles[k];
  return get(`${id}.md`) ?? get(`${id}.mdx`);
}

/**
 * A `kind: Schematic` page's `resource` is the published schema file (ADR-0067), on the
 * site (`siteUrl` + base) when the origin is known, else a base-prefixed path. Any other
 * page keeps the `resource` it declares.
 *
 * @param {Record<string, any>} node
 * @param {Record<string, any>} data the page's frontmatter
 * @param {Omit<import('./links.mjs').LinkContext, 'pageHref' | 'pageId'>} links
 * @returns {string | undefined}
 */
function resourceOf(node, data, links) {
  if (node.doc_kind !== SCHEMATIC_KIND || typeof data.schematic_path !== 'string') return node.resource;
  return `${links.siteUrl || links.base}${schematicHref(node.href ?? '/', data.schematic_path)}`;
}

/**
 * @param {Record<string, any>} node
 * @param {string} source raw source text ('' when absent)
 * @param {Array<{target: string, rel: string, note?: string}>} edges
 * @param {Map<string, Record<string, any>>} nodes
 * @param {string[]} indexNames
 * @param {Omit<import('./links.mjs').LinkContext, 'pageHref' | 'pageId'>} links
 * @returns {string}
 */
function conceptDocument(node, source, edges, nodes, indexNames, links) {
  const parsed = matter(source);
  const raw = parsed.content.replace(/^\s*\n/, '').trimEnd();
  const body = rewriteBodyLinks(raw, { ...links, pageHref: node.href ?? '/', pageId: node.id });
  const { markdown, extraSources } = relationSections(edges, nodes, indexNames);
  const parts = [body, markdown.trimEnd()].filter((p) => p !== '');
  return `${fence(toYaml(conceptFrontmatter(node, extraSources, resourceOf(node, parsed.data, links))))}\n${parts.join('\n\n')}\n`;
}

/**
 * Whether an index file's source has prose once its frontmatter, MDX
 * `import`/`export` lines and HTML comments are stripped (#238).
 *
 * @param {string} source raw source text ('' when absent)
 * @returns {boolean}
 */
const hasBody = (source) =>
  matter(source)
    .content.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*(?:import|export)\s.*$/gm, '')
    .trim() !== '';

/**
 * The §8 entry for one node: `- [title](/path) - description`.
 *
 * @param {Record<string, any>} node
 * @param {string} path bundle path the entry links to
 * @returns {string}
 */
function entryLine(node, path) {
  const desc = node.description ? ` - ${node.description}` : '';
  return linkLine(node.title ?? node.id, `/${path}`, desc);
}

/**
 * A §8 entry list: the children of `indexId` by `in-section` edges, grouped
 * under one heading (the index title). An index whose README has a body (#238)
 * lists that overview page first.
 *
 * @param {Record<string, any>} index the index node
 * @param {Array<Record<string, any>>} children
 * @param {string[]} indexNames
 * @param {string} [overviewPath] bundle path of the index's overview page, when it has one
 * @returns {string}
 */
function indexDocument(index, children, indexNames, overviewPath) {
  const entries = children
    .map((child) => ({ path: bundlePathOf(child.id, indexNames), child }))
    .sort((a, b) => compareCodeUnit(a.path, b.path))
    .map(({ path, child }) => entryLine(child, path));
  if (overviewPath !== undefined) entries.unshift(entryLine(index, overviewPath));
  const heading = `# ${index.title ?? 'Index'}\n`;
  return entries.length > 0 ? `${heading}\n${entries.join('\n')}\n` : heading;
}

/**
 * @param {string} source raw source text of an index file
 * @returns {string | null} the sidecar YAML, or `null` when it had no frontmatter
 */
function sidecarOf(source) {
  const data = /** @type {Record<string, unknown>} */ (sortedPlain(matter(source).data));
  return Object.keys(data).length > 0 ? `${toYaml(data)}\n` : null;
}

/**
 * Group the `in-section` children of every index, and every page's outgoing edges.
 *
 * @param {ExportGraph} graph
 * @param {Map<string, Record<string, any>>} nodes
 */
function indexEdges(graph, nodes) {
  /** @type {Map<string, Array<Record<string, any>>>} */
  const children = new Map();
  /** @type {Map<string, ExportGraph['edges']>} */
  const outgoing = new Map();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
    const child = nodes.get(edge.source);
    if (edge.rel !== 'in-section' || !child) continue;
    children.set(edge.target, [...(children.get(edge.target) ?? []), child]);
  }
  return { children, outgoing };
}

/**
 * `log.md` is reserved (OKF §9): copied as-is when its directory is in the bundle.
 *
 * @param {Map<string, string> | Record<string, string>} sourceFiles
 * @param {Map<string, string>} out
 */
function copyLogs(sourceFiles, out) {
  const entries = sourceFiles instanceof Map ? [...sourceFiles] : Object.entries(sourceFiles);
  const dirs = new Set([...out.keys()].map((p) => p.slice(0, Math.max(p.lastIndexOf('/'), 0))));
  for (const [path, text] of entries) {
    if (path !== 'log.md' && !path.endsWith('/log.md')) continue;
    const dir = path.slice(0, Math.max(path.lastIndexOf('/'), 0));
    if (dirs.has(dir)) out.set(path, text);
  }
}

/**
 * The path part of a site URL, trailing slash trimmed; a scheme-less URL
 * (`docs.example.org/docs`) is read as if it had `http://`.
 *
 * @param {string} url
 * @returns {string}
 */
function pathOfSiteUrl(url) {
  for (const candidate of [url, `http://${url}`]) {
    try {
      return new URL(candidate).pathname.replace(/\/+$/, '');
    } catch {
      // try the next form
    }
  }
  return '';
}

/**
 * Origin + base, composed once for every caller (integration and CLI). Idempotent:
 * a site URL that already ends in the base is not given the base twice.
 *
 * @param {string | undefined} siteUrl
 * @param {string} base
 * @returns {string}
 */
function composeSiteUrl(siteUrl, base) {
  const origin = (siteUrl ?? '').replace(/\/+$/, '');
  if (origin === '' || base === '') return origin;
  const sitePath = pathOfSiteUrl(origin);
  // `base` always starts with '/' (normalizeBase), so `endsWith(base)` can only match
  // at a path-segment boundary: base '/docs' matches '/x/docs' but never '/x/mydocs'.
  // Parallel base authority for the HTML/agent-API side: src/lib/with-base.ts withBase
  // (TypeScript, so this .mjs cannot import it).
  const alreadyBased = sitePath === base || sitePath.endsWith(base);
  return alreadyBased ? origin : origin + base;
}

/**
 * The site base as a leading-slash path without trailing slash ('' for none).
 *
 * @param {string | undefined} base
 * @returns {string}
 */
function normalizeBase(base) {
  const trimmed = (base ?? '').trim().replace(/\/+$/, '');
  return trimmed === '' || trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Build the OKF v0.2 bundle.
 *
 * @param {ExportGraph} graph the built `content-graph.json`
 * @param {Map<string, string> | Record<string, string>} sourceFiles docs-relative path -> file text
 * @param {ExportOptions} [options]
 * @returns {Map<string, string>} bundle path -> file text, in `compareCodeUnit` path order
 */
export function exportOkfBundle(graph, sourceFiles, options = {}) {
  const indexNames = normalizeIndexBasenames(options.indexBasename);
  const exported = graph.nodes.filter((n) => n.kind === 'page' || n.kind === 'persona');
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const { children, outgoing } = indexEdges(graph, nodes);
  const base = normalizeBase(options.base);
  const links = {
    routes: routeIndex(graph.nodes),
    ids: idIndex(graph.nodes),
    base,
    siteUrl: composeSiteUrl(options.siteUrl, base),
    bundlePath: (/** @type {string} */ id) => bundlePathOf(id, indexNames),
  };
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const node of exported) {
    const source = sourceOf(sourceFiles, node.id) ?? '';
    const path = bundlePathOf(node.id, indexNames);
    const concept = () => conceptDocument(node, source, outgoing.get(node.id) ?? [], nodes, indexNames, links);
    if (!isIndexId(node.id, indexNames)) {
      out.set(path, concept());
      continue;
    }
    // #238: a README body is not lost; it is exported as a sibling `<id>.md` the index lists first.
    // `bundlePathOf` stays as is (links to a README resolve to the index, #237). When the sibling
    // would be the index file itself (basename `index`), nothing is written.
    const overview = hasBody(source) ? overviewPathOf(node.id, indexNames) : undefined;
    if (overview !== undefined) out.set(overview, concept());
    const listing = indexDocument(node, children.get(node.id) ?? [], indexNames, overview);
    if (path === 'index.md') {
      out.set(path, `${fence(`okf_version: ${scalar(OKF_VERSION)}`)}\n${listing}`);
      continue;
    }
    out.set(path, listing);
    const sidecar = sidecarOf(source);
    if (sidecar !== null) out.set(path.replace(/index\.md$/, '_index.meta.yaml'), sidecar);
  }
  copyLogs(sourceFiles, out);
  return new Map([...out].sort(([a], [b]) => compareCodeUnit(a, b)));
}
