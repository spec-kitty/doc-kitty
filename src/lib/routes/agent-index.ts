/**
 * `agentIndexRoute` — the machine-readable map of the corpus at
 * `/api/index.json`. One JSON document listing every agent-discoverable page
 * with its metadata and a pointer to its per-page source.
 *
 * Mount as `src/pages/api/index.json.ts`:
 *
 *   import { agentIndexRoute } from '@spec-kitty/doc-toolkit/routes';
 *   export const GET = agentIndexRoute({ title: 'My Docs' });
 */
import process from 'node:process';
import type { APIRoute } from 'astro';
import type { AgentIndex, AgentRecordEntry, SectionRecord } from '../contract.js';
import type { AudienceEntry, ResolvedRelated } from '../metadata.js';
import { DEFAULT_AGENT_PRIORITY, rankForAgents, resolveRelated, sectionOf, toAgentRecord } from '../metadata.js';
import { resolveSectionRegistry, sectionOrder, sectionFeeds, feedsSurface } from '../sections.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { absolute, buildIdForBuild, docsRoot, mcpLaunchUsage, openApiStampConfig } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';
import { servedSurfaces } from '../served-surfaces.js';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import { readPublication } from '../integrations/openapi-publish.js';
import type { OpenApiPublication, OpenApiPublicationVersion } from '../integrations/openapi-publish.js';
import type { Operation } from '../openapi/operations.mjs';
import { escapeMdLink, flattenText } from '../openapi/summary.mjs';
import { withBase } from '../with-base.js';

export interface AgentIndexRouteOptions {
  title: string;
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
  /**
   * Which optional site-owned surfaces to link from `_links` (#103). `pages`,
   * `rss`, `bibliography` and `scenarios` default to what the site serves,
   * detected from its routes at their standard paths (FR-002), so a surface the
   * site does not mount is not named. A value here wins: pass `true` for a
   * surface at a non-standard path. `llms` and `sitemap` have no option: they
   * follow detection alone (`sitemap` also needs `site`). Outside the
   * integration, where detection has not run, every link defaults to on.
   */
  links?: AgentIndexLinks;
  /**
   * Where this route is mounted, as a site-absolute path. Used for the index's
   * own `self` link. Default `/api/index.json`; set it if you mount the route
   * elsewhere, or `self` would dangle. Pass the same path, relative to `dist`
   * (without the site base), to `assert-build-artifacts --index-path`; without the flag the gate
   * reads `api/index.json` and fails (it does not skip) on any other path.
   */
  indexPath?: string;
}

export interface AgentIndexLinks {
  /** Per-page JSON at `/api/pages/<slug>.json`: gates each record's `self` link. */
  pages?: boolean;
  rss?: boolean;
  bibliography?: boolean;
  scenarios?: boolean;
  /**
   * The MCP wiring pointer (FR-009). Unlike the siblings here this defaults to
   * OFF: it advertises `@spec-kitty/doc-kitty-mcp`, so it is opt-in until a
   * site deliberately wires the server into its agent story. When true, the
   * index carries `_links.mcp` — `{ href: 'npm:@spec-kitty/doc-kitty-mcp',
   * title, usage }`, where `usage` is the packed-tarball launch command with
   * this site's base URL substituted (registry publishing is deferred per
   * C-002) — and `llms.txt` shows the matching one-liner when the site also
   * passes `links: { mcp: true }` to `llmsTxtRoute`.
   */
  mcp?: boolean;
}

/**
 * The base record of one OpenAPI spec version, shared by the index record and
 * the page payload (mission openapi-second-slice-01M6WXJ4, WP03;
 * contracts/synthetic-entry.md, research R10): every `AgentRecordEntry` field
 * the two projections share, plus the OpenAPI-only `released`, `rawDocumentUrl`
 * and `sha256`. `slug` is `<section>/<label>`; the section/type/kind/status/tags
 * vocabulary is R10's, chosen so the records satisfy the MCP corpus shape
 * guards with values already in the vocabulary (a `draft` status would trip
 * publication filters and drop the entry — unreleased is stated by `released`).
 */
export interface OpenApiVersionRecord {
  slug: string;
  route: string;
  section: string;
  title: string;
  description: string;
  type: 'reference';
  doc_status: 'active';
  kind: 'Reference';
  tags: string[];
  priority: number;
  updated: null;
  /** Whether the version is released (the option's `released` flag). */
  released: boolean;
  /** The raw document's site-absolute, base-aware PATH (`withBase(rawRoute)`). */
  rawDocumentUrl: string;
  /** sha256 of the published raw document bytes, 64 lowercase hex. */
  sha256: string;
}

/**
 * Project one publication version into the shared record. Spec-derived text
 * (title, apiVersion) is flattened (FR-028: no field spans lines); the label,
 * the section and the digest are toolkit-produced and stay raw. `title` is
 * `<info.title> <label>` plus ` (unreleased)` when the version is not released.
 */
export function toOpenApiVersionRecord(
  publication: OpenApiPublication,
  version: OpenApiPublicationVersion,
): OpenApiVersionRecord {
  const slug = `${publication.section}/${version.label}`;
  return {
    slug,
    route: routeOfSlug(slug),
    section: sectionOf(slug),
    title: `${flattenText(version.title)} ${version.label}${version.released ? '' : ' (unreleased)'}`,
    description: `OpenAPI ${flattenText(version.apiVersion)} contract, ${version.operations.length} operations`,
    type: 'reference',
    doc_status: 'active',
    kind: 'Reference',
    tags: ['openapi'],
    priority: DEFAULT_AGENT_PRIORITY,
    updated: null,
    released: version.released,
    rawDocumentUrl: withBase(version.rawRoute),
    sha256: version.sha256,
  };
}

/**
 * The page payload's `keywords` (R10): the operation summaries — falling back
 * to the operationId — flattened and link-escaped (FR-028), empties skipped,
 * unique, sorted. One keyword per operation, never per page.
 */
export function openApiKeywords(operations: readonly Operation[]): string[] {
  const names = operations
    .map((operation) => escapeMdLink(flattenText(operation.summary ?? operation.operationId ?? '')))
    .filter((keyword) => keyword !== '');
  return [...new Set(names)].sort();
}

/**
 * The synthetic index record: an `AgentRecordEntry` plus the OpenAPI-only
 * fields, appended after the docs records (never ranked among them).
 */
export interface OpenApiRecordEntry extends AgentRecordEntry {
  released: boolean;
  rawDocumentUrl: string;
  sha256: string;
}

export function agentIndexRoute(options: AgentIndexRouteOptions): APIRoute {
  const indexPath = options.indexPath ?? '/api/index.json';
  return async ({ site }) => {
    // Read per request, not in the factory: dev re-detects when routes change, and
    // a value taken in the factory would keep naming the old set.
    const surfaces = servedSurfaces();
    const declared = {
      pages: surfaces?.agentPages ?? true,
      llms: surfaces?.llms ?? true,
      sitemap: surfaces?.sitemap ?? true,
      rss: surfaces?.rss ?? true,
      bibliography: surfaces?.bibliography ?? true,
      scenarios: surfaces?.scenarios ?? true,
      mcp: false,
      ...options.links,
    };
    // `withBody`: the build identity hashes every entry's body bytes
    // (FR-008); downstream consumers of the entries ignore the field.
    const all = await collectDocEntries({ withBody: true });
    // The publication read once: the OpenAPI records below and the build
    // identity's spec fold (#257) share it.
    const openapi = readPublication(process.env[DK_OPENAPI_ENV]);
    const buildId = buildIdForBuild(all, openApiStampConfig(openapi));
    // Resolve against the full corpus, not just the discoverable subset, so a
    // `related` ref into a non-discoverable page still resolves (FR-004).
    const index = buildDocsIndex(all);
    // Registry-driven section order when present; else the SECTION_ORDER default
    // inside rankForAgents (issue #18). Resolve the registry from the SAME docs
    // root the content came from so a custom docs directory is honored (#22).
    const registry = resolveSectionRegistry(await docsRoot());
    const order = registry ? sectionOrder(registry) : undefined;
    // Section-level `feeds` filter, composed ON TOP of the per-page
    // `agent.discoverable` gating rankForAgents already applies: a page appears
    // iff its section feeds `agent` AND it is discoverable. A section that OMITS
    // `feeds` feeds all four surfaces (absent = all); an absent registry means
    // `feeds` is undefined → no filtering (byte-compatible). The `related`
    // resolution index above stays the FULL corpus, so a `related` ref INTO a
    // non-agent-fed section still resolves (FR-004) — only the emitted `pages`
    // list is feeds-filtered.
    const feeds = registry ? sectionFeeds(registry) : undefined;
    // FR-003: the section listing, projected from the registry in registry
    // order (already `order`-sorted). A registry-free site emits `[]` rather
    // than failing — the same absent-registry posture the feeds filter applies.
    const sections: SectionRecord[] = (registry ?? []).map((entry) => ({
      id: entry.id,
      label: entry.label,
      order: entry.order,
      ...(entry.purpose !== undefined ? { purpose: entry.purpose } : {}),
    }));
    const ranked = rankForAgents(all, order).filter((entry) =>
      feedsSurface(feeds, sectionOf(entry.slug), 'agent'),
    );
    const pages: AgentRecordEntry[] = ranked.map((entry) => {
      const record = toAgentRecord(entry);
      // Enrich in the route (composes WP01's resolveRelated); toAgentRecord
      // stays pure/single-entry. Typed against the exported ResolvedRelated so
      // the emitted JSON cannot diverge from a declared type (no `as` cast).
      const related: ResolvedRelated[] = record.related.map((ref) => {
        const resolved = resolveRelated(ref, index);
        return {
          ref: resolved.ref,
          title: resolved.title,
          kind: resolved.kind,
          doc_status: resolved.doc_status,
        };
      });
      const audience: AudienceEntry[] = entry.data.audience ?? [];
      const url = absolute(site, record.route);
      const source = absolute(site, record.source);
      return {
        ...record,
        related,
        audience,
        url,
        source,
        _links: {
          ...(declared.pages ? { self: { href: source } } : {}),
          html: { href: url },
          related: related.map((r) => ({ href: absolute(site, routeOfSlug(r.ref)), title: r.title })),
        },
      };
    });

    // WP03 (mission openapi-second-slice-01M6WXJ4): one synthetic record per
    // OpenAPI spec version, APPENDED after the docs records — never ranked
    // among them (contracts/synthetic-entry.md). Only the `openapi` option
    // publishes the handoff, so a site without it emits exactly what it did
    // before. The records are not docs entries: the section `feeds` filter and
    // `rankForAgents` never see them. The buildId above folds the specs'
    // (label, released, sha256) through the shared `openApiStampConfig` seam,
    // so index, docs pages and synthetic pages keep agreeing on it.
    if (openapi) {
      for (const version of openapi.versions) {
        const record = toOpenApiVersionRecord(openapi, version);
        const url = absolute(site, record.route);
        const source = absolute(site, `/api/pages/${record.slug}.json`);
        const entry: OpenApiRecordEntry = {
          ...record,
          related: [],
          audience: [],
          url,
          source,
          _links: {
            ...(declared.pages ? { self: { href: source } } : {}),
            html: { href: url },
            related: [],
          },
        };
        pages.push(entry);
      }
    }

    const body: AgentIndex = {
      title: options.title,
      // Bumped from '1': the `related` array changed shape (raw slugs →
      // resolved objects) and records now carry `audience`, a
      // published-contract change that consumers branch on (DIRECTIVE_018).
      // '2' -> '3': `updated` is now a full UTC instant (YYYY-MM-DDTHH:MM:SSZ),
      // not a date-only slice (FR-024). `buildId`/`sections`/`_links.mcp`
      // (WP01) are additive, so the wire version stays '3'.
      version: options.version ?? '3',
      generatedFrom: 'doc-kitty',
      count: pages.length,
      buildId,
      sections,
      _links: {
        self: { href: absolute(site, indexPath) },
        ...(declared.llms ? { llms: { href: absolute(site, '/llms.txt') } } : {}),
        ...(declared.sitemap ? { sitemap: { href: absolute(site, '/sitemap-index.xml') } } : {}),
        // Always declared: the `doc-kitty:content-graph` integration injects the route
        // on every site (#176), so unlike the site-owned surfaces below it cannot dangle.
        contentGraph: { href: absolute(site, '/api/content-graph.json') },
        ...(declared.rss ? { rss: { href: absolute(site, '/rss.xml') } } : {}),
        ...(declared.bibliography ? { bibliography: { href: absolute(site, '/api/bibliography.json') } } : {}),
        ...(declared.scenarios ? { scenarios: { href: absolute(site, '/api/scenarios.json') } } : {}),
        // FR-009: the opt-in MCP wiring pointer. `usage` names the installed
        // tarball bin (the C-002 ruling on registry publishing is pending, so
        // no `npx -y @spec-kitty/…` form is advertised yet). `href` is a
        // RESERVED NAME, not an installable package: `@spec-kitty/doc-kitty-mcp`
        // is `private: true` until publishing is decided, so `npm install` of it
        // fails today. Consumers must follow `usage`, not `href`.
        ...(declared.mcp
          ? {
              mcp: {
                href: 'npm:@spec-kitty/doc-kitty-mcp',
                title: 'Doc-Kitty MCP server',
                usage: mcpLaunchUsage(site),
              },
            }
          : {}),
      },
      pages,
    };

    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
