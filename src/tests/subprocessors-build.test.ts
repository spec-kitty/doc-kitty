/**
 * The sub-processor catalog in a real build of the chrome fixture site
 * (ADR-0086, FR-009, FR-010, FR-012, FR-013, NFR-001).
 *
 * - Without a catalog the build serves nothing new (the integration's unit test
 *   proves it then calls no Astro hook at all).
 * - With one, it serves exactly the two new files, links them from the agent
 *   index, and changes no other file by a single byte (U1): the catalog only adds.
 * - The API document serves the loader's checked records and changes. Its exact
 *   bytes are pinned on the renderer (subprocessors-render.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { buildChromeFixture } from './fixtures/chrome/harness.mjs';
import { checkSubprocessorCatalog } from '../lib/subprocessors-loader.mjs';

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
 * is not regeneration-clean). That `at` reappears as a feed `pubDate`, and the
 * `buildId` hashes it. Only these are masked: an ISO instant, an RFC 822 date and
 * the build id. Any other byte difference still fails.
 */
function masked(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z/g, '<instant>')
    .replace(/[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT/g, '<rfc822>')
    .replace(/("?buildId"?: ?"?)[0-9a-f]{64}/g, '$1<buildId>');
}

function built(files: Record<string, string> = {}) {
  const build = buildChromeFixture({ files });
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
    'serves the checked catalog: resolved records, every change, and the feed',
    () => {
      const withCatalog = built(WITH_CATALOG);
      const checked = checkSubprocessorCatalog(path.join(withCatalog.root, 'docs'));
      expect(checked.problems).toEqual([]);
      const doc = JSON.parse(withCatalog.text('api/subprocessors.json'));
      expect(doc.count).toBe(3);
      expect(doc.records).toEqual(checked.normalised);
      expect(doc.changes).toEqual(checked.changes);
      expect(doc._links.feed).toEqual(withCatalog.links().subprocessorFeed);
      const feed = withCatalog.text('subprocessors.xml');
      expect(feed).toContain('<title>Chrome fixture: sub-processor changes</title>');
      expect([...feed.matchAll(/<item>/g)]).toHaveLength(4);
      expect(feed).not.toContain('lastBuildDate');
    },
    BUILD_TIMEOUT,
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
