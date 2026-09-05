/**
 * ATDD for the base-aware, built-output link gate (link-integrity-01M1PSEH,
 * WP02 T009/T011 — #62, FR-005/NFR-003/NFR-004).
 *
 * Red-first per the WP: a base-less internal link and a bare-relative
 * trailing-slash-directory trap must fail; a correctly base-prefixed link and
 * a correct relative directory link must pass; external/anchor/protocol-
 * relative links are never resolved at all.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  extractHrefs,
  isSkippableHref,
  pageRouteFor,
  resolveHref,
  stripBase,
  distCandidatesFor,
  distFileExists,
  findBrokenLinks,
  findBaselessFeedUrls,
} from '../scripts/assert-no-broken-links.mjs';

const gatePath = fileURLToPath(new URL('../scripts/assert-no-broken-links.mjs', import.meta.url));

// -- fixture helpers ----------------------------------------------------------

const tmpDirs: string[] = [];

function makeTmpDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'no-broken-links-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function page(title: string, links: string[]): string {
  const anchors = links.map((href) => `<a href="${href}">${href}</a>`).join('\n');
  return `<!doctype html>\n<title>${title}</title>\n<body><h1>${title}</h1>\n${anchors}\n</body>`;
}

/** Write `<distDir>/<relPath>` (directories created as needed). */
function writeDistFile(distDir: string, relPath: string, content: string): void {
  const file = path.join(distDir, relPath);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

// -- unit-level helpers -------------------------------------------------------

describe('extractHrefs', () => {
  it('extracts every <a href> value, double- and single-quoted', () => {
    const html = `<a href="/one/">One</a> text <a href='/two/'>Two</a>`;
    expect(extractHrefs(html)).toEqual(['/one/', '/two/']);
  });

  it('ignores non-anchor tags and anchors with no href', () => {
    const html = `<link rel="stylesheet" href="/style.css"><a id="top">no href</a>`;
    expect(extractHrefs(html)).toEqual([]);
  });
});

describe('isSkippableHref', () => {
  it.each([
    ['', true],
    ['#top', true],
    ['#_top', true],
    ['//example.com/path', true],
    ['http://example.com', true],
    ['https://example.com', true],
    ['mailto:hi@example.com', true],
    ['tel:+15551234567', true],
    ['javascript:void(0)', true],
    ['/architecture/overview/', false],
    ['./child/', false],
    ['sibling', false],
  ])('%s -> %s', (href, expected) => {
    expect(isSkippableHref(href)).toBe(expected);
  });
});

describe('pageRouteFor', () => {
  it('maps the root index.html to "<base>/"', () => {
    expect(pageRouteFor('index.html', '/doc-kitty')).toBe('/doc-kitty/');
  });

  it('maps a nested index.html to its directory route', () => {
    expect(pageRouteFor('architecture/overview/index.html', '/doc-kitty')).toBe(
      '/doc-kitty/architecture/overview/',
    );
  });

  it('maps a non-index file by dropping the extension only (no implied trailing slash)', () => {
    expect(pageRouteFor('404.html', '/doc-kitty')).toBe('/doc-kitty/404');
  });

  it('is a no-op prefix with an empty base', () => {
    expect(pageRouteFor('glossary/index.html', '')).toBe('/glossary/');
  });
});

describe('resolveHref — RFC 3986 resolution via the page\'s own trailing-slash directory route', () => {
  it('a bare relative link resolves as a CHILD of the current page (the class-A trap)', () => {
    // This is exactly why check-links.mjs's old filesystem-relative resolution
    // missed #61 Class A: on disk, blocks-demonstrator.md sits NEXT TO
    // superseded-note.md, but the served URL nests it underneath because the
    // page's own route ends in a trailing slash.
    const resolved = resolveHref('blocks-demonstrator', '/doc-kitty/architecture/superseded-note/');
    expect(resolved).toBe('/doc-kitty/architecture/superseded-note/blocks-demonstrator');
  });

  it('a "../sibling/" relative link correctly reaches a true sibling page', () => {
    const resolved = resolveHref('../blocks-demonstrator/', '/doc-kitty/architecture/superseded-note/');
    expect(resolved).toBe('/doc-kitty/architecture/blocks-demonstrator/');
  });

  it('a "./child/" relative link from a directory-index page reaches its real child route', () => {
    const resolved = resolveHref('./missions/mission-alpha/', '/doc-kitty/plans/');
    expect(resolved).toBe('/doc-kitty/plans/missions/mission-alpha/');
  });

  it('a root-absolute href resolves against the origin, independent of the page route', () => {
    const resolved = resolveHref('/architecture/overview/', '/doc-kitty/glossary/hr/');
    expect(resolved).toBe('/architecture/overview/');
  });

  it('strips a query and a fragment from the resolved pathname', () => {
    const resolved = resolveHref('/glossary/shipping/?x=1#cargo', '/doc-kitty/');
    expect(resolved).toBe('/glossary/shipping/');
  });
});

describe('stripBase', () => {
  it('strips the base, keeping the leading slash of the remainder', () => {
    expect(stripBase('/doc-kitty/architecture/overview/', '/doc-kitty')).toBe('/architecture/overview/');
  });

  it('maps the bare base to "/"', () => {
    expect(stripBase('/doc-kitty', '/doc-kitty')).toBe('/');
  });

  it('returns null for a path that does not carry the configured base (#61 signal)', () => {
    expect(stripBase('/architecture/overview/', '/doc-kitty')).toBeNull();
  });

  it('is a no-op with no base configured', () => {
    expect(stripBase('/architecture/overview/', '')).toBe('/architecture/overview/');
  });
});

describe('distCandidatesFor', () => {
  it('a directory route maps to its index.html', () => {
    expect(distCandidatesFor('/architecture/overview/')).toEqual([
      path.posix.join('architecture/overview', 'index.html'),
    ]);
  });

  it('the root route maps to the top-level index.html', () => {
    expect(distCandidatesFor('/')).toEqual(['index.html']);
  });

  it('a route with no trailing slash tries the literal file first, then its index.html', () => {
    expect(distCandidatesFor('/rss.xml')).toEqual(['rss.xml', path.posix.join('rss.xml', 'index.html')]);
  });
});

describe('distFileExists', () => {
  it('true when the directory-index candidate exists', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, path.join('architecture', 'overview', 'index.html'), page('Overview', []));
    expect(distFileExists(dist, '/architecture/overview/')).toBe(true);
  });

  it('false when neither candidate exists', () => {
    const dist = makeTmpDir();
    expect(distFileExists(dist, '/never/built/')).toBe(false);
  });
});

// -- end-to-end: findBrokenLinks over a small built dist tree ----------------

describe('findBrokenLinks — base-aware built-output walk', () => {
  it('PASS: a correctly base-prefixed link and a correct relative directory link both resolve', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'index.html',
      page('Home', ['/doc-kitty/architecture/overview/', './architecture/', 'https://example.com', '#top']),
    );
    writeDistFile(dist, path.join('architecture', 'index.html'), page('Architecture', []));
    writeDistFile(dist, path.join('architecture', 'overview', 'index.html'), page('Overview', []));

    expect(findBrokenLinks(dist, '/doc-kitty')).toEqual([]);
  });

  it('FAIL (#61): a base-less internal link is reported distinctly from an ordinary missing target', () => {
    const dist = makeTmpDir();
    // The target page DOES exist in dist — proving this is caught because the
    // href lacks the base, not because the page is missing (the old,
    // filesystem-based gate would have called this resolved).
    writeDistFile(dist, 'index.html', page('Home', ['/architecture/overview/']));
    writeDistFile(dist, path.join('architecture', 'overview', 'index.html'), page('Overview', []));

    const failures = findBrokenLinks(dist, '/doc-kitty');

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ page: 'index.html', href: '/architecture/overview/' });
    expect(failures[0].reason).toMatch(/base-less|#61/);
  });

  it('FAIL (class-A trap): a bare relative link that resolves as a child 404s', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      path.join('architecture', 'superseded-note', 'index.html'),
      page('Superseded', ['blocks-demonstrator']),
    );
    writeDistFile(dist, path.join('architecture', 'blocks-demonstrator', 'index.html'), page('Blocks', []));

    const failures = findBrokenLinks(dist, '/doc-kitty');

    expect(failures).toHaveLength(1);
    expect(failures[0].resolved).toBe('/doc-kitty/architecture/superseded-note/blocks-demonstrator');
    expect(failures[0].reason).toMatch(/no matching page or file/);
  });

  it('skips external, mailto, tel, javascript, protocol-relative, and pure-anchor hrefs entirely', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'index.html',
      page('Home', [
        'https://example.com',
        'mailto:hi@example.com',
        'tel:+15551234567',
        'javascript:void(0)',
        '//example.com/path',
        '#top',
      ]),
    );

    expect(findBrokenLinks(dist, '/doc-kitty')).toEqual([]);
  });

  it('never flags the ADR template page\'s copy-me placeholder link', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, path.join('adr', 'template', 'index.html'), page('Template', ['XXXX-title.md']));

    expect(findBrokenLinks(dist, '/doc-kitty')).toEqual([]);
  });

  it('a base-agnostic gate (base "") only requires the literal route to exist', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, 'index.html', page('Home', ['/architecture/overview/']));
    writeDistFile(dist, path.join('architecture', 'overview', 'index.html'), page('Overview', []));

    expect(findBrokenLinks(dist, '')).toEqual([]);
  });
});

// -- findBaselessFeedUrls — RSS/llms.txt/agent-API absolute-URL scan (pre-PR
// review finding, #61/#62 completeness gap) ---------------------------------

describe('findBaselessFeedUrls — RSS/llms.txt/agent-API internal absolute URLs', () => {
  const SITE = 'https://spec-kitty.github.io';

  it('FAIL: a base-less internal <link> in rss.xml is reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/guides/markua-malformed/</link></channel></rss>',
    );

    const failures = findBaselessFeedUrls(dist, '/doc-kitty', SITE);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      file: 'rss.xml',
      url: 'https://spec-kitty.github.io/guides/markua-malformed/',
    });
    expect(failures[0].reason).toMatch(/base|#61|#62/);
  });

  it('PASS: a base-prefixed internal <link> in rss.xml is not reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/doc-kitty/guides/markua-malformed/</link></channel></rss>',
    );

    expect(findBaselessFeedUrls(dist, '/doc-kitty', SITE)).toEqual([]);
  });

  it('FAIL: a base-less URL in llms.txt (the machine-index pointer) is reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'llms.txt',
      '# Docs\n\nFull machine index: https://spec-kitty.github.io/api/index.json\n',
    );

    const failures = findBaselessFeedUrls(dist, '/doc-kitty', SITE);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      file: 'llms.txt',
      url: 'https://spec-kitty.github.io/api/index.json',
    });
  });

  it('PASS: a base-prefixed URL in llms.txt is not reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'llms.txt',
      '# Docs\n\nFull machine index: https://spec-kitty.github.io/doc-kitty/api/index.json\n',
    );

    expect(findBaselessFeedUrls(dist, '/doc-kitty', SITE)).toEqual([]);
  });

  it('FAIL: a base-less url/source field nested under api/**/*.json is reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      path.join('api', 'pages', 'guides', 'markua-malformed.json'),
      JSON.stringify({
        route: '/guides/markua-malformed/',
        url: 'https://spec-kitty.github.io/guides/markua-malformed/',
      }),
    );

    const failures = findBaselessFeedUrls(dist, '/doc-kitty', SITE);

    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      file: path.join('api', 'pages', 'guides', 'markua-malformed.json'),
      url: 'https://spec-kitty.github.io/guides/markua-malformed/',
    });
  });

  it('PASS: a base-prefixed url/source field under api/index.json is not reported', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      path.join('api', 'index.json'),
      JSON.stringify({
        pages: [
          {
            route: '/guides/markua-malformed/',
            url: 'https://spec-kitty.github.io/doc-kitty/guides/markua-malformed/',
            source: 'https://spec-kitty.github.io/doc-kitty/api/pages/guides/markua-malformed.json',
          },
        ],
      }),
    );

    expect(findBaselessFeedUrls(dist, '/doc-kitty', SITE)).toEqual([]);
  });

  it('ignores an external absolute URL (different origin) entirely', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'llms.txt',
      '# Docs\n\n- [External](https://example.com/mac.jpg)\n',
    );

    expect(findBaselessFeedUrls(dist, '/doc-kitty', SITE)).toEqual([]);
  });

  it('a base-agnostic gate (base "") requires no prefix at all', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/guides/markua-malformed/</link></channel></rss>',
    );

    expect(findBaselessFeedUrls(dist, '', SITE)).toEqual([]);
  });

  it('with no configured site origin, nothing is scanned (opt-in — CI always passes --site)', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/guides/markua-malformed/</link></channel></rss>',
    );

    expect(findBaselessFeedUrls(dist, '/doc-kitty', '')).toEqual([]);
  });

  it('is a no-op when rss.xml/llms.txt/api are absent (no build-artifact assumption)', () => {
    const dist = makeTmpDir();
    expect(findBaselessFeedUrls(dist, '/doc-kitty', SITE)).toEqual([]);
  });
});

// -- CLI (assert-no-broken-links.mjs run directly) ---------------------------

describe('CLI (assert-no-broken-links.mjs run directly)', () => {
  it('exits 0 and prints OK when every internal link resolves', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, 'index.html', page('Home', ['/doc-kitty/adr/']));
    writeDistFile(dist, path.join('adr', 'index.html'), page('ADR', []));

    const result = spawnSync('node', [gatePath, dist, '--base', '/doc-kitty'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK/);
  });

  it('exits non-zero and names the page, href, and reason for a broken link', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, 'index.html', page('Home', ['/architecture/overview/']));

    const result = spawnSync('node', [gatePath, dist, '--base', '/doc-kitty'], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('index.html');
    expect(result.stderr).toContain('/architecture/overview/');
  });

  it('exits 2 with a usage message when the dist dir arg is missing', () => {
    const result = spawnSync('node', [gatePath], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Usage/);
  });

  it('exits non-zero and names the file/url when --site is passed and a feed URL is base-less', () => {
    const dist = makeTmpDir();
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/guides/markua-malformed/</link></channel></rss>',
    );

    const result = spawnSync(
      'node',
      [gatePath, dist, '--base', '/doc-kitty', '--site', 'https://spec-kitty.github.io'],
      { encoding: 'utf8' },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('rss.xml');
    expect(result.stderr).toContain('https://spec-kitty.github.io/guides/markua-malformed/');
  });

  it('exits 0 when --site is passed and every feed/agent-API URL carries the base', () => {
    const dist = makeTmpDir();
    writeDistFile(dist, 'index.html', page('Home', []));
    writeDistFile(
      dist,
      'rss.xml',
      '<rss><channel><link>https://spec-kitty.github.io/doc-kitty/</link></channel></rss>',
    );

    const result = spawnSync(
      'node',
      [gatePath, dist, '--base', '/doc-kitty', '--site', 'https://spec-kitty.github.io'],
      { encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/OK/);
  });

  it('exits 2 when the dist dir does not exist (never builds itself)', () => {
    const dist = makeTmpDir();
    const result = spawnSync('node', [gatePath, path.join(dist, 'no-such-dist')], { encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/dist dir not found/);
  });
});
