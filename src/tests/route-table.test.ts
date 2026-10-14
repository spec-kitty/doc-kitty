/**
 * The shared file-to-route rule (FR-010, C-002, NFR-001): one rule, one walk.
 *
 * The loader's ids (`resolveIndexEntries`), the route table, the draft routes
 * and the sidebar's index detection used to be separate copies that disagreed
 * for a folder holding two index files and for a site that does not list
 * `index`. The agreement test builds that folder, with a draft among the two,
 * and demands one answer from all four.
 *
 * Mission: generated-page-and-link-integrity-01M4VB0N, WP01.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildRouteTable,
  generatedIndexBasename,
  resolveIndexEntries,
  resolveRelativeDocLink,
  routeOfSlug,
} from '../lib/vocabulary-core.mjs';
import { walkMarkdownPaths } from '../lib/docs-walk.mjs';
import { draftRoutesOf, unpublishedDraftPaths } from '../lib/draft-publication.mjs';
import { routeShapingSource } from '../lib/config.js';
import { docKittyDocsLoader } from '../lib/schema.js';

const SETTINGS: [string, string | string[] | undefined][] = [
  ['default (README)', undefined],
  ['index', 'index'],
  ['README then index', ['README', 'index']],
  ['index then README', ['index', 'README']],
];

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

/** A site whose `docs/` holds the given files: path -> `doc_status`. Each title is its own path. */
function site(files: Record<string, 'draft' | 'active'>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-route-table-'));
  roots.push(root);
  for (const [rel, status] of Object.entries(files)) {
    const abs = path.join(root, 'docs', rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, `---\ntitle: ${rel}\ndoc_status: ${status}\n---\n\nBody.\n`);
  }
  return root;
}

describe('one route rule for every consumer', () => {
  // `guides/` holds both index names and the `index.md` is a draft: under
  // `['index','README']` the draft is the folder index, under the others it is
  // an ordinary page or the demoted duplicate.
  const FILES = {
    'README.md': 'active',
    'guides/README.md': 'active',
    'guides/index.md': 'draft',
    'guides/deploy.md': 'active',
    'other/index.md': 'active',
    'other/draft-page.md': 'draft',
  } as const;

  // Literal draft routes per setting (not derived from the table). `guides/index.md` is a draft:
  // it is a draft route only where no published file shares `/guides/`.
  const DRAFT_ROUTES: Record<string, string[]> = {
    'default (README)': ['/other/draft-page/'],
    index: ['/guides/', '/other/draft-page/'],
    'README then index': ['/other/draft-page/'],
    'index then README': ['/guides/', '/other/draft-page/'],
  };

  it.each(SETTINGS)('the loader, route table, draft routes and sidebar agree: %s', (_name, indexBasename) => {
    const root = site(FILES);
    const docs = path.join(root, 'docs');
    const paths = walkMarkdownPaths(docs);
    expect([...paths].sort()).toEqual(Object.keys(FILES).sort());
    // The table is built from this walk, so a loader pattern that narrowed the load would list unloaded pages.
    expect(() => docKittyDocsLoader({ base: docs, pattern: 'x/*.md' })).toThrow(/pattern/);

    const { ids } = resolveIndexEntries(paths, { indexBasename });
    const { routes } = buildRouteTable(paths, { indexBasename });
    for (const rel of paths) expect(routes[rel], rel).toBe(routeOfSlug(ids.get(rel)!));

    // draft routes: literal, the root never among them, a route shared with a published file not a draft.
    expect([...draftRoutesOf(docs, indexBasename)].sort()).toEqual(DRAFT_ROUTES[_name]);

    // sidebar: a directory's group is labelled by the page that is its index per the rule.
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const source = routeShapingSource({
      docsDir: 'docs',
      base: '/',
      indexBasename,
      shapeSidebar: true,
      pagination: true,
    });
    const data = JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
    const expectedGroups = paths
      .filter((rel) => ids.get(rel) !== '' && ids.get(rel) !== rel.replace(/\.mdx?$/i, ''))
      .map((rel) => [ids.get(rel)!, rel])
      .sort(([a], [b]) => (a < b ? -1 : 1));
    expect(data.directoryMeta.map(([dir, meta]: [string, { label: string }]) => [dir, meta.label])).toEqual(
      expectedGroups,
    );
  });

  it.each([
    ['README', 'README'],
    ['README,index', ['README', 'index']],
  ] as const)('a draft index.md sharing its route with a published README.md does not make the route a draft: %s', (_n, indexBasename) => {
    const docs = path.join(site({ 'README.md': 'active', 'x/README.md': 'active', 'x/index.md': 'draft' }), 'docs');
    expect([...draftRoutesOf(docs, indexBasename as string | string[])]).toEqual([]);
    // The mirror: file paths, so the published sibling stays resolvable.
    expect(unpublishedDraftPaths(docs, false, indexBasename as string | string[])).toEqual(['x/index.md']);
    const { routes } = buildRouteTable(walkMarkdownPaths(docs), {
      indexBasename: indexBasename as string | string[],
      unpublishedPaths: ['x/index.md'],
    });
    expect(routes['x/README.md']).toBe('/x/');
    expect(routes['x/index.md']).toBeUndefined();
  });

  it('a draft index.md that is the only page in its folder on a README-only site is a draft route', () => {
    const docs = path.join(site({ 'README.md': 'active', 'y/index.md': 'draft' }), 'docs');
    expect([...draftRoutesOf(docs, 'README')]).toEqual(['/y/']);
  });

  it('walks a symlink loop once instead of overflowing the stack', () => {
    const docs = path.join(site({ 'a/page.md': 'active' }), 'docs');
    symlinkSync(docs, path.join(docs, 'a', 'back'), 'dir');
    expect(walkMarkdownPaths(docs).sort()).toEqual(['a/page.md']);
  });

  it('withholds draft files, and only draft files, when drafts are off', () => {
    const root = site(FILES);
    const docs = path.join(root, 'docs');
    expect(unpublishedDraftPaths(docs, true)).toEqual([]);
    expect(unpublishedDraftPaths(docs, false).sort()).toEqual(['guides/index.md', 'other/draft-page.md']);
  });

  it('never withholds the root page, whatever its status', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-route-table-'));
    roots.push(root);
    const docs = path.join(root, 'docs');
    mkdirSync(path.join(docs, 'guides'), { recursive: true });
    writeFileSync(path.join(docs, 'README.md'), '---\ntitle: Home\n---\n\nHome.\n');
    writeFileSync(path.join(docs, 'guides', 'wip.md'), '---\ntitle: W\n---\n\nW.\n');
    expect(unpublishedDraftPaths(docs, false, 'README')).toEqual(['guides/wip.md']);
  });

  it('finds the root page through the index name it is given', () => {
    // With the default name, `home.md` would be an ordinary draft page at `/home/`.
    const docs = path.join(site({ 'home.md': 'draft', 'guides/wip.md': 'draft' }), 'docs');
    expect(unpublishedDraftPaths(docs, false, 'home')).toEqual(['guides/wip.md']);
  });

  it('never reports the root route as a draft route', () => {
    const docs = path.join(site({ 'README.md': 'draft', 'guides/wip.md': 'draft' }), 'docs');
    expect([...draftRoutesOf(docs, 'README')]).toEqual(['/guides/wip/']);
  });

  it('publishes a root index.md at the root route when the site does not list index', () => {
    // The loader stores the root under the reserved id `index`, and a root
    // `index.md` under a README-only setting has that id too (Starlight serves it at `/`).
    const { routes } = buildRouteTable(['index.md', 'guides/index.md'], { indexBasename: 'README' });
    // A nested `guides/index.md` has the id `guides/index`, which Starlight serves at `/guides/`
    // (`slugToParam` strips a trailing `/index`), not at `/guides/index/`.
    expect(routes).toEqual({ 'guides/index.md': '/guides/', 'index.md': '/' });
    // ...and, as the root, it is never withheld even without a status.
    const bare = mkdtempSync(path.join(tmpdir(), 'dk-route-table-'));
    roots.push(bare);
    writeFileSync(path.join(bare, 'index.md'), '---\ntitle: Home\n---\n\nHome.\n');
    expect(unpublishedDraftPaths(bare, false, 'README')).toEqual([]);
  });

  it('resolves ids over all files before dropping the unpublished ones', () => {
    // Dropping the draft winner first would promote `guides/README.md` to the folder route.
    const paths = ['guides/README.md', 'guides/index.md'];
    const { routes } = buildRouteTable(paths, {
      indexBasename: ['index', 'README'],
      unpublishedPaths: ['guides/index.md'],
    });
    expect(routes).toEqual({ 'guides/README.md': '/guides/README/' });
  });
});

describe('generatedIndexBasename', () => {
  // [setting, first, preferring index]
  it.each([
    [undefined, 'README', 'README'],
    ['index', 'index', 'index'],
    [['README', 'index'], 'README', 'index'],
    [['index', 'README'], 'index', 'index'],
    [['README', 'Index'], 'README', 'index'],
  ] as [string | string[] | undefined, string, string][])('%j -> %s, preferring index -> %s', (setting, first, preferred) => {
    expect(generatedIndexBasename(setting)).toBe(first);
    expect(generatedIndexBasename(setting, { prefer: 'index' })).toBe(preferred);
  });
});

describe('buildRouteTable output', () => {
  it('is plain JSON with keys in code-unit order', () => {
    const { routes, collisions } = buildRouteTable(['b/z.md', 'README.md', 'B/README.md', 'b/a.md', 'b/README.md'], {});
    const table = { routes, collisions };
    expect(JSON.parse(JSON.stringify(table))).toEqual(table);
    expect(Object.keys(routes)).toEqual([...Object.keys(routes)].sort());
    expect(routes).toEqual({
      'B/README.md': '/B/',
      'README.md': '/',
      'b/README.md': '/b/',
      'b/a.md': '/b/a/',
      'b/z.md': '/b/z/',
    });
  });
});

describe('resolveRelativeDocLink', () => {
  const { routes } = buildRouteTable(
    [
      'README.md',
      'guides/README.md',
      'guides/deploy.md',
      'guides/Setup Guide.md',
      'guides/Caps.mdx',
      'guides/secret.md',
      'adr/0001-x.md',
    ],
    { unpublishedPaths: ['guides/secret.md'] },
  );
  // [source, href, expected]
  const CASES: [string, string, string | null][] = [
    ['guides/deploy.md', 'README.md', '/guides/'], // a leaf page: sibling index -> section route
    ['guides/README.md', 'deploy.md', '/guides/deploy/'], // an index page resolves from its folder
    ['guides/deploy.md', '../README.md', '/'], // root README -> /
    ['guides/deploy.md', '../adr/0001-x.md', '/adr/0001-x/'],
    ['guides/deploy.md', './README.md#top', '/guides/#top'],
    ['guides/deploy.md', '../adr/0001-x.md?v=1#a', '/adr/0001-x/?v=1#a'],
    ['guides/deploy.md', 'Setup%20Guide.md', '/guides/Setup%20Guide/'],
    ['guides/deploy.md', 'Setup Guide.md', '/guides/Setup%20Guide/'],
    ['guides/deploy.md', 'Caps.mdx', '/guides/Caps/'],
    ['guides/deploy.md', 'caps.mdx', null], // lookup is case-sensitive
    ['guides/deploy.md', '../../outside.md', null], // leaves the docs root
    ['guides/deploy.md', 'diagram.png', null], // not a page
    ['guides/deploy.md', 'missing.md', null],
    ['guides/deploy.md', 'secret.md', null], // unpublished draft
    ['guides/deploy.md', 'README', null], // bare, extensionless
    ['guides/deploy.md', '/guides/README.md', null], // root-absolute
    ['guides/deploy.md', '#section', null],
    ['guides/deploy.md', 'https://example.com/README.md', null],
    ['guides/deploy.md', 'mailto:a@b.c', null],
  ];
  it.each(CASES)('%s -> %s = %s', (source, href, expected) => {
    expect(resolveRelativeDocLink(routes, source, href)).toBe(expected);
  });
});

describe('the walk lists what the site loads', () => {
  it('leaves out a page under a dot-folder or named with a leading dot, so no route and no link resolve to it', () => {
    const root = site({ 'a.md': 'active', '.drafts/p.md': 'draft', 'guides/.hidden.md': 'active', 'guides/ok.md': 'active' });
    const paths = walkMarkdownPaths(path.join(root, 'docs'));
    expect(paths.sort()).toEqual(['a.md', 'guides/ok.md']);
    const { routes } = buildRouteTable(paths, {});
    expect(Object.values(routes)).not.toContain('/.drafts/p/');
    expect(resolveRelativeDocLink(routes, 'a.md', './.drafts/p.md')).toBeNull();
    expect(resolveRelativeDocLink(routes, 'a.md', './guides/ok.md')).toBe('/guides/ok/');
  });
});
