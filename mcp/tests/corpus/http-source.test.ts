/**
 * HttpCorpusSource (T008): fetch index first, then per-page artifacts by their
 * verbatim `_links.self.href`; bounded parallelism >= 8; one documented retry
 * (immediate, once) then UNREACHABLE_ENDPOINT; per-request timeout.
 *
 * The local static server below plays GitHub Pages: it serves the committed
 * example fixture but rewrites the baked origin in link refs to the server's
 * own origin, so verbatim-ref fetching exercises real identity plumbing
 * without touching the network.
 */
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HttpCorpusSource } from '../../src/corpus/http-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import { collectEvents, fixture, ofKind } from './helpers.js';

const FIXTURE_DIR = fixture('example');
const BAKED = 'https://spec-kitty.github.io/doc-kitty';

interface ServedCorpus {
  server: Server;
  base: string;
  requests: Map<string, number>;
  /** Paths that fail with 500 until they have hit the given attempt count. */
  flakyAfter: Map<string, number>;
  /** Total in-flight requests right now / high-water mark. */
  inFlight: number;
  maxInFlight: number;
  /** Artificial per-response delay (ms), for timeout tests. */
  delayMs: number;
  /** Serve nothing: every request gets a 404. */
  dead: boolean;
}

function startCorpusServer(overrides: Partial<Pick<ServedCorpus, 'delayMs' | 'dead'>> = {}): Promise<ServedCorpus> {
  const state: ServedCorpus = {
    server: undefined as unknown as Server,
    base: '',
    requests: new Map(),
    flakyAfter: new Map(),
    inFlight: 0,
    maxInFlight: 0,
    delayMs: overrides.delayMs ?? 0,
    dead: overrides.dead ?? false,
  };
  const server = createServer((req, res) => {
    state.inFlight += 1;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    const finish = (): void => {
      state.inFlight -= 1;
    };
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    state.requests.set(pathname, (state.requests.get(pathname) ?? 0) + 1);
    const respond = (): void => {
      try {
        if (state.dead) {
          res.writeHead(404).end('not found');
          return;
        }
        const flakyAt = state.flakyAfter.get(pathname);
        if (flakyAt !== undefined && state.requests.get(pathname)! <= flakyAt) {
          res.writeHead(500).end('flaky');
          return;
        }
        const file = path.join(FIXTURE_DIR, pathname);
        if (!existsSync(file)) {
          res.writeHead(404).end('not found');
          return;
        }
        let body = readFileSync(file, 'utf8');
        // Deploy-style rewritex: the baked origin becomes this server's origin.
        body = body.replaceAll(BAKED, state.base);
        res.writeHead(200, { 'content-type': 'application/json' }).end(body);
      } finally {
        finish();
      }
    };
    if (state.delayMs > 0) {
      setTimeout(respond, state.delayMs);
    } else {
      respond();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      state.server = server;
      state.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve(state);
    });
  });
}

async function stopCorpusServer(state: ServedCorpus): Promise<void> {
  await new Promise<void>((resolve) => state.server.close(() => resolve()));
  state.server.closeAllConnections();
}

let served: ServedCorpus;
beforeAll(async () => {
  served = await startCorpusServer();
});
afterEach(() => {
  served.requests.clear();
  served.flakyAfter.clear();
  served.delayMs = 0;
  served.dead = false;
  served.maxInFlight = 0;
});
afterAll(() => stopCorpusServer(served));

describe('happy path over a live corpus server', () => {
  it('materializes every page of the example fixture, identical to the fs projection', async () => {
    const snapshot = await loadSnapshot(new HttpCorpusSource(served.base));
    const index = JSON.parse(readFileSync(`${fixture('example')}/api/index.json`, 'utf8'));
    expect(snapshot.pages).toHaveLength(index.count);
    expect(snapshot.pagesGated).toBe(false);
    expect(snapshot.contractVersion).toBe('3');
    expect(snapshot.buildId).toBe(index.buildId);
    // Identity comes from the (server-rebased) record refs, verbatim.
    const home = snapshot.pages.find((p) => p.record.slug === '')!;
    expect(home.ref).toBe(`${served.base}/api/pages/home.json`);
    // Interleaved ref fetch still lands in registry (index) order.
    const expectedIds = index.pages.map((r: { _links: { self: { href: string } } }) =>
      r._links.self.href.split('/api/pages/')[1].replace(/\.json$/, ''),
    );
    expect(snapshot.pages.map((p) => p.id)).toEqual(expectedIds);
  });

  it('keeps parallelism bounded (<= 8 in-flight) while actually fetching in parallel', async () => {
    served.delayMs = 30; // make in-flight overlap observable
    await loadSnapshot(new HttpCorpusSource(served.base));
    expect(served.maxInFlight).toBeLessThanOrEqual(8);
    expect(served.maxInFlight).toBeGreaterThan(1); // actually parallel, not serial
  });
});

describe('retry policy: one immediate retry, then UNREACHABLE_ENDPOINT', () => {
  it('recovers when the index fails once (exactly two attempts)', async () => {
    served.flakyAfter.set('/api/index.json', 1);
    const events = collectEvents();
    const snapshot = await loadSnapshot(new HttpCorpusSource(served.base), { logger: events.logger });
    expect(snapshot.pages.length).toBeGreaterThan(0);
    expect(served.requests.get('/api/index.json')).toBe(2);
    expect(ofKind(events.events, 'retry').some((e) => e.ref === `${served.base}/api/index.json`)).toBe(true);
  });

  it('recovers when one page fails once inside the bounded fan-out', async () => {
    served.flakyAfter.set('/api/pages/guides/getting-started.json', 1);
    const snapshot = await loadSnapshot(new HttpCorpusSource(served.base));
    expect(served.requests.get('/api/pages/guides/getting-started.json')).toBe(2);
    expect(snapshot.pages.some((p) => p.id === 'guides/getting-started')).toBe(true);
  });

  it('gives up after the second failure with UNREACHABLE_ENDPOINT (never hangs)', async () => {
    served.dead = true;
    await expect(loadSnapshot(new HttpCorpusSource(served.base))).rejects.toMatchObject({
      code: 'UNREACHABLE_ENDPOINT',
      message: expect.stringContaining('/api/index.json'),
    });
    expect(served.requests.get('/api/index.json')).toBe(2); // attempt + ONE retry, then named failure
  });
});

describe('per-request timeout', () => {
  it('fails the load with UNREACHABLE_ENDPOINT when responses exceed the timeout', async () => {
    served.delayMs = 250;
    const events = collectEvents();
    await expect(
      loadSnapshot(new HttpCorpusSource(served.base, { timeoutMs: 50 }), { logger: events.logger }),
    ).rejects.toMatchObject({ code: 'UNREACHABLE_ENDPOINT' });
    expect(ofKind(events.events, 'retry').length).toBe(1);
  });
});
