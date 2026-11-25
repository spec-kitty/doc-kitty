/**
 * The sub-processor catalog in a real build of the chrome fixture site
 * (ADR-0086, FR-009, FR-010, FR-012, FR-013, NFR-001).
 *
 * - Without a catalog the build serves nothing new (the integration's unit test
 *   proves it then calls no Astro hook at all).
 * - With one, it serves exactly the two new files, links them from the agent
 *   index, and changes no other file by a single byte (U1): the catalog only adds.
 * - Both served files are byte-for-byte what the WP04 renderers produce from the
 *   loader's checked catalog, so a route that added anything (a build time, say)
 *   fails here. A genuine second build (a distinct cache key, so not a reuse)
 *   serves the same bytes again (FR-013, NFR-001). Two builds cannot be days
 *   apart; subprocessors-render.test.ts covers that with fake clocks years apart
 *   and a second time zone.
 *
 * Real builds: the stock site, the site with a catalog, and its rebuild. The
 * invalid-catalog request stops at `astro:config:setup`, before any page renders.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { buildChromeFixture } from './fixtures/chrome/harness.mjs';
import { checkSubprocessorCatalog } from '../lib/subprocessors-loader.mjs';

// The renderers reach `routes/shared.ts`, which imports `astro:content`; they never call it.
vi.mock('astro:content', () => ({ getCollection: async () => [] }));
const { renderSubprocessorsApi, renderSubprocessorsFeed } = await import('../lib/subprocessors-render.js');

afterEach(() => vi.unstubAllEnvs());

const BUILD_TIMEOUT = 240_000;

const CATALOG = `# Fictional fixture records (ADR-0086).
- id: northwind-hosting
  name: Northwind Hosting
  processing: Hosting of the production database.
  location: [NL, DE]
  responsibilities: Northwind operates the infrastructure; we configure access.
  since: 2024-03-01
  tom_classification: [physical-security]
- id: fabrikam-mail
  name: Fabrikam Mail
  processing: Transactional email.
  location: [IE]
  responsibilities: Fabrikam delivers mail; we choose what is sent.
  since: 2027-06-01
- id: contoso-analytics
  name: Contoso Analytics
  processing: Product usage analytics.
  location: [US]
  responsibilities: Contoso stores events; we choose which are sent.
  since: 2023-01-10
  until: 2025-09-30
`;
const WITH_CATALOG = { 'docs/_meta/subprocessors.yaml': CATALOG };

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? filesUnder(path.join(dir, entry.name)).map((file) => path.join(entry.name, file))
        : [entry.name],
    )
    .sort();
}

/**
 * Mask what differs between ANY two fresh fixture builds, catalog or not. Each
 * request builds in its own root, where the glossary producer regenerates its page
 * during the build and stamps `generated.at` with the clock (ADR-0087 D5: the tree
 * is not regeneration-clean). That one instant reaches these places today:
 * - as an ISO instant: `generated.at` in the per-page JSON and the content graph,
 *   `at:` in the OKF `_index.meta.yaml` files, and (with milliseconds) the Atom
 *   `<updated>` of the glossary's page feeds;
 * - as an RFC 822 date: the glossary items' `<pubDate>` in `rss.xml`;
 * - through the 64-hex `buildId`, which hashes it.
 * The patterns are file-wide, so they would also hide a NEW clock-derived value
 * in a stock file; the sub-processor files themselves are never masked, and the
 * byte-identity test below compares them unmasked.
 */
function masked(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/g, '<instant>')
    .replace(/[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT/g, '<rfc822>')
    .replace(/("?buildId"?: ?"?)[0-9a-f]{64}/g, '$1<buildId>');
}

function built(files: Record<string, string> = {}, env: Record<string, string> = {}) {
  const build = buildChromeFixture({ files, env });
  expect(build.status, build.output).toBe(0);
  return {
    dist: build.dist,
    root: build.root,
    has: (rel: string) => existsSync(path.join(build.dist, rel)),
    text: (rel: string) => readFileSync(path.join(build.dist, rel), 'utf8'),
    links: () => JSON.parse(readFileSync(path.join(build.dist, 'api/index.json'), 'utf8'))._links as Record<string, unknown>,
  };
}

describe('the sub-processor catalog in a built site', () => {
  it(
    'serves nothing new without a catalog, and only additions with one',
    () => {
      const stock = built();
      expect(stock.has('api/subprocessors.json')).toBe(false);
      expect(stock.has('subprocessors.xml')).toBe(false);
      expect(stock.links()).not.toHaveProperty('subprocessors');
      expect(stock.links()).not.toHaveProperty('subprocessorFeed');

      const withCatalog = built(WITH_CATALOG);
      expect(withCatalog.has('api/subprocessors.json'), 'positive control: the routes are served').toBe(true);
      expect(withCatalog.has('subprocessors.xml')).toBe(true);
      expect(withCatalog.links()).toMatchObject({
        subprocessors: { href: expect.stringMatching(/\/api\/subprocessors\.json$/) },
        subprocessorFeed: { href: expect.stringMatching(/\/subprocessors\.xml$/) },
      });

      // U1: the catalog adds two files and two index links, and touches nothing else.
      const stockFiles = filesUnder(stock.dist);
      expect(filesUnder(withCatalog.dist)).toEqual([...stockFiles, 'api/subprocessors.json', 'subprocessors.xml'].sort());
      const changed = stockFiles.filter((rel) => {
        const a = masked(readFileSync(path.join(stock.dist, rel), 'utf8'));
        const b = masked(readFileSync(path.join(withCatalog.dist, rel), 'utf8'));
        return a !== b;
      });
      expect(changed).toEqual(['api/index.json']);
      const stockIndex = JSON.parse(masked(stock.text('api/index.json')));
      const catalogIndex = JSON.parse(masked(withCatalog.text('api/index.json')));
      const otherLinks = { ...catalogIndex._links };
      delete otherLinks.subprocessors;
      delete otherLinks.subprocessorFeed;
      expect({ ...catalogIndex, _links: otherLinks }).toEqual(stockIndex);
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    "serves exactly the renderers' bytes, and the same bytes from a genuine rebuild",
    () => {
      const withCatalog = built(WITH_CATALOG);
      const checked = checkSubprocessorCatalog(path.join(withCatalog.root, 'docs'));
      expect(checked.problems).toEqual([]);
      expect(checked.records).toHaveLength(3);

      // The site and base the build served under, read back from its own link.
      const self = new URL(JSON.parse(withCatalog.text('api/subprocessors.json'))._links.self.href);
      const base = self.pathname.replace(/api\/subprocessors\.json$/, '');
      vi.stubEnv('BASE_URL', base);
      const site = new URL('/', self);
      const input = { records: checked.normalised, changes: checked.changes };
      expect(withCatalog.text('api/subprocessors.json')).toBe(renderSubprocessorsApi(input, { site }));
      expect(withCatalog.text('subprocessors.xml')).toBe(
        renderSubprocessorsFeed(input, { site, siteTitle: 'Chrome fixture' }),
      );

      // A distinct env key is a distinct cache key: a real second build, not a reuse.
      const rebuilt = built(WITH_CATALOG, { DK_TEST_SUBPROCESSORS_REBUILD: '1' });
      expect(rebuilt.dist).not.toBe(withCatalog.dist);
      expect(rebuilt.text('api/subprocessors.json')).toBe(withCatalog.text('api/subprocessors.json'));
      expect(rebuilt.text('subprocessors.xml')).toBe(withCatalog.text('subprocessors.xml'));
    },
    BUILD_TIMEOUT * 2,
  );

  it(
    'fails the build on an invalid catalog, naming the problem',
    () => {
      const build = buildChromeFixture({ files: { 'docs/_meta/subprocessors.yaml': CATALOG.replace('[IE]', '[ie]') } });
      expect(build.status).not.toBe(0);
      expect(build.output).toContain('[dk-subprocessors] invalid sub-processor catalog:');
      expect(build.output).toContain('write country codes in upper case ("IE")');
    },
    BUILD_TIMEOUT,
  );
});
