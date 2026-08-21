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
import { rankForAgents, toAgentRecord } from '../metadata.js';
import { absolute, collectDocEntries } from './shared.js';

export interface AgentIndexRouteOptions {
  title: string;
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
}

export function agentIndexRoute(options: AgentIndexRouteOptions): APIRoute {
  return async ({ site }) => {
    const ranked = rankForAgents(await collectDocEntries());
    const pages = ranked.map((entry) => {
      const record = toAgentRecord(entry);
      return {
        ...record,
        url: absolute(site, record.route),
        source: absolute(site, record.source),
      };
    });

    const body = {
      title: options.title,
      version: options.version ?? '1',
      generatedFrom: 'common-docs-kitty',
      count: pages.length,
      pages,
    };

    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
