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
import type { AudienceEntry, ResolvedRelated } from '../metadata.js';
import { rankForAgents, resolveRelated, sectionOf, toAgentRecord } from '../metadata.js';
import { resolveSectionRegistry, sectionOrder, sectionFeeds, feedsSurface } from '../sections.js';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { absolute, docsRoot } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';

export interface AgentIndexRouteOptions {
  title: string;
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
  /**
   * Which optional site-owned surfaces to link from `_links` (#103). `llms` and
   * `sitemap` are always linked. The defaults match the worked example, which
   * mounts all four; pass `false` for a surface your site does not build, or
   * the link would dangle. (A route cannot see another route's existence.)
   */
  links?: AgentIndexLinks;
  /**
   * Where this route is mounted, as a site-absolute path. Used for the index's
   * own `self` link. Default `/api/index.json`; set it if you mount the route
   * elsewhere, or `self` would dangle.
   */
  indexPath?: string;
}

export interface AgentIndexLinks {
  /** Per-page JSON at `/api/pages/<slug>.json`: gates each record's `self` link. */
  pages?: boolean;
  rss?: boolean;
  bibliography?: boolean;
  scenarios?: boolean;
}

export function agentIndexRoute(options: AgentIndexRouteOptions): APIRoute {
  const indexPath = options.indexPath ?? '/api/index.json';
  const declared = { pages: true, rss: true, bibliography: true, scenarios: true, ...options.links };
  return async ({ site }) => {
    const all = await collectDocEntries();
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
    const ranked = rankForAgents(all, order).filter((entry) =>
      feedsSurface(feeds, sectionOf(entry.slug), 'agent'),
    );
    const pages = ranked.map((entry) => {
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

    const body = {
      title: options.title,
      // Bumped from '1': the `related` array changed shape (raw slugs →
      // resolved objects) and records now carry `audience`, a
      // published-contract change that consumers branch on (DIRECTIVE_018).
      version: options.version ?? '2',
      generatedFrom: 'doc-kitty',
      count: pages.length,
      _links: {
        self: { href: absolute(site, indexPath) },
        llms: { href: absolute(site, '/llms.txt') },
        sitemap: { href: absolute(site, '/sitemap-index.xml') },
        ...(declared.rss ? { rss: { href: absolute(site, '/rss.xml') } } : {}),
        ...(declared.bibliography ? { bibliography: { href: absolute(site, '/api/bibliography.json') } } : {}),
        ...(declared.scenarios ? { scenarios: { href: absolute(site, '/api/scenarios.json') } } : {}),
      },
      pages,
    };

    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
