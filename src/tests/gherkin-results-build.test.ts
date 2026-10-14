/**
 * Scenario results in a REAL BUILD (ADR-0055): a fixture site with a generated
 * feature page and an include, both of `features/checkout.feature`, and
 * `gherkin.results` pointing at `reports/cucumber.ndjson`.
 *
 *  1. The built pages show the report's results, while the committed Markdown of
 *     the generated page holds none (the drift gate never sees a result).
 *  2. Replacing ONLY the report and building again over the same content cache
 *     changes both pages: the docs loader folds the report into the digest of
 *     every page that may show results (decision 10). Without the fold the
 *     cache would serve the first report's results.
 *     No built file of any kind (HTML, llms*.txt, the scenario index, agent
 *     pages, feeds, sitemap) carries the report's failure text, stack trace or
 *     attachment: only statuses are published (FR-005).
 *  3. A missing report builds, with a warning and no results, unless CI is set
 *     (FR-006): then the build fails and names the opt-out.
 *  4. A report that cannot be read fails the build at config time, naming it.
 *
 * Like `gherkin-fence-build.test.ts`, the site lives in `example/` so the
 * toolkit, Astro and Starlight resolve as for an adopter, with its own `dist/`
 * and content cache, and is removed afterwards (git-ignored in case a run dies).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = path.join(REPO_ROOT, 'example', '.dk-test-gherkin-results');
const ASTRO_BIN = path.join(REPO_ROOT, 'example', 'node_modules', 'astro', 'astro.js');
const FIX = fileURLToPath(new URL('./fixtures/gherkin/results/', import.meta.url));

const doc = (title: string, body = '') => `---\ntitle: ${title}\ndescription: Fixture.\n---\n\n# ${title}\n\n${body}\n`;
const FILES: Record<string, string> = {
  'astro.config.mjs': `import { defineConfig } from 'astro/config';
import { defineDocKittyIntegrations } from '@spec-kitty/doc-toolkit/config';
export default defineConfig({
  integrations: defineDocKittyIntegrations({ title: 'Results fixture', gherkin: { sources: ['features'], results: 'reports/cucumber.ndjson' } }),
});
`,
  'src/content.config.ts': `import { defineCollection } from 'astro:content';
import { docKittyDocsLoader, docKittyDocsSchema } from '@spec-kitty/doc-toolkit/schema';
export const collections = { docs: defineCollection({ loader: docKittyDocsLoader({ base: 'docs' }), schema: docKittyDocsSchema() }) };
`,
  'docs/guide.md': doc('Guide', '::gherkin{src="features/checkout.feature"}'),
  'features/checkout.feature': readFileSync(path.join(FIX, 'features', 'checkout.feature'), 'utf8'),
};

function report(name: string | null, contents?: string) {
  const target = path.join(SITE, 'reports', 'cucumber.ndjson');
  rmSync(target, { force: true });
  if (name === null) return;
  mkdirSync(path.dirname(target), { recursive: true });
  if (contents === undefined) copyFileSync(path.join(FIX, name), target);
  else writeFileSync(target, contents);
}

/** Text a leak would put in a built file; the report below carries all three. */
const LEAK = {
  message: 'SENTINEL-FAILURE-MESSAGE-7f3a',
  stack: 'SENTINEL-STACK-FRAME-7f3a (/home/runner/work/shop/shop/steps/steps.js:12:59)',
  attachment: 'SENTINEL-ATTACHMENT-BODY-7f3a',
};

/** The Messages fixture with sentinel failure text, stack trace and an attachment added. */
function reportWithLeakBait() {
  const lines = readFileSync(path.join(FIX, 'messages.ndjson'), 'utf8').split('\n').filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    const env = JSON.parse(line);
    const result = env.testStepFinished?.testStepResult;
    if (result?.status === 'FAILED') {
      result.message = `Error: ${LEAK.message}\n    at ${LEAK.stack}`;
      result.exception = { type: 'Error', message: LEAK.message, stackTrace: LEAK.stack };
    }
    out.push(JSON.stringify(env));
    if (result?.status === 'FAILED') {
      const { testCaseStartedId, testStepId } = env.testStepFinished;
      out.push(
        JSON.stringify({
          attachment: { testCaseStartedId, testStepId, body: LEAK.attachment, contentEncoding: 'IDENTITY', mediaType: 'text/plain' },
        }),
      );
    }
  }
  return out.join('\n') + '\n';
}

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? filesUnder(path.join(dir, e.name)).map((f) => path.join(e.name, f)) : [e.name],
  );
}

/**
 * GitHub Actions sets `CI=true`, which makes a missing report fatal, so every
 * build pins `CI` itself (`''` unless a case is about CI).
 */
function build(ci = '') {
  // Vitest's env carries `BASE_URL`, which would override the child's `base`.
  const env: NodeJS.ProcessEnv = { ...process.env, CI: ci };
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

describe('scenario results in a real build (ADR-0055)', () => {
  it(
    'shows the report on the include and the generated page, and re-renders both when only the report changes',
    () => {
      report('messages.ndjson', reportWithLeakBait());
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

      // Positive control (same build): the statuses above are published, and no
      // built file of any kind carries the report's text (only statuses are).
      const dist = path.join(SITE, 'dist');
      const built = filesUnder(dist);
      for (const kind of ['.html', '.json']) {
        expect(built.some((f) => f.endsWith(kind)), `built a ${kind} file`).toBe(true);
      }
      for (const f of built) {
        const text = readFileSync(path.join(dist, f), 'utf8');
        const b64 = Buffer.from(LEAK.attachment).toString('base64');
        expect(text, `${f} leaks the attachment base64`).not.toContain(b64);
        for (const leak of Object.values(LEAK)) expect(text, `${f} leaks report text`).not.toContain(leak);
        expect(text, `${f} leaks a stack frame`).not.toContain('steps/steps.js');
      }

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
    'a missing report builds without results, with a warning; an unreadable one fails the build, naming it',
    () => {
      report(null);
      const missing = build();
      expect(missing.status, missing.output).toBe(0);
      expect(missing.output).toContain('[dk-gherkin] gherkin.results report not found: reports/cucumber.ndjson');
      for (const rel of ['guide', 'behaviour/checkout']) expect(page(rel)).not.toContain('dk-gherkin__status');
      // The generated index route exists in the same build (it is the one that
      // carries results when a report is present).
      expect(existsSync(path.join(SITE, 'dist', 'api', 'scenarios.json'))).toBe(true);

      // With CI set the same missing report fails the build, naming the opt-out.
      const ci = build('true');
      expect(ci.status, ci.output).not.toBe(0);
      expect(ci.output).toContain('(CI is set; set gherkin.results.required: false to build without results)');

      mkdirSync(path.join(SITE, 'reports'), { recursive: true });
      writeFileSync(path.join(SITE, 'reports', 'cucumber.ndjson'), '{"meta":{}}\nthis is not json\n');
      const bad = build();
      expect(bad.status, bad.output).not.toBe(0);
      expect(bad.output).toContain('[dk-gherkin] reports/cucumber.ndjson:2 is not a Cucumber Messages envelope');
    },
    240_000,
  );
});
