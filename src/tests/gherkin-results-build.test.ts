/**
 * Scenario results in a REAL BUILD (ADR-0052): a fixture site with a generated
 * feature page and an include, both of `features/checkout.feature`, and
 * `gherkin.results` pointing at `reports/cucumber.ndjson`.
 *
 *  1. The built pages show the report's results, while the committed Markdown of
 *     the generated page holds none (the drift gate never sees a result).
 *  2. Replacing ONLY the report and building again over the same content cache
 *     changes both pages: the docs loader folds the report into the digest of
 *     every page that may show results (decision 10). Without the fold the
 *     cache would serve the first report's results.
 *  3. A missing report builds, with a warning and no results.
 *  4. A report that cannot be read fails the build at config time, naming it.
 *
 * Like `gherkin-fence-build.test.ts`, the site lives in `example/` so the
 * toolkit, Astro and Starlight resolve as for an adopter, with its own `dist/`
 * and content cache, and is removed afterwards (git-ignored in case a run dies).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-gherkin-results');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'astro.js');
const FIX = fileURLToPath(new URL('./fixtures/gherkin/results/', import.meta.url));

const FILES: Record<string, string> = {
  'astro.config.mjs': [
    "import { defineConfig } from 'astro/config';",
    "import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';",
    '',
    'export default defineConfig({',
    '  integrations: defineDocKittyIntegrations({',
    "    title: 'Results fixture',",
    "    gherkin: { sources: ['features'], results: 'reports/cucumber.ndjson' },",
    '  }),',
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
  'docs/README.md': ['---', 'title: Home', 'description: Fixture home.', '---', '', '# Home', '', 'Hello.', ''].join('\n'),
  'docs/guide.md': [
    '---',
    'title: Guide',
    'description: A guide that includes a feature.',
    '---',
    '',
    '# Guide',
    '',
    '::gherkin{src="features/checkout.feature"}',
    '',
  ].join('\n'),
  'features/checkout.feature': readFileSync(path.join(FIX, 'features', 'checkout.feature'), 'utf8'),
};

function report(name: string | null) {
  const target = path.join(SITE, 'reports', 'cucumber.ndjson');
  rmSync(target, { force: true });
  if (name === null) return;
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(path.join(FIX, name), target);
}

function build() {
  // Vitest's env carries `BASE_URL`, which would override the child's `base`.
  const env = { ...process.env };
  delete env.BASE_URL;
  const r = spawnSync(process.execPath, [ASTRO_BIN, 'build'], { cwd: SITE, encoding: 'utf8', env });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

const page = (rel: string) => readFileSync(path.join(SITE, 'dist', rel, 'index.html'), 'utf8');
/** The status badges of a built page, in order: `data-status` and word. */
const badges = (html: string) =>
  [...html.matchAll(/<span class="dk-gherkin__status" data-status="([^"]+)">([\s\S]*?)<\/span>(?=[^<]*<\/(?:p|td)>)/g)].map(
    (m) => `${m[1]}:${m[2].replace(/<[^>]+>/g, '')}`,
  );

beforeAll(() => {
  rmSync(SITE, { recursive: true, force: true });
  for (const [rel, contents] of Object.entries(FILES)) {
    const abs = path.join(SITE, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
  }
});
afterAll(() => {
  rmSync(SITE, { recursive: true, force: true });
});

describe('scenario results in a real build (ADR-0052)', () => {
  it(
    'shows the report on the include and the generated page, and re-renders both when only the report changes',
    () => {
      report('messages.ndjson');
      const first = build();
      expect(first.status, first.output).toBe(0);
      const expected = [
        'passed:Result: Passed',
        'failed:Result: Failed',
        'passed:Passed',
        'failed:Failed',
        'passed:Result: Passed on retry',
      ];
      expect(badges(page('guide'))).toEqual(expected);
      expect(badges(page('behaviour/checkout'))).toEqual(expected);
      // Generated at config time, committed by a real site: no result in it.
      expect(readFileSync(path.join(SITE, 'docs', 'behaviour', 'checkout.md'), 'utf8')).not.toContain('Result');

      // Same file, a --tags run: only the gift-card scenario ran (and failed).
      report('filtered.ndjson');
      const second = build();
      expect(second.status, second.output).toBe(0);
      const filtered = [
        'not-run:Result: Not run',
        'not-run:Result: Not run',
        'not-run:Not run',
        'not-run:Not run',
        'failed:Result: Failed',
      ];
      expect(badges(page('guide'))).toEqual(filtered);
      expect(badges(page('behaviour/checkout'))).toEqual(filtered);
    },
    180_000,
  );

  it(
    'builds without results, and warns, when the report is missing',
    () => {
      report(null);
      const r = build();
      expect(r.status, r.output).toBe(0);
      expect(r.output).toContain('[dk-gherkin] gherkin.results report not found: reports/cucumber.ndjson');
      expect(page('guide')).not.toContain('dk-gherkin__status');
      expect(page('behaviour/checkout')).not.toContain('dk-gherkin__status');
    },
    120_000,
  );

  it(
    'fails the build, naming the report, when it cannot be read',
    () => {
      mkdirSync(path.join(SITE, 'reports'), { recursive: true });
      writeFileSync(path.join(SITE, 'reports', 'cucumber.ndjson'), '{"meta":{}}\nthis is not json\n');
      const r = build();
      expect(r.status, r.output).not.toBe(0);
      expect(r.output).toContain('[dk-gherkin] reports/cucumber.ndjson:2 is not a Cucumber Messages envelope');
    },
    120_000,
  );
});
