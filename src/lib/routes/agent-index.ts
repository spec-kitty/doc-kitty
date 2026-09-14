/**
 * `agentIndexRoute` — the machine-readable map of the corpus at
 * `/api/index.json`. One JSON document listing every agent-discoverable page
 * with its metadata and a pointer to its per-page source.
 *
 * Mount as `src/pages/api/index.json.ts`:
 *
 *   import { agentIndexRoute } from '@commondocs-kitty/toolkit/routes';
 *   export const GET = agentIndexRoute({ title: 'My Docs' });
 */
import type { APIRoute } from 'astro';
import type { AudienceEntry, ResolvedRelated } from '../metadata.js';
import { rankForAgents, resolveRelated, sectionOf, toAgentRecord } from '../metadata.js';
import { resolveSectionRegistry, sectionOrder, sectionFeeds, feedsSurface } from '../sections.js';
import { absolute, docsRoot } from './shared.js';
import { buildDocsIndex, collectDocEntries } from '../docs-index.js';

export interface AgentIndexRouteOptions {
  title: string;
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
}

export function agentIndexRoute(options: AgentIndexRouteOptions): APIRoute {
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
      return {
        ...record,
        related,
        audience,
        url: absolute(site, record.route),
        source: absolute(site, record.source),
      };
    });

    const body = {
      title: options.title,
      // Bumped from '1': the `related` array changed shape (raw slugs →
      // resolved objects) and records now carry `audience`, a
      // published-contract change that consumers branch on (DIRECTIVE_018).
      version: options.version ?? '2',
      generatedFrom: 'common-docs-kitty',
      count: pages.length,
      pages,
    };

    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
