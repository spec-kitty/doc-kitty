/**
 * Compat shim (pre-merge fold): the conformance suite's local static corpus
 * server moved to `../helpers/static-corpus-server.ts`, deduplicated with the
 * perf and corpus lanes' copies. This module preserves the old `ServeOptions`
 * / `ServedFixture` names / `stop()` surface so the suite's reads cost nothing.
 */
import {
  startStaticCorpusServer,
  type StaticCorpusServerOptions,
} from '../helpers/static-corpus-server.js';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * Reliably dead endpoint: bind a free loopback port, close it, hand back its
 * base. A connect is refused immediately (UNREACHABLE_ENDPOINT's socket shape).
 */
export async function deadLoopbackBase(): Promise<string> {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()));
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return `http://127.0.0.1:${port}`;
}

export interface ServedFixture {
  server: Server;
  base: string;
  /** Requests per pathname (for retry-policy assertions). */
  requests: Map<string, number>;
  stop(): Promise<void>;
}

export interface ServeOptions {
  /** Baked origin string to rebase onto the loopback origin (exact prefix replace). */
  rewriteFrom: string;
  /** Pathnames that always answer with this status body. */
  failStatus?: { status: number; paths: readonly string[] };
}

export async function serveFixture(dir: string, options: ServeOptions): Promise<ServedFixture> {
  const opts: StaticCorpusServerOptions = { bakedOrigin: options.rewriteFrom };
  if (options.failStatus !== undefined) opts.failStatus = options.failStatus;
  const inner = await startStaticCorpusServer(dir, opts);
  return {
    server: inner.server,
    base: inner.base,
    requests: inner.requests,
    stop: inner.stop,
  };
}
