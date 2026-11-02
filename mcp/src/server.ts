/**
 * The MCP server core (T011): stdio wiring and the five tools, over the WP02
 * snapshot.
 *
 *   - One `McpServer({ name: 'doc-kitty-mcp', version: <package version> })`,
 *     stdio transport via the SDK's `./stdio` subpath (`StdioServerTransport`).
 *   - NO HTTP listener is imported anywhere in this package (C-003); WP05's
 *     boundary test proves it structurally.
 *   - Optional surfaces hang off ONE hook, `registerOptionalSurfaces`
 *     (surface/optional.ts) - a no-op stub in this WP, replaced by WP04's
 *     resources registration without touching this file.
 *   - `createServer` is pure assembly (no I/O) so tests drive it in-process
 *     over the SDK's InMemoryTransport; `serveSnapshot` is the cli's
 *     ServerSurface for the real binary: connect stdio, resolve on clean
 *     shutdown (the client closing stdin), let anything else propagate for
 *     the cli's exit-2 taxonomy.
 */
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { UnsupportedClientRevisionError } from './errors.js';
import type { LaunchConfiguration } from './cli.js';
import type { CorpusSnapshot } from './corpus/snapshot.js';
import { assertLaunchConfiguration } from './surface/guards.js';
import { registerOptionalSurfaces } from './surface/optional.js';
import { registerTools } from './surface/tools.js';

/** The server's handshake identity name (pinned; clients display this). */
export const SERVER_NAME = 'doc-kitty-mcp';

/**
 * DEV-ONLY launch faults (WP05 T020 auto-vacuity control; lane-crossing edit
 * sanctioned by WP05 - this file is WP03-owned). The conformance suite seeds
 * a fault through `createServer(snapshot, { ...config, faults: ... })` and
 * asserts its golden comparisons GO RED; without this seam a suite asserting
 * against its own bug could stay green forever. Never set by the real cli;
 * a fault-free launch takes the identity path below (no copy, no behavior
 * change).
 */
export interface ServerFaults {
  /** Uppercase every projected page title (get_page, list_pages, search_pages). */
  uppercaseTitles?: boolean;
}

/** Fault launch configuration: the cli's launch config plus the dev-only faults bag. */
export type FaultyLaunchConfiguration = LaunchConfiguration & { faults?: ServerFaults };

/**
 * Apply the seeded faults at the assembly seam: the tools' projection then
 * READS the faulted values, exactly where an honest or dishonest
 * implementation would diverge from the fixture-derived expectation. No
 * faults configured -> the untouched snapshot passes through by identity.
 */
function applyDevFaults(snapshot: CorpusSnapshot, faults: ServerFaults | undefined): CorpusSnapshot {
  if (faults?.uppercaseTitles !== true) return snapshot;
  return {
    ...snapshot,
    pages: snapshot.pages.map((page) => ({ ...page, title: page.title.toUpperCase() })),
  };
}

/**
 * The server version reported in the MCP handshake: the package version,
 * read from the package's own package.json (dist/server.js and
 * src/server.ts both resolve it one level up). Falling back to '0.0.0' keeps
 * a stripped package legible rather than crashing the handshake.
 */
export function serverVersion(): string {
  const pkgPath = new URL('../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
  return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : '0.0.0';
}

/**
 * Assemble the server: validate the launch configuration at the surface
 * boundary, apply any dev-only seeded faults (WP05 auto-vacuity seam; absent
 * under the real cli), then register the five always-on tools and every
 * optional surface (none in this WP). No I/O happens here.
 */
export function createServer(snapshot: CorpusSnapshot, config: FaultyLaunchConfiguration): McpServer {
  assertLaunchConfiguration(config);
  const effective = applyDevFaults(snapshot, config.faults);
  const server = new McpServer({ name: SERVER_NAME, version: serverVersion() });
  registerTools(server, effective, config);
  registerOptionalSurfaces(server, effective, config);
  return server;
}

/**
 * Normalize an SDK handshake error into the taxonomy. A client negotiating an
 * MCP spec revision outside the SDK's supported window fails inside connect()
 * validation; it is normalized into the named UNSUPPORTED_CLIENT_REVISION so a
 * client (or the cli's exit-2 report) shows the taxonomy code, never a raw SDK
 * string (NFR-004). Any other error passes through unchanged.
 */
export function normalizeHandshakeError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  if (/protocol version|unsupported.*version/i.test(message)) {
    return new UnsupportedClientRevisionError(
      `MCP handshake failed: ${message}. This server supports the spec revision bundled with @modelcontextprotocol/server ${serverVersion()}; upgrade the client or pin the matching server release.`,
      { cause: error },
    );
  }
  return error;
}

/**
 * The cli's ServerSurface over stdio (contracts/mcp-surface.md CLI section).
 * Resolves when the transport closes for any reason - the stdio binding's
 * clean shutdown is the client closing stdin - so the cli resolves exit 0.
 */
export async function serveSnapshot(snapshot: CorpusSnapshot, config: LaunchConfiguration): Promise<void> {
  const server = createServer(snapshot, config);
  const transport = new StdioServerTransport();
  const closed = new Promise<void>((resolve) => {
    server.server.onclose = () => resolve();
  });
  try {
    await server.connect(transport);
  } catch (error) {
    throw normalizeHandshakeError(error);
  }
  await closed;
}
