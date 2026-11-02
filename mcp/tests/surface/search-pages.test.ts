/**
 * search_pages (T014; C-001): case-insensitive substring over title,
 * description and keywords ONLY (never the markdown body); matches in
 * published registry order, capped at 25, with no score or ranking fields.
 * The discriminating controls (SC-002 style) run on the authored surface
 * fixture whose keyword/body placement is known exactly; the large real
 * corpus pins the cap and the order guarantee.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../corpus/helpers.js';
import { SEARCH_MATCH_CAP } from '../../src/surface/tools.js';
import { SurfaceClient } from './harness.js';
import { connectFixture, resultJson } from './helpers.js';

interface PageSummary {
  id: string;
  section: string;
  title: string;
  description: string;
  keywords: string[];
  uri: string;
}

describe('search_pages on the authored surface corpus (exact controls)', () => {
  let client: SurfaceClient;

  beforeAll(async () => {
    client = await connectFixture('surface');
  });

  afterAll(async () => {
    await client.close();
  });

  const search = async (query: string): Promise<PageSummary[]> => {
    const result = await client.callTool('search_pages', { query });
    expect(result.isError).toBeFalsy();
    return resultJson(result) as PageSummary[];
  };

  it('a keyword-only term hits the page carrying the keyword (case-insensitively)', async () => {
    // 'quickstart' appears ONLY in guides/alpha's keywords ("QuickStart") and
    // reference/beta's markdown body (which search must never read).
    const pages = await search('quickstart');
    expect(pages.map((p) => p.id)).toEqual(['guides/alpha']);
  });

  it('a body-only term misses every page (markdown is never searched)', async () => {
    // 'flibbertygibbet' appears only in home's markdown body.
    expect(await search('flibbertygibbet')).toEqual([]);
  });

  it('matches are case-insensitive against title, description and keywords', async () => {
    expect((await search('ALPHA')).map((p) => p.id)).toEqual(['guides/alpha']); // title
    expect((await search('SHARED-KEY')).map((p) => p.id)).toEqual(['guides/alpha', 'reference/beta']); // keywords
    expect((await search('betatoken')).map((p) => p.id)).toEqual(['reference/beta']); // keyword case-fold both ways
  });

  it('known-K recall is exact and in registry order (description match)', async () => {
    // 'shared-topic' appears in both descriptions; registry order is alpha then beta.
    const pages = await search('shared-topic');
    expect(pages.map((p) => p.id)).toEqual(['guides/alpha', 'reference/beta']);
    for (const page of pages) {
      expect(Object.keys(page).sort()).toEqual(['description', 'id', 'keywords', 'section', 'title', 'uri']);
    }
  });

  it('an unmatched query returns an empty list, not an error', async () => {
    expect(await search('zzz-never-anywhere')).toEqual([]);
  });

  it('MALFORMED_CORPUS for empty or blank queries (guard path, named error)', async () => {
    for (const query of ['', '  ']) {
      const result = await client.callTool('search_pages', { query });
      expect(result.isError).toBe(true);
      expect(result.content![0]!.text).toBe('MALFORMED_CORPUS: search_pages: arguments.query - expected a non-empty string');
    }
  });

  it('a missing query is rejected by the wire input schema before the handler runs', async () => {
    const result = await client.callTool('search_pages', {});
    expect(result.isError).toBe(true);
    expect(result.content![0]!.text).toContain('Invalid arguments');
  });
});

describe('search_pages on the full example corpus (cap and order at scale)', () => {
  let client: SurfaceClient;

  beforeAll(async () => {
    client = await connectFixture('example');
  });

  afterAll(async () => {
    await client.close();
  });

  it('caps results at 25 in registry order (a prefix cut, never a ranking)', async () => {
    const needle = 'the';
    const result = await client.callTool('search_pages', { query: needle });
    expect(result.isError).toBeFalsy();
    const pages = resultJson(result) as PageSummary[];

    // Independent expectation recomputed from the committed index (keywords are
    // artifact-level and EMPTY throughout this fixture, so title+description
    // fully determine the expected set here).
    const index = JSON.parse(readFileSync(`${fixture('example')}/api/index.json`, 'utf8')) as {
      pages: Array<{ title: string; description: string; _links: { self?: { href: string } } }>;
    };
    const expectedIds = index.pages
      .filter((record) => record._links.self !== undefined)
      .filter(
        (record) =>
          record.title.toLowerCase().includes(needle) || record.description.toLowerCase().includes(needle),
      )
      .map((record) => new URL(record._links.self!.href).pathname.split('/api/pages/')[1]!.replace(/\.json$/, ''));

    expect(expectedIds.length).toBeGreaterThan(SEARCH_MATCH_CAP); // premise: the corpus really overflows the cap
    expect(pages.length).toBe(SEARCH_MATCH_CAP);
    expect(pages.map((p) => p.id)).toEqual(expectedIds.slice(0, SEARCH_MATCH_CAP));
    for (const page of pages) {
      expect(page).not.toHaveProperty('score');
      expect(page.uri.startsWith('docs://spec-kitty-github-io-doc-kitty/pages/')).toBe(true);
    }
  });
});
