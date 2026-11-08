/**
 * Builds the OpenAPI fixture sites (mission openapi-second-slice-01M6WXJ4,
 * WP01/T002).
 *
 * `buildOpenApiFixture` writes a throwaway site under
 * `example/.dk-test-openapi/<key>/` (so the toolkit, Astro, Starlight and the
 * pinned renderer resolve through `example/node_modules`, like
 * `legacy-html-redirects-build.test.ts` and the chrome harness), gives it its
 * own dist, and runs a real `astro build`. There is no cross-run build cache:
 * every call rebuilds, so a test never reads a dist whose inputs it did not
 * just set up, and `twoBuilds` really builds twice from cold caches.
 *
 * `readAll` maps every dist-relative POSIX path to its bytes, and `twoBuilds`
 * returns two such maps for the NFR-001 determinism compare used by
 * WP02/03/04/09/10/12.
 *
 * Roots are tracked per test file (vitest isolates module state per file), so
 * parallel suites never delete each other's builds: call
 * {@link removeOpenApiFixtureBuilds} in `afterAll`.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const FIXTURES = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'openapi');
const BUILDS_DIR = path.join(REPO_ROOT, 'example', '.dk-test-openapi');
/**
 * The build runs through pnpm's `node_modules/.bin/astro` shim, not
 * `astro/bin/astro.mjs` directly. The OpenAPI pages pull `satteri` (the syntax
 * highlighter) into Astro's prerender bundle, whose native binding
 * (`@bruits/satteri-linux-x64-gnu`) is only resolvable through the NODE_PATH
 * the shim exports (pnpm keeps it inside `.pnpm/node_modules`, never hoisted).
 * `pnpm build` in `example/` goes through this same shim — the builds here
 * resolve exactly the way the example's own build does.
 */
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', '.bin', 'astro');

/** The roots this test file's builds created; removed by {@link removeOpenApiFixtureBuilds}. */
const CREATED = new Set<string>();

/** One build request. */
export interface OpenApiFixtureRequest {
  /** Directory under `src/tests/fixtures/openapi/`, copied to `<root>/openapi/`. */
  fixture: string;
  /** The `openapi` option minus `renderer`, which the fixture config injects. */
  openapi?: Record<string, unknown> | null;
  /** Extra doc-kitty options, spread over the fixture config's defaults (e.g. `base`). */
  options?: Record<string, unknown>;
  /** Site-relative file overrides, written after the copies (e.g. a generated spec). */
  files?: Record<string, string>;
  /** Extra build environment, such as `DOCKITTY_OFFLINE`. */
  env?: Record<string, string>;
}

export interface OpenApiBuildResult {
  /** The `astro build` exit status; non-zero means `output` holds why. */
  status: number | null;
  output: string;
  root: string;
  dist: string;
}

/** The environment of a build: the request's values, not the caller's shell or Vitest's. */
function buildEnv(request: OpenApiFixtureRequest): NodeJS.ProcessEnv {
  const clean = { ...process.env, CI: '' };
  for (const name of Object.keys(clean)) {
    if (name.startsWith('DK_') || ['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'].includes(name)) {
      delete clean[name];
    }
  }
  return {
    ...clean,
    DK_PUBLISH_DRAFTS: 'on',
    DK_TEST_OPTIONS: JSON.stringify({ ...request.options, openapi: request.openapi ?? null }),
    DK_OUTDIR: 'dist',
    ...request.env,
  };
}

/**
 * On a based build, prefix the copied fixture specs' root-relative Markdown
 * links (`](/…`) with the base, as the author of a based site must: WP06's
 * build-time link check resolves root-relative links against the base and fails
 * an unprefixed one. `files` overrides are written afterwards and stay verbatim.
 */
function prefixFixtureLinks(dir: string, base: unknown): void {
  const prefix = typeof base === 'string' ? base.replace(/\/+$/, '') : '';
  if (prefix === '' || prefix === '/') return;
  const lead = prefix.startsWith('/') ? prefix : `/${prefix}`;
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(ya?ml|json)$/i.test(entry.name)) continue;
    const abs = path.join(entry.parentPath, entry.name);
    const source = readFileSync(abs, 'utf8');
    const rewritten = source.replace(/\]\(\/(?!\/)/g, `](${lead}/`);
    if (rewritten !== source) writeFileSync(abs, rewritten);
  }
}

/**
 * Build one fixture site. Always rebuilds (no cache); `tag` separates roots of
 * identical requests, so parallel suites and `twoBuilds` never share a root.
 */
export function buildOpenApiFixture(request: OpenApiFixtureRequest, tag = 'default'): OpenApiBuildResult {
  const key = createHash('sha256').update(JSON.stringify({ request: { ...request, env: undefined }, tag })).digest('hex').slice(0, 16);
  const root = path.join(BUILDS_DIR, key);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  CREATED.add(root);
  cpSync(path.join(FIXTURES, 'site'), root, { recursive: true });
  cpSync(path.join(FIXTURES, 'astro.config.mjs'), path.join(root, 'astro.config.mjs'));
  cpSync(path.join(FIXTURES, request.fixture), path.join(root, 'openapi'), { recursive: true });
  prefixFixtureLinks(path.join(root, 'openapi'), request.options?.base);
  for (const [rel, contents] of Object.entries(request.files ?? {})) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
  // The shim (a #!/bin/sh script) is exec'd directly; it re-execs node on
  // `astro/bin/astro.mjs` with the NODE_PATH described above.
  const run = spawnSync(ASTRO_BIN, ['build'], { cwd: root, encoding: 'utf8', env: buildEnv(request) });
  return { status: run.status, output: stripVTControlCharacters(`${run.stdout}\n${run.stderr}`), root, dist: path.join(root, 'dist') };
}

/** Every file under `dist`, as POSIX paths relative to it, mapped to its bytes. */
export function readAll(dist: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const walk = (rel: string) => {
    for (const entry of readdirSync(path.join(dist, rel), { withFileTypes: true })) {
      const child = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walk(child);
      else out.set(child, readFileSync(path.join(dist, child)));
    }
  };
  walk('');
  return out;
}

/**
 * The NFR-001 determinism pair: two cold builds of the same request, as byte
 * maps. `first`/`second` carry the builds (for their `dist` and `output`);
 * `a`/`b` are the read maps.
 */
export function twoBuilds(request: OpenApiFixtureRequest): {
  first: OpenApiBuildResult;
  second: OpenApiBuildResult;
  a: Map<string, Buffer>;
  b: Map<string, Buffer>;
} {
  const first = buildOpenApiFixture(request, 'two-builds-1');
  const second = buildOpenApiFixture(request, 'two-builds-2');
  return { first, second, a: readAll(first.dist), b: readAll(second.dist) };
}

/** Remove the roots this test file's builds created. Call in `afterAll`. */
export function removeOpenApiFixtureBuilds(): void {
  for (const root of CREATED) rmSync(root, { recursive: true, force: true });
  CREATED.clear();
}

export { FIXTURES, BUILDS_DIR };
