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
import process from 'node:process';
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import type { AgentLink, AgentPagePayload } from '../contract.js';
import type { AudienceEntry, DocKittyFrontmatter, ResolvedRelated } from '../metadata.js';
import { pageSourceId, resolveRelated, slugFromEntryId, toAgentRecord } from '../metadata.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { absolute, memoizedBuildIdForEntries } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';
import { readAgentIncludes, spliceAgentIncludes } from '../gherkin/agent-includes.mjs';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import { readPublication } from '../integrations/openapi-publish.js';
import { openApiSummaryMarkdown } from '../openapi/summary.mjs';
import { openApiKeywords, toOpenApiVersionRecord } from './agent-index.js';

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
export type AgentPageRouteProps = { id: string; body: string; openApi?: string };

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
    return paths;
  };

  const GET: APIRoute = async ({ props, site }) => {
    const { id, body, openApi } = props as AgentPageRouteProps;
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
    // is the SAME mapping agent-index/scenario-index apply.
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
 * `agent-index.ts`, so the two cannot drift). The `buildId` is the
 * DOCS-corpus identity — the same value `agentIndexRoute` stamps — so the
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
