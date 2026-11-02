/**
 * perf-helpers - shared machinery for the WP08 perf/NFR suite (T022/T023):
 *
 *   - ensureMcpDistBuilt: build the binary the boundary test scans and the
 *     launch-budget / lane tests spawn (tsc emit, a few seconds);
 *   - startStaticCorpusServer: the local static corpus host (node:http)
 *     with deploy-style origin rewrite, per-request latency injection and
 *     in-flight accounting - the NFR-001 latency mechanism;
 *   - ChildStdioMcpClient: a minimal stdio MCP client over a spawned
 *     doc-kitty-mcp binary (newline-delimited JSON-RPC per the MCP stdio
 *     framing), deliberately hand-rolled like the WP03 surface harness: the
 *     package's one runtime dependency is @modelcontextprotocol/server
 *     (NFR-003) and no client package may join the closure.
 *
 * Nothing here asserts; every assertion lives in the importing test file.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import {
  startStaticCorpusServer as sharedStart,
} from '../helpers/static-corpus-server.js';

export const PERF_DIR = path.dirname(fileURLToPath(import.meta.url));
export const MCP_ROOT = path.resolve(PERF_DIR, '..', '..');
export const REPO_ROOT = path.resolve(MCP_ROOT, '..');
export const MCP_BIN = path.join(MCP_ROOT, 'dist', 'cli.js');
export const CORPUS_FIXTURES = path.join(MCP_ROOT, 'tests', 'corpus', 'fixtures');

/** The origin the example site bakes into its published artifacts. */
export const EXAMPLE_BAKED_ORIGIN = 'https://spec-kitty.github.io/doc-kitty';

/**
 * `pnpm build` (tsc emit) for the mcp package, asserted. Every test file that
 * needs dist/ builds it itself: the code-quality CI lane runs vitest without a
 * prior build step, and each of these files must be runnable standalone
 * (`vitest run tests/perf/<file>`). Skipped when dist is already newer than
 * every src file.
 */
export function ensureMcpDistBuilt(): void {
  if (existsSync(MCP_BIN)) {
    const entry = statSync(MCP_BIN).mtimeMs;
    if (entry >= newestMtime(path.join(MCP_ROOT, 'src'))) return;
  }
  const res = spawnSync('pnpm', ['build'], { cwd: MCP_ROOT, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`mcp build (tsc) failed:\n${res.stdout}\n${res.stderr}`);
  }
  if (!existsSync(MCP_BIN)) {
    throw new Error(`expected built binary missing after build: ${MCP_BIN}`);
  }
}

function newestMtime(target: string): number {
  let stat;
  try {
    stat = statSync(target);
  } catch {
    return 0;
  }
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = 0;
  for (const entry of readdirSync(target)) {
    newest = Math.max(newest, newestMtime(path.join(target, entry)));
  }
  return newest;
}

/** The origin token synthetic corpora bake into their artifacts; the static server rewrites it per request. */
export const SYNTHETIC_ORIGIN = 'https://synthetic.invalid/site';

/**
 * Mint a deterministic, guard-passing corpus of `count` pages under `dir`
 * (api/index.json + api/pages/pNNNN.json, one shared buildId). Programmatic
 * generation is the mission-pinned alternative to committing a 1000-page
 * fixture.
 */
export function generateSyntheticCorpus(dir: string, count: number): void {
  mkdirSync(path.join(dir, 'api', 'pages'), { recursive: true });
  const buildId = 'deadbeef'.repeat(8); // 64 hex chars, shared by every artifact
  const pages = [];
  for (let i = 0; i < count; i += 1) {
    const id = `p${String(i).padStart(4, '0')}`;
    const record = {
      slug: id,
      route: `/${id}/`,
      section: `sec-${i % 10}`,
      title: `Synthetic page ${i}`,
      description: `Synthetic corpus page number ${i} for the WP08 perf suite.`,
      type: null,
      doc_status: 'active',
      kind: 'Guide',
      tags: ['synthetic'],
      related: [],
      priority: 0.5,
      updated: '2026-11-01T00:00:00Z',
      source: `${SYNTHETIC_ORIGIN}/api/pages/${id}.json`,
      audience: [],
      url: `${SYNTHETIC_ORIGIN}/${id}/`,
      _links: {
        self: { href: `${SYNTHETIC_ORIGIN}/api/pages/${id}.json` },
        html: { href: `${SYNTHETIC_ORIGIN}/${id}/` },
        related: [],
      },
    };
    pages.push(record);
    const artifact = {
      slug: id,
      section: `sec-${i % 10}`,
      title: `Synthetic page ${i}`,
      description: record.description,
      doc_status: 'active',
      authors: ['generator:wp08'],
      keywords: ['synthetic', `kw-${i % 50}`],
      markdown:
        `# Synthetic page ${i}\n\nBody payload for page ${i}. ` +
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(4) +
        `Unique token: token-${id}.\n`,
      url: `${SYNTHETIC_ORIGIN}/${id}/`,
      source: `${SYNTHETIC_ORIGIN}/api/pages/${id}.json`,
      buildId,
      _links: {
        self: { href: `${SYNTHETIC_ORIGIN}/api/pages/${id}.json` },
        html: { href: `${SYNTHETIC_ORIGIN}/${id}/` },
      },
    };
    writeFileSync(path.join(dir, 'api', 'pages', `${id}.json`), JSON.stringify(artifact));
  }
  const index = {
    title: 'Synthetic NFR corpus',
    version: '3',
    count,
    buildId,
    sections: Array.from({ length: 10 }, (_v, i) => ({ id: `sec-${i}`, label: `Section ${i}`, order: i })),
    pages,
    _links: { self: { href: `${SYNTHETIC_ORIGIN}/api/index.json` } },
  };
  writeFileSync(path.join(dir, 'api', 'index.json'), JSON.stringify(index));
}

/**
 * Serve the /api/**.json artifacts under `dir` over 127.0.0.1, re-reading the
 * file from disk on EVERY request (the FR-006 mutation test depends on it:
 * the mutation must be visible to a reader that looks again).
 *
 * Perf-lane local names (`bakedOrigin`, `close`) map onto the one shared
 * implementation in ../helpers/static-corpus-server.ts (pre-merge fold: three
 * hand-rolled servers -> one).
 */
export interface StaticCorpusServerOptions {
  bakedOrigin?: string;
  latencyMs?: () => number;
  alwaysStatus?: number;
}

export interface StaticCorpusServer {
  base: string;
  requests: Map<string, number>;
  maxInFlight: () => number;
  close: () => Promise<void>;
}

export async function startStaticCorpusServer(
  dir: string,
  options: StaticCorpusServerOptions = {},
): Promise<StaticCorpusServer> {
  const inner = await sharedStart(dir, options);
  return {
    base: inner.base,
    requests: inner.requests,
    maxInFlight: inner.maxInFlight,
    close: inner.stop,
  };
}

/** The JSON-RPC error object of a failed request (id-correlated). */
export class StdioWireError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(error: { code: number; message: string; data?: unknown }) {
    super(error.message);
    this.name = 'StdioWireError';
    this.code = error.code;
    this.data = error.data;
  }
}

/** The wire shape of a tools/call result as these tests consume it. */
export interface ToolResultWire {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export interface InitializeResultWire {
  serverInfo: { name: string; version: string };
  capabilities: Record<string, unknown>;
  protocolVersion: string;
}

export interface SpawnedMcp {
  client: ChildStdioMcpClient;
  child: ChildProcessByStdio<Writable, Readable, Readable>;
  /** Everything the binary wrote to stderr so far (the diagnostics channel). */
  stderrLines: string[];
}

/**
 * A minimal MCP client speaking newline-delimited JSON-RPC to a spawned
 * doc-kitty-mcp binary's stdio. Mirrors the WP03 in-process harness' API
 * (initialize handshake in the factory, then listTools/callTool/close) so the
 * two client shapes read alike.
 */
export class ChildStdioMcpClient {
  initializeResult!: InitializeResultWire;

  private readonly child: SpawnedMcp['child'];
  private readonly pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 0;
  private buffer = '';
  private exitCode: number | null = null;
  private exitSeen: (() => void) | undefined;

  private constructor(child: SpawnedMcp['child'], stderrLines: string[]) {
    this.child = child;
    child.stdout.on('data', (chunk: Buffer | string) => this.onData(String(chunk)));
    child.stderr.on('data', (chunk: Buffer | string) => {
      for (const line of String(chunk).split('\n')) {
        if (line.length > 0 && stderrLines.length < 500) stderrLines.push(line);
      }
    });
    child.on('exit', (code) => {
      this.exitCode = code;
      this.exitSeen?.();
      for (const entry of this.pending.values()) {
        entry.reject(new Error(`doc-kitty-mcp exited (code ${code}) with a pending request`));
      }
      this.pending.clear();
    });
  }

  /**
   * Spawn the freshly built binary, perform the MCP initialize handshake and
   * announce initialized. `binArgs` are the cli args (e.g. ['--site', base]).
   */
  static async start(binArgs: readonly string[], options: { initializeTimeoutMs?: number } = {}): Promise<SpawnedMcp> {
    const stderrLines: string[] = [];
    const child = spawn(process.execPath, [MCP_BIN, ...binArgs], { stdio: ['pipe', 'pipe', 'pipe'] });
    const client = new ChildStdioMcpClient(child, stderrLines);
    const timeoutMs = options.initializeTimeoutMs ?? 20_000;
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`initialize handshake exceeded ${timeoutMs} ms`)), timeoutMs);
    });
    try {
      client.initializeResult = (await Promise.race([
        client.request('initialize', {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'doc-kitty-mcp perf tests (WP08)', version: '0.0.0' },
        }),
        timeout,
      ])) as InitializeResultWire;
    } finally {
      clearTimeout(timer!);
    }
    await client.notify('notifications/initialized');
    return { client, child, stderrLines };
  }

  /** tools/list result (names come back in registration order). */
  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    const result = (await this.request('tools/list', {})) as { tools: Array<{ name: string; description?: string }> };
    return result.tools;
  }

  /** tools/call result; wire errors reject. */
  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolResultWire> {
    return (await this.request('tools/call', { name, arguments: args ?? {} })) as ToolResultWire;
  }

  request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = ++this.nextId;
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${message}\n`, (error: Error | null | undefined) => {
        if (error) {
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    const message = params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params };
    await new Promise<void>((resolve, reject) => {
      this.child.stdin.write(`${JSON.stringify(message)}\n`, (error: Error | null | undefined) =>
        error ? reject(error) : resolve(),
      );
    });
  }

  /**
   * Close stdin (the clean-shutdown signal of the stdio binding) and await
   * process exit; resolves with the exit code. Kills after `timeoutMs`.
   */
  async close(timeoutMs = 10_000): Promise<number | null> {
    if (this.exitCode !== null) return this.exitCode;
    this.child.stdin.end();
    await Promise.race([
      new Promise<void>((resolve) => {
        this.exitSeen = resolve;
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.child.kill('SIGKILL');
          resolve();
        }, timeoutMs);
      }),
    ]);
    for (const entry of this.pending.values()) entry.reject(new Error('client closed with a pending request'));
    this.pending.clear();
    return this.exitCode;
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) return;
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 1);
      if (line.trim().length === 0) continue;
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // the SDK's stdio binding never emits non-JSON; ignore defensively
      }
      this.dispatch(message as { id?: unknown; error?: unknown; result?: unknown });
    }
  }

  private dispatch(message: { id?: unknown; error?: unknown; result?: unknown }): void {
    if (typeof message.id !== 'number') return; // server-to-client notifications: none expected here
    const entry = this.pending.get(message.id);
    if (entry === undefined) return;
    this.pending.delete(message.id);
    if (message.error !== undefined && message.error !== null) {
      entry.reject(new StdioWireError(message.error as { code: number; message: string; data?: unknown }));
    } else {
      entry.resolve(message.result);
    }
  }
}
