/**
 * Shared harness for the PlantUML include-check CLI tests (#268): a fake PlantUML
 * service, free ports, an async CLI runner and the one output normalization.
 *
 * Spawning is always async: the fake service runs in the test's own event loop, and a
 * synchronous spawn would deadlock it.
 */
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, symlinkSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePlantuml } from '../../scripts/plantuml-include-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The CLI under test. */
export const CLI_PATH = path.resolve(HERE, '../../scripts/assert-plantuml-no-remote-include.mjs');

/** Directory holding the strict fake `docker` (prepended to PATH by `runCheck`). */
export const FAKE_DOCKER_DIR = path.resolve(HERE, '../fixtures/plantuml-fake-docker');

/** Env names `runCheck` removes from the child unless the caller passes them. */
const OPT_IN_ENV = ['DK_PLANTUML_ALLOW_EXTERNAL', 'DK_PLANTUML_ALLOW_EXTERNAL_RESOLVED'];

export type Decision = 'fetch' | 'refuse';
export type Policy = Decision | ((url: string) => Decision);

export interface FakePlantumlOptions {
  /** Answer 500 to everything. */
  broken?: boolean;
  /** Follow redirects when fetching an include (default: do not). */
  followRedirects?: boolean;
  /** On the first render that has an include, also GET `<canary origin><strayPath>` (NFR-001 positive control). */
  strayPath?: string;
  /** How many times each fetched include is requested (default 1; the real image requests twice). */
  fetchCount?: number;
  /** Refuse URLs whose host has no dot or is an IP literal, like the real INTERNET profile. */
  refusePrivateHosts?: boolean;
}

export interface FakePlantuml {
  /** The SVG endpoint, with trailing `/svg/`. */
  url: string;
  server: Server;
  /** Every include URL the fake was asked to render, in order. */
  includes: string[];
}

const INCLUDE_RE = /^\s*!include(?:url|_once|_many)?\s+(\S+)/gm;

const servers: Server[] = [];

/** Register a server so `closeAll` (call it in `afterEach`) closes it. */
export function trackServer<T extends Server>(server: T): T {
  servers.push(server);
  return server;
}

/** Close every tracked server. */
export async function closeAll(): Promise<void> {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
}

/** Ports this process already handed out: one process never gets the same port twice. */
const pickedPorts = new Set<number>();

/**
 * A canary port that is free now and below the OS's ephemeral range (32768+), so another
 * test's outbound connection cannot grab it between this probe and the later bind (by the
 * CLI, the canary or the test itself). A bind-0 port would come from the ephemeral range
 * and race exactly that way. The probe binds 0.0.0.0, like the canary itself; a port already
 * handed out in this process, or a collision with a sibling test's pick, retries with a new
 * random port.
 */
export async function canaryPort(): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const port = 20000 + Math.floor(Math.random() * 10000);
    if (pickedPorts.has(port)) continue;
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.listen(port, '0.0.0.0', () => probe.close(() => resolve(true)));
    });
    if (free) {
      pickedPorts.add(port);
      return port;
    }
  }
  throw new Error('canaryPort: no free port in 20000-29999 after 50 attempts');
}

/** A policy that fetches an include iff its URL starts with one of `prefixes` (raw `startsWith`, like PlantUML). */
export function prefixPolicy(prefixes: string[]): (url: string) => Decision {
  return (url) => (prefixes.some((p) => url.startsWith(p)) ? 'fetch' : 'refuse');
}

function isPrivateHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !host.includes('.') || /^[\d.]+$/.test(host) || host.startsWith('[');
  } catch {
    return true;
  }
}

/**
 * A fake PlantUML server (tracked: `closeAll` closes it). `refuse` acts like SANDBOX
 * (HTTP 400 + `x-plantuml-diagram-error`), `fetch` GETs the include and appends the
 * body, `broken` answers 500. A function policy decides per include URL.
 */
export async function startFakePlantuml(policy: Policy, options: FakePlantumlOptions = {}): Promise<FakePlantuml> {
  const { broken = false, followRedirects = false, strayPath, fetchCount = 1, refusePrivateHosts = false } = options;
  const includes: string[] = [];
  let strayDone = false;
  const server = createServer(async (req, res) => {
    if (broken) {
      res.writeHead(500).end('down');
      return;
    }
    try {
      const source = decodePlantuml((req.url ?? '').replace(/^\/svg\//, ''));
      const found = [...source.matchAll(INCLUDE_RE)].map((m) => m[1]);
      let body = source;
      if (found.length > 0 && strayPath && !strayDone) {
        strayDone = true;
        await fetch(new URL(strayPath, found[0]).href).then((r) => r.arrayBuffer());
      }
      for (const include of found) {
        includes.push(include);
        const decision = typeof policy === 'function' ? policy(include) : policy;
        if (decision === 'refuse' || (refusePrivateHosts && isPrivateHost(include))) {
          res.writeHead(400, { 'x-plantuml-diagram-error': 'Cannot open URL' }).end('<svg>Cannot open URL</svg>');
          return;
        }
        for (let i = 0; i < fetchCount; i += 1) {
          const r = await fetch(include, { redirect: followRedirects ? 'follow' : 'manual' });
          if (r.status >= 300 && r.status < 400 && !followRedirects) {
            // Redirects are not followed: the render succeeds with an empty diagram (spike F3).
            res.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<svg></svg>');
            return;
          }
          const text = await r.text();
          if (i === 0) body += text;
        }
      }
      res.writeHead(200, { 'content-type': 'image/svg+xml' }).end(`<svg>${body}</svg>`);
    } catch (err) {
      res.writeHead(500).end(String(err));
    }
  });
  trackServer(server);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/svg/`, server, includes };
}

export interface RunCheckOptions {
  env?: Record<string, string>;
  /** Prepend the strict fake `docker` to PATH. */
  fakeDocker?: boolean;
  /** `node-only`: PATH holds a single dir with only a `node` symlink (no docker at all). */
  pathMode?: 'inherit' | 'node-only';
}

export interface CheckResult {
  stdout: string;
  stderr: string;
  exit: number;
}

/** Run the include-check CLI (async spawn) and collect its output. */
export function runCheck(args: string[], opts: RunCheckOptions = {}): Promise<CheckResult> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const name of OPT_IN_ENV) delete env[name];
  if (opts.pathMode === 'node-only') {
    const dir = mkdtempSync(path.join(tmpdir(), 'dk-node-only-'));
    symlinkSync(process.execPath, path.join(dir, 'node'));
    env.PATH = dir;
  } else if (opts.fakeDocker) {
    env.PATH = `${FAKE_DOCKER_DIR}${path.delimiter}${env.PATH ?? ''}`;
    // The fake container publishes the --server port (the CLI's default is 8091), so the
    // identity check passes unless a test overrides DK_FAKE_DOCKER_PUBLISHED_PORT or _PORTS_FILE.
    const server = args[args.indexOf('--server') + 1];
    env.DK_FAKE_DOCKER_PUBLISHED_PORT = args.includes('--server') && server ? new URL(server).port : '8091';
  }
  Object.assign(env, opts.env);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], { env: env as NodeJS.ProcessEnv });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, exit: code ?? -1 }));
  });
}

/** The ONLY normalization: ports on loopback hosts. Nothing else is rewritten. */
export function normalizePorts(text: string): string {
  return text.replace(/(127\.0\.0\.1|localhost):\d+/g, '$1:<PORT>');
}
