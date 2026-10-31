/**
 * Legacy `.html` redirects (issue #249, ADR-0068).
 *
 * A site that moves off an `.html`-URL generator (DocFX) keeps every old
 * `/a/b.html` URL working with a FLAT meta-refresh stub at `<dist>/a/b.html`.
 * That is the one file a static host such as GitHub Pages serves for that exact
 * URL, with no host-side redirect involved.
 *
 * These tests cover, without an Astro build:
 *  - the shared library (`src/lib/legacy-html-redirects.mjs`): validation, chain
 *    flattening, the stub page, writing the stubs, and the mechanical map helper;
 *  - the redirect-coverage gate's `.html` support: a flat stub covers its URL,
 *    chains are followed, a dead target / a missing source / an Astro
 *    directory-form stub fails, at the domain root and under a base path;
 *  - every legacy URL resolves the way GitHub Pages serves it, through a small
 *    model of the host's static lookup ({@link githubPagesServe}).
 *
 * The real-build half is `legacy-html-redirects-build.test.ts`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  flattenLegacyChains,
  mechanicalHtmlMap,
  normalizeLegacyHtmlRedirects,
  refuseAstroHtmlRedirects,
  renderLegacyStub,
  writeLegacyHtmlStubs,
} from '../lib/legacy-html-redirects.mjs';
import {
  checkCoverage,
  inspectDistUrl,
  redirectStubUrls,
  resolveVerdict,
  stripKnownBase,
  urlToDistFile,
} from '../scripts/check-redirect-coverage.mjs';

const gatePath = fileURLToPath(new URL('../scripts/check-redirect-coverage.mjs', import.meta.url));
const mapperPath = fileURLToPath(new URL('../scripts/generate-legacy-redirects.mjs', import.meta.url));

const tmpDirs: string[] = [];
function makeTmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'legacy-html-'));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function writeFile(root: string, rel: string, text: string): void {
  const abs = path.join(root, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}
const page = (title: string) => `<!doctype html><title>${title}</title><body><h1>${title}</h1></body>`;

/** A built site with three live pages, as Astro's directory format writes them. */
function builtSite(): string {
  const dist = makeTmpDir();
  writeFile(dist, 'index.html', page('Home'));
  writeFile(dist, 'guides/how-to/accept/index.html', page('Accept'));
  writeFile(dist, 'guides/index.html', page('Guides'));
  return dist;
}

/**
 * A model of how GitHub Pages answers a GET for `urlPath` from a published
 * `dist/` (path without the site base): a path ending in `/` serves
 * `index.html` in that folder; a path naming a file serves it; a path naming a
 * folder answers 301 to the same path with a trailing slash; a path with no
 * extension falls back to `<path>.html`; anything else is a 404.
 *
 * Only the first rule matters for the flat stubs: they are files, so each old
 * URL is answered by its own file with status 200, and no host redirect is ever
 * involved. The folder rule is the one the Astro directory form would depend on.
 */
function githubPagesServe(dist: string, urlPath: string):
  | { status: 200; file: string }
  | { status: 301; location: string }
  | { status: 404 } {
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const abs = path.join(dist, rel);
  if (urlPath.endsWith('/')) {
    const index = path.join(abs, 'index.html');
    return existsSync(index) ? { status: 200, file: index } : { status: 404 };
  }
  if (existsSync(abs) && statSync(abs).isFile()) return { status: 200, file: abs };
  if (existsSync(abs) && statSync(abs).isDirectory()) return { status: 301, location: `${urlPath}/` };
  if (!path.extname(abs) && existsSync(`${abs}.html`)) return { status: 200, file: `${abs}.html` };
  return { status: 404 };
}

/**
 * Follow `urlPath` as a browser on GitHub Pages would: host redirects and
 * meta-refresh stubs, to the page it ends on. `base` is the site base the
 * stub targets carry. Returns the hops and the final served file.
 */
function browse(dist: string, urlPath: string, base = '') {
  const hops: string[] = [];
  let url = urlPath;
  for (let i = 0; i < 10; i += 1) {
    hops.push(url);
    const res = githubPagesServe(dist, url);
    if (res.status === 404) return { status: 404 as const, hops };
    if (res.status === 301) {
      url = res.location;
      continue;
    }
    const html = readFileSync(res.file, 'utf8');
    const refresh = html.match(/<meta http-equiv="refresh" content="\d+;\s*url=([^"]*)"/i);
    if (!refresh) return { status: 200 as const, hops, file: res.file, html };
    url = refresh[1].startsWith(base) ? refresh[1].slice(base.length) || '/' : refresh[1];
  }
  return { status: 'loop' as const, hops };
}

// --------------------------------------------------------------------------

describe('normalizeLegacyHtmlRedirects', () => {
  it('accepts .html sources and site-path targets, sorted by source', () => {
    expect(
      normalizeLegacyHtmlRedirects({
        '/guides/index.html': '/guides/',
        '/a/b.html': '/a/b/',
      }),
    ).toEqual([
      { from: '/a/b.html', to: '/a/b/' },
      { from: '/guides/index.html', to: '/guides/' },
    ]);
  });

  it('refuses a source that does not end in .html, is not site-absolute, or carries a query', () => {
    expect(() => normalizeLegacyHtmlRedirects({ '/a/b/': '/a/' })).toThrow(/must end in \.html/);
    expect(() => normalizeLegacyHtmlRedirects({ 'a/b.html': '/a/' })).toThrow(/must start with \//);
    expect(() => normalizeLegacyHtmlRedirects({ '/a.html?x=1': '/a/' })).toThrow(/query or fragment/);
  });

  it('refuses an empty or non-string target', () => {
    expect(() => normalizeLegacyHtmlRedirects({ '/a.html': '' })).toThrow(/target/);
    expect(() => normalizeLegacyHtmlRedirects({ '/a.html': 3 as unknown as string })).toThrow(/target/);
  });

  it('accepts an external https target as-is', () => {
    expect(normalizeLegacyHtmlRedirects({ '/a.html': 'https://example.com/x' })).toEqual([
      { from: '/a.html', to: 'https://example.com/x' },
    ]);
  });
});

describe('flattenLegacyChains', () => {
  it('points every stub at the end of its chain through the legacy map', () => {
    const flat = flattenLegacyChains([
      { from: '/a.html', to: '/b.html' },
      { from: '/b.html', to: '/c/' },
    ]);
    expect(flat).toEqual([
      { from: '/a.html', to: '/c/' },
      { from: '/b.html', to: '/c/' },
    ]);
  });

  it('keeps a fragment on the first hop', () => {
    expect(flattenLegacyChains([{ from: '/a.html', to: '/c/#part' }])).toEqual([{ from: '/a.html', to: '/c/#part' }]);
  });

  it('refuses a loop, naming it', () => {
    expect(() =>
      flattenLegacyChains([
        { from: '/a.html', to: '/b.html' },
        { from: '/b.html', to: '/a.html' },
      ]),
    ).toThrow(/loop.*\/a\.html/);
  });
});

describe('renderLegacyStub', () => {
  it('is noindex, canonical to the target, and has the shape the gate reads (domain root)', () => {
    const html = renderLegacyStub({ from: '/a/b.html', to: '/a/b/', base: '/', site: 'https://docs.example.test' });
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://docs.example.test/a/b/">');
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/a/b/">');
    expect(html).toContain('<title>Redirecting to: /a/b/</title>');
    expect(html).toContain('Redirecting from <code>/a/b.html</code> to <code>/a/b/</code>');
  });

  it('prefixes the base on the target and the source under a base path', () => {
    const html = renderLegacyStub({ from: '/a/b.html', to: '/a/b/', base: '/proj/', site: 'https://x.test' });
    expect(html).toContain('content="0;url=/proj/a/b/"');
    expect(html).toContain('<link rel="canonical" href="https://x.test/proj/a/b/">');
    expect(html).toContain('Redirecting from <code>/proj/a/b.html</code>');
  });

  it('uses a root-relative canonical when the site has no `site` URL', () => {
    expect(renderLegacyStub({ from: '/a.html', to: '/b/', base: '/' })).toContain('<link rel="canonical" href="/b/">');
  });

  it('escapes markup in a target', () => {
    const html = renderLegacyStub({ from: '/a.html', to: '/b/?q="x"<y>', base: '/' });
    expect(html).not.toContain('"x"<y>');
    expect(html).toContain('&quot;x&quot;&lt;y&gt;');
  });
});

describe('writeLegacyHtmlStubs', () => {
  it('writes each stub as a flat file at <dist>/<source>, not as a folder', () => {
    const dist = builtSite();
    const result = writeLegacyHtmlStubs(dist, [{ from: '/guides/how-to/accept.html', to: '/guides/how-to/accept/' }], {
      base: '/',
    });
    expect(result.written).toEqual(['/guides/how-to/accept.html']);
    const file = path.join(dist, 'guides/how-to/accept.html');
    expect(statSync(file).isFile()).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('url=/guides/how-to/accept/');
  });

  it('leaves a live page alone when the source is that page\'s own index.html', () => {
    const dist = builtSite();
    const before = readFileSync(path.join(dist, 'guides/index.html'), 'utf8');
    const result = writeLegacyHtmlStubs(dist, [{ from: '/guides/index.html', to: '/guides/' }], { base: '/' });
    expect(result.written).toEqual([]);
    expect(result.servedByPage).toEqual(['/guides/index.html']);
    expect(readFileSync(path.join(dist, 'guides/index.html'), 'utf8')).toBe(before);
  });

  it('writes a stub for `X/index.html` when `X/` is no longer a page', () => {
    const dist = builtSite();
    const result = writeLegacyHtmlStubs(dist, [{ from: '/old/index.html', to: '/guides/' }], { base: '/' });
    expect(result.written).toEqual(['/old/index.html']);
    expect(readFileSync(path.join(dist, 'old/index.html'), 'utf8')).toContain('url=/guides/');
  });

  it('refuses to overwrite a page or asset that is already at the source path', () => {
    const dist = builtSite();
    writeFile(dist, 'kept.html', '<html>an asset from public/</html>');
    expect(() => writeLegacyHtmlStubs(dist, [{ from: '/kept.html', to: '/guides/' }], { base: '/' })).toThrow(
      /\/kept\.html.*already/,
    );
    expect(() =>
      writeLegacyHtmlStubs(dist, [{ from: '/guides/index.html', to: '/guides/how-to/accept/' }], { base: '/' }),
    ).toThrow(/\/guides\/index\.html.*already/);
  });

  it('refuses a source whose path is taken by a folder (an Astro directory-form stub)', () => {
    const dist = builtSite();
    writeFile(dist, 'a/b.html/index.html', page('x'));
    expect(() => writeLegacyHtmlStubs(dist, [{ from: '/a/b.html', to: '/guides/' }], { base: '/' })).toThrow(
      /\/a\/b\.html.*folder/,
    );
  });
});

describe('refuseAstroHtmlRedirects', () => {
  it('throws for an Astro `redirects` key that ends in .html, naming the toolkit option', () => {
    expect(() => refuseAstroHtmlRedirects({ '/a/b.html': '/a/b/', '/ok/': '/a/' })).toThrow(
      /\/a\/b\.html[\s\S]*legacyHtmlRedirects/,
    );
  });
  it('accepts directory-URL keys and no redirects at all', () => {
    expect(() => refuseAstroHtmlRedirects({ '/old/': '/new/' })).not.toThrow();
    expect(() => refuseAstroHtmlRedirects(undefined)).not.toThrow();
  });
});

describe('mechanicalHtmlMap', () => {
  it('maps X.html to X/ and X/index.html to X/, and the root index to /', () => {
    const { map, skipped } = mechanicalHtmlMap([
      'https://docs.spec-kitty.ai/guides/how-to/accept.html',
      '/guides/index.html',
      '/index.html',
      '/assets/logo.png',
      '/already/',
      '# a comment',
      '',
    ]);
    expect(map).toEqual({
      '/guides/how-to/accept.html': '/guides/how-to/accept/',
      '/guides/index.html': '/guides/',
      '/index.html': '/',
    });
    expect(skipped).toEqual(['/assets/logo.png', '/already/']);
  });

  it('lets an override win for a page that moved, and keeps an override-only source', () => {
    const { map } = mechanicalHtmlMap(['/a.html', '/b.html'], { '/a.html': '/renamed/', '/gone.html': '/b/' });
    expect(map).toEqual({ '/a.html': '/renamed/', '/b.html': '/b/', '/gone.html': '/b/' });
  });

  it('CLI: writes the map as JSON from a baseline file', () => {
    const dir = makeTmpDir();
    writeFile(dir, 'baseline.txt', '/a.html\n/b/index.html\n');
    writeFile(dir, 'overrides.json', JSON.stringify({ '/a.html': '/z/' }));
    const r = spawnSync(
      process.execPath,
      [mapperPath, path.join(dir, 'baseline.txt'), '--overrides', path.join(dir, 'overrides.json'), '--out', path.join(dir, 'map.json')],
      { encoding: 'utf8' },
    );
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(path.join(dir, 'map.json'), 'utf8'))).toEqual({ '/a.html': '/z/', '/b/index.html': '/b/' });
  });
});

// -- the coverage gate -------------------------------------------------------

describe('redirect-coverage gate: .html sources', () => {
  it('maps an .html URL to the flat file GitHub Pages serves for it', () => {
    expect(urlToDistFile('/d', '/a/b.html')).toBe(path.join('/d', 'a/b.html'));
    expect(urlToDistFile('/d', '/a/index.html')).toBe(path.join('/d', 'a/index.html'));
    expect(urlToDistFile('/d', '/a/b/')).toBe(path.join('/d', 'a/b/index.html'));
  });

  for (const base of ['/', '/proj/']) {
    it(`covers every legacy URL through its flat stub (base ${base})`, () => {
      const dist = builtSite();
      writeLegacyHtmlStubs(
        dist,
        flattenLegacyChains([
          { from: '/guides/how-to/accept.html', to: '/guides/how-to/accept/' },
          { from: '/guides/index.html', to: '/guides/' },
          { from: '/old/accept.html', to: '/guides/how-to/accept.html' },
          { from: '/index.html', to: '/' },
        ]),
        { base, site: 'https://docs.example.test' },
      );
      const urls = ['/guides/how-to/accept.html', '/guides/index.html', '/old/accept.html', '/index.html'];
      const result = checkCoverage(dist, urls);
      expect(result.uncovered).toEqual([]);
      expect(result.deadStubs).toEqual([]);
      expect(result.ok).toBe(true);
      // And through the GitHub Pages model: each URL is a 200 for its own file,
      // then one meta refresh to the live page.
      const prefix = base.replace(/\/$/, '');
      for (const url of urls) {
        const res = browse(dist, url, prefix);
        expect(res.status, `${url}: ${res.hops.join(' -> ')}`).toBe(200);
        expect(res.hops.length, `${url}: ${res.hops.join(' -> ')}`).toBeLessThanOrEqual(2);
      }
    });
  }

  it('finds the base of a `/x/index.html` stub reached through the stub walk as `/x/` (base path)', () => {
    const dist = builtSite();
    writeLegacyHtmlStubs(dist, [{ from: '/retired/index.html', to: '/guides/' }], { base: '/proj' });
    expect(redirectStubUrls(dist)).toEqual(['/retired/']);
    expect(checkCoverage(dist, ['/retired/index.html']).ok).toBe(true);
    expect(stripKnownBase('/proj/retired/index.html', '/retired/', '/proj/guides/')).toBe('/guides/');
  });

  it('follows a chain that crosses from a flat stub into a directory redirect', () => {
    const dist = builtSite();
    writeFile(
      dist,
      'renamed/index.html',
      '<!doctype html><title>Redirecting to: /guides/</title><meta http-equiv="refresh" content="0;url=/guides/">',
    );
    writeLegacyHtmlStubs(dist, [{ from: '/x.html', to: '/renamed/' }], { base: '/' });
    const v = resolveVerdict(dist, '/x.html');
    expect(v.covered).toBe(true);
    expect(v.chain).toEqual([
      { from: '/x.html', to: '/renamed/' },
      { from: '/renamed/', to: '/guides/' },
    ]);
  });

  it('fails on a baselined .html URL with no stub', () => {
    const dist = builtSite();
    const result = checkCoverage(dist, ['/guides/how-to/accept.html']);
    expect(result.ok).toBe(false);
    expect(result.uncovered[0]).toMatchObject({ url: '/guides/how-to/accept.html', reason: 'no page and no redirect' });
  });

  it('fails on an .html stub whose target is dead, baselined or not', () => {
    const dist = builtSite();
    writeLegacyHtmlStubs(dist, [{ from: '/a.html', to: '/nowhere/' }], { base: '/' });
    const result = checkCoverage(dist, ['/a.html']);
    expect(result.uncovered[0]).toMatchObject({ reason: 'redirect target is dead', failingTarget: '/nowhere/' });
    expect(redirectStubUrls(dist)).toEqual(['/a.html']);
    expect(checkCoverage(dist, []).deadStubs.map((r) => r.url)).toEqual(['/a.html']);
  });

  it('does not count an Astro directory-form stub (`a/b.html/index.html`) as covering /a/b.html', () => {
    const dist = builtSite();
    writeFile(
      dist,
      'a/b.html/index.html',
      '<!doctype html><title>Redirecting to: /guides/</title><meta http-equiv="refresh" content="0;url=/guides/">',
    );
    expect(inspectDistUrl(dist, '/a/b.html', undefined)).toMatchObject({ kind: 'missing' });
    const v = resolveVerdict(dist, '/a/b.html');
    expect(v.covered).toBe(false);
    expect(v.reason).toMatch(/directory-form stub.*a\/b\.html\/index\.html.*legacyHtmlRedirects/);
  });

  it('CLI: exits 1 naming a missing .html source, 0 once the stub is written', () => {
    const dist = builtSite();
    const dir = makeTmpDir();
    writeFile(dir, 'baseline.txt', '/guides/how-to/accept.html\n/guides/\n');
    // A dist with no Astro config above it: `--env-dir false` skips the config read.
    const run = () =>
      spawnSync(process.execPath, [gatePath, path.join(dir, 'baseline.txt'), dist, '--env-dir', 'false'], {
        encoding: 'utf8',
        env: { ...process.env, DK_PUBLISH_DRAFTS: 'on' },
      });
    const red = run();
    expect(red.status, red.stdout + red.stderr).toBe(1);
    expect(red.stderr).toContain('/guides/how-to/accept.html: no page and no redirect');
    writeLegacyHtmlStubs(dist, [{ from: '/guides/how-to/accept.html', to: '/guides/how-to/accept/' }], { base: '/' });
    const green = run();
    expect(green.status, green.stdout + green.stderr).toBe(0);
    expect(green.stdout).toContain('2/2 baselined URL(s) covered');
  });
});
