/**
 * The optional-surface seam (planner lens, T011): everything beyond the five
 * always-on tools registers through this ONE hook so `server.ts` never grows
 * feature branches.
 *
 * WP04 fills the WP03 no-op stub: the docs:// resource surface (FR-011,
 * size-gated by `config.resourceListingThreshold`) registers here via
 * `surface/resources.ts`. Capability and handlers arrive as ONE unit inside
 * registerResources - the contract's degrade-loud rule means an optional
 * capability is never declared without its handlers. Disjoint ownership held:
 * WP03 created this file as the hand-off contract; this body only delegates.
 */
import type { McpServer } from '@modelcontextprotocol/server';
import type { LaunchConfiguration } from '../cli.js';
import type { CorpusSnapshot } from '../corpus/snapshot.js';
import { registerResources } from './resources.js';

/**
 * Register every optional surface for this snapshot/configuration pair.
 * The snapshot is always present when the server is assembled, so the
 * resources surface registers unconditionally (its own gating is the
 * listing-size threshold, applied per call).
 *
 * @param server the MCP server under construction
 * @param snapshot the immutable launch-time corpus snapshot (FR-006)
 * @param config the validated launch configuration
 */
export function registerOptionalSurfaces(
  server: McpServer,
  snapshot: CorpusSnapshot,
  config: LaunchConfiguration,
): void {
  registerResources(server, snapshot, config);
}
