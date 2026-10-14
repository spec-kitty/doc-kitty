/**
 * Content-layer freshness for `::gherkin` includes, end to end (ADR-0051
 * decision 11; 02 §Content-layer freshness).
 *
 * Astro's `glob()` loader caches each page's render by file digest, in the
 * content data store under `node_modules/.astro/` (a build) or `.astro/` (dev).
 * A page that includes a `.feature` file kept its old HTML when only that file
 * changed. `docKittyDocsLoader` folds the include's bytes into the digest and,
 * in dev, re-syncs the page when its include changes. Unit tests drive `glob()`
 * through a fake context (`docs-loader-includes.test.ts`); this suite runs Astro:
 *
 *  1. Incremental build: build, edit ONLY the `.feature` file, build again over
 *     the same content cache. The second build must show the edit.
 *  2. Dev server: start `astro dev`, fetch the page, edit ONLY the `.feature`
 *     file, and the page served without a restart must show the edit.
 *
 * The fixture is a minimal toolkit site written into
 * `example/.dk-test-loader-includes/` (inside `example/` so the toolkit, Astro
 * and Starlight resolve through `example/node_modules`, as in
 * `gherkin-fence-build.test.ts`). It has its own `dist/` and content caches,
 * is removed afterwards and is git-ignored in case a run dies.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-loader-includes');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'astro.js');

/** The included file; only the scenario name changes between the two states. */
const feature = (scenario: string) =>
  ['Feature: Book a consignment', `  Scenario: ${scenario}`, '    Given a step', ''].join('\n');

const FILES: Record<string, string> = {
  'astro.config.mjs': [
    "import { defineConfig } from 'astro/config';",
    "import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';",
    '',
    'export default defineConfig({',
    "  integrations: defineDocKittyIntegrations({ title: 'Loader includes fixture', gherkin: { includeRoots: ['features'] } }),",
    '});',
    '',
  ].join('\n'),
  'src/content.config.ts': [
    "import { defineCollection } from 'astro:content';",
    "import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';",
    '',
    'export const collections = {',
    "  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),",
    '};',
    '',
  ].join('\n'),
  'docs/README.md': ['---', 'title: Home', 'description: Fixture home.', '---', '', '# Home', '', 'Hello.', ''].join(
    '\n',
  ),
  'docs/guide.md': [
    '---',
    'title: Guide',
    'description: A guide that includes a feature file.',
    '---',
    '',
    '# Guide',
    '',
    '::gherkin{src="features/book.feature"}',
    '',
  ].join('\n'),
  'features/book.feature': feature('First name'),
};

function write(rel: string, contents: string) {
  const abs = path.join(SITE, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, contents);
}

/** The child's env: vitest's `BASE_URL` would override the site's `base` (see `glossary-build-warning.test.ts`). */
function childEnv() {
  const env = { ...process.env };
  delete env.BASE_URL;
  return env;
}

function build() {
  const r = spawnSync(process.execPath, [ASTRO_BIN, 'build'], { cwd: SITE, encoding: 'utf8', env: childEnv() });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

const guideHtml = () => readFileSync(path.join(SITE, 'dist', 'guide', 'index.html'), 'utf8');

beforeAll(() => {
  rmSync(SITE, { recursive: true, force: true });
  for (const [rel, contents] of Object.entries(FILES)) write(rel, contents);
});
afterAll(() => {
  rmSync(SITE, { recursive: true, force: true });
});

describe('an incremental build re-renders a page whose include changed', () => {
  it(
    'shows the edited .feature on the second build over the same content cache',
    () => {
      const first = build();
      expect(first.status, first.output).toBe(0);
      expect(guideHtml()).toContain('Scenario: First name');

      // Only the included file changes; the page's own bytes do not.
      write('features/book.feature', feature('Second name'));
      const second = build();
      expect(second.status, second.output).toBe(0);
      const html = guideHtml();
      expect(html).toContain('Scenario: Second name');
      expect(html).not.toContain('Scenario: First name');
    },
    180_000,
  );
});

/**
 * Poll `probe` until it returns true, or fail after `ms`. `what` is a thunk, so
 * the failure message (which carries the dev log) is built only on failure.
 */
async function until(probe: () => Promise<boolean>, ms: number, what: () => string): Promise<void> {
  const deadline = Date.now() + ms;
  for (;;) {
    if (await probe().catch(() => false)) return;
    if (Date.now() > deadline) throw new Error(`timed out after ${ms}ms waiting for ${what()}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * The `Local` URL the dev server prints once it listens. Read from its log
 * rather than chosen up front: a port probed free and handed over can be taken
 * before the server binds it, and Vite moves to the next free port instead.
 */
const localUrl = (log: string): string | undefined =>
  // eslint-disable-next-line no-control-regex -- strip ANSI colour codes
  /Local\s+(http:\/\/[^\s/]+)/.exec(log.replace(/\x1b\[[0-9;]*m/g, ''))?.[1];

describe('the dev server refreshes a page whose include changed, without a restart', () => {
  let dev: ChildProcess | undefined;
  let log = '';

  afterAll(async () => {
    if (!dev || dev.exitCode !== null) return;
    const exited = new Promise((r) => dev!.once('exit', r));
    // Detached: kill the whole process group, so no Vite worker outlives the test.
    try {
      process.kill(-dev.pid!, 'SIGTERM');
    } catch {
      dev.kill('SIGTERM');
    }
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5_000))]);
  });

  it(
    'serves the edited .feature after the file changes',
    async () => {
      write('features/book.feature', feature('Dev before'));
      dev = spawn(process.execPath, [ASTRO_BIN, 'dev', '--port', '4400', '--host', '127.0.0.1'], {
        cwd: SITE,
        env: childEnv(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      dev.stdout!.on('data', (d) => (log += d));
      dev.stderr!.on('data', (d) => (log += d));
      await until(async () => localUrl(log) !== undefined, 90_000, () => `the dev server to listen\n${log}`);
      const url = `${localUrl(log)}/guide/`;
      const page = async () => {
        const res = await fetch(url);
        return res.ok ? res.text() : '';
      };

      await until(async () => (await page()).includes('Scenario: Dev before'), 90_000, () => `the first render\n${log}`);

      write('features/book.feature', feature('Dev after'));
      await until(async () => (await page()).includes('Scenario: Dev after'), 30_000, () => `the refreshed render\n${log}`);
      expect(await page()).not.toContain('Scenario: Dev before');
    },
    150_000,
  );
});
