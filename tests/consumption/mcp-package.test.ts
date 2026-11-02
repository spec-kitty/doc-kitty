/**
 * mcp-package.test.ts - clean-room consumption proof for the PACKED
 * `@spec-kitty/doc-kitty-mcp` tarball (mission doc-kitty-mcp-server WP06;
 * T024 lane wiring, T025 consumption, T026 pointer e2e; NFR-003, C-002,
 * FR-009, US-3/SC-001).
 *
 * WHY CLEAN-ROOM: the in-repo suites (mcp/tests/**) exercise the server from
 * source. This file proves the DELIVERABLE as packed: `npm pack` the workspace
 * package, install the tarball into a throwaway copy of the committed fixture
 * (own workspace via `packages: []`, own lockfile, `--frozen-lockfile
 * --prefer-offline` per the consumption-gap precedent - never a bare
 * registry install), then spawn the fixture's `node_modules/.bin/doc-kitty-mcp`
 * shim DIRECTLY (never `node <path>`) so the shim + shebang launch chain of a
 * real client config is what carries the protocol.
 *
 * Client: tests/consumption/fixtures/mcp-consumer/client.mjs runs INSIDE the
 * clean room, importing the tarball's pinned `@modelcontextprotocol/server`
 * for the handshake's LATEST_PROTOCOL_VERSION (NFR-004's in-process client
 * built only from the pinned SDK), speaking newline-delimited JSON-RPC like
 * the WP03/WP08 harnesses (no client package may join the closure).
 *
 * T026 pointer e2e (US-3/SC-001 within C-002): ONE example build with
 * `links.mcp` enabled (route sources patched in place and restored - the knobs
 * live in example/src/pages, outside any mission WP's edit scope, so the test
 * writes them for exactly the duration of its build) advertises the
 * packed-tarball launch line; the test asserts THAT string and then executes
 * its command form in the clean room against the same build served over
 * 127.0.0.1 (deploy-style origin substitution - the baked https origin is the
 * site's production URL; the hermetic test serves the identical dist on
 * loopback, the mechanism the WP08 served-site lane established).
 *
 * Harness notes (environment, not weakening):
 *  - Same-filesystem temp root (crafted-fixture.makeCraftRoot) so the
 *    `--prefer-offline` install reuses the content-addressable pnpm store.
 *  - CI's consumption workflow has no PlantUML service, so the example build
 *    runs with DK_DIAGRAM_BUILD_RENDER=off (client-mode diagrams), exactly the
 *    WP08 lane's posture; the corpus artifacts under test are
 *    diagram-mode independent.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { craftFixtureCopy, installFixture, makeCraftRoot, REPO_ROOT } from './crafted-fixture';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // tests/consumption
const MCP_ROOT = path.join(REPO_ROOT, 'mcp');
const FIXTURE_SOURCE = path.join(HERE, 'fixtures', 'mcp-consumer');
const EXAMPLE_DIST_NAME = 'dist-wp06-mcp-consumption';
const EXAMPLE_DIST = path.join(REPO_ROOT, 'example', EXAMPLE_DIST_NAME);
/** The origin the example site bakes into its published artifacts (mirrors EXAMPLE_BAKED_ORIGIN in mcp/tests/perf/perf-helpers.ts). */
const EXAMPLE_BAKED_ORIGIN = 'https://spec-kitty.github.io/doc-kitty';
/** Tool order is contract-pinned (registration order; mcp/src/surface/tools.ts). */
const EXPECTED_TOOLS = ['get_site_info', 'list_pages', 'get_page', 'search_pages', 'list_scenarios'];

const CHILD_ENV = (() => {
  const env = { ...process.env };
  // Vitest mirrors BASE_URL into the env; it would silently re-base a real
  // `astro build` child (established lesson in example-adopter.test.ts).
  delete env.BASE_URL;
  // Local env note: pnpm's verify-deps preflight must not interrupt child installs/builds.
  env.npm_config_verify_deps_before_run = 'false';
  return env;
})();

// -- example route patching (links.mcp enabled for exactly one build) ---------

interface RoutePatch {
  file: string;
  anchor: string;
  replacement: string;
  original?: string;
}

/**
 * The example ships the FR-009 knob OFF; enabling it for one build is the
 * US-3 acceptance construction. Anchors are exact strings from the committed
 * route sources - if the example drifts, the patch fails loudly instead of
 * silently testing nothing.
 */
const ROUTE_PATCHES: RoutePatch[] = [
  {
    file: path.join(REPO_ROOT, 'example', 'src', 'pages', 'api', 'index.json.ts'),
    anchor: `agentIndexRoute({ title: 'DocKitty Example' })`,
    replacement: `agentIndexRoute({ title: 'DocKitty Example', links: { mcp: true } })`,
  },
  {
    file: path.join(REPO_ROOT, 'example', 'src', 'pages', 'llms.txt.ts'),
    anchor: `  title: 'DocKitty Example',`,
    replacement: `  title: 'DocKitty Example',\n  links: { mcp: true },`,
  },
];

function applyRoutePatches(): void {
  for (const patch of ROUTE_PATCHES) {
    const text = readFileSync(patch.file, 'utf8');
    patch.original = text;
    const occurrences = text.split(patch.anchor).length - 1;
    if (occurrences !== 1) {
      throw new Error(`pointer e2e patch anchor occurs ${occurrences}x in ${patch.file} (expected 1); example source drifted`);
    }
    writeFileSync(patch.file, text.replace(patch.anchor, patch.replacement));
  }
}

function restoreRoutePatches(): void {
  for (const patch of ROUTE_PATCHES) {
    if (patch.original !== undefined && readFileSync(patch.file, 'utf8') !== patch.original) {
      writeFileSync(patch.file, patch.original);
    }
    patch.original = undefined;
  }
}

// -- tarball pack + lockfile integrity pinning --------------------------------

/** Pack the mcp workspace package into the crafted fixture as the stable `doc-kitty-mcp.tgz`. */
function packMcpTarball(fixtureDir: string): void {
  const build = spawnSync('pnpm', ['build'], { cwd: MCP_ROOT, encoding: 'utf8', env: CHILD_ENV });
  if (build.status !== 0) throw new Error(`mcp build (tsc) failed:\n${build.stdout}\n${build.stderr}`);
  const res = spawnSync('npm', ['pack', '--json', '--pack-destination', fixtureDir], {
    cwd: MCP_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`npm pack failed:\n${res.stderr}`);
  const packed = readdirSync(fixtureDir).find((f) => f.endsWith('.tgz') && f !== 'doc-kitty-mcp.tgz');
  if (!packed) throw new Error('npm pack produced no tarball');
  cpSync(path.join(fixtureDir, packed), path.join(fixtureDir, 'doc-kitty-mcp.tgz'));
  rmSync(path.join(fixtureDir, packed));
}

/**
 * Point the fixture lockfile's `doc-kitty-mcp.tgz` entry at the tarball that
 * was JUST packed - the same non-reproducible-bytes problem and one-entry
 * rewrite as scripts/pin-toolkit-integrity.mjs (which is name-pinned to the
 * toolkit and cannot be reused). Fails closed unless the entry occurs once.
 */
function pinMcpTarballIntegrity(fixtureDir: string): void {
  const lockPath = path.join(fixtureDir, 'pnpm-lock.yaml');
  const original = readFileSync(lockPath, 'utf8');
  const tarball = readFileSync(path.join(fixtureDir, 'doc-kitty-mcp.tgz'));
  const integrity = `sha512-${createHash('sha512').update(tarball).digest('base64')}`;
  const ENTRY =
    /^( {2}'@spec-kitty\/doc-kitty-mcp@file:doc-kitty-mcp\.tgz':\n {4}resolution: \{integrity: )(sha512-[A-Za-z0-9+/=]+)(, tarball: file:doc-kitty-mcp\.tgz\})$/gm;
  const matches = original.match(ENTRY) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      `expected exactly one '@spec-kitty/doc-kitty-mcp@file:doc-kitty-mcp.tgz' resolution in ${lockPath}, found ${matches.length}`,
    );
  }
  writeFileSync(lockPath, original.replace(ENTRY, `$1${integrity}$3`));
}

// -- static corpus server (deploy-style origin rewrite, WP08 mechanism) -------

interface StaticServer {
  base: string;
  requests: Map<string, number>;
  close: () => Promise<void>;
}

/** Serve the /api/**.json artifacts under `dir` on 127.0.0.1 with the baked origin rewritten per request. */
function startStaticServer(dir: string): Promise<StaticServer> {
  const requests = new Map<string, number>();
  let base = '';
  const server: Server = createServer((req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    requests.set(pathname, (requests.get(pathname) ?? 0) + 1);
    if (!pathname.startsWith('/api/') || !pathname.endsWith('.json') || pathname.includes('..')) {
      res.writeHead(404).end('not found');
      return;
    }
    const file = path.join(dir, pathname);
    if (!existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    // The baked /doc-kitty base path segment disappears under the origin rewrite
    // (EXAMPLE_BAKED_ORIGIN includes it), so requests arrive as /api/... here.
    const body = readFileSync(file, 'utf8').replaceAll(EXAMPLE_BAKED_ORIGIN, base);
    res.writeHead(200, { 'content-type': 'application/json' }).end(body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      resolve({
        base,
        requests,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections();
            server.close(() => done());
          }),
      });
    });
  });
}

/** The bytes exactly as the static server sends them for a dist-relative file. */
function servedJson(base: string, relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(EXAMPLE_DIST, relPath), 'utf8').replaceAll(EXAMPLE_BAKED_ORIGIN, base));
}

// -- clean-room client driver -------------------------------------------------

interface ClientReport {
  initialize: { serverInfo: { name: string }; protocolVersion: string };
  tools: string[];
  siteInfo: {
    siteTitle: string;
    baseUrl: string;
    contractVersion: string;
    buildId?: string;
    pageCount: number;
    capabilities: Record<string, boolean>;
  };
  pages: Record<string, { id: string; title: string; markdown: string }>;
  exitCode: number;
  stderr: string[];
  spawnFailures: string[];
  clientError?: string;
}

/**
 * Run the fixture's client.mjs against the fixture's own bin shim, spawning
 * the bin DIRECTLY (the T025 shebang/shim proof). Returns the parsed envelope.
 *
 * MUST be async: this test process hosts the static corpus server, so a
 * `spawnSync` here would freeze the event loop and starve the spawned
 * server's fetches until its per-request timeout fired (learned the hard
 * way; the WP08 lane's all-async shape is why it never sees this).
 */
function runCleanRoomClient(fixtureDir: string, binArgs: string[], pageIds: string[]): Promise<{ status: number; report: ClientReport }> {
  const binShim = path.join(fixtureDir, 'node_modules', '.bin', 'doc-kitty-mcp');
  const child = spawn(
    process.execPath,
    [path.join(fixtureDir, 'client.mjs'), binShim, ...binArgs, '--pages', pageIds.join(',')],
    { cwd: fixtureDir, env: CHILD_ENV },
  );
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('clean-room client run exceeded 120 s'));
    }, 120_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`clean-room client run failed to spawn: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      let report: ClientReport;
      try {
        report = JSON.parse(stdout.slice(stdout.lastIndexOf('\n') + 1)) as ClientReport;
      } catch (error) {
        reject(new Error(`clean-room client emitted no parseable envelope: ${String(error)}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      if (code !== 0 || report.clientError !== undefined) {
        reject(
          new Error(
            `clean-room client reported failure:\n${report.clientError ?? ''}\n${report.spawnFailures?.join('\n') ?? ''}\n${report.stderr?.join('\n') ?? stderr}`,
          ),
        );
        return;
      }
      resolve({ status: code ?? 1, report });
    });
  });
}

// -- suite --------------------------------------------------------------------

let craftRoot = '';
let fixture = '';
let server: StaticServer;
let builtIndex: {
  title: string;
  version: string;
  count: number;
  buildId?: string;
  pages: Array<{ _links?: { self?: { href?: string } } }>;
  _links: { mcp?: { href: string; title: string; usage: string } };
};
let sampleIds: string[] = [];
const timings: Record<string, number> = {};

describe('mcp package clean-room consumption (WP06, NFR-003/C-002/US-3)', () => {
  beforeAll(() => {
    const t0 = Date.now();
    // 1. Pack the tarball and install it in the clean room (own workspace,
    //    own lockfile, frozen + prefer-offline against the shared store).
    let t = Date.now();
    craftRoot = makeCraftRoot('dk-mcp-package-');
    fixture = craftFixtureCopy(craftRoot, 'mcp-consumer', FIXTURE_SOURCE);
    packMcpTarball(fixture);
    pinMcpTarballIntegrity(fixture);
    const install = installFixture(fixture);
    if (install.status !== 0) {
      throw new Error(`clean-room install failed (offline store may be incomplete):\n${install.output}`);
    }
    timings.packInstallMs = Date.now() - t;

    // 2. ONE example build with links.mcp enabled (patched in, restored out).
    t = Date.now();
    rmSync(EXAMPLE_DIST, { recursive: true, force: true });
    try {
      applyRoutePatches();
      const build = spawnSync('pnpm', ['--filter', 'example', 'build'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: { ...CHILD_ENV, DK_OUTDIR: EXAMPLE_DIST_NAME, DK_DIAGRAM_BUILD_RENDER: 'off' },
      });
      if (build.status !== 0) {
        throw new Error(`example build failed:\n${(build.stderr ?? '').slice(-4000)}`);
      }
    } finally {
      restoreRoutePatches();
    }
    timings.exampleBuildMs = Date.now() - t;
    builtIndex = JSON.parse(readFileSync(path.join(EXAMPLE_DIST, 'api', 'index.json'), 'utf8'));

    // Sample pages: the home page (empty-slug record - index records name it,
    // never slug arithmetic) plus one nested page, the two classes the WP08
    // lane samples.
    const marker = '/api/pages/';
    const idOf = (record: { _links?: { self?: { href?: string } } }): string => {
      const href = record._links?.self?.href ?? '';
      return href.slice(href.indexOf(marker) + marker.length, -'.json'.length);
    };
    const nested = builtIndex.pages.find((record) => idOf(record).includes('/'));
    sampleIds = ['home', ...(nested ? [idOf(nested)] : [])];
    if (sampleIds.length < 2) throw new Error('expected at least one nested page in the example corpus');

    // 3. Serve the fresh dist statically.
    return startStaticServer(EXAMPLE_DIST).then((started) => {
      server = started;
      timings.setupMs = Date.now() - t0;
      console.log(`[wp06-consumption] timings: ${JSON.stringify(timings)}`);
    });
  }, 600_000);

  afterAll(async () => {
    restoreRoutePatches(); // idempotent; covers a beforeAll mid-failure path
    if (server !== undefined) await server.close();
    rmSync(EXAMPLE_DIST, { recursive: true, force: true }); // own output; .gitignore is out of scope
    if (craftRoot && existsSync(craftRoot)) rmSync(craftRoot, { recursive: true, force: true });
  });

  it('T024 lane wiring: pnpm assert:supply-chain (mcp closure audit) is green in this lane', () => {
    const audit = spawnSync('pnpm', ['assert:supply-chain'], { cwd: REPO_ROOT, encoding: 'utf8', env: CHILD_ENV });
    expect(audit.status, `supply-chain audit must pass:\n${audit.stdout}\n${audit.stderr}`).toBe(0);
    expect(audit.stdout).toMatch(/audit-closure: PASS - \d+ lockfile entries/);
  });

  it('T025: the tarball installs the bin shim, executable, with the shebang entry behind it', () => {
    const binShim = path.join(fixture, 'node_modules', '.bin', 'doc-kitty-mcp');
    expect(existsSync(binShim), `bin shim missing at ${binShim}`).toBe(true);
    expect(() => accessSync(binShim, constants.X_OK), 'bin shim must be executable').not.toThrow();
    // The packed entry the shim dispatches to carries the shebang (the header
    // comment of mcp/src/cli.ts documents tsc preserving but never creating
    // it, and the mandate here is to prove the launch chain end to end).
    const entry = path.join(fixture, 'node_modules', '@spec-kitty', 'doc-kitty-mcp', 'dist', 'cli.js');
    expect(readFileSync(entry, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
    // Reviewer gate ("the clean room must not see workspace hoisting"): the
    // installed package must resolve into the pnpm store path of the FILE
    // TARBALL, never into the repo's mcp/ source tree.
    const installedReal = realpathSync(path.join(fixture, 'node_modules', '@spec-kitty', 'doc-kitty-mcp'));
    expect(installedReal).toContain(`node_modules${path.sep}.pnpm`);
    expect(installedReal).toContain('file+doc-kitty-mcp.tgz');
    expect(installedReal.startsWith(REPO_ROOT)).toBe(false);
  });

  it('T025: direct shim spawn completes the MCP handshake and serves get_site_info byte-derived', async () => {
    // Request-count assertions are taken as deltas around THIS client run:
    // every run reloads the same snapshot, so absolute counts accrue with the
    // number of runs; each run must still have fetched index.json exactly once.
    const indexRequestsBefore = server.requests.get('/api/index.json') ?? 0;
    const { report } = await runCleanRoomClient(fixture, ['--site', server.base], sampleIds);
    expect(report.spawnFailures).toEqual([]);
    expect(report.initialize.serverInfo.name).toBe('doc-kitty-mcp');
    expect(typeof report.initialize.protocolVersion).toBe('string');
    expect(report.tools).toEqual(EXPECTED_TOOLS);

    const servedIndex = servedJson(server.base, 'api/index.json') as typeof builtIndex;
    expect(report.siteInfo.siteTitle).toBe(servedIndex.title);
    expect(report.siteInfo.pageCount).toBe(servedIndex.count);
    expect(report.siteInfo.contractVersion).toBe(servedIndex.version);
    expect(report.siteInfo.buildId).toBe(servedIndex.buildId);
    expect(report.siteInfo.capabilities.pages).toBe(true);
    // The corpus really transited THIS static server (never a fixture replay):
    expect(server.requests.get('/api/index.json')).toBe(indexRequestsBefore + 1);
  });

  it('T025: get_page markdown byte-equals the bytes the static server sent for each sampled page', async () => {
    const { report } = await runCleanRoomClient(fixture, ['--site', server.base], sampleIds);
    for (const id of sampleIds) {
      const served = servedJson(server.base, `api/pages/${id}.json`) as { title: string; markdown: string };
      expect(report.pages[id]?.id).toBe(id);
      expect(report.pages[id]?.title).toBe(served.title);
      expect(report.pages[id]?.markdown).toBe(served.markdown);
      expect(server.requests.get(`/api/pages/${id}.json`)).toBeGreaterThanOrEqual(1);
    }
    // Clean shutdown on stdin close (contract exit code 0).
    expect(report.exitCode).toBe(0);
  });

  it('T026: the links.mcp build advertises the packed-tarball command form (never an npx registry form)', () => {
    // Assert the raw BUILT index (pre-rewrite), so the advertised URL is the
    // site's real baked base URL - exactly what a visiting agent would read.
    expect(builtIndex._links.mcp).toEqual({
      href: 'npm:@spec-kitty/doc-kitty-mcp',
      title: 'Doc-Kitty MCP server',
      usage: `doc-kitty-mcp --site ${EXAMPLE_BAKED_ORIGIN}`,
    });
    expect(builtIndex._links.mcp?.usage).not.toContain('npx'); // C-002: no registry form is advertised yet

    const llmsTxt = readFileSync(path.join(EXAMPLE_DIST, 'llms.txt'), 'utf8');
    const mcpLines = llmsTxt.split('\n').filter((line) => line.startsWith('MCP server:'));
    expect(mcpLines).toEqual([
      `MCP server: doc-kitty-mcp --site ${EXAMPLE_BAKED_ORIGIN} serves the machine index ` +
        `(${EXAMPLE_BAKED_ORIGIN}/api/index.json) to MCP clients (npm:@spec-kitty/doc-kitty-mcp)`,
    ]);
  });

  it('T026: the advertised snippet form installs+launches in the clean room (US-3 execution)', async () => {
    const usage = builtIndex._links.mcp?.usage ?? '';
    const tokens = usage.split(/\s+/);
    expect(tokens.slice(0, 2)).toEqual(['doc-kitty-mcp', '--site']);
    // Execute the advertised form with the site URL substituted to the hermetic
    // server (deploy-style rewrite: identical dist, loopback origin), resolving
    // the `doc-kitty-mcp` command as the clean room's installed bin shim.
    const { report } = await runCleanRoomClient(fixture, [tokens[1]!, server.base], ['home']);
    expect(report.initialize.serverInfo.name).toBe('doc-kitty-mcp');
    expect(report.siteInfo.siteTitle).toBe(builtIndex.title);
    expect(report.siteInfo.pageCount).toBe(builtIndex.count);
    const servedHome = servedJson(server.base, 'api/pages/home.json') as { markdown: string };
    expect(report.pages.home?.markdown).toBe(servedHome.markdown);
    expect(report.exitCode).toBe(0);
  });
});
