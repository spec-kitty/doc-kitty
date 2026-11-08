/**
 * The page-format helpers (page-chrome WP09, FR-001, FR-003, FR-019, FR-021 to FR-024).
 * No `astro:content` mock: that the module loads here proves it is pure.
 */
import { describe, expect, it } from 'vitest';
import type { DocKittyFrontmatter } from '../lib/metadata.js';
import { headAlternates, machineEntryPoints, pageFormatLinks, sourceLink, type PageEntry } from '../lib/page-formats.js';
import { atomEligible } from '../lib/routes/atom-eligible.js';
import type { ServedSurfaces } from '../lib/served-surfaces.js';

const ALL: ServedSurfaces = {
  llms: true,
  agentIndex: true,
  agentPages: true,
  rss: true,
  bibliography: true,
  scenarios: true,
  contentGraph: true,
  pageAtom: true,
  sitemap: true,
  okf: true,
  openapi: false,
};
const ATOM_ON = { pageFormats: { atom: true } };
const STAMP = 'doc-kitty-glossary/0.4.0';

function page(id: string, filePath: string | undefined, data: Record<string, unknown> = {}): PageEntry {
  return {
    id,
    ...(filePath === undefined ? {} : { filePath }),
    data: { title: 'T', doc_status: 'active', updated: '2026-10-31', ...data } as unknown as DocKittyFrontmatter,
  };
}
const links = (entry: PageEntry | undefined, over: Partial<Parameters<typeof pageFormatLinks>[0]> = {}) =>
  pageFormatLinks({ entry, surfaces: ALL, options: ATOM_ON, base: '/', docsDir: 'docs', ...over }).map((l) => `${l.label} ${l.href}`);

describe('pageFormatLinks', () => {
  it.each([
    ['a plain page', page('guides/a', 'docs/guides/a.md'), {}, ['JSON /api/pages/guides/a.json', 'OKF /okf/guides/a.md', 'Atom /api/pages/guides/a.atom.xml']],
    ['a nested README', page('guides/b', 'docs/guides/b/README.md'), {}, ['JSON /api/pages/guides/b.json', 'OKF /okf/guides/b/index.md', 'Atom /api/pages/guides/b.atom.xml']],
    ['a custom index basename', page('guides/b', 'docs/guides/b/_index.mdx'), { indexBasename: '_index' }, ['JSON /api/pages/guides/b.json', 'OKF /okf/guides/b/index.md', 'Atom /api/pages/guides/b.atom.xml']],
    ['a README that is not an index here', page('guides/README', 'docs/guides/README.md'), { indexBasename: 'index' }, ['JSON /api/pages/guides/README.json', 'OKF /okf/guides/README.md', 'Atom /api/pages/guides/README.atom.xml']],
    ['the root page', page('index', 'docs/README.md'), {}, ['JSON /api/pages/home.json', 'OKF /okf/index.md', 'Atom /api/pages/home.atom.xml']],
    ['a based site', page('guides/a', 'docs/guides/a.md'), { base: '/doc-kitty/' }, ['JSON /doc-kitty/api/pages/guides/a.json', 'OKF /doc-kitty/okf/guides/a.md', 'Atom /doc-kitty/api/pages/guides/a.atom.xml']],
    ['a docs folder that is the project root', page('guides/a', 'guides/a.md'), { docsDir: '' }, ['JSON /api/pages/guides/a.json', 'OKF /okf/guides/a.md', 'Atom /api/pages/guides/a.atom.xml']],
    ['a file name that needs encoding', page('guides/a-b', 'docs/guides/a b.md'), {}, ['JSON /api/pages/guides/a-b.json', 'OKF /okf/guides/a%20b.md', 'Atom /api/pages/guides/a-b.atom.xml']],
  ])('%s', (_name, entry, over, expected) => {
    expect(links(entry, over)).toEqual(expected);
  });

  it('has none for a page that opted out of agent discovery, while its source link stays', () => {
    const hidden = page('guides/a', 'docs/guides/a.md', { agent: { discoverable: false } });
    expect(links(hidden)).toEqual([]);
    expect(links(page('guides/a', 'docs/guides/a.md', { agent: { discoverable: true } }))).toHaveLength(3);
    expect(sourceLink(hidden, { provider: 'github', repo: 'o/r', branch: 'main' })).toBe('https://github.com/o/r/blob/main/docs/guides/a.md');
  });

  it('gives each link its media type', () => {
    const types = pageFormatLinks({ entry: page('a', 'docs/a.md'), surfaces: ALL, options: ATOM_ON, base: '/', docsDir: 'docs' }).map((l) => l.type);
    expect(types).toEqual(['application/json', 'text/markdown', 'application/atom+xml;type=entry']);
  });

  it('has nothing for a page outside the collection, or before detection has run', () => {
    expect(links(undefined)).toEqual([]);
    expect(links(page('a', 'docs/a.md'), { surfaces: undefined })).toEqual([]);
  });

  it('has nothing for a draft (FR-022), which the published control does', () => {
    expect(links(page('a', 'docs/a.md', { doc_status: 'draft' }))).toEqual([]);
    expect(links(page('a', 'docs/a.md'))).toHaveLength(3);
  });

  it('keeps a draft-status root, as the loader and the Head carrier do', () => {
    expect(links(page('index', 'docs/README.md', { doc_status: 'draft' })).map((l) => l.split(' ')[0])).toEqual(['JSON', 'OKF']);
  });

  it('leaves out what the site does not serve', () => {
    const entry = page('a', 'docs/a.md');
    expect(links(entry, { surfaces: { ...ALL, agentPages: false } }).map((l) => l.split(' ')[0])).toEqual(['OKF', 'Atom']);
    expect(links(entry, { surfaces: { ...ALL, pageAtom: false } }).map((l) => l.split(' ')[0])).toEqual(['JSON', 'OKF']);
    expect(links(entry, { options: { pageFormats: { atom: false } } }).map((l) => l.split(' ')[0])).toEqual(['JSON', 'OKF']);
  });

  it('asks atomEligible for Atom: an undated page gets none, so a link and an entry agree', () => {
    const undated = page('a', 'docs/a.md', { updated: undefined });
    expect(atomEligible(undated)).toBe(false);
    expect(links(undated).map((l) => l.split(' ')[0])).toEqual(['JSON', 'OKF']);
  });

  it('has no OKF link for a file outside the docs folder, or no file', () => {
    expect(links(page('a', 'elsewhere/a.md')).map((l) => l.split(' ')[0])).toEqual(['JSON', 'Atom']);
    expect(links(page('a', undefined)).map((l) => l.split(' ')[0])).toEqual(['JSON', 'Atom']);
  });
});

describe('machineEntryPoints', () => {
  it('lists every served surface, in order', () => {
    expect(machineEntryPoints(ALL).map((l) => l.path)).toEqual([
      '/llms.txt',
      '/api/index.json',
      '/api/content-graph.json',
      '/rss.xml',
      '/sitemap-index.xml',
      '/api/bibliography.json',
      '/api/scenarios.json',
      '/okf/index.md',
    ]);
  });
  it('leaves out each one the site does not serve', () => {
    for (const [surface, path] of [['rss', '/rss.xml'], ['sitemap', '/sitemap-index.xml'], ['bibliography', '/api/bibliography.json'], ['scenarios', '/api/scenarios.json']] as const) {
      const paths = machineEntryPoints({ ...ALL, [surface]: false }).map((l) => l.path);
      expect(paths).not.toContain(path);
      expect(paths).toHaveLength(7);
    }
  });
  it('has nothing before detection has run', () => {
    expect(machineEntryPoints(undefined)).toEqual([]);
  });
});

describe('headAlternates', () => {
  const formats = pageFormatLinks({ entry: page('a', 'docs/a.md'), surfaces: ALL, options: ATOM_ON, base: '/x', docsDir: 'docs' });
  it('is the feeds, then one per format, in that order', () => {
    expect(headAlternates(ALL, formats, '/x').map((l) => l.href)).toEqual([
      '/x/rss.xml',
      '/x/llms.txt',
      '/x/api/pages/a.json',
      '/x/okf/a.md',
      '/x/api/pages/a.atom.xml',
    ]);
  });
  it('leaves out a feed the site does not serve (FR-021)', () => {
    expect(headAlternates({ ...ALL, rss: false }, [], '/').map((l) => l.href)).toEqual(['/llms.txt']);
    expect(headAlternates({ ...ALL, llms: false }, [], '/').map((l) => l.href)).toEqual(['/rss.xml']);
  });
});

describe('sourceLink', () => {
  const entry = page('guides/a', 'docs/guides/a.md');
  it.each([
    ['github', { provider: 'github', repo: 'o/r', branch: 'main' }, 'https://github.com/o/r/blob/main/docs/guides/a.md'],
    ['gitlab', { provider: 'gitlab', repo: 'g/s/r', branch: 'main' }, 'https://gitlab.com/g/s/r/-/blob/main/docs/guides/a.md'],
    ['bitbucket', { provider: 'bitbucket', repo: 'o/r', branch: 'main' }, 'https://bitbucket.org/o/r/src/main/docs/guides/a.md'],
    ['a siteDir', { provider: 'github', repo: 'o/r', branch: 'main', siteDir: 'example' }, 'https://github.com/o/r/blob/main/example/docs/guides/a.md'],
    ['a siteDir with slashes', { provider: 'github', repo: 'o/r', branch: 'main', siteDir: './site/docs-site/' }, 'https://github.com/o/r/blob/main/site/docs-site/docs/guides/a.md'],
    ['a bare dot siteDir', { provider: 'github', repo: 'o/r', branch: 'main', siteDir: '.' }, 'https://github.com/o/r/blob/main/docs/guides/a.md'],
    ['a ./ siteDir', { provider: 'github', repo: 'o/r', branch: 'main', siteDir: './' }, 'https://github.com/o/r/blob/main/docs/guides/a.md'],
    ['a branch with a slash', { provider: 'github', repo: 'o/r', branch: 'release/1.0', siteDir: 'example' }, 'https://github.com/o/r/blob/release/1.0/example/docs/guides/a.md'],
  ] as const)('%s', (_name, repository, url) => {
    expect(sourceLink(entry, repository)).toBe(url);
  });

  it('encodes path segments', () => {
    expect(sourceLink(page('a', 'docs/a b#c.md'), { provider: 'github', repo: 'o/r', branch: 'main' })).toBe('https://github.com/o/r/blob/main/docs/a%20b%23c.md');
  });

  const REPO = { provider: 'github', repo: 'o/r', branch: 'main' } as const;
  it('has none without repository settings (FR-024)', () => {
    expect(sourceLink(entry, undefined)).toBeUndefined();
  });
  it('has none on a generated page (FR-024), which an authored one does', () => {
    expect(sourceLink(page('a', 'docs/a.md', { generated: { by: STAMP, at: '2026-10-31' } }), REPO)).toBeUndefined();
    expect(sourceLink(page('a', 'docs/a.md', { generated: { by: 'someone', at: '2026-10-31' } }), REPO), 'not a generator stamp').toBeDefined();
    expect(sourceLink(page('a', 'docs/a.md'), REPO)).toBeDefined();
  });
  it('has none with no file, no collection entry, or on a draft', () => {
    expect(sourceLink(page('a', undefined), REPO)).toBeUndefined();
    expect(sourceLink(undefined, REPO)).toBeUndefined();
    expect(sourceLink(page('a', 'docs/a.md', { doc_status: 'draft' }), REPO)).toBeUndefined();
  });
});
