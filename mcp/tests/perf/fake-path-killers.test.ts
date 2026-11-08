/**
 * Fake-path killer controls (T023): three regressions that would let a
 * cheating or broken implementation pass a weaker suite, each proven closed.
 *
 *   1. FR-002 (fs mode is network-free): run the CLI's --dir load with every
 *      process-level network API tripwired (global fetch plus the mutable
 *      connect/request entry points of node: net/tls/http/https). The full fs
 *      load must succeed with ZERO trapped calls. The traps are self-checked
 *      live before the run, so an armed-but-inert trap cannot fake the pass.
 *      Scope note: the tripwire guards the API surface our own code and the
 *      SDK could call; node internals path through these same module-export
 *      objects at call time, which is what the patch catches.
 *
 *   2. FR-006 (one process serves exactly one corpus build): start the real
 *      binary against a static server over a TEMP COPY of the corpus, read a
 *      page, then rewrite that page on disk mid-process. The server's answers
 *      must stay pinned to the launch snapshot, and the static server's
 *      request log must show no re-fetch.
 *
 *   3. FR-001 negative control (an endpoint returning nothing): --site against
 *      a host that 404s everything, and one that answers 200 with an empty
 *      body, must exit 2 with a NAMED error (UNREACHABLE_ENDPOINT /
 *      MALFORMED_CORPUS) and must never reach the serve seam - never fixture
 *      content.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { run } from '../../src/cli.js';
import type { LaunchConfiguration } from '../../src/cli.js';
import type { CorpusSnapshot } from '../../src/corpus/snapshot.js';
import {
  ChildStdioMcpClient,
  CORPUS_FIXTURES,
  EXAMPLE_BAKED_ORIGIN,
  ensureMcpDistBuilt,
  startStaticCorpusServer,
} from './perf-helpers.js';
import type { SpawnedMcp, StaticCorpusServer, ToolResultWire } from './perf-helpers.js';

const EXAMPLE_FIXTURE = path.join(CORPUS_FIXTURES, 'example');

function resultJson(result: ToolResultWire): unknown {
  expect(result.isError).toBeFalsy();
  const block = result.content?.[0];
  expect(block?.type).toBe('text');
  return JSON.parse(block!.text as string);
}

describe('FR-002 control: fs mode opens zero sockets with network tripwired', () => {
  it('loads the example corpus from --dir under an armed network trap', async () => {
    const hits: string[] = [];
    const trap = (name: string) => {
      const fn = (...args: unknown[]): never => {
        hits.push(`${name} ${String(args[0])}`);
        throw new Error(`WP08 tripwire: fs mode attempted network access via ${name}`);
      };
      return fn;
    };
    const realFetch = globalThis.fetch;
    const realNetConnect = net.connect;
    const realNetCreateConnection = net.createConnection;
    const realTlsConnect = tls.connect;
    const realHttpRequest = http.request;
    const realHttpGet = http.get;
    const realHttpsRequest = https.request;
    const realHttpsGet = https.get;
    const mutable = (m: object): Record<string, unknown> => m as unknown as Record<string, unknown>;
    globalThis.fetch = ((...args: unknown[]) => {
      hits.push(`fetch ${String(args[0])}`);
      return Promise.reject(new Error('WP08 tripwire: fs mode attempted fetch'));
    }) as typeof fetch;
    mutable(net)['connect'] = trap('net.connect');
    mutable(net)['createConnection'] = trap('net.createConnection');
    mutable(tls)['connect'] = trap('tls.connect');
    mutable(http)['request'] = trap('http.request');
    mutable(http)['get'] = trap('http.get');
    mutable(https)['request'] = trap('https.request');
    mutable(https)['get'] = trap('https.get');
    try {
      // Self-check: the armed traps must actually bite (non-vacuity).
      await expect(globalThis.fetch('http://192.0.2.1/wp08-probe')).rejects.toThrow('WP08 tripwire');
      expect(() => net.connect(80, '192.0.2.1')).toThrow('WP08 tripwire');
      const hitsAfterSelfCheck = hits.length;
      expect(hitsAfterSelfCheck).toBeGreaterThanOrEqual(2);

      let served: { snapshot: CorpusSnapshot; config: LaunchConfiguration } | undefined;
      const io = { out: [] as string[], err: [] as string[], stdout: (l: string) => void io.out.push(l), stderr: (l: string) => void io.err.push(l) };
      const code = await run(['--dir', EXAMPLE_FIXTURE], io, (snapshot, config) => {
        served = { snapshot, config };
      });
      expect(code, io.err.join('\n')).toBe(0);
      // 70 docs pages + the 3 synthetic OpenAPI version records (WP03).
      expect(served?.snapshot.pages.length).toBe(73);
      // The whole load happened with the traps armed and bit NOTHING new.
      expect(hits).toHaveLength(hitsAfterSelfCheck);
    } finally {
      globalThis.fetch = realFetch;
      mutable(net)['connect'] = realNetConnect;
      mutable(net)['createConnection'] = realNetCreateConnection;
      mutable(tls)['connect'] = realTlsConnect;
      mutable(http)['request'] = realHttpRequest;
      mutable(http)['get'] = realHttpGet;
      mutable(https)['request'] = realHttpsRequest;
      mutable(https)['get'] = realHttpsGet;
    }
  }, 60_000);
});

describe('FR-006 control: mid-process corpus mutation leaves answers pinned to the launch snapshot', () => {
  let workDir: string;
  let corpusDir: string;
  let server: StaticCorpusServer;
  let spawned: SpawnedMcp;

  beforeAll(async () => {
    ensureMcpDistBuilt();
    workDir = mkdtempSync(path.join(tmpdir(), 'wp08-fr006-'));
    corpusDir = path.join(workDir, 'corpus');
    cpSync(EXAMPLE_FIXTURE, corpusDir, { recursive: true });
    server = await startStaticCorpusServer(corpusDir, { bakedOrigin: EXAMPLE_BAKED_ORIGIN });
    spawned = await ChildStdioMcpClient.start(['--site', server.base]);
  }, 120_000);

  afterAll(async () => {
    if (spawned !== undefined) await spawned.client.close();
    if (server !== undefined) await server.close();
    if (workDir !== undefined) rmSync(workDir, { recursive: true, force: true });
  });

  it('serves the launch-time bytes after the served corpus mutates on disk', async () => {
    const before = resultJson(await spawned.client.callTool('get_page', { id: 'home' })) as { title: string; markdown: string };

    // Mutate the served corpus mid-process: new title, new markdown body.
    const pagePath = path.join(corpusDir, 'api', 'pages', 'home.json');
    const artifact = JSON.parse(readFileSync(pagePath, 'utf8')) as Record<string, unknown>;
    artifact['title'] = 'MUTATED TITLE - must never be served';
    artifact['markdown'] = 'MUTATED BODY - a lazy re-fetch would surface this';
    writeFileSync(pagePath, JSON.stringify(artifact));

    const after = resultJson(await spawned.client.callTool('get_page', { id: 'home' })) as { title: string; markdown: string };
    expect(after.title).toBe(before.title);
    expect(after.markdown).toBe(before.markdown);
    expect(after.title).not.toContain('MUTATED');
    expect(after.markdown).not.toContain('MUTATED');

    // No re-read happened on the wire: exactly ONE fetch per artifact.
    expect(server.requests.get('/api/pages/home.json')).toBe(1);
  }, 60_000);
});

describe('FR-001 negative control: an endpoint returning nothing yields a named error, never fixture content', () => {
  let dead: StaticCorpusServer;
  let empty: StaticCorpusServer;

  beforeAll(async () => {
    dead = await startStaticCorpusServer('.', { alwaysStatus: 404 });
    empty = await startStaticCorpusServer('.', { alwaysStatus: 200 }); // 200 with an EMPTY body
  });

  afterAll(async () => {
    await Promise.all([dead.close(), empty.close()]);
  });

  function capture(): { out: string[]; err: string[]; stdout: (l: string) => void; stderr: (l: string) => void } {
    const out: string[] = [];
    const err: string[] = [];
    return { out, err, stdout: (l) => void out.push(l), stderr: (l) => void err.push(l) };
  }

  it('404-everything exits 2 with UNREACHABLE_ENDPOINT and never serves', async () => {
    const io = capture();
    let serveCalled = false;
    const code = await run(['--site', dead.base], io, () => {
      serveCalled = true;
    });
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('UNREACHABLE_ENDPOINT');
    expect(serveCalled).toBe(false); // no snapshot, no surface, no content
  }, 30_000);

  it('200-with-empty-body exits 2 with MALFORMED_CORPUS and never serves', async () => {
    const io = capture();
    let serveCalled = false;
    const code = await run(['--site', empty.base], io, () => {
      serveCalled = true;
    });
    expect(code).toBe(2);
    expect(io.err.join('\n')).toContain('MALFORMED_CORPUS');
    expect(serveCalled).toBe(false);
  }, 30_000);
});
