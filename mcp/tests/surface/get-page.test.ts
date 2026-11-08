/**
 * get_page (T013): byte-projected from the per-page artifact; unknown ids are
 * PAGE_NOT_FOUND; a pages-gated corpus answers PAGES_LINKS_GATED, never
 * synthesized content; malformed ids hit the named guard.
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fixture } from '../corpus/helpers.js';
import { SurfaceClient } from './harness.js';
import { connectFixture, resultJson } from './helpers.js';

interface PageDetail {
  id: string;
  title: string;
  description: string;
  links: Record<string, unknown>;
  uri: string;
  markdown: string;
}

describe('get_page', () => {
  describe('against the full example corpus', () => {
    let client: SurfaceClient;

    beforeAll(async () => {
      client = await connectFixture('example');
    });

    afterAll(async () => {
      await client.close();
    });

    it('returns the page byte-derived from its per-page artifact and index record', async () => {
      const result = await client.callTool('get_page', { id: 'guides/getting-started' });
      expect(result.isError).toBeFalsy();
      const page = resultJson(result) as PageDetail;

      // Independently re-read the two published artifacts (no vitest snapshots).
      const dir = fixture('example');
      const index = JSON.parse(readFileSync(`${dir}/api/index.json`, 'utf8')) as {
        pages: Array<Record<string, unknown> & { _links: Record<string, unknown>; title: string; description: string }>;
      };
      const artifact = JSON.parse(readFileSync(`${dir}/api/pages/guides/getting-started.json`, 'utf8')) as {
        markdown: string;
      };
      const record = index.pages.find((p) => (p._links.self as { href: string }).href.endsWith('/api/pages/guides/getting-started.json'))!;

      expect(page.id).toBe('guides/getting-started');
      expect(page.title).toBe(record.title);
      expect(page.description).toBe(record.description);
      expect(page.links).toEqual(record._links);
      expect(page.markdown).toBe(artifact.markdown);
      expect(page.uri).toBe('docs://spec-kitty-github-io-doc-kitty/pages/guides/getting-started');
      expect(Object.keys(page).sort()).toEqual(['description', 'id', 'links', 'markdown', 'title', 'uri']);
      // Object payloads travel in both channels with the identical shape.
      expect(result.structuredContent).toEqual(page);
    });

    it('serves the home page by its pinned id', async () => {
      const result = await client.callTool('get_page', { id: 'home' });
      expect(result.isError).toBeFalsy();
      const page = resultJson(result) as PageDetail;
      expect(page.id).toBe('home');
      expect(page.uri).toBe('docs://spec-kitty-github-io-doc-kitty/pages/home');
    });

    it('PAGE_NOT_FOUND for an unknown id (named error in the tool result)', async () => {
      const result = await client.callTool('get_page', { id: 'guides/no-such-page' });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      const text = result.content![0]!.text!;
      expect(text.startsWith('PAGE_NOT_FOUND: ')).toBe(true);
      expect(text).toContain('guides/no-such-page');
      // 70 docs pages + the 3 synthetic OpenAPI version records (WP03).
      expect(text).toContain('73 pages');
    });

    it('MALFORMED_CORPUS for empty or blank ids (guard path, named error)', async () => {
      for (const id of ['', '   ']) {
        const result = await client.callTool('get_page', { id });
        expect(result.isError).toBe(true);
        expect(result.content![0]!.text).toBe('MALFORMED_CORPUS: get_page: arguments.id - expected a non-empty string');
      }
    });

    it('a missing id is rejected by the wire input schema before the handler runs', async () => {
      const result = await client.callTool('get_page', {});
      expect(result.isError).toBe(true);
      expect(result.content![0]!.text).toContain('Invalid arguments');
    });
  });

  it('PAGES_LINKS_GATED for any page-level call on a gated corpus', async () => {
    const client = await connectFixture('gated-pages');
    try {
      const result = await client.callTool('get_page', { id: 'home' });
      expect(result.isError).toBe(true);
      const text = result.content![0]!.text!;
      expect(text.startsWith('PAGES_LINKS_GATED: ')).toBe(true);
      expect(text).toContain('home');
    } finally {
      await client.close();
    }
  });
});
