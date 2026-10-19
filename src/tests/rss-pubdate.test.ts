import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Every RSS item carries a `<pubDate>` (#190). Feed readers sort undated items
 * unpredictably, so a page dates its item from `updated`, else from its
 * generator stamp's `generated.at` (Gherkin feature pages and glossary pages
 * carry no `updated`), and a page with neither is left out of the feed.
 */

const { entries } = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; filePath: string; data: Record<string, unknown> }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { rssRoute } = await import('../lib/routes/rss.js');

const SITE = new URL('https://docs.example/');
let root: string;

function addEntry(id: string, data: Record<string, unknown>): void {
  entries.push({ id, filePath: path.join(root, `${id}.md`), data });
}

async function feed(): Promise<string> {
  const route = rssRoute({ title: 'Docs' }) as (ctx: { site: URL }) => Promise<Response>;
  return (await route({ site: SITE })).text();
}

const itemsOf = (xml: string) => xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
const linkOf = (item: string) => item.match(/<link>([^<]*)<\/link>/)?.[1];

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'dk-rss-pubdate-'));
  entries.length = 0;
  addEntry('guides/authored', { title: 'Authored', doc_status: 'active', updated: '2026-03-01' });
  addEntry('behaviour/feature', {
    title: 'Generated feature',
    doc_status: 'active',
    kind: 'Specification',
    generated: { by: 'doc-kitty-gherkin/0.4.0', at: '2026-05-01T10:00:00Z' },
  });
  addEntry('guides/undated', { title: 'Undated', doc_status: 'active' });
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  entries.length = 0;
});

describe('rssRoute — every item has a <pubDate> (#190)', () => {
  it('gives every item a <pubDate>', async () => {
    const items = itemsOf(await feed());
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((item) => /<pubDate>[^<]+<\/pubDate>/.test(item))).toHaveLength(items.length);
  });

  it('dates a generated page from its generated.at stamp', async () => {
    const item = itemsOf(await feed()).find((i) => linkOf(i) === 'https://docs.example/behaviour/feature/');
    expect(item).toContain(`<pubDate>${new Date('2026-05-01T10:00:00Z').toUTCString()}</pubDate>`);
  });

  it('leaves out a page with no date at all', async () => {
    expect(await feed()).not.toContain('https://docs.example/guides/undated/');
  });

  it('orders items newest first by the date they carry', async () => {
    expect(itemsOf(await feed()).map(linkOf)).toEqual([
      'https://docs.example/behaviour/feature/',
      'https://docs.example/guides/authored/',
    ]);
  });
});
