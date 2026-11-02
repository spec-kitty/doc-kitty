/**
 * The one static corpus server used by every mcp test lane (pre-merge fold:
 * replaces the three hand-rolled servers in conformance/serve-fixture.ts,
 * perf/perf-helpers.ts and corpus/http-source.test.ts - all byte-verified to
 * do the same origin rebase).
 *
 * Serves a committed fixture tree under 127.0.0.1 with the emitted absolute
 * URLs rebased onto the live origin, so links/_links authored against the
 * baked origin resolve for the loader's verbatim-ref fetching.
 */
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

export interface StaticCorpusServerOptions {
  /** Status to force for these pathnames (every attempt). */
  failStatus?: { status: number; paths: readonly string[] };
  /** Same status body for EVERY request (fake-path tests). Overrides failStatus. */
  alwaysStatus?: number;
  /** Per-request artificial latency in ms (called per request). */
  latencyMs?: () => number;
  /** Baked origin to rebase onto the server origin; omit to serve files verbatim.
   *  The emitted body is base-replaced exactly once per request, so a build's
   *  baked origin-shaped links resolve against the live loopback origin. */
  bakedOrigin?: string;
}

export interface StaticCorpusServer {
  server: Server;
  base: string;
  /** Requests per pathname (retry/assert proof). */
  requests: Map<string, number>;
  /** Peak concurrent in-flight requests (concurrency proof). */
  maxInFlight(): number;
  stop(): Promise<void>;
  /** Alias of stop() (the perf lane's historical name). */
  close(): Promise<void>;
}

export async function startStaticCorpusServer(
  dir: string,
  options: StaticCorpusServerOptions = {},
): Promise<StaticCorpusServer> {
  const requests = new Map<string, number>();
  const failPaths = new Set(options.failStatus?.paths ?? []);
  let inFlight = 0;
  let peak = 0;
  let base = '';
  const server = createServer((req, res) => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    const respond = (): void => {
      void (async () => {
        try {
          const pathname = new URL(req.url ?? '/', 'http://loopback.invalid').pathname;
          requests.set(pathname, (requests.get(pathname) ?? 0) + 1);
          if (options.alwaysStatus !== undefined) {
            res.writeHead(options.alwaysStatus).end('');
            return;
          }
          if (failPaths.has(pathname)) {
            res.writeHead(options.failStatus!.status).end('forced failure');
            return;
          }
          if (!pathname.startsWith('/api/') || !pathname.endsWith('.json') || pathname.includes('..')) {
            res.writeHead(404).end('not found');
            return;
          }
          const file = path.join(dir, pathname);
          if (!existsSync(file)) {
            res.writeHead(404).end('not found');
            return;
          }
          let body = await readFile(file, 'utf8');
          if (options.bakedOrigin !== undefined) body = body.replaceAll(options.bakedOrigin, base);
          res.writeHead(200, { 'content-type': 'application/json' }).end(body);
        } finally {
          inFlight -= 1;
        }
      })().catch((error: unknown) => {
        inFlight -= 1;
        res.writeHead(500).end(String(error));
      });
    };
    const latency = options.latencyMs?.() ?? 0;
    if (latency > 0) setTimeout(respond, latency);
    else respond();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve();
    });
  });
  const stop = (): Promise<void> =>
    new Promise<void>((done) => {
      server.closeAllConnections();
      server.close(() => done());
    });
  return {
    server,
    get base() {
      return base;
    },
    requests,
    maxInFlight: () => peak,
    stop,
    close: stop,
  };
}

/** The baked origin of the committed example fixture corpus (one canonical constant). */
export const EXAMPLE_BAKED_ORIGIN = 'https://spec-kitty.github.io/doc-kitty';
