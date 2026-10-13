/**
 * WP05 T032 — the draft-publication setting, proven against the BUILT example
 * site (FR-013..FR-017, NFR-006, SC-005).
 *
 * FR-015 asks for one consistent answer per setting value, proven half by half
 * on the same fixture. So this suite builds the example with the setting OFF
 * (by leaving it unset: the default) and with it ON, and reads both outputs:
 * pages, sidebar, robots meta, search index and the machine surfaces.
 *
 * A third build repeats OFF, to show two builds with the same value produce the
 * same sidebar (NFR-006).
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
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE_BASE = '/doc-kitty';
const OUT = {
  on: 'dist-wp05-drafts-on-test',
  off: 'dist-wp05-drafts-off-test',
  offRepeat: 'dist-wp05-drafts-off-repeat-test',
} as const;
type Mode = keyof typeof OUT;

/**
 * Every draft page of the example (`doc_status: draft`), by route slug. The
 * last one is a slide deck: an out-of-frame page that no sidebar links to.
 */
const SIDEBAR_DRAFTS = [
  'context/audience/draft-persona',
  'adr/template',
  'plans',
  'plans/missions',
  'plans/missions/mission-alpha',
  'plans/missions/mission-beta',
  'guides/markua-footnotes-showcase',
  'guides/markua-footnotes-malformed',
];
const DRAFT_DECK = 'presentations/draft-preview';
const DRAFTS = [...SIDEBAR_DRAFTS, DRAFT_DECK];
/** Published pages: present, indexable and searchable in both modes. */
const PUBLISHED = ['guides/getting-started', 'adr', 'context/audience/example-persona'];
/** The files agents and crawlers read. Drafts are in none of them, in either mode. */
const MACHINE_SURFACES = ['sitemap-0.xml', 'rss.xml', 'llms.txt', 'api/index.json'];

/** Old URLs the example redirects to draft pages, and one it redirects to a published page. */
const WITHHELD_REDIRECTS = ['plans/features/mission-alpha', 'plans/features/mission-beta'];
const LIVE_REDIRECT = 'guides/old-getting-started';

const NOINDEX = /<meta name="robots" content="noindex"\s*\/?>/;

interface Build {
  status: number | null;
  output: string;
}
const builds = {} as Record<Mode, Build>;

function runBuild(mode: Mode, setting: string | undefined): Build {
  rmSync(path.join(REPO_ROOT, 'example', OUT[mode]), { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = { ...process.env, DK_OUTDIR: OUT[mode] };
  // Vitest injects BASE_URL; passed through it would override the site base.
  delete env.BASE_URL;
  delete env.DK_PUBLISH_DRAFTS;
  delete env.DK_PUBLISH_DRAFTS_RESOLVED;
  if (setting !== undefined) env.DK_PUBLISH_DRAFTS = setting;
  const res = spawnSync('pnpm', ['--filter', 'example', 'build'], {
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
    // ON first, then OFF twice: see the note on the shared content store above.
    builds.on = runBuild('on', 'on');
    builds.off = runBuild('off', undefined);
    builds.offRepeat = runBuild('offRepeat', undefined);
  }, 540_000);

  it('all three builds succeed', () => {
    for (const mode of ['on', 'off', 'offRepeat'] as const) {
      expect(builds[mode].status, `${mode} build output:\n${builds[mode].output.slice(-4000)}`).toBe(0);
    }
  });

  it('each build states the value in force and where it came from (T027)', () => {
    expect(builds.off.output).toContain('[dk-drafts] DK_PUBLISH_DRAFTS=off (default)');
    expect(builds.on.output).toContain('[dk-drafts] DK_PUBLISH_DRAFTS=on (process environment)');
  });

  it('the example .env.development does not reach a production build', () => {
    // The file turns drafts on, and the OFF build ran with the setting unset.
    expect(readFileSync(path.join(REPO_ROOT, 'example/.env.development'), 'utf8')).toMatch(
      /^DK_PUBLISH_DRAFTS=on$/m,
    );
    expect(builds.off.output).not.toContain('(env file)');
  });

  describe('setting off (the default)', () => {
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

    it('drops the Plans group, whose pages are all drafts, without a title warning', () => {
      const sidebar = sidebarHtml(page('off', 'guides/getting-started'));
      expect(sidebar).not.toMatch(/>\s*Plans\s*</);
      expect(sidebar).not.toMatch(/>\s*Missions\s*</);
      expect(builds.off.output).not.toContain('[dk-sidebar]');
    });

    it('has no draft in the search index', () => {
      const urls = searchUrls('off');
      expect(urls).toContain('/guides/getting-started/');
      for (const slug of DRAFTS) expect(urls, slug).not.toContain(`/${slug}/`);
    });

    it('does not report drafts as built', () => {
      expect(builds.off.output).not.toMatch(/draft page\(s\) were\s+built/);
    });

    it('warns about the redirects into drafts and builds no stub for them', () => {
      // The example declares all three redirects in both modes; the toolkit
      // withholds the two whose target is a draft.
      expect(builds.off.output).toMatch(/\[dk-drafts\] 2 redirect\(s\) lead to a draft page/);
      for (const old of WITHHELD_REDIRECTS) {
        expect(builds.off.output).toContain(`/${old}/ -> `);
        expect(existsSync(abs('off', old)), old).toBe(false);
      }
      expect(page('off', LIVE_REDIRECT)).toContain('Redirecting to:');
      // No built file mentions a draft target, so no stub was left behind.
      for (const file of htmlFiles('off')) {
        expect(read('off', file).includes('plans/missions'), file).toBe(false);
      }
    });
  });

  describe('setting on', () => {
    it('emits every draft page, marked noindex (FR-016)', () => {
      for (const slug of DRAFTS) {
        expect(page('on', slug), slug).toMatch(NOINDEX);
      }
    });

    it('builds every redirect stub, without a warning', () => {
      expect(builds.on.output).not.toContain('redirect(s) lead to a draft page');
      for (const old of [...WITHHELD_REDIRECTS, LIVE_REDIRECT]) {
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
      const sidebar = sidebarHtml(page('on', 'guides/getting-started'));
      expect(sidebar).toMatch(/>\s*Plans\s*</);
    });

    it('keeps every draft out of the search index, and published pages in it', () => {
      const urls = searchUrls('on');
      expect(urls).toContain('/guides/getting-started/');
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
