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
import type { APIRoute } from 'astro';
import type { AgentIndex, AgentRecordEntry, SectionRecord } from '../contract.js';
import type { AudienceEntry, ResolvedRelated } from '../metadata.js';
import { rankForAgents, resolveRelated, sectionOf, toAgentRecord } from '../metadata.js';
import { resolveSectionRegistry, sectionOrder, sectionFeeds, feedsSurface } from '../sections.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { absolute, buildIdForBuild, docsRoot, mcpLaunchUsage } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';
import { servedSurfaces } from '../served-surfaces.js';

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
    const buildId = buildIdForBuild(all);
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
