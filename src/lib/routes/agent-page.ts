/**
 * `agentPageRoute` — per-page detail at `/api/pages/<id>.json` (the site root is
 * `home`). Gives an agent one page's metadata plus its raw Markdown body, so it
 * can fetch exactly what it needs without scraping HTML.
 *
 * `::gherkin{…}` includes (ADR-0051) are EXPANDED in `markdown`: the fence
 * stage recorded each include's Markdown and body offsets in the entry's
 * rendered frontmatter (`gherkin/agent-includes.mjs`), and this route splices
 * them in and lists them under `includes`. It needs no filesystem, include
 * roots or parser: its module graph must not reach `@cucumber/gherkin`
 * (asserted in `agent-page-includes.test.ts`). A page with no include gets an
 * unchanged payload.
 *
 * Mount as `src/pages/api/pages/[...slug].json.ts`:
 *
 *   import { agentPageRoute } from '@spec-kitty/doc-toolkit/routes';
 *   const route = agentPageRoute();
 *   export const getStaticPaths = route.getStaticPaths;
 *   export const GET = route.GET;
 */
import path from 'node:path';
import process from 'node:process';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import type { AgentLink, AgentPageMeasure, AgentPagePayload } from '../contract.js';
import type { AudienceEntry, DocKittyFrontmatter, ResolvedRelated } from '../metadata.js';
import { pageSourceId, resolveRelated, slugFromEntryId, toAgentRecord } from '../metadata.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { absolute, docsRoot, memoizedBuildIdForEntries, pagedHubListing, readHubData } from './shared.js';
import { resolveClassification } from '../measures-core.mjs';
import { loadMeasuresCatalog, type MeasuresCatalog } from '../measures-loader.mjs';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';
import { readAgentIncludes, spliceAgentIncludes } from '../gherkin/agent-includes.mjs';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import { readPublication } from '../openapi/publication.js';
import { openApiSummaryMarkdown } from '../openapi/summary.mjs';
import { openApiKeywords, toListingRecord, toOpenApiVersionRecord } from './agent-index.js';

export interface AgentPageRouteOptions {
  /** Site-owned surfaces to link from `_links`. Defaults match the worked example. */
  links?: {
    /** Link `up` to the index (`indexPath`); pass `false` if the site does not mount the index route. */
    index?: boolean;
  };
  /**
   * Where the index route is mounted, as a site-absolute path. Used for each
   * page's `up` link. Default `/api/index.json`. Pass the same path, relative to `dist`
   * (without the site base), to `assert-build-artifacts --index-path`; without the flag
   * the gate reads `api/index.json` and fails (it does not skip) on any other path.
   */
  indexPath?: string;
}

/**
 * The synthetic page payload of one OpenAPI spec version (mission
 * openapi-second-slice-01M6WXJ4, WP03): an `AgentPagePayload` plus the
 * OpenAPI-only `released`, `rawDocumentUrl` and `sha256`, and `_links.describedby`
 * pointing at the raw document. Contract major stays `"3"` (additive fields).
 */
export interface OpenApiPagePayload extends AgentPagePayload {
  released: boolean;
  rawDocumentUrl: string;
  sha256: string;
  _links: AgentPagePayload['_links'] & { describedby: AgentLink };
}

/**
 * Props `getStaticPaths` hands to `GET`: a docs entry (`id` + `body`), or —
 * for the WP03 synthetic pages — just the `openApi` label of a spec version
 * (`id`/`body` are empty placeholders the branch never reads).
 */
export type AgentPageRouteProps = { id: string; body: string; openApi?: string; listing?: string };

/**
 * A page's `tom_classification`, resolved against the measures catalog into the
 * record shape `{ measure, label, nature, scope, note? }` (ADR-0080). `undefined`
 * when the page has no such field, so its payload stays byte-identical. Throws on
 * an unknown id, naming `pageLabel` and the id, which fails the page's build.
 */
export function resolvePageMeasures(
  data: Pick<DocKittyFrontmatter, 'tom_classification'>,
  catalog: Pick<MeasuresCatalog, 'index' | 'source'>,
  pageLabel: string,
): AgentPageMeasure[] | undefined {
  if (data.tom_classification === undefined) return undefined;
  return resolveClassification(data.tom_classification, catalog.index, pageLabel, catalog.source).map((m) => ({
    measure: m.measure,
    label: m.label,
    nature: m.nature,
    scope: m.scope,
    ...(m.note !== undefined ? { note: m.note } : {}),
  }));
}

/** The page's file, relative to the docs root, for messages; else `<slug>.md`. */
function pageLabelOf(entry: { filePath?: string }, slug: string, root: string): string {
  if (entry.filePath) {
    const rel = path.relative(root, path.resolve(entry.filePath)).split(path.sep).join('/');
    if (rel !== '' && !rel.startsWith('..')) return rel;
  }
  return `${slug || 'README'}.md`;
}

export function agentPageRoute(options: AgentPageRouteOptions = {}) {
  const linkIndex = options.links?.index ?? true;
  const indexPath = options.indexPath ?? '/api/index.json';
  const getStaticPaths: GetStaticPaths = async () => {
    const entries = await getCollection('docs');
    const paths: { params: { slug: string }; props: AgentPageRouteProps }[] = entries.map(
      (entry) => ({
        params: { slug: pageSourceId(slugFromEntryId(entry.id)) },
        props: { id: entry.id, body: entry.body ?? '' },
      }),
    );
    // WP03: one synthetic page artifact per OpenAPI spec version, with the
    // same artifact-id rule the docs paths use (`<section>/<label>` is never
    // the empty slug, so no `home` mapping applies). Only the `openapi` option
    // publishes the handoff, so a site without it is unchanged.
    const openapi = readPublication(process.env[DK_OPENAPI_ENV]);
    if (openapi) {
      for (const version of openapi.versions) {
        paths.push({
          params: { slug: `${openapi.section}/${version.label}` },
          props: { id: '', body: '', openApi: version.label },
        });
      }
    }
    // #342: one page artifact per listing page from 2 on of every paged hub
    // (`<hub>/page/<n>`, never a docs slug: a paged hub with such a child fails
    // the build). No paged hub adds no path.
    for (const page of pagedHubListing()) {
      paths.push({ params: { slug: page.slug }, props: { id: '', body: '', listing: page.slug } });
    }
    return paths;
  };

  const GET: APIRoute = async ({ props, site }) => {
    const { id, body, openApi, listing } = props as AgentPageRouteProps;
    if (listing !== undefined) {
      return listingResponse(listing, site, linkIndex, indexPath);
    }
    // WP03: the synthetic branch. The label alone identifies the version (it
    // is unique per site by the option's own validation); a label the
    // publication no longer carries is a 404, like a removed docs entry.
    if (openApi !== undefined) {
      return openApiResponse(openApi, site, linkIndex, indexPath);
    }
    const entries = await getCollection('docs');
    const entry = entries.find((e) => e.id === id);
    if (!entry) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const data = entry.data as unknown as DocKittyFrontmatter;
    const record = toAgentRecord({ slug: slugFromEntryId(id), data });
    // Resolve `related` against the full corpus and carry `audience` as
    // authored. Enrichment is route-local; toAgentRecord stays pure.
    const index = buildDocsIndex(await collectDocEntries());
    const related: ResolvedRelated[] = record.related.map((ref) => {
      const resolved = resolveRelated(ref, index);
      return {
        ref: resolved.ref,
        title: resolved.title,
        kind: resolved.kind,
        doc_status: resolved.doc_status,
      };
    });
    const audience: AudienceEntry[] = data.audience ?? [];
    // TOM classification (ADR-0080): resolved only when declared, so other
    // payloads are unchanged; an unknown id throws and fails this page's build.
    let measures: AgentPageMeasure[] | undefined;
    if (data.tom_classification !== undefined) {
      const root = await docsRoot();
      const label = pageLabelOf(entry as { filePath?: string }, slugFromEntryId(id), root);
      measures = resolvePageMeasures(data, loadMeasuresCatalog(root), label);
    }
    // `rendered` is the content layer's stored render (glob-loaded Markdown);
    // its frontmatter is the remark-time copy, not the validated `entry.data`.
    const rendered = (entry as { rendered?: { metadata?: { frontmatter?: unknown } } }).rendered;
    const expanded = spliceAgentIncludes(body, readAgentIncludes(rendered?.metadata?.frontmatter));
    const url = absolute(site, record.route);
    // `record.source` is base-less (toAgentRecord stays pure, ADR-0037); the
    // absolute, base-aware form is built here, after the spread, so it overrides it.
    const source = absolute(site, record.source);
    // FR-008 (WP01/T004): the corpus-wide build identity, computed over EVERY
    // entry — never only this page — so the value byte-equals the index and
    // scenarios stamps of the same build and a torn read is detectable. The
    // entry projection (slug via slugFromEntryId, body, validated frontmatter)
    // is the SAME mapping agent-index/scenario-index apply; the memoized helper
    // folds the OpenAPI specs' identity through the shared seam (#257).
    const payload: AgentPagePayload = {
      ...record,
      source,
      related,
      audience,
      url,
      authors: data.authors ?? [],
      keywords: data.agent?.keywords ?? [],
      ...(data.generated ? { generated: data.generated } : {}),
      ...(data.verified ? { verified: data.verified } : {}),
      ...(data.sources ? { sources: data.sources } : {}),
      ...(measures ? { tom_classification: measures } : {}),
      ...(expanded.includes.length > 0 ? { includes: expanded.includes } : {}),
      /**
       * Raw Markdown source of the page (frontmatter stripped by Astro), with
       * every `::gherkin` include replaced by the scenarios it renders.
       */
      markdown: expanded.markdown,
      buildId: memoizedBuildIdForEntries(entries),
      // Navigation links (#103). Built here, never in `toAgentRecord`, which
      // other consumers share. hrefs go through `absolute` like `url`/`source`.
      // No `source` relation: the payload's `source` IS the per-page JSON, i.e. `self`.
      _links: {
        self: { href: source },
        ...(linkIndex ? { up: { href: absolute(site, indexPath) } } : {}),
        html: { href: url },
        related: related.map((r) => ({ href: absolute(site, routeOfSlug(r.ref)), title: r.title })),
      },
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };

  return { getStaticPaths, GET };
}

/**
 * The synthetic branch of {@link agentPageRoute}'s GET (WP03): the page
 * artifact of one OpenAPI spec version, built from the publication handoff
 * exactly as the index builds its record (the shared projection lives in
 * `agent-index.ts`, so the two cannot drift). The `buildId` is the same
 * identity `agentIndexRoute` stamps — docs corpus plus the specs'
 * (label, released, sha256) fold (`openApiStampConfig`, #257) — so the
 * index, the docs pages and the synthetic pages of one build all agree.
 */
async function openApiResponse(
  label: string,
  site: URL | undefined,
  linkIndex: boolean,
  indexPath: string,
): Promise<Response> {
  const openapi = readPublication(process.env[DK_OPENAPI_ENV]);
  const version = openapi?.versions.find((candidate) => candidate.label === label);
  if (!openapi || !version) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  const record = toOpenApiVersionRecord(openapi, version);
  const url = absolute(site, record.route);
  const source = absolute(site, `/api/pages/${record.slug}.json`);
  const entries = await getCollection('docs');
  const payload: OpenApiPagePayload = {
    ...record,
    source,
    related: [],
    audience: [],
    url,
    authors: [],
    keywords: openApiKeywords(version.operations),
    markdown: openApiSummaryMarkdown(version, record.rawDocumentUrl),
    buildId: memoizedBuildIdForEntries(entries),
    // Navigation links, shaped like the docs payload's; `describedby` is the
    // raw document (contracts/synthetic-entry.md), carried as the same
    // base-aware PATH `rawDocumentUrl` names, not an absolute URL.
    _links: {
      self: { href: source },
      ...(linkIndex ? { up: { href: absolute(site, indexPath) } } : {}),
      html: { href: url },
      related: [],
      describedby: { href: record.rawDocumentUrl },
    },
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/**
 * The listing branch of {@link agentPageRoute}'s GET (#342): the page artifact of
 * one listing page of a paged hub. The record is the index's (`toListingRecord`),
 * plus `children` (that page's children in the hub's order, with title and URL)
 * and a Markdown list of them, so an agent can walk a hub page by page. The
 * `buildId` is the stamp every other artifact of the build carries.
 */
async function listingResponse(
  slug: string,
  site: URL | undefined,
  linkIndex: boolean,
  indexPath: string,
): Promise<Response> {
  const page = pagedHubListing().find((candidate) => candidate.slug === slug);
  const data = page ? new Map(readHubData()).get(page.hub) : undefined;
  const entries = await getCollection('docs');
  const bySlug = new Map(entries.map((entry) => [slugFromEntryId(entry.id), entry]));
  const hubEntry = page ? bySlug.get(page.hub) : undefined;
  if (!page || !data || !hubEntry) {
    return new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
  const hubRecord = toAgentRecord({ slug: page.hub, data: hubEntry.data as unknown as DocKittyFrontmatter });
  const record = toListingRecord(page, hubRecord, data);
  const url = absolute(site, record.route);
  const source = absolute(site, `/api/pages/${record.slug}.json`);
  const children = page.children.map((child) => {
    const childEntry = bySlug.get(child.slug);
    const title = (childEntry?.data as { title?: string } | undefined)?.title ?? child.label;
    return { slug: child.slug, title, url: absolute(site, routeOfSlug(child.slug)) };
  });
  const payload = {
    ...record,
    source,
    related: [],
    audience: [],
    url,
    authors: [],
    keywords: [],
    children,
    markdown: children.map((child) => `- [${child.title}](${child.url})`).join('\n') + '\n',
    buildId: memoizedBuildIdForEntries(entries),
    _links: {
      self: { href: source },
      ...(linkIndex ? { up: { href: absolute(site, indexPath) } } : {}),
      html: { href: url },
      related: [],
    },
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
