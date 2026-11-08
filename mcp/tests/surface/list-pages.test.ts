/**
 * list_pages (T012): { id, section, title, description, keywords, uri } in
 * published registry order, optional section filter, unconditional docs://
 * uri per record - including on the fs-launch path, where the slug derives
 * from the index-declared origin, never the local directory.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../corpus/helpers.js';
import { SurfaceClient } from './harness.js';
import { connectFixture, resultJson } from './helpers.js';

/** Re-read the committed index to compute expectations independently (no vitest snapshots). */
function expectedPageIds(fixturePath: string): string[] {
  const index = JSON.parse(readFileSync(`${fixturePath}/api/index.json`, 'utf8')) as {
    pages: Array<{ _links: { self?: { href: string } }; section: string }>;
  };
  return index.pages
    .filter((record) => record._links.self !== undefined)
    .map((record) => new URL(record._links.self!.href).pathname.split('/api/pages/')[1]!.replace(/\.json$/, ''));
}

describe('list_pages', () => {
  describe('against the full example corpus', () => {
    let client: SurfaceClient;
    let pages: Array<Record<string, unknown>>;

    beforeAll(async () => {
      client = await connectFixture('example');
      const result = await client.callTool('list_pages');
      expect(result.isError).toBeFalsy();
      pages = resultJson(result) as Array<Record<string, unknown>>;
    });

    afterAll(async () => {
      await client.close();
    });

    it('returns every page in published registry order', () => {
      expect(pages.map((p) => p.id)).toEqual(expectedPageIds(fixture('example')));
      // 70 docs pages + the 3 synthetic OpenAPI version records
      // (openapi-second-slice WP03; the fixture's index carries them last).
      expect(pages.length).toBe(73);
    });

    it('emits exactly the contract record shape, uri included, no score fields', () => {
      for (const page of pages) {
        expect(Object.keys(page).sort()).toEqual(['description', 'id', 'keywords', 'section', 'title', 'uri']);
        expect(page.uri).toMatch(/^docs:\/\/spec-kitty-github-io-doc-kitty\/pages\//);
        expect(Array.isArray(page.keywords)).toBe(true);
      }
      expect(pages[0]).toMatchObject({ id: 'home', section: '', title: 'DocKitty Example' });
    });

    it('filters by section id when given', async () => {
      const result = await client.callTool('list_pages', { section: 'context' });
      expect(result.isError).toBeFalsy();
      const filtered = resultJson(result) as Array<Record<string, unknown>>;
      expect(filtered.length).toBeGreaterThan(0);
      for (const page of filtered) {
        expect(page.section).toBe('context');
      }
      expect(filtered.map((p) => p.id)).toEqual(expectedPageIds(fixture('example')).filter((id) =>
        filtered.some((p) => p.id === id),
      ));
    });

    it('an unknown section id yields an empty list, not an error (sections are a display overlay)', async () => {
      const result = await client.callTool('list_pages', { section: 'no-such-section' });
      expect(result.isError).toBeFalsy();
      expect(resultJson(result)).toEqual([]);
    });
  });

  it('mints fs-mode uris from the index-declared origin (never the local dir)', async () => {
    const client = await connectFixture('surface');
    try {
      const result = await client.callTool('list_pages');
      const pages = resultJson(result) as Array<{ id: string; uri: string; section: string }>;
      expect(pages.map((p) => p.id)).toEqual(['home', 'guides/alpha', 'reference/beta']);
      for (const page of pages) {
        expect(page.uri).toBe(`docs://docs-example-com-surface/pages/${page.id}`);
      }
    } finally {
      await client.close();
    }
  });

  it('the empty section id selects the site-root pages', async () => {
    const client = await connectFixture('surface');
    try {
      const result = await client.callTool('list_pages', { section: '' });
      expect(result.isError).toBeFalsy();
      expect((resultJson(result) as Array<{ id: string }>).map((p) => p.id)).toEqual(['home']);
    } finally {
      await client.close();
    }
  });

  it('a fully pages-gated corpus lists zero pages without erroring (index-level tools still work)', async () => {
    const client = await connectFixture('gated-pages');
    try {
      const result = await client.callTool('list_pages');
      expect(result.isError).toBeFalsy();
      expect(resultJson(result)).toEqual([]);
    } finally {
      await client.close();
    }
  });
});
