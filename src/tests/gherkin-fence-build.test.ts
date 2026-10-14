/**
 * A broken ```` ```gherkin ```` fence FAILS A REAL BUILD (ADR-0051 decision 5;
 * 02 §Making errors fatal; 05 mutation check 9).
 *
 * Why a real build: Astro's content-layer `glob()` loader renders every entry
 * inside a `try`, only LOGS a render error and stores the page with no HTML. A
 * remark stage that throws therefore builds an empty page and `astro build`
 * exits 0. The fence stage records its errors in a process-wide sink and the
 * `doc-kitty:gherkin-fence` integration throws from `astro:build:done`; no unit
 * test can show that the exit code really changes, so this suite runs Astro.
 *
 * The fixture is a minimal toolkit site (one index page, one guide page,
 * `gherkin: true`) written at test time into `example/.dk-test-gherkin-fence/`:
 * inside `example/` so `@spec-kitty/doc-toolkit`, `astro` and Starlight resolve
 * through `example/node_modules` exactly as for an adopter (a root outside the
 * repository trips Astro's out-of-root path handling). It has its own `dist/`
 * and content cache, so it never touches the shared `example/dist` or
 * `example/.astro`; it is removed afterwards and git-ignored in case a run dies.
 * The build takes a few seconds, which is why the suite is in the serialized
 * `build` project rather than `fast`.
 *
 * Each test starts from a fresh fixture (no `dist/`, no content cache):
 *  1. the broken page exits non-zero and prints `page:line:col`, and the SAME
 *     broken page built again unchanged exits non-zero too. The loader caches
 *     every entry by file digest, failed renders included, so without the docs
 *     loader storing a failed Gherkin render under a never-matching digest the
 *     second build would skip the page, record nothing and pass with an empty
 *     page;
 *  2. `astro sync` (which `astro check` also runs) and then `astro build` of the
 *     broken page exits non-zero: the sync renders the page into the same cache
 *     but never reaches `astro:build:done`, so nothing else would make the build
 *     render it again;
 *  3. the fixed fence passes and the page holds the structured block;
 *  4. the same broken fence in a second collection on a plain `glob()` loader
 *     (not `docKittyDocsLoader`) exits non-zero twice: the loader-side digest
 *     never sees that collection, so the second build relies on
 *     `astro:build:done` deleting `<cacheDir>/data-store.json` on failure.
 *
 * Then two builds of a `::gherkin` include (WP07; 05 §Definition of done, "bad
 * path/name/tag → build fails naming page and reference"): a missing scenario
 * exits non-zero naming `page:line` and the `src`, and the fixed include passes.
 * The fixed build also proves the agent surface end to end (WP09): the records
 * the stage writes to the render-time frontmatter survive Astro's data store as
 * `entry.rendered.metadata.frontmatter`, and the mounted `/api/pages/<id>.json`
 * route splices them into the body; they never reach the page's HTML.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-gherkin-fence');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'astro.js');

const FILES: Record<string, string> = {
  'astro.config.mjs': [
    "import { defineConfig } from 'astro/config';",
    "import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';",
    '',
    'export default defineConfig({',
    "  integrations: defineDocKittyIntegrations({ title: 'Gherkin fence fixture', gherkin: { includeRoots: ['features'] } }),",
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
  // The agent page route (02 §Agent surface): its payload must expand includes.
  'src/pages/api/pages/[...slug].json.ts': [
    "import { agentPageRoute } from '@spec-kitty/doc-toolkit/routes';",
    'const route = agentPageRoute();',
    'export const getStaticPaths = route.getStaticPaths;',
    'export const GET = route.GET;',
    '',
  ].join('\n'),
  'docs/README.md': ['---', 'title: Home', 'description: Fixture home.', '---', '', '# Home', '', 'Hello.', ''].join(
    '\n',
  ),
  'features/book.feature': ['Feature: Book a consignment', '  Scenario: One', '    Given a step', ''].join('\n'),
};

/** The guide page; `rows` are the data-table rows under the step. */
const guide = (rows: string[]) =>
  [
    '---', // 1
    'title: Guide', // 2
    'description: A guide with a gherkin fence.', // 3
    '---', // 4
    '', // 5
    '# Guide', // 6
    '', // 7
    '```gherkin', // 8
    'Feature: Book a consignment', // 9
    '  Scenario: One', // 10
    '    Given these containers:', // 11
    ...rows, // 12, 13
    '```',
    '',
  ].join('\n');

const BROKEN = guide(['      | size |', '      | 20ft | 2 |']);
const FIXED = guide(['      | size | count |', '      | 20ft | 2     |']);
// Line 13 is the row with the wrong cell count; its first cell is at column 7.
const WHERE = 'docs/guide.md:13:7 inconsistent cell count within the table';

/** The guide page with an include of `features/book.feature` (directive on line 8). */
const includePage = (scenario: string) =>
  [
    '---',
    'title: Guide',
    'description: A guide with a gherkin include.',
    '---',
    '',
    '# Guide',
    '',
    `::gherkin{src="features/book.feature" scenario="${scenario}"}`,
    '',
  ].join('\n');
const INCLUDE_WHERE =
  'docs/guide.md:8 ::gherkin src="features/book.feature" — no scenario named "Missing" in features/book.feature ' +
  '(scenarios: "One")';

/** A fresh fixture site: no `dist/`, no content cache, `docs/guide.md` = `guideSource`. */
function freshSite(guideSource: string) {
  rmSync(SITE, { recursive: true, force: true });
  for (const [rel, contents] of Object.entries({ ...FILES, 'docs/guide.md': guideSource })) {
    const abs = path.join(SITE, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
}

/** Run one `astro` command (`build`, `sync`) in the fixture site. */
function astro(command: 'build' | 'sync') {
  // Vitest's env carries `BASE_URL`, which would override the child's `base`
  // (see `glossary-build-warning.test.ts`).
  const env = { ...process.env };
  delete env.BASE_URL;
  const r = spawnSync(process.execPath, [ASTRO_BIN, command], { cwd: SITE, encoding: 'utf8', env });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}
const build = () => astro('build');

afterAll(() => {
  rmSync(SITE, { recursive: true, force: true });
});

describe('a malformed gherkin fence fails `astro build` (exit code)', () => {
  it(
    'exits non-zero and names the page, line and column, and again when built unchanged',
    () => {
      freshSite(BROKEN);
      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain(`[dk-gherkin] ${WHERE}`);
      // The aggregate thrown from astro:build:done, not only the loader's log line.
      expect(r.output).toContain('[dk-gherkin] 1 Gherkin error(s) on 1 page');
      expect(r.output).toContain('astro:build:done');

      // The failed render is cached, but never as a hit.
      const again = build();
      expect(again.status, again.output).not.toBe(0);
      expect(again.output).toContain(`[dk-gherkin] ${WHERE}`);
    },
    120_000,
  );

  it(
    'exits non-zero when `astro sync` rendered the broken page first',
    () => {
      freshSite(BROKEN);
      const sync = astro('sync');
      expect(sync.output).toContain(`[dk-gherkin] ${WHERE}`);
      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain(`[dk-gherkin] ${WHERE}`);
      expect(r.output).toContain('[dk-gherkin] 1 Gherkin error(s) on 1 page');
    },
    120_000,
  );

  it(
    'passes once the fence is fixed, and the page holds the structured scenario',
    () => {
      freshSite(FIXED);
      const r = build();
      expect(r.status, r.output).toBe(0);
      expect(r.output).not.toContain('[dk-gherkin]');
      const html = readFileSync(path.join(SITE, 'dist', 'guide', 'index.html'), 'utf8');
      expect(html).toContain('<div class="dk-gherkin">');
      expect(html).toMatch(/<h2 id="book-a-consignment">Book a consignment<\/h2>/);
      expect(html).toContain('<strong class="dk-gherkin__kw">Given</strong>');
    },
    120_000,
  );
});

describe('a malformed gherkin fence in a collection NOT on docKittyDocsLoader', () => {
  // A second collection on Astro's plain `glob()` loader: the docs loader's
  // never-matching digest for a failed render does not apply to it, so the
  // second build relies on `astro:build:done` deleting the content data store
  // when it fails the build (ADR-0051 decision 5, the fallback).
  const plainGlobConfig = [
    "import { defineCollection } from 'astro:content';",
    "import { glob } from 'astro/loaders';",
    "import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';",
    '',
    'export const collections = {',
    "  docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }),",
    "  notes: defineCollection({ loader: glob({ base: 'notes', pattern: '**/*.md' }) }),",
    '};',
    '',
  ].join('\n');

  it(
    'exits non-zero, and again when built unchanged',
    () => {
      freshSite(FIXED);
      writeFileSync(path.join(SITE, 'src', 'content.config.ts'), plainGlobConfig);
      mkdirSync(path.join(SITE, 'notes'), { recursive: true });
      writeFileSync(path.join(SITE, 'notes', 'broken.md'), BROKEN);
      const where = WHERE.replace('docs/guide.md', 'notes/broken.md');

      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain(`[dk-gherkin] ${where}`);

      const again = build();
      expect(again.status, again.output).not.toBe(0);
      expect(again.output).toContain(`[dk-gherkin] ${where}`);
    },
    120_000,
  );
});

describe('a bad `::gherkin` include fails `astro build` (exit code)', () => {
  it(
    'exits non-zero and names the page, line and the reference',
    () => {
      freshSite(includePage('Missing'));
      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain(`[dk-gherkin] ${INCLUDE_WHERE}`);
      expect(r.output).toContain('[dk-gherkin] 1 Gherkin error(s) on 1 page');
    },
    120_000,
  );

  it(
    'passes once the scenario exists, and the page holds the selected scenario and its source line',
    () => {
      freshSite(includePage('One'));
      const r = build();
      expect(r.status, r.output).toBe(0);
      expect(r.output).not.toContain('[dk-gherkin]');
      const html = readFileSync(path.join(SITE, 'dist', 'guide', 'index.html'), 'utf8');
      expect(html).toContain('<div class="dk-gherkin">');
      expect(html).toMatch(/<h2 id="scenario-one">Scenario: One<\/h2>/);
      expect(html).toMatch(/<p class="dk-gherkin__source">From Book a consignment, <code dir="auto">features\/book\.feature<\/code><\/p>/);
      expect(html).not.toContain('::gherkin');
      expect(html).not.toContain('dkGherkinIncludes');

      const agent = JSON.parse(readFileSync(path.join(SITE, 'dist', 'api', 'pages', 'guide.json'), 'utf8'));
      expect(agent.markdown).toBe(
        '# Guide\n\n## Scenario: One\n\n- **Given** a step\n\nFrom Book a consignment, `features/book.feature`',
      );
      expect(agent.includes).toEqual([{ src: 'features/book.feature', scenario: 'One' }]);
      // A page with no include keeps the slice C payload shape.
      const home = JSON.parse(readFileSync(path.join(SITE, 'dist', 'api', 'pages', 'home.json'), 'utf8'));
      expect(home.markdown).toBe('# Home\n\nHello.');
      expect(home).not.toHaveProperty('includes');
    },
    120_000,
  );
});
