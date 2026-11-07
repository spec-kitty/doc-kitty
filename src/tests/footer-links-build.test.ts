/**
 * The footer groups and head links in real builds (page-chrome WP09): the example,
 * and the chrome fixture under varied options, themed and not. Every href is read back
 * from built HTML and looked up in `dist`.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bundlePathOf } from '../lib/okf-export/core.mjs';
import { buildChromeFixture, emittedCss, NON_HUB_PAGE, REPO_ROOT } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
const BASE = '/doc-kitty';
const GENERATED_PAGE = 'reference/generated-page/index.html';
const DRAFT_PAGE = 'adr/template/index.html';
const NESTED_INDEX = 'guides/authoring/index.html';
const LINK_GATE = path.join(REPO_ROOT, 'src/scripts/assert-no-broken-links.mjs');
const BIBLIOGRAPHY = {
  'src/pages/api/bibliography.json.ts': "import { bibliographyRoute } from '@spec-kitty/doc-toolkit/routes';\nexport const GET = bibliographyRoute();\n",
};
const REPOSITORY = { provider: 'gitlab', repo: 'acme/docs', branch: 'main', siteDir: 'site' };
/** What FR-001 names. The fixture needs its bibliography mounted, and has no scenarios. */
const ENTRY_POINTS = ['/llms.txt', '/api/index.json', '/api/content-graph.json', '/rss.xml', '/sitemap-index.xml', '/api/bibliography.json', '/okf/index.md'];

function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build.dist;
}
const read = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');

function group(html: string, name: 'machine-links' | 'page-formats'): string | undefined {
  return new RegExp(`<nav class="dk-${name}[ "][\\s\\S]*?</nav>`).exec(html)?.[0];
}
const hrefs = (fragment = '') => [...fragment.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1] as string);
/** The page-format links of the footer group: the ones marked as alternates. */
const formatLinks = (html: string) =>
  [...(group(html, 'page-formats') ?? '').matchAll(/<a [^>]*rel="alternate"[^>]*>/g)].map((m) => m[0]).map((tag) => ({
    type: /type="([^"]*)"/.exec(tag)?.[1] as string,
    href: /href="([^"]*)"/.exec(tag)?.[1] as string,
  }));
const headLinks = (html: string) =>
  [...html.slice(0, html.indexOf('</head>')).matchAll(/<link rel="alternate" [^>]*>/g)].map((m) => m[0]).map((tag) => ({
    type: /type="([^"]*)"/.exec(tag)?.[1] as string,
    href: /href="([^"]*)"/.exec(tag)?.[1] as string,
  }));
const sourceHref = (html: string) => /<a class="[^"]*" href="([^"]*)"[^>]*>\s*source\s*<\/a>/.exec(group(html, 'page-formats') ?? '')?.[1];
const inDist = (dist: string, href: string, base = BASE) => existsSync(path.join(dist, href.slice(base.length)));

function htmlFiles(dir: string, under = ''): string[] {
  return readdirSync(path.join(dir, under), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(under, e.name);
    if (e.isDirectory()) return htmlFiles(dir, rel);
    return e.name.endsWith('.html') ? [rel] : [];
  });
}

describe('the built example', () => {
  const OUT = '.dk-test-chrome/example-footer-links';
  const dist = path.join(REPO_ROOT, 'example', OUT);
  let build: { status: number | null; output: string };

  beforeAll(() => {
    // Vitest's own variables must not reach the build: its `BASE_URL` would win.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !['NODE_ENV', 'MODE', 'DEV', 'PROD', 'SSR', 'BASE_URL'].includes(name)));
    Object.assign(env, { CI: '', DK_OUTDIR: OUT });
    const run = spawnSync(process.execPath, [path.join(REPO_ROOT, 'example/node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: path.join(REPO_ROOT, 'example'),
      encoding: 'utf8',
      env,
    });
    build = { status: run.status, output: `${run.stdout}\n${run.stderr}` };
  }, BUILD_TIMEOUT);
  afterAll(() => rmSync(dist, { recursive: true, force: true }));

  it('builds', () => {
    expect(build.status, build.output).toBe(0);
  });

  it('FR-001: the footer links every entry point, and each is built', () => {
    const links = hrefs(group(read(dist, 'guides/getting-started/index.html'), 'machine-links'));
    for (const surface of [...ENTRY_POINTS, '/api/scenarios.json']) {
      expect(links).toContain(`${BASE}${surface}`);
      expect(existsSync(path.join(dist, surface)), surface).toBe(true);
    }
  });

  it('every generated href on every page resolves, and the published pages are exactly those the OKF bundle holds', () => {
    const graph = JSON.parse(read(dist, 'api/content-graph.json')) as {
      nodes: Array<{ id: string; kind: string; href?: string; doc_kind?: string }>;
    };
    const pages = graph.nodes.filter((n) => n.kind === 'page' || n.kind === 'persona');
    // A deck has its own layout, with no Starlight footer or head at all.
    const expected = new Map(pages.filter((n) => n.doc_kind !== 'Presentation').map((n) => [n.href as string, n.id]));
    expect(expected.size, 'a real corpus').toBeGreaterThan(40);
    expect([...expected.values()].some((id) => /\/(README|index)$/.test(id) && id.includes('/')), 'a nested index is covered').toBe(true);

    const withGroup = new Map<string, ReturnType<typeof formatLinks>>();
    for (const rel of htmlFiles(dist)) {
      const html = read(dist, rel);
      for (const href of hrefs(group(html, 'machine-links'))) expect(inDist(dist, href), `${rel}: ${href}`).toBe(true);
      const formats = formatLinks(html);
      for (const { href } of formats) expect(inDist(dist, href), `${rel}: ${href}`).toBe(true);
      for (const { href } of headLinks(html)) expect(inDist(dist, href), `${rel} head: ${href}`).toBe(true);
      expect(headLinks(html).filter((l) => l.href.includes('/api/pages/') || l.href.includes('/okf/')), `${rel}: footer and head match`).toEqual(formats);
      if (formats.length > 0) withGroup.set(`/${rel.replace(/index\.html$/, '')}`, formats);
    }
    expect([...withGroup.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [route, id] of expected) {
      const okf = withGroup.get(route)?.find((l) => l.type === 'text/markdown')?.href;
      expect(okf, route).toBe(`${BASE}/okf/${bundlePathOf(id, ['README', 'index'])}`);
    }
  });

  it('a deck, in the bundle or not, has no format links, and neither has a 404 or an OpenAPI page', () => {
    for (const rel of ['presentations/feature-tour/index.html', '404.html', 'reference/api/v1/index.html']) {
      expect(existsSync(path.join(dist, rel)), rel).toBe(true);
      expect(group(read(dist, rel), 'page-formats'), rel).toBeUndefined();
    }
    expect(group(read(dist, '404.html'), 'machine-links'), 'control: the site group is on every Starlight page').toBeDefined();
  });

  it('FR-023: the example shows its source link', () => {
    expect(sourceHref(read(dist, 'guides/getting-started/index.html'))).toBe('https://github.com/spec-kitty/doc-kitty/blob/main/example/docs/guides/getting-started.md');
    expect(sourceHref(read(dist, 'guides/index.html'))).toBe('https://github.com/spec-kitty/doc-kitty/blob/main/example/docs/guides/README.md');
  });
});

describe('the chrome fixture', () => {
  it(
    'FR-001: without a theme the footer links the same entry points',
    () => {
      const dist = built({ options: { theme: null }, files: BIBLIOGRAPHY });
      const links = hrefs(group(read(dist, NON_HUB_PAGE), 'machine-links'));
      for (const surface of ENTRY_POINTS) {
        expect(links).toContain(`${BASE}${surface}`);
        expect(existsSync(path.join(dist, surface)), surface).toBe(true);
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-003, FR-021: a surface in footer and head while mounted, and in neither once unmounted',
    () => {
      const stock = read(built(), NON_HUB_PAGE);
      const rss = `${BASE}/rss.xml`;
      expect(hrefs(group(stock, 'machine-links'))).toContain(rss);
      expect(headLinks(stock).map((l) => l.href)).toContain(rss);

      const removed = read(built({ files: { 'src/pages/rss.xml.ts': null } }), NON_HUB_PAGE);
      expect(hrefs(group(removed, 'machine-links'))).not.toContain(rss);
      expect(headLinks(removed).map((l) => l.href)).not.toContain(rss);
      expect(hrefs(group(removed, 'machine-links')), 'control: the others stay').toContain(`${BASE}/llms.txt`);
      expect(headLinks(removed).map((l) => l.href), 'control: the others stay').toContain(`${BASE}/llms.txt`);

      // The fixture mounts neither: FR-003's other half, on the page that links the rest.
      for (const absent of ['/api/bibliography.json', '/api/scenarios.json']) expect(hrefs(group(stock, 'machine-links'))).not.toContain(`${BASE}${absent}`);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-003: a build with no `site` has no sitemap link',
    () => {
      const noSite = read(built({ options: { site: null } }), NON_HUB_PAGE);
      expect(hrefs(group(noSite, 'machine-links'))).not.toContain(`${BASE}/sitemap-index.xml`);
      expect(hrefs(group(noSite, 'machine-links')), 'control').toContain(`${BASE}/llms.txt`);
      expect(hrefs(group(read(built(), NON_HUB_PAGE), 'machine-links')), 'control: with a site').toContain(`${BASE}/sitemap-index.xml`);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-004: the group can be turned off, or relabelled, and the page formats stay',
    () => {
      const stock = read(built(), NON_HUB_PAGE);
      expect(group(stock, 'machine-links')).toContain('aria-label="Machine-readable"');

      const off = read(built({ options: { footer: { machineEntryPoints: false } } }), NON_HUB_PAGE);
      expect(group(off, 'machine-links')).toBeUndefined();
      expect(group(off, 'page-formats'), 'control').toBeDefined();
      expect(headLinks(off).map((l) => l.href), 'the head is not part of the group').toContain(`${BASE}/rss.xml`);

      const relabelled = read(built({ options: { footer: { machineEntryPoints: { label: 'For agents' } } } }), NON_HUB_PAGE);
      expect(group(relabelled, 'machine-links')).toContain('aria-label="For agents"');
      expect(group(relabelled, 'machine-links')).not.toContain('Machine-readable');
    },
    BUILD_TIMEOUT,
  );

  it(
    "FR-019: a page's three formats are alternates with a media type, exist in dist, and match the head",
    () => {
      const dist = built();
      const html = read(dist, NON_HUB_PAGE);
      const formats = formatLinks(html);
      expect(formats).toEqual([
        { type: 'application/json', href: `${BASE}/api/pages/guides/getting-started.json` },
        { type: 'text/markdown', href: `${BASE}/okf/guides/getting-started.md` },
        { type: 'application/atom+xml;type=entry', href: `${BASE}/api/pages/guides/getting-started.atom.xml` },
      ]);
      for (const { href } of formats) expect(inDist(dist, href), href).toBe(true);
      expect(headLinks(html).slice(0, 2).map((l) => l.href), 'the feeds come first').toEqual([`${BASE}/rss.xml`, `${BASE}/llms.txt`]);
      expect(headLinks(html).slice(2)).toEqual(formats);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-019: a nested README maps to its bundle index, and that exists',
    () => {
      const dist = built();
      const formats = formatLinks(read(dist, NESTED_INDEX));
      expect(formats.map((l) => l.href)).toContain(`${BASE}/okf/guides/authoring/index.md`);
      for (const { href } of formats) expect(inDist(dist, href), href).toBe(true);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-019: an undated page has no Atom link, and no Atom entry',
    () => {
      const dist = built();
      const types = formatLinks(read(dist, 'guides/undated/index.html')).map((l) => l.type);
      expect(types).toEqual(['application/json', 'text/markdown']);
      expect(existsSync(path.join(dist, 'api/pages/guides/undated.atom.xml'))).toBe(false);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-019: with `pageFormats.atom` off there is no Atom link, in footer or head',
    () => {
      const html = read(built({ options: { pageFormats: { atom: false } } }), NON_HUB_PAGE);
      expect(formatLinks(html).map((l) => l.type)).toEqual(['application/json', 'text/markdown']);
      expect(headLinks(html).map((l) => l.type)).not.toContain('application/atom+xml;type=entry');
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-022: under DK_PUBLISH_DRAFTS=on a draft has no formats, and a published page in the same build does',
    () => {
      const dist = built({ env: { DK_PUBLISH_DRAFTS: 'on' }, options: { repository: REPOSITORY } });
      const draft = read(dist, DRAFT_PAGE);
      expect(draft, 'the draft is rendered').toContain('name="robots" content="noindex"');
      expect(group(draft, 'page-formats')).toBeUndefined();
      expect(headLinks(draft).map((l) => l.href).sort(), 'only the site feeds').toEqual([`${BASE}/llms.txt`, `${BASE}/rss.xml`].sort());
      expect(existsSync(path.join(dist, 'okf/adr/template.md'))).toBe(false);
      expect(formatLinks(read(dist, NON_HUB_PAGE)), 'control: the published page shows them').toHaveLength(3);
    },
    BUILD_TIMEOUT,
  );

  it(
    "FR-023, FR-024: an authored page's source link is exact, and a generated page in the same build has none",
    () => {
      const dist = built({ options: { repository: REPOSITORY } });
      const authored = read(dist, NON_HUB_PAGE);
      expect(sourceHref(authored)).toBe('https://gitlab.com/acme/docs/-/blob/main/site/docs/guides/getting-started.md');
      expect(sourceHref(read(dist, NESTED_INDEX))).toBe('https://gitlab.com/acme/docs/-/blob/main/site/docs/guides/authoring/README.md');
      expect(group(authored, 'page-formats'), 'the source link is not an alternate').not.toMatch(/rel="alternate"[^>]*href="https:\/\/gitlab/);
      expect(headLinks(authored).map((l) => l.href).join(), 'nor in the head').not.toContain('gitlab');
      const generated = read(dist, GENERATED_PAGE);
      expect(sourceHref(generated)).toBeUndefined();
      expect(formatLinks(generated), 'control: the generated page keeps its formats').not.toHaveLength(0);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-024: a build with no repository has no source link on the authored page',
    () => {
      const authored = read(built(), NON_HUB_PAGE);
      expect(sourceHref(authored)).toBeUndefined();
      expect(formatLinks(authored), 'control').toHaveLength(3);
    },
    BUILD_TIMEOUT,
  );

  it(
    'agent.discoverable: false shows no JSON, OKF or Atom link in footer or head, and keeps its source link; a discoverable page beside it keeps all',
    () => {
      const page = (discoverable: boolean) =>
        `---\ntitle: Page\ndescription: A page.\ndoc_status: active\nkind: How-To\nupdated: 2026-10-31\nagent:\n  discoverable: ${discoverable}\n---\n\n# Page\n\nBody.\n`;
      const dist = built({
        options: { repository: REPOSITORY },
        files: { 'docs/guides/hidden.md': page(false), 'docs/guides/visible.md': page(true) },
      });
      const hidden = read(dist, 'guides/hidden/index.html');
      expect(formatLinks(hidden)).toEqual([]);
      expect(headLinks(hidden).filter((l) => l.href.includes('/api/pages/') || l.href.includes('/okf/'))).toEqual([]);
      expect(sourceHref(hidden)).toBe('https://gitlab.com/acme/docs/-/blob/main/site/docs/guides/hidden.md');
      expect(headLinks(hidden).map((l) => l.href), 'control: the site feeds stay').toContain(`${BASE}/rss.xml`);
      const visible = read(dist, 'guides/visible/index.html');
      expect(formatLinks(visible)).toHaveLength(3);
      expect(headLinks(visible).filter((l) => l.href.includes('/api/pages/') || l.href.includes('/okf/'))).toHaveLength(3);
    },
    BUILD_TIMEOUT,
  );

  it(
    'FR-025, C-004: pill CSS is in the themed build and not the unthemed one, which has the same classes',
    () => {
      const themed = emittedCss(built());
      const unthemedDist = built({ options: { theme: null } });
      const unthemed = emittedCss(unthemedDist);
      expect(themed).toContain('.dk-pill');
      expect(themed).toContain('a.dk-pill:hover');
      expect(unthemed).not.toContain('dk-pill');
      expect(group(read(unthemedDist, NON_HUB_PAGE), 'page-formats'), 'the same markup').toContain('dk-pill dk-pill--neutral');
      expect(unthemed, 'control: the size rule is not theme-only').toContain('.dk-page-formats');
    },
    BUILD_TIMEOUT,
  );

  describe('NFR-009: the link gate, on a root and a based build', () => {
    const gate = (dist: string, base: string) =>
      spawnSync(process.execPath, [LINK_GATE, dist, '--base', base, '--site', 'https://spec-kitty.github.io', '--no-external-images'], { encoding: 'utf8' });
    const scratch: string[] = [];
    afterAll(() => {
      for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
    });

    it.each([
      ['root', { base: '/' }, ''],
      ['based', {}, BASE],
    ])(
      '%s: it passes, with every href resolving',
      (_name, options, base) => {
        const dist = built({ options: { ...options, repository: REPOSITORY } });
        const run = gate(dist, base === '' ? '/' : base);
        expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
        const html = read(dist, NON_HUB_PAGE);
        expect(hrefs(group(html, 'machine-links'))).toContain(`${base}/llms.txt`);
        for (const { href } of [...formatLinks(html), ...headLinks(html)]) expect(inDist(dist, href, base), href).toBe(true);
      },
      BUILD_TIMEOUT,
    );

    it(
      'it treats .md and .atom.xml as files: remove one and it fails',
      () => {
        const dist = built();
        for (const victim of ['okf/guides/getting-started.md', 'api/pages/guides/getting-started.atom.xml']) {
          const copy = mkdtempSync(path.join(tmpdir(), 'dk-footer-links-'));
          scratch.push(copy);
          cpSync(dist, copy, { recursive: true });
          expect(gate(copy, BASE).status, 'control: the copy passes').toBe(0);
          rmSync(path.join(copy, victim));
          const run = gate(copy, BASE);
          expect(run.status, victim).not.toBe(0);
          expect(`${run.stdout}${run.stderr}`).toContain(path.basename(victim));
        }
      },
      BUILD_TIMEOUT,
    );
  });
});
