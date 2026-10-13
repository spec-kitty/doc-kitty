/**
 * WP05 T032 — the draft-publication setting, proven against the BUILT example
 * site (FR-013..FR-017, NFR-006, SC-005).
 *
 * FR-015 asks for one consistent answer per setting value, proven half by half
 * on the same fixture. So this suite builds the example with the setting ON
 * (by leaving it unset: the default, owner decision 2026-10-13) and with it
 * OFF (stated, as a live deployment states it), and reads both outputs: pages,
 * sidebar, robots meta, search index and the machine surfaces.
 *
 * A third build repeats OFF, to show two builds with the same value produce the
 * same sidebar (NFR-006). A fourth, also OFF, adds one redirect that ends at a
 * draft page (`fixtures/draft-redirect`), because the example itself no longer
 * has one: its Plans section was promoted to active.
 *
 * Each build has its own `DK_OUTDIR` (a second build into `dist` would
 * overwrite the first), and the file is listed in `vitest.workspace.ts`'s
 * serialized `build` project because every build suite shares `example/.astro`.
 * The content store there is deliberately NOT cleared between the builds: the
 * OFF build after an ON build is the case where a draft cached by the earlier
 * build has to be removed again. The example's Astro config is the same in both
 * modes, so Astro keeps the store; `draft-publication.test.ts` covers the same
 * case without a build.
 *
 * Mission: sidebar-frame-header-carrier-01M4T3CB, WP05.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE_BASE = '/doc-kitty';
const OUT = {
  on: 'dist-wp05-drafts-on-test',
  off: 'dist-wp05-drafts-off-test',
  offRepeat: 'dist-wp05-drafts-off-repeat-test',
  offRedirect: 'dist-wp05-drafts-off-redirect-test',
} as const;
type Mode = keyof typeof OUT;

/**
 * Every draft page of the example (`doc_status: draft`), by route slug. The
 * last one is a slide deck: an out-of-frame page that no sidebar links to.
 */
const SIDEBAR_DRAFTS = [
  'context/audience/draft-persona',
  'adr/template',
  'guides/markua-footnotes-malformed',
];
const DRAFT_DECK = 'presentations/draft-preview';
const DRAFTS = [...SIDEBAR_DRAFTS, DRAFT_DECK];
/**
 * Pages promoted from draft to active so the live site keeps them: the Plans
 * section and the footnotes showcase. Published in both modes.
 */
const PROMOTED = [
  'plans',
  'plans/missions',
  'plans/missions/mission-alpha',
  'plans/missions/mission-beta',
  'guides/markua-footnotes-showcase',
];
/** Published pages: present, indexable and searchable in both modes. */
const PUBLISHED = ['guides/getting-started', 'adr', 'context/audience/example-persona', ...PROMOTED];
/** The files agents and crawlers read. Drafts are in none of them, in either mode. */
const MACHINE_SURFACES = ['sitemap-0.xml', 'rss.xml', 'llms.txt', 'api/index.json'];

/** The example's redirects. All three end at a published page, so all are built in both modes. */
const REDIRECTS = ['plans/features/mission-alpha', 'plans/features/mission-beta', 'guides/old-getting-started'];

/** `fixtures/draft-redirect`: the example plus one redirect that ends at a draft. */
const DRAFT_REDIRECT_CONFIG = fileURLToPath(new URL('./fixtures/draft-redirect/astro.config.mjs', import.meta.url));
const DRAFT_REDIRECT_MAP = fileURLToPath(new URL('./fixtures/draft-redirect/redirects.json', import.meta.url));
const WITHHELD_REDIRECT = 'adr/old-template';
const WITHHELD_TARGET = 'adr/template';

const NOINDEX = /<meta name="robots" content="noindex"\s*\/?>/;

interface Build {
  status: number | null;
  output: string;
}
const builds = {} as Record<Mode, Build>;

function runBuild(mode: Mode, setting: string | undefined, config?: string): Build {
  rmSync(path.join(REPO_ROOT, 'example', OUT[mode]), { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: OUT[mode] };
  // Vitest injects BASE_URL; passed through it would override the site base.
  delete env.BASE_URL;
  delete env.DK_PUBLISH_DRAFTS;
  delete env.DK_PUBLISH_DRAFTS_RESOLVED;
  if (setting !== undefined) env.DK_PUBLISH_DRAFTS = setting;
  const args = config
    ? ['--filter', 'example', 'exec', 'astro', 'build', '--config', path.relative(path.join(REPO_ROOT, 'example'), config)]
    : ['--filter', 'example', 'build'];
  const res = spawnSync('pnpm', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

const abs = (mode: Mode, rel: string): string => path.join(REPO_ROOT, 'example', OUT[mode], rel);
const pageFile = (mode: Mode, slug: string): string => abs(mode, path.join(slug, 'index.html'));
const read = (mode: Mode, rel: string): string => {
  const file = abs(mode, rel);
  if (!existsSync(file)) throw new Error(`expected built file missing: ${rel} (${file})`);
  return readFileSync(file, 'utf8');
};
const page = (mode: Mode, slug: string): string => read(mode, path.join(slug, 'index.html'));

/** The sidebar pane's markup: from its id to the end of the enclosing `<nav>`. */
function sidebarHtml(doc: string): string {
  const start = doc.indexOf('id="starlight__sidebar"');
  if (start === -1) throw new Error('page has no sidebar pane');
  return doc.slice(start, doc.indexOf('</nav>', start));
}
const sidebarHrefs = (doc: string): string[] =>
  [...sidebarHtml(doc).matchAll(/<a href="([^"]*)"/g)].map((m) => m[1]!);
const href = (slug: string): string => `${SITE_BASE}/${slug}/`;

/** Every built HTML file, relative to the output directory. */
function htmlFiles(mode: Mode): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(abs(mode, dir), { withFileTypes: true })) {
      const rel = path.join(dir, name.name);
      if (name.isDirectory()) walk(rel);
      else if (name.name.endsWith('.html')) out.push(rel);
    }
  };
  walk('');
  return out;
}

/** The page URLs Pagefind indexed (one gzipped fragment per page; base-less routes). */
function searchUrls(mode: Mode): string[] {
  const dir = abs(mode, 'pagefind/fragment');
  return readdirSync(dir).map((name) => {
    const url = /"url":"([^"]*)"/.exec(gunzipSync(readFileSync(path.join(dir, name))).toString('utf8'));
    if (!url) throw new Error(`pagefind fragment ${name} has no url`);
    return url[1]!;
  });
}

describe('WP05 — draft publication in the built example', () => {
  beforeAll(() => {
    // ON first, then OFF: see the note on the shared content store above. ON is
    // the build with nothing set; OFF is stated, as a live deployment states it.
    builds.on = runBuild('on', undefined);
    builds.off = runBuild('off', 'off');
    builds.offRepeat = runBuild('offRepeat', 'off');
    builds.offRedirect = runBuild('offRedirect', 'off', DRAFT_REDIRECT_CONFIG);
  }, 720_000);

  it('all four builds succeed', () => {
    for (const mode of ['on', 'off', 'offRepeat', 'offRedirect'] as const) {
      expect(builds[mode].status, `${mode} build output:\n${builds[mode].output.slice(-4000)}`).toBe(0);
    }
  });

  it('each build states the value in force and where it came from (T027)', () => {
    expect(builds.on.output).toContain('[dk-drafts] DK_PUBLISH_DRAFTS=on (default)');
    expect(builds.off.output).toContain('[dk-drafts] DK_PUBLISH_DRAFTS=off (process environment)');
  });

  it('the unset build tells the reader how to turn drafts off for a live deployment', () => {
    expect(builds.on.output).toContain('Set DK_PUBLISH_DRAFTS=off in a live deployment');
    expect(builds.off.output).not.toContain('Set DK_PUBLISH_DRAFTS=off in a live deployment');
  });

  it('the example commits no env file a build reads, only the documented .env.example', () => {
    expect(builds.on.output).not.toContain('(env file)');
    expect(existsSync(path.join(REPO_ROOT, 'example/.env.example'))).toBe(true);
    for (const name of ['.env', '.env.production', '.env.development']) {
      expect(existsSync(path.join(REPO_ROOT, 'example', name)), name).toBe(false);
    }
  });

  describe('setting off (what the live deployment sets)', () => {
    it('emits no draft page (FR-014)', () => {
      for (const slug of DRAFTS) {
        expect(existsSync(pageFile('off', slug)), slug).toBe(false);
      }
    });

    it('still emits the published pages, indexable', () => {
      for (const slug of PUBLISHED) {
        expect(page('off', slug), slug).not.toMatch(NOINDEX);
      }
    });

    it('leaves out exactly the draft pages: the two builds differ by those files only', () => {
      const on = htmlFiles('on').sort();
      const off = htmlFiles('off').sort();
      expect(on.filter((file) => !off.includes(file))).toEqual(
        DRAFTS.map((slug) => path.join(slug, 'index.html')).sort(),
      );
      expect(off.filter((file) => !on.includes(file))).toEqual([]);
    });

    it('lists no draft in any sidebar and links to none from any page (FR-015)', () => {
      const draftHrefs = DRAFTS.map(href);
      const files = htmlFiles('off');
      expect(files.length).toBeGreaterThan(40);
      for (const file of files) {
        const doc = read('off', file);
        for (const draft of draftHrefs) {
          expect(doc.includes(`href="${draft}"`), `${file} links to ${draft}`).toBe(false);
        }
      }
    });

    it('keeps the Plans group, whose pages are published, without a title warning', () => {
      const hrefs = sidebarHrefs(page('off', 'guides/getting-started'));
      for (const slug of PROMOTED) expect(hrefs, slug).toContain(href(slug));
      const sidebar = sidebarHtml(page('off', 'guides/getting-started'));
      expect(sidebar).toMatch(/>\s*Plans\s*</);
      expect(sidebar).toMatch(/>\s*Missions\s*</);
      expect(builds.off.output).not.toContain('[dk-sidebar]');
    });

    it('has no draft in the search index, and the published pages in it', () => {
      const urls = searchUrls('off');
      expect(urls).toContain('/guides/getting-started/');
      for (const slug of PROMOTED) expect(urls, slug).toContain(`/${slug}/`);
      for (const slug of DRAFTS) expect(urls, slug).not.toContain(`/${slug}/`);
    });

    it('does not report drafts as built', () => {
      expect(builds.off.output).not.toMatch(/draft page\(s\) were\s+built/);
    });

    it('builds every redirect of the example: none of them ends at a draft', () => {
      expect(builds.off.output).not.toContain('redirect(s) lead to a draft page');
      for (const old of REDIRECTS) {
        expect(page('off', old), old).toContain('Redirecting to:');
      }
    });
  });

  describe('setting off, with a redirect that ends at a draft', () => {
    it('warns once, naming the redirect and its draft target, and builds no stub for it', () => {
      expect(builds.offRedirect.output).toMatch(/\[dk-drafts\] 1 redirect\(s\) lead to a draft page/);
      expect(builds.offRedirect.output).toContain(`/${WITHHELD_REDIRECT}/ -> /${WITHHELD_TARGET}/`);
      expect(existsSync(abs('offRedirect', WITHHELD_REDIRECT)), WITHHELD_REDIRECT).toBe(false);
      expect(existsSync(pageFile('offRedirect', WITHHELD_TARGET)), WITHHELD_TARGET).toBe(false);
      // The redirects that end at published pages are built as usual.
      for (const old of REDIRECTS) {
        expect(page('offRedirect', old), old).toContain('Redirecting to:');
      }
      // No built file mentions the draft target, so no stub was left behind.
      for (const file of htmlFiles('offRedirect')) {
        expect(read('offRedirect', file).includes(`${SITE_BASE}/${WITHHELD_TARGET}/`), file).toBe(false);
      }
    });

    it('the redirect-coverage gate reports that old URL as unpublished and passes', () => {
      const tmp = mkdtempSync(path.join(tmpdir(), 'dk-draft-redirect-'));
      try {
        const baseline = path.join(tmp, 'url-baseline.txt');
        writeFileSync(
          baseline,
          `${readFileSync(path.join(REPO_ROOT, 'example/url-baseline.txt'), 'utf8')}\n/${WITHHELD_REDIRECT}/\n`,
        );
        const declared = path.join(tmp, 'redirects.json');
        writeFileSync(
          declared,
          JSON.stringify({
            ...JSON.parse(readFileSync(path.join(REPO_ROOT, 'example/redirects.json'), 'utf8')),
            ...JSON.parse(readFileSync(DRAFT_REDIRECT_MAP, 'utf8')),
          }),
        );
        const gate = (setting: string) =>
          spawnSync(
            'node',
            [
              path.join(REPO_ROOT, 'src/scripts/check-redirect-coverage.mjs'),
              baseline,
              abs('offRedirect', ''),
              '--docs',
              path.join(REPO_ROOT, 'example/docs'),
              '--index-basename',
              'README,index',
              '--declared-redirects',
              declared,
            ],
            { encoding: 'utf8', env: { ...process.env, DK_PUBLISH_DRAFTS: setting } },
          );
        const off = gate('off');
        expect(off.status, off.stderr).toBe(0);
        expect(off.stdout).toContain(`/${WITHHELD_REDIRECT}/: draft /${WITHHELD_TARGET}/`);
        expect(off.stdout).toContain('1 unpublished (drafts off)');
        // The same output checked as a drafts-on build fails: there the URL must resolve.
        const on = gate('on');
        expect(on.status).toBe(1);
        expect(on.stderr).toContain(`/${WITHHELD_REDIRECT}/: no page and no redirect`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    });
  });

  describe('setting on (the default: nothing set)', () => {
    it('emits every draft page, marked noindex (FR-016)', () => {
      for (const slug of DRAFTS) {
        expect(page('on', slug), slug).toMatch(NOINDEX);
      }
    });

    it('builds every redirect stub, without a warning', () => {
      expect(builds.on.output).not.toContain('redirect(s) lead to a draft page');
      for (const old of REDIRECTS) {
        expect(page('on', old), old).toContain('Redirecting to:');
      }
    });

    it('marks only drafts: published pages stay indexable', () => {
      for (const slug of PUBLISHED) {
        expect(page('on', slug), slug).not.toMatch(NOINDEX);
      }
    });

    it('lists the drafts in the sidebar of a published page (FR-015)', () => {
      const hrefs = sidebarHrefs(page('on', 'guides/getting-started'));
      for (const slug of SIDEBAR_DRAFTS) expect(hrefs, slug).toContain(href(slug));
      for (const slug of PROMOTED) expect(hrefs, slug).toContain(href(slug));
    });

    it('keeps every draft out of the search index, and published pages in it', () => {
      const urls = searchUrls('on');
      expect(urls).toContain('/guides/getting-started/');
      for (const slug of PROMOTED) expect(urls, slug).toContain(`/${slug}/`);
      for (const slug of DRAFTS) expect(urls, slug).not.toContain(`/${slug}/`);
      for (const slug of SIDEBAR_DRAFTS) {
        expect(page('on', slug), slug).not.toContain('data-pagefind-body');
      }
      expect(page('on', 'guides/getting-started')).toContain('data-pagefind-body');
    });
  });

  describe('machine surfaces, both settings', () => {
    it.each(['off', 'on'] as const)('list no draft with the setting %s', (mode) => {
      for (const surface of MACHINE_SURFACES) {
        const text = read(mode, surface);
        // Non-vacuity: the surface does list a published page.
        expect(text, `${surface} lists published pages`).toContain('guides/getting-started');
        // The promoted pages are published, so every surface lists them.
        for (const slug of PROMOTED) {
          expect(text.includes(`/${slug}/`), `${surface} (${mode}) lists ${slug}`).toBe(true);
        }
        for (const slug of DRAFTS) {
          expect(text.includes(`/${slug}/`), `${surface} (${mode}) lists ${slug}`).toBe(false);
        }
      }
    });

    it('are the same in both modes', () => {
      for (const surface of ['llms.txt', 'api/index.json', 'sitemap-0.xml']) {
        expect(read('on', surface), surface).toBe(read('off', surface));
      }
      expect(read('off', 'sitemap-0.xml').match(/<loc>/g)!.length).toBeGreaterThan(40);
    });
  });

  it('two builds with the same value produce the same sidebar (NFR-006)', () => {
    for (const slug of ['guides/getting-started', 'adr']) {
      expect(sidebarHtml(page('offRepeat', slug)), slug).toBe(sidebarHtml(page('off', slug)));
    }
  });
});

describe('WP05 — an unrecognised value stops the build (FR-017)', () => {
  it('fails before emitting anything, naming the setting and the accepted values', () => {
    const outDir = 'dist-wp05-drafts-invalid-test';
    const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: outDir, DK_PUBLISH_DRAFTS: 'maybe' };
    delete env.BASE_URL;
    const res = spawnSync('pnpm', ['--filter', 'example', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env,
    });
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(res.status).not.toBe(0);
    expect(output).toContain(
      'DK_PUBLISH_DRAFTS must be "on" or "off", but the process environment sets it to "maybe".',
    );
    expect(existsSync(path.join(REPO_ROOT, 'example', outDir))).toBe(false);
  }, 120_000);
});
