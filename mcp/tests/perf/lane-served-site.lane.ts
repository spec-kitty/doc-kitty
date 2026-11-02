/**
 * T022 serialized build lane: the FR-001 anti-fake. The .lane.ts suffix keeps
 * the file OUT of the mcp package's own `vitest run` default include - this
 * suite is registered exactly once, in src/vitest.workspace.ts's BUILD_SUITES
 * (the serialized single-fork project, where every full `astro build` suite
 * lives), which the code-quality CI lane invokes via `pnpm test`.
 *
 * Programme (bytes must provably come from the SERVED site, not fixtures):
 *
 *   1. build example/ once into its own DK_OUTDIR (dist-wp08-mcp-lane);
 *   2. build the mcp binary (tsc) so the spawned process is the SHIPPED code;
 *   3. serve the fresh dist statically on 127.0.0.1 with the deploy-style
 *      origin rewrite (the same mechanism http-source.test.ts uses: baked
 *      https://spec-kitty.github.io/doc-kitty -> this server);
 *   4. spawn the freshly built binary with --site <server base> and drive a
 *      hand-rolled stdio MCP client through a smoke of the conformance
 *      surface: tools/list (all five tools), then one call per tool;
 *   5. prove provenance: a run-unique sentinel token written into the fresh
 *      dist's home page before spawn comes back out of get_page - an answer
 *      assembled from committed fixtures cannot carry it (buildIds are
 *      content-derived, so a same-content rebuild legitimately reproduces the
 *      fixture's id; the sentinel is the discriminator); get_page markdown
 *      byte-equals the JSON the static server actually sent for that page.
 *
 * Environment choices, for the budget posture: DK_DIAGRAM_BUILD_RENDER=off
 * makes the build client-mode for diagrams, because this lane runs in the
 * code-quality CI lane (no PlantUML service, no Chromium) and the corpus
 * artifacts under test (api/*.json) are diagram-mode independent. The lane
 * cleans its own DK_OUTDIR up in afterAll - .gitignore is outside WP08's
 * write scope, so the lane may not leave a transient dir behind.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ChildStdioMcpClient,
  EXAMPLE_BAKED_ORIGIN,
  MCP_BIN,
  REPO_ROOT,
  ensureMcpDistBuilt,
  startStaticCorpusServer,
} from './perf-helpers.js';
import type { SpawnedMcp, StaticCorpusServer, ToolResultWire } from './perf-helpers.js';

const EXAMPLE_OUT = 'dist-wp08-mcp-lane';
const EXAMPLE_DIST = path.join(REPO_ROOT, 'example', EXAMPLE_OUT);

/** Tool order is contract-pinned (registration order; mcp/src/surface/tools.ts). */
const EXPECTED_TOOLS = ['get_site_info', 'list_pages', 'get_page', 'search_pages', 'list_scenarios'];

/**
 * The provenance sentinel: buildIds are CONTENT-derived, so building fixture
 * content legitimately reproduces the committed fixture's buildId. What a
 * fixture-fake can never carry is a per-run token written into THIS build's
 * dist before the server starts: get_page answers must contain it.
 */
const SENTINEL = `wp08-lane-sentinel-pid${process.pid}-${Date.now().toString(36)}`;

interface FreshIndex {
  title: string;
  version: string;
  count: number;
  buildId?: string;
  pages: Array<{ _links?: { self?: { href?: string } } }>;
  _links: { scenarios?: { href: string } };
}

let timings: Record<string, number> = {};
let server: StaticCorpusServer;
let spawned: SpawnedMcp;
let freshIndex: FreshIndex;

function resultJson(result: ToolResultWire): unknown {
  expect(result.isError).toBeFalsy();
  const block = result.content?.[0];
  expect(block?.type).toBe('text');
  return JSON.parse(block!.text as string);
}

/** Recursive key paths of a JSON value (array elements merge under `[]`); values are ignored. */
function keyPaths(value: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const element of value) keyPaths(element, `${prefix}[]`, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      out.add(`${prefix}.${key}`);
      keyPaths(child, `${prefix}.${key}`, out);
    }
  }
  return out;
}

/** The bytes exactly as the static server sends them for a dist-relative file. */
function servedJson(relPath: string): unknown {
  let body = readFileSync(path.join(EXAMPLE_DIST, relPath), 'utf8');
  body = body.replaceAll(EXAMPLE_BAKED_ORIGIN, server.base);
  return JSON.parse(body);
}

beforeAll(async () => {
  const t0 = Date.now();
  // 1. Fresh example build, own output dir, deterministic mode (see header).
  rmSync(EXAMPLE_DIST, { recursive: true, force: true });
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    DK_OUTDIR: EXAMPLE_OUT,
    DK_DIAGRAM_BUILD_RENDER: 'off',
  };
  // Vitest mirrors BASE_URL into the env; it would silently re-base a real
  // astro build child (established lesson in example-adopter.test.ts).
  delete childEnv.BASE_URL;
  let t = Date.now();
  const build = spawnSync('pnpm', ['--filter', 'example', 'build'], { cwd: REPO_ROOT, env: childEnv, encoding: 'utf8' });
  timings.buildMs = Date.now() - t;
  expect(build.status, `example build failed:\n${build.stderr.slice(-4000)}`).toBe(0);
  expect(existsSync(path.join(EXAMPLE_DIST, 'api', 'index.json'))).toBe(true);
  const rawIndex = readFileSync(path.join(EXAMPLE_DIST, 'api', 'index.json'), 'utf8');
  expect(rawIndex, 'this lane assumes the example baked origin; got a different bake').toContain(EXAMPLE_BAKED_ORIGIN);
  freshIndex = JSON.parse(rawIndex) as FreshIndex;

  // Plant the provenance sentinel into the home page of the SERVED corpus
  // (disk bytes), before anything spawns. See the SENTINEL comment above.
  const homePath = path.join(EXAMPLE_DIST, 'api', 'pages', 'home.json');
  const home = JSON.parse(readFileSync(homePath, 'utf8')) as { markdown: string };
  home.markdown = `${home.markdown}\n${SENTINEL}\n`;
  writeFileSync(homePath, JSON.stringify(home));

  // 2. Fresh binary.
  t = Date.now();
  ensureMcpDistBuilt();
  timings.mcpBuildMs = Date.now() - t;
  expect(existsSync(MCP_BIN)).toBe(true);

  // 3. Serve the fresh dist statically.
  server = await startStaticCorpusServer(EXAMPLE_DIST, { bakedOrigin: EXAMPLE_BAKED_ORIGIN });

  // 4. Spawn the freshly built binary against the SERVED site.
  t = Date.now();
  spawned = await ChildStdioMcpClient.start(['--site', server.base]);
  timings.spawnToReadyMs = Date.now() - t;
  timings.setupMs = Date.now() - t0;
}, 300_000);

afterAll(async () => {
  if (spawned !== undefined) await spawned.client.close();
  if (server !== undefined) await server.close();
  // Own-output cleanup: .gitignore is outside this WP's write scope, so the
  // transient build dir must not survive the lane.
  rmSync(EXAMPLE_DIST, { recursive: true, force: true });
});

describe('T022 serialized lane: freshly built example served statically, binary driven over stdio', () => {
  it('completes the MCP initialize handshake with the doc-kitty-mcp identity', () => {
    expect(spawned.client.initializeResult.serverInfo.name).toBe('doc-kitty-mcp');
    expect(typeof spawned.client.initializeResult.protocolVersion).toBe('string');
  });

  it('the committed example fixture still has the fresh build\'s contract shape', () => {
    // The fixture is a hand copy of example/dist/api; this is the only thing that notices it going stale.
    const committed = path.join(REPO_ROOT, 'mcp', 'tests', 'corpus', 'fixtures', 'example', 'api');
    const remint = 'Re-mint (see mcp/tests/corpus/fixtures/README.md): pnpm --filter example build, then ' +
      'cp -r example/dist/api mcp/tests/corpus/fixtures/example/api && node mcp/tests/corpus/fixtures/derive.mjs';
    for (const rel of ['index.json', 'pages/home.json']) {
      const fresh = JSON.parse(readFileSync(path.join(EXAMPLE_DIST, 'api', rel), 'utf8')) as { version: string };
      const fixture = JSON.parse(readFileSync(path.join(committed, rel), 'utf8')) as { version: string };
      expect(fixture.version, `${rel}: contract version drifted. ${remint}`).toBe(fresh.version);
      expect([...keyPaths(fixture)].sort(), `${rel}: key set drifted. ${remint}`).toEqual([...keyPaths(fresh)].sort());
    }
  });

  it('lists exactly the five contract tools in registration order', async () => {
    const tools = await spawned.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
  });

  it('get_site_info carries the served build identity', async () => {
    const info = resultJson(await spawned.client.callTool('get_site_info')) as {
      siteTitle: string;
      buildId?: string;
      pageCount: number;
      capabilities: Record<string, boolean>;
    };
    expect(info.siteTitle).toBe(freshIndex.title);
    expect(info.pageCount).toBe(freshIndex.count);
    // Consistency with the served bytes (the anti-FIXTURE discriminator is the
    // sentinel assertion in the get_page test below; content-derived buildIds
    // reproduce across identical builds, so equality with the fixture id is
    // not evidence of fakery and is not asserted against).
    expect(info.buildId).toBe(freshIndex.buildId);
    expect(info.capabilities.pages).toBe(true);
  });

  it('list_pages returns the served registry in order', async () => {
    const pages = resultJson(await spawned.client.callTool('list_pages')) as Array<{ id: string }>;
    const marker = '/api/pages/';
    const expectedIds = freshIndex.pages.map((record) => {
      const href = record._links?.self?.href ?? '';
      const at = href.indexOf(marker);
      return href.slice(at + marker.length, -'.json'.length);
    });
    expect(pages.map((p) => p.id)).toEqual(expectedIds);
    expect(pages.length).toBe(freshIndex.count);
  });

  it('get_page markdown byte-equals the bytes the static server sent for that page', async () => {
    // The home page (empty-slug record) plus one nested page: the same sample
    // classes the conformance matrix pins (SC-003).
    const nestedRecord = freshIndex.pages.find((record) => {
      const href = record._links?.self?.href ?? '';
      return href.slice(href.indexOf('/api/pages/') + '/api/pages/'.length).replace(/\.json$/, '').includes('/');
    });
    const ids = ['home'];
    if (nestedRecord !== undefined) {
      const href = nestedRecord._links!.self!.href!;
      ids.push(href.slice(href.indexOf('/api/pages/') + '/api/pages/'.length, -'.json'.length));
    }
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) {
      const page = resultJson(await spawned.client.callTool('get_page', { id })) as { id: string; markdown: string; title: string };
      const served = servedJson(`api/pages/${id}.json`) as { markdown: string; title: string };
      expect(page.id).toBe(id);
      expect(page.markdown).toBe(served.markdown);
      expect(page.title).toBe(served.title);
      // and the artifact really transited this server:
      expect(server.requests.get(`/api/pages/${id}.json`)).toBe(1);
    }
  });

  it('serves the run-unique sentinel planted in the SERVED dist (FR-001 anti-fixture proof)', async () => {
    const page = resultJson(await spawned.client.callTool('get_page', { id: 'home' })) as { markdown: string };
    // The token was written into the freshly built dist on disk moments
    // before the server started. A fixture-driven fake could carry the
    // committed corpus (same content, same buildId) but never this token.
    expect(page.markdown).toContain(SENTINEL);
  });

  it('search_pages finds a term known present in the served corpus', async () => {
    const hits = resultJson(await spawned.client.callTool('search_pages', { query: 'dockitty' })) as Array<{
      id: string;
      title: string;
      description: string;
      keywords: string[];
    }>;
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      const haystacks = [hit.title, hit.description, ...hit.keywords].map((s) => s.toLowerCase());
      expect(haystacks.some((s) => s.includes('dockitty'))).toBe(true);
    }
  });

  it('list_scenarios matches the served scenarios surface of the fresh build', async () => {
    const scenariosPath = path.join(EXAMPLE_DIST, 'api', 'scenarios.json');
    const answer = resultJson(await spawned.client.callTool('list_scenarios')) as { available?: boolean; count?: number };
    if (existsSync(scenariosPath) && freshIndex._links.scenarios !== undefined) {
      const servedScenarios = servedJson('api/scenarios.json') as { count: number };
      expect(answer.count).toBe(servedScenarios.count);
      expect(answer.count).toBeGreaterThan(0);
    } else {
      expect(answer.available).toBe(false);
    }
  });

  it('shuts down cleanly (exit 0) when the client closes stdin', async () => {
    const code = await spawned.client.close();
    expect(code).toBe(0);
  }, 30_000);

  it('records the measured lane runtime', () => {
    timings.totalMs = timings.setupMs;
    console.log(`[wp08-lane] timings: ${JSON.stringify(timings)}`);
    // Budget posture: aside from the (recorded) example build itself, the
    // lane machinery - mcp build, static server, spawn, handshake - must stay
    // small. The existing build suites allow 180 s per astro build; this lane
    // holds its non-build part within one fifth of that.
    expect(timings.spawnToReadyMs).toBeLessThan(15_000);
    expect((timings.setupMs ?? 0) - (timings.buildMs ?? 0)).toBeLessThan(60_000);
  });
});
