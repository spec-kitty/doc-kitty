/**
 * The independent in-test projection (T020, reviewer pins V4 + FR-010).
 *
 * This module re-implements, FOR THE TEST SIDE ONLY, the documented projection
 * of contracts/mcp-surface.md onto the fixture artifacts. It shares NO code
 * with mcp/src: it reads artifact bytes itself (fs or fetch), parses them
 * itself, derives page ids and the site slug from the contract prose itself,
 * and applies the FR-007 link carve-out itself. The conformance suite then
 * asserts the SERVER's tool outputs byte-equal THESE values - never a value
 * captured from the server.
 *
 * Mode semantics (contract "Byte-derivation carve-out"):
 *   - https mode: expectations byte-equal the SERVED artifact values.
 *   - fs mode without --link-base: the effective link base equals the declared
 *     origin, so expectations byte-equal the on-disk artifact values.
 *   - fs mode with --link-base: exactly the carve-out link fields (record
 *     source/url, hrefs inside links/_links containers) carry the documented
 *     re-origining; every content field still byte-equals the on-disk value.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Raw JSON value bag; this file deliberately avoids the toolkit contract types. */
type Json = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Contract-documented derivations, re-authored from the contract prose.
// ---------------------------------------------------------------------------

/** Page id: artifact pathname relative to `/api/pages/`, minus `.json`. */
export function pageIdFromSelfHref(href: string): string {
  const pathname = new URL(href).pathname;
  const marker = '/api/pages/';
  const at = pathname.indexOf(marker);
  if (at < 0) throw new Error(`test projection: ref '${href}' not under ${marker}`);
  return pathname.slice(at + marker.length, -'.json'.length);
}

/** Site slug: lowercase, drop scheme and trailing slashes, collapse non-alphanumerics to '-'. */
export function siteSlugFromContract(launchBase: string): string {
  let value = launchBase.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  value = value.replace(/\/+$/, '');
  return value.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** docs:// page URI per the contract's Resources section. */
export function pageUriFor(slug: string, pageId: string): string {
  return `docs://${slug}/pages/${pageId}`;
}

/** Declared site base: the index's `_links.self.href` minus the `/api/index.json` suffix. */
export function declaredBaseOf(indexSelfHref: string): string {
  const suffix = '/api/index.json';
  if (!indexSelfHref.endsWith(suffix)) {
    throw new Error(`test projection: index self '${indexSelfHref}' does not end with ${suffix}`);
  }
  return indexSelfHref.slice(0, -suffix.length);
}

/**
 * The FR-007 carve-out, re-authored: inside a `links`/`_links` container,
 * string `href` fields rebase; `source`/`url` string fields rebase anywhere;
 * everything else passes through untouched. Only values under the declared
 * base (exact, or base + '/') move to the effective base.
 */
export function applyDocumentedLinkRewrite(value: unknown, declared: string, effective: string): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => applyDocumentedLinkRewrite(item, declared, effective));
  const out: Json = {};
  for (const [key, child] of Object.entries(value as Json)) {
    if (typeof child === 'string' && (key === 'source' || key === 'url')) {
      out[key] = rebase(child, declared, effective);
    } else if (key === 'links' || key === '_links') {
      out[key] = rewriteLinkContainer(child, declared, effective);
    } else {
      out[key] = applyDocumentedLinkRewrite(child, declared, effective);
    }
  }
  return out;
}

function rewriteLinkContainer(value: unknown, declared: string, effective: string): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => rewriteLinkContainer(item, declared, effective));
  const out: Json = {};
  for (const [key, child] of Object.entries(value as Json)) {
    if (key === 'href' && typeof child === 'string') {
      out[key] = rebase(child, declared, effective);
    } else {
      // deeper containers (e.g. related[] entries) stay inside the container
      out[key] = rewriteLinkContainer(child, declared, effective);
    }
  }
  return out;
}

function rebase(value: string, declared: string, effective: string): string {
  if (value === declared) return effective;
  if (value.startsWith(`${declared}/`)) return `${effective}${value.slice(declared.length)}`;
  return value;
}

// ---------------------------------------------------------------------------
// Independent fixture re-read.
// ---------------------------------------------------------------------------

/** One re-read page: the artifact values the tools must pass through. */
export interface ProjectedPage {
  id: string;
  /** The record's `_links.self.href` exactly as served/stored. */
  ref: string;
  /** Raw artifact text as read by THIS module (pre-rewrite). */
  raw: string;
  record: Json;
  artifact: Json;
}

export interface ProjectedCorpus {
  /** Raw index text as read by THIS module. */
  indexRaw: string;
  index: Json;
  /** Only records promising a per-page artifact (carry `_links.self`). */
  pages: ProjectedPage[];
  pagesGated: boolean;
  scenarios?: { raw: string; artifact: Json };
  /** Location the projections below depend on. */
  location: { kind: 'fs'; dir: string } | { kind: 'http'; base: string };
}

async function readArtifacts(
  location: ProjectedCorpus['location'],
): Promise<{ indexRaw: string; pageRawById: Map<string, string>; scenariosRaw?: string }> {
  if (location.kind === 'fs') {
    const read = (rel: string) => readFile(path.join(location.dir, rel), 'utf8');
    const indexRaw = await read('api/index.json');
    const index = JSON.parse(indexRaw) as Json;
    const pageRawById = new Map<string, string>();
    for (const record of recordList(index)) {
      const self = selfHrefOf(record);
      if (self === undefined) continue;
      const id = pageIdFromSelfHref(self);
      pageRawById.set(id, await read(`api/pages/${id}.json`));
    }
    const scenariosHref = scenariosHrefOf(index);
    const scenariosRaw = scenariosHref === undefined ? undefined : await read('api/scenarios.json');
    return { indexRaw, pageRawById, ...(scenariosRaw === undefined ? {} : { scenariosRaw }) };
  }
  const get = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`test projection: GET ${url} -> ${response.status}`);
    return response.text();
  };
  const indexRaw = await get(`${location.base}/api/index.json`);
  const index = JSON.parse(indexRaw) as Json;
  const pageRawById = new Map<string, string>();
  for (const record of recordList(index)) {
    const self = selfHrefOf(record);
    if (self === undefined) continue;
    pageRawById.set(pageIdFromSelfHref(self), await get(self));
  }
  const scenariosHref = scenariosHrefOf(index);
  const scenariosRaw = scenariosHref === undefined ? undefined : await get(scenariosHref);
  return { indexRaw, pageRawById, ...(scenariosRaw === undefined ? {} : { scenariosRaw }) };
}

function recordList(index: Json): Json[] {
  return index.pages as Json[];
}

function selfHrefOf(record: Json): string | undefined {
  const links = record._links as Json;
  const self = links.self as Json | undefined;
  return self === undefined ? undefined : (self.href as string);
}

function scenariosHrefOf(index: Json): string | undefined {
  const links = index._links as Json;
  const scenarios = links.scenarios as Json | undefined;
  return scenarios === undefined ? undefined : (scenarios.href as string);
}

/** Re-read one fixture corpus from disk OR over http, entirely in-test. */
export async function projectCorpus(location: ProjectedCorpus['location']): Promise<ProjectedCorpus> {
  const { indexRaw, pageRawById, scenariosRaw } = await readArtifacts(location);
  const index = JSON.parse(indexRaw) as Json;
  const pages: ProjectedPage[] = [];
  for (const record of recordList(index)) {
    const self = selfHrefOf(record);
    if (self === undefined) continue;
    const id = pageIdFromSelfHref(self);
    const raw = pageRawById.get(id);
    if (raw === undefined) throw new Error(`test projection: promised artifact for '${id}' unread`);
    pages.push({ id, ref: self, raw, record, artifact: JSON.parse(raw) as Json });
  }
  return {
    indexRaw,
    index,
    pages,
    pagesGated: pages.length < recordList(index).length,
    ...(scenariosRaw === undefined ? {} : { scenarios: { raw: scenariosRaw, artifact: JSON.parse(scenariosRaw) as Json } }),
    location,
  };
}

// ---------------------------------------------------------------------------
// Tool-output expectations from the re-read values (the golden model).
// ---------------------------------------------------------------------------

/** The launch view: how the server was (or would be) pointed at this corpus. */
export type LaunchView =
  | { kind: 'https'; url: string }
  | { kind: 'fs'; dir: string; linkBase?: string };

/** Effective link base for a launch view over this corpus (FR-007 rule). */
export function effectiveLinkBase(corpus: ProjectedCorpus, view: LaunchView): string {
  if (view.kind === 'https') return view.url;
  const indexSelfHref = ((corpus.index._links as Json).self as Json).href as string;
  const declared = declaredBaseOf(indexSelfHref);
  return view.linkBase ?? declared;
}

/** The slug identity the surface must mint for this launch. */
export function expectedSiteSlug(corpus: ProjectedCorpus, view: LaunchView): string {
  if (view.kind === 'https') return siteSlugFromContract(view.url);
  return siteSlugFromContract(effectiveLinkBase(corpus, view));
}

/** One artifact's value as the surface should hold it (post carom rewrite when given). */
function effectiveArtifactValue(corpus: ProjectedCorpus, view: LaunchView, raw: string): unknown {
  const parsed: unknown = JSON.parse(raw);
  if (view.kind === 'https') return parsed;
  const declared = declaredBaseOf(((corpus.index._links as Json).self as Json).href as string);
  const effective = effectiveLinkBase(corpus, view);
  if (effective === declared) return parsed; // identity: no rewrite, bytes pass through
  return applyDocumentedLinkRewrite(parsed, declared, effective);
}

/** The effective (possibly re-origined) index and artifacts for this launch. */
export function effectiveCorpus(corpus: ProjectedCorpus, view: LaunchView): {
  index: Json;
  pages: Array<{ id: string; record: Json; artifact: Json }>;
  scenarios?: Json;
} {
  const index = effectiveArtifactValue(corpus, view, corpus.indexRaw) as Json;
  const effectiveRecords = recordList(index);
  const pages = corpus.pages.map((page) => ({
    id: page.id,
    record: effectiveRecords.find((record) => {
      const self = selfHrefOf(record);
      return self !== undefined && pageIdFromSelfHref(self) === page.id;
    })!,
    artifact: effectiveArtifactValue(corpus, view, page.raw) as Json,
  }));
  const scenarios =
    corpus.scenarios === undefined
      ? undefined
      : (effectiveArtifactValue(corpus, view, corpus.scenarios.raw) as Json);
  return { index, pages, ...(scenarios === undefined ? {} : { scenarios }) };
}

/** Expected get_site_info payload. The resources flag is EXCLUDED on purpose (WP04 conditionality). */
export function expectedSiteInfo(corpus: ProjectedCorpus, view: LaunchView): Json {
  const buildId = corpus.index.buildId;
  return {
    siteTitle: corpus.index.title,
    baseUrl: view.kind === 'https' ? view.url : path.resolve(view.dir),
    contractVersion: corpus.index.version,
    ...(typeof buildId === 'string' ? { buildId } : {}),
    pageCount: corpus.pages.length,
    capabilities: {
      pages: !corpus.pagesGated,
      scenarios: corpus.scenarios !== undefined,
    },
  };
}

/** Expected list_pages payload (array), registry order, optional section filter. */
export function expectedListPages(corpus: ProjectedCorpus, view: LaunchView, section?: string): Json[] {
  const slug = expectedSiteSlug(corpus, view);
  const { pages } = effectiveCorpus(corpus, view);
  return pages
    .filter((page) => section === undefined || page.record.section === section)
    .map((page) => expectedSummaryRecord(page.record, page.artifact, page.id, slug));
}

function expectedSummaryRecord(record: Json, artifact: Json, id: string, slug: string): Json {
  return {
    id,
    section: record.section,
    title: record.title,
    description: record.description,
    keywords: artifact.keywords,
    uri: pageUriFor(slug, id),
  };
}

/** Expected get_page payload for one id. */
export function expectedPage(corpus: ProjectedCorpus, view: LaunchView, id: string): Json {
  const slug = expectedSiteSlug(corpus, view);
  const { pages } = effectiveCorpus(corpus, view);
  const page = pages.find((p) => p.id === id);
  if (page === undefined) throw new Error(`test projection: '${id}' not promised by this corpus`);
  return {
    id: page.id,
    title: page.record.title,
    description: page.record.description,
    links: page.record._links,
    uri: pageUriFor(slug, page.id),
    markdown: page.artifact.markdown,
  };
}

/**
 * Expected search_pages payload: case-insensitive substring over the record
 * title, record description and artifact keywords ONLY; registry order; the
 * documented prefix cap of 25 (pass cap: Infinity to count the uncapped set).
 */
export function expectedSearch(corpus: ProjectedCorpus, view: LaunchView, query: string, cap = 25): Json[] {
  const slug = expectedSiteSlug(corpus, view);
  const needle = query.toLowerCase();
  const { pages } = effectiveCorpus(corpus, view);
  return pages
    .filter((page) => {
      return (
        (page.record.title as string).toLowerCase().includes(needle) ||
        (page.record.description as string).toLowerCase().includes(needle) ||
        (page.artifact.keywords as string[]).some((keyword) => keyword.toLowerCase().includes(needle))
      );
    })
    .slice(0, cap)
    .map((page) => expectedSummaryRecord(page.record, page.artifact, page.id, slug));
}

/** Expected list_scenarios payload (unavailability shape when the surface is absent). */
export function expectedScenarios(corpus: ProjectedCorpus, view: LaunchView): Json {
  const { scenarios } = effectiveCorpus(corpus, view);
  if (scenarios === undefined) return { available: false };
  return {
    version: scenarios.version,
    generated_from: scenarios.generated_by,
    count: scenarios.count,
    ...(scenarios.results === undefined ? {} : { results: scenarios.results }),
    features: scenarios.features,
  };
}

/**
 * Expected resource body for one page (WP04-conditional): the artifact text
 * as published - https mode: the served bytes; fs identity mode: the on-disk
 * bytes; fs rewrite mode: the documented re-origining re-serialized the way
 * the fs adapter documents it (2-space JSON.stringify).
 */
export function expectedResourceBody(corpus: ProjectedCorpus, view: LaunchView, id: string): string {
  const page = corpus.pages.find((p) => p.id === id);
  if (page === undefined) throw new Error(`test projection: '${id}' not promised by this corpus`);
  if (view.kind === 'https') return page.raw;
  const declared = declaredBaseOf(((corpus.index._links as Json).self as Json).href as string);
  const effective = effectiveLinkBase(corpus, view);
  if (effective === declared) return page.raw;
  return JSON.stringify(applyDocumentedLinkRewrite(JSON.parse(page.raw), declared, effective), null, 2);
}
