/**
 * Unreleased spec versions stay out of the sitemap and the search index
 * (mission openapi-second-slice-01M6WXJ4, WP05/T029; FR-013, FR-015; research
 * R2).
 *
 * Two real builds of the WP01 fixtures, no in-process shortcut:
 *
 *  - `two-versions`: `v1` released, `v2` unreleased. The paired control and the
 *    change in one dist — `v1` must keep its sitemap entries and its Pagefind
 *    fragments (FR-013), `v2` must have neither (FR-015) while its pages are
 *    still built and published.
 *  - `two-versions` with both versions unreleased: nothing under the reference
 *    section may be indexed, and the reference pages must still exist.
 *
 * "Unindexed" is proved the way the shipped site proves it: the pages carry no
 * `data-pagefind-body` (Starlight omits it when the frontmatter says
 * `pagefind: false`, which is the WP05 hook) and Pagefind wrote no fragment
 * whose URL is under the version. Fragments are gzip'd JSON carrying the page
 * URL, as `assert-openapi-artifacts.mjs` reads the example's.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { buildOpenApiFixture, readAll, removeOpenApiFixtureBuilds } from './helpers/openapi-build';
import { openApiPagefind, openApiSitemapPredicate } from '../lib/openapi/indexing.js';
import { DK_OPENAPI_ENV } from '../lib/internal-env.mjs';
import { publicationFile } from './helpers/openapi-publication.js';

/** `v1` released, `v2` unreleased: the WP01 seam fixtures. */
const TWO_VERSIONS = {
  fixture: 'two-versions',
  openapi: {
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: true },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

/** The same fixture with no released version at all. */
const ALL_UNRELEASED = {
  fixture: 'two-versions',
  openapi: {
    specs: [
      { path: 'openapi/v1.yaml', label: 'v1', released: false },
      { path: 'openapi/v2.yaml', label: 'v2', released: false },
    ],
  },
};

/** One pagefind fragment, decoded. */
interface Fragment {
  url: string;
  text: string;
}

function text(files: Map<string, Buffer>, key: string): string {
  const bytes = files.get(key);
  expect(bytes, `${key} exists in the built dist`).toBeDefined();
  return (bytes ?? Buffer.alloc(0)).toString('utf8');
}

/** Every sitemap `loc` in the dist, as one string (index and page sitemaps). */
function sitemap(files: Map<string, Buffer>): string {
  return [...files.keys()]
    .filter((key) => /^sitemap-.*\.xml$/.test(key))
    .map((key) => text(files, key))
    .join('\n');
}

/** The decoded Pagefind fragments of the dist. */
function fragments(files: Map<string, Buffer>): Fragment[] {
  const out: Fragment[] = [];
  for (const [key, bytes] of files) {
    if (!/^pagefind\/fragment\/.*\.pf_fragment$/.test(key)) continue;
    const decoded = gunzipSync(bytes).toString('utf8');
    const url = decoded.match(/"url":"([^"]*)"/)?.[1];
    if (url) out.push({ url, text: decoded });
  }
  return out;
}

/** The built HTML pages under one version's route. */
function versionPages(files: Map<string, Buffer>, label: string): Array<[string, string]> {
  return [...files.entries()]
    .filter(([key]) => new RegExp(`^reference/api/${label}/.*index\\.html$`).test(key))
    .map(([key, bytes]) => [key, bytes.toString('utf8')]);
}

describe('openapi indexing (WP05: FR-013, FR-015)', () => {
  let two!: Map<string, Buffer>;
  let allUnreleased!: Map<string, Buffer>;

  beforeAll(() => {
    const build = (request: typeof TWO_VERSIONS): Map<string, Buffer> => {
      const built = buildOpenApiFixture(request);
      expect(built.status, `astro build output:\n${built.output}`).toBe(0);
      return readAll(built.dist);
    };
    two = build(TWO_VERSIONS);
    allUnreleased = build(ALL_UNRELEASED);
  }, 900_000);

  afterAll(() => {
    removeOpenApiFixtureBuilds();
  });

  describe('an unreleased version', () => {
    it('[WP05] keeps every page out of the sitemap', () => {
      const urls = sitemap(two);
      expect(urls).not.toContain('/reference/api/v2/');
      // Positive control: the sitemap is otherwise populated.
      expect(urls).toContain('/reference/api/v1/');
    });

    it('[WP05] carries no data-pagefind-body on any of its pages', () => {
      const pages = versionPages(two, 'v2');
      // The pages are built and published: this is about indexing, not existence.
      expect(pages.length).toBeGreaterThan(1);
      for (const [key, html] of pages) expect(html, key).not.toContain('data-pagefind-body');
    });

    it('[WP05] gets no search fragment from Pagefind', () => {
      const all = fragments(two);
      // Positive control: Pagefind indexed the released version's pages.
      expect(all.some((fragment) => fragment.url.includes('/reference/api/v1/'))).toBe(true);
      expect(all.filter((fragment) => fragment.url.includes('/reference/api/v2/'))).toEqual([]);
    });
  });

  describe('a released version', () => {
    it('[WP05] stays in the sitemap, marked for Pagefind, and findable by summary, method and path', () => {
      expect(sitemap(two)).toContain('/reference/api/v1/');
      const pages = versionPages(two, 'v1');
      expect(pages.length).toBeGreaterThan(1);
      for (const [key, html] of pages) expect(html, key).toContain('data-pagefind-body');
      const operation = fragments(two).find((fragment) =>
        fragment.url.includes('/reference/api/v1/operations/listparcels/'),
      );
      expect(operation, 'the listParcels fragment').toBeDefined();
      // FR-013: summary, method and path each find the operation.
      expect(operation?.text).toContain('List parcels');
      expect(operation?.text).toContain('GET');
      expect(operation?.text).toContain('/parcels');
    });
  });

  describe('with no released version at all', () => {
    it('[WP05] the reference pages are built but nothing under the section is indexed', () => {
      expect(sitemap(allUnreleased)).not.toContain('/reference/api/');
      expect(fragments(allUnreleased).filter((fragment) => fragment.url.includes('/reference/api/'))).toEqual([]);
      for (const label of ['v1', 'v2']) {
        const pages = versionPages(allUnreleased, label);
        expect(pages.length, `${label} pages are still built`).toBeGreaterThan(1);
        for (const [key, html] of pages) expect(html, key).not.toContain('data-pagefind-body');
      }
      // Positive control: the site's authored pages are still indexed.
      expect(fragments(allUnreleased).length).toBeGreaterThan(0);
    });
  });

  describe('the two seams, unit-tested', () => {
    const versions = [
      { label: 'v1', released: true },
      { label: 'main', released: false },
    ];

    it('[WP05] the sitemap predicate drops an unreleased route under the base, as a segment-bounded prefix, and nothing else', () => {
      const keep = openApiSitemapPredicate('reference/api', versions);
      expect(keep('https://docs.example.test/reference/api/main/')).toBe(false);
      expect(keep('https://docs.example.test/reference/api/main/operations/listparcels/')).toBe(false);
      expect(openApiSitemapPredicate('reference/api', versions, '/doc-kitty/')('https://docs.example.test/doc-kitty/reference/api/main/')).toBe(false);
      // Only a path prefix after the base counts: an unrelated parent segment or a
      // lookalike base keeps the page.
      expect(keep('https://docs.example.test/old/reference/api/main/')).toBe(true);
      expect(keep('https://docs.example.test/old/reference/api/beta/')).toBe(true);
      expect(openApiSitemapPredicate('reference/api', versions, '/doc-kitty')('https://docs.example.test/doc-kittyx/reference/api/main/')).toBe(true);
      // Released versions, a lookalike label, and every other section stay.
      expect(keep('https://docs.example.test/reference/api/v1/')).toBe(true);
      expect(keep('https://docs.example.test/reference/api/v1/operations/listparcels/')).toBe(true);
      expect(keep('https://docs.example.test/reference/api/mainish/')).toBe(true);
      expect(keep('https://docs.example.test/guides/start/')).toBe(true);
      // A site with every version released has nothing to drop.
      const allReleased = openApiSitemapPredicate('reference/api', [{ label: 'v1', released: true }]);
      expect(allReleased('https://docs.example.test/reference/api/v1/')).toBe(true);
    });

    it('[WP05] the pagefind hook reads the released flag of the page\'s own version', () => {
      const previous = process.env[DK_OPENAPI_ENV];
      process.env[DK_OPENAPI_ENV] = publicationFile({
        section: 'reference/api',
        llmsOperations: false,
        versions: [
          { label: 'v1', released: true },
          { label: 'main', released: false },
        ],
      });
      try {
        expect(openApiPagefind('List parcels', { config: { base: 'reference/api/v1' } })).toBe(true);
        expect(openApiPagefind('List parcels', { config: { base: 'reference/api/main' } })).toBe(false);
        // A trailing slash in the renderer's base does not change the label.
        expect(openApiPagefind('List parcels', { config: { base: '/reference/api/main/' } })).toBe(false);
        // A page outside the configured versions keeps Starlight's default.
        expect(openApiPagefind('Elsewhere', { config: { base: 'guides/start' } })).toBe(true);
        expect(openApiPagefind('No base')).toBe(true);
      } finally {
        if (previous === undefined) delete process.env[DK_OPENAPI_ENV];
        else process.env[DK_OPENAPI_ENV] = previous;
      }
      // Arm A: no publication, every page indexed as before.
      delete process.env[DK_OPENAPI_ENV];
      expect(openApiPagefind('List parcels', { config: { base: 'reference/api/main' } })).toBe(true);
    });
  });
});
