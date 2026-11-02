/**
 * NFR-001 start budgets (T023): from launch to ready -
 *
 *   - local-directory input (fs) on the 70-page example corpus: <= 5 s
 *   - HTTPS input on the same 70-page example corpus: <= 15 s
 *   - HTTPS input on a 1000-page synthetic corpus: <= 60 s, with the
 *     worker-pool floor (bounded fetch parallelism >= 8) actively load-bearing
 *
 * "Launch to ready" is measured around the REAL binary: spawn
 * `node dist/cli.js`, timing stops when the MCP initialize handshake resolves
 * (the server cannot answer before the snapshot load completed - readiness is
 * observable on the wire, not on a log line).
 *
 * Why the latency is synthetic and real at once: localhost fetches are too
 * fast for the 60 s bound to discriminate a serial loader from a parallel one
 * (1 ms local fetches finish 1000 pages serially in ~1 s). The static server
 * injects 50-150 ms per request: a serial (c=1) loader needs
 * 1000 * ~100 ms = ~100 s and fails the bound; the pinned c=8 pool lands in
 * ~13 s. The same run asserts the server observed >= 8 in-flight requests, so
 * the pass is attributable to the pool, not to quiet hardware.
 *
 * The 1000-page corpus is generated programmatically at test time (fs-written
 * JSON, cheap to mint): no committed 1000-page fixture (plan D5).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HttpCorpusSource } from '../../src/corpus/http-source.js';
import { loadSnapshot } from '../../src/corpus/snapshot.js';
import {
  CORPUS_FIXTURES,
  ChildStdioMcpClient,
  EXAMPLE_BAKED_ORIGIN,
  SYNTHETIC_ORIGIN,
  ensureMcpDistBuilt,
  generateSyntheticCorpus,
  startStaticCorpusServer,
} from './perf-helpers.js';
import type { StaticCorpusServer } from './perf-helpers.js';

/** NFR-001 budgets, milliseconds. */
const BUDGET_FS_MS = 5_000;
const BUDGET_HTTP_EXAMPLE_MS = 15_000;
const BUDGET_HTTP_1000_MS = 60_000;

let workDir: string;
let syntheticDir: string;
let tinyDir: string;
let fixtureServer: StaticCorpusServer;
let syntheticServer: StaticCorpusServer;
let tinyServer: StaticCorpusServer;

beforeAll(async () => {
  ensureMcpDistBuilt();
  workDir = mkdtempSync(path.join(tmpdir(), 'wp08-nfr-'));
  syntheticDir = path.join(workDir, 'synthetic-1000');
  tinyDir = path.join(workDir, 'synthetic-32');
  generateSyntheticCorpus(syntheticDir, 1000);
  generateSyntheticCorpus(tinyDir, 32);
  [fixtureServer, syntheticServer, tinyServer] = await Promise.all([
    startStaticCorpusServer(path.join(CORPUS_FIXTURES, 'example'), { bakedOrigin: EXAMPLE_BAKED_ORIGIN }),
    // 50-150 ms uniform per request: the discrimination band of the 60 s bound.
    startStaticCorpusServer(syntheticDir, { bakedOrigin: SYNTHETIC_ORIGIN, latencyMs: () => 50 + Math.random() * 100 }),
    startStaticCorpusServer(tinyDir, { bakedOrigin: SYNTHETIC_ORIGIN, latencyMs: () => 60 }),
  ]);
}, 180_000);

afterAll(async () => {
  await Promise.all([fixtureServer.close(), syntheticServer.close(), tinyServer.close()]);
  rmSync(workDir, { recursive: true, force: true });
});

describe('NFR-001 launch-to-ready budgets (real binary, wire-observable readiness)', () => {
  it('fs input on the example corpus is ready within 5 s', async () => {
    const started = Date.now();
    const spawned = await ChildStdioMcpClient.start(['--dir', path.join(CORPUS_FIXTURES, 'example')]);
    const readyMs = Date.now() - started;
    expect(spawned.client.initializeResult.serverInfo.name).toBe('doc-kitty-mcp');
    const code = await spawned.client.close();
    expect(code).toBe(0);
    console.log(`[wp08-nfr] fs example launch-to-ready: ${readyMs} ms (budget ${BUDGET_FS_MS} ms)`);
    expect(readyMs).toBeLessThan(BUDGET_FS_MS);
  }, 30_000);

  it('HTTPS input on the example corpus is ready within 15 s', async () => {
    const started = Date.now();
    const spawned = await ChildStdioMcpClient.start(['--site', fixtureServer.base]);
    const readyMs = Date.now() - started;
    expect(spawned.client.initializeResult.serverInfo.name).toBe('doc-kitty-mcp');
    const code = await spawned.client.close();
    expect(code).toBe(0);
    // Every artifact was fetched from the served corpus, exactly once each.
    expect(fixtureServer.requests.get('/api/index.json')).toBe(1);
    console.log(`[wp08-nfr] https example launch-to-ready: ${readyMs} ms (budget ${BUDGET_HTTP_EXAMPLE_MS} ms)`);
    expect(readyMs).toBeLessThan(BUDGET_HTTP_EXAMPLE_MS);
  }, 60_000);

  it('HTTPS input on a generated 1000-page corpus is ready within 60 s under 50-150 ms latency', async () => {
    const started = Date.now();
    const spawned = await ChildStdioMcpClient.start(['--site', syntheticServer.base], {
      initializeTimeoutMs: BUDGET_HTTP_1000_MS + 30_000,
    });
    const readyMs = Date.now() - started;
    expect(spawned.client.initializeResult.serverInfo.name).toBe('doc-kitty-mcp');
    const code = await spawned.client.close();
    expect(code).toBe(0);
    // The full corpus transited this server: index + every page, once each.
    expect(syntheticServer.requests.get('/api/index.json')).toBe(1);
    let fetchedPages = 0;
    for (const [pathname, n] of syntheticServer.requests) {
      if (pathname.startsWith('/api/pages/')) {
        expect(n).toBe(1);
        fetchedPages += 1;
      }
    }
    expect(fetchedPages).toBe(1000);
    // The pass must be attributable to the pinned pool width, not quiet iron:
    // with ~100 ms mean latency a serial loader needs ~100 s and fails; the
    // observed overlap proves c >= 8 did the work.
    expect(syntheticServer.maxInFlight()).toBeGreaterThanOrEqual(8);
    console.log(
      `[wp08-nfr] https 1000-page launch-to-ready: ${readyMs} ms (budget ${BUDGET_HTTP_1000_MS} ms; ` +
        `peak in-flight ${syntheticServer.maxInFlight()}; with c=1 the same latency profile costs ~100 s)`,
    );
    expect(readyMs).toBeLessThan(BUDGET_HTTP_1000_MS);
  }, 150_000);
});

describe('NFR-001 worker-pool floor: concurrency parameter >= 8', () => {
  it('drives the default-constructed source to >= 8 simultaneous fetches', async () => {
    // No options: the constructor's documented default is the parameter under test.
    const snapshot = await loadSnapshot(new HttpCorpusSource(tinyServer.base));
    expect(snapshot.pages).toHaveLength(32);
    expect(tinyServer.maxInFlight()).toBeGreaterThanOrEqual(8);
  }, 60_000);
});
