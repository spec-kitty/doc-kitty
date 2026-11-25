/**
 * The hub listing's pure helpers (#342, WP03; FR-006, FR-008, C-001): the cards a
 * listing page shows, in the hub data's order, and the pagination window. A
 * guard pins that the hub page's composition and the route-shaping hub data
 * agree on the order, so a paged hub's slices list what its page would.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { assertListingAgrees, listingCards, pageCards, pageLabelPrefix, paginationItems, type HubCard } from '../lib/hub-pagination.js';
import { composeHubChildren, selectHubChildren } from '../lib/hub-children.mjs';
import { routeShapingSource } from '../lib/integrations/route-shaping.js';
import { loadAdrIdRule } from '../scripts/generate-adr-index.mjs';
import type { HubCap } from '../lib/child-cap.js';

describe('listingCards (FR-006, C-001)', () => {
  const card = (slug: string): HubCard => ({ slug, title: slug.toUpperCase() });
  const bySlug = new Map(['a', 'b', 'c'].map((slug) => [slug, card(slug)]));

  it('returns the cards in the order of the slugs', () => {
    expect(listingCards(['c', 'a'], bySlug).map((c) => c.slug)).toEqual(['c', 'a']);
    expect(listingCards([], bySlug)).toEqual([]);
  });

  it('fails loudly on a slug with no card: the hub data and the hub page would disagree', () => {
    expect(() => listingCards(['a', 'zz'], bySlug)).toThrow('[dk-hubs] listing child "zz" has no card');
  });
});

describe('paginationItems (FR-008)', () => {
  const show = (current: number, total: number) =>
    paginationItems(current, total)
      .map((item) => (item.type === 'gap' ? '…' : item.current ? `[${item.page}]` : String(item.page)))
      .join(' ');

  it('lists every page up to seven', () => {
    expect(show(1, 1)).toBe('[1]');
    expect(show(2, 2)).toBe('1 [2]');
    expect(show(4, 7)).toBe('1 2 3 [4] 5 6 7');
  });

  it('shows the first, the last and the current page with its neighbours, with gaps', () => {
    expect(show(1, 8)).toBe('[1] 2 … 8');
    expect(show(2, 8)).toBe('1 [2] 3 … 8');
    expect(show(3, 8)).toBe('1 2 [3] 4 … 8');
    expect(show(4, 8)).toBe('1 2 3 [4] 5 … 8');
    expect(show(5, 9)).toBe('1 … 4 [5] 6 … 9');
    expect(show(50, 100)).toBe('1 … 49 [50] 51 … 100');
    expect(show(99, 100)).toBe('1 … 98 [99] 100');
    expect(show(100, 100)).toBe('1 … 99 [100]');
  });

  it('never repeats a page, marks exactly one current, and stays bounded', () => {
    for (const total of [1, 2, 7, 8, 9, 30, 100]) {
      for (let current = 1; current <= total; current += 1) {
        const items = paginationItems(current, total);
        const pages = items.flatMap((i) => (i.type === 'page' ? [i.page] : []));
        expect(new Set(pages).size).toBe(pages.length);
        expect(pages).toEqual([...pages].sort((a, b) => a - b));
        expect(items.filter((i) => i.type === 'page' && i.current)).toEqual([{ type: 'page', page: current, current: true }]);
        expect(items.length).toBeLessThanOrEqual(9);
        // A gap never stands for a single page: it would be shorter to show the page.
        items.forEach((item, at) => {
          if (item.type !== 'gap') return;
          const before = items[at - 1] as { page: number };
          const after = items[at + 1] as { page: number };
          expect(after.page - before.page).toBeGreaterThan(2);
        });
      }
    }
  });

  it('refuses a current page outside 1..total', () => {
    for (const [current, total] of [[0, 3], [4, 3], [1.5, 3], [1, 0]]) {
      expect(() => paginationItems(current!, total!)).toThrow(RangeError);
    }
  });
});

describe('the hub page and the hub data list one order (C-001)', () => {
  const roots: string[] = [];
  afterEach(() => {
    vi.restoreAllMocks();
    for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
  });

  it('agrees on a mixed ADR and non-ADR hub', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-hub-order-'));
    roots.push(root);
    const files: Record<string, string> = {
      'adr/README.md': '---\ntitle: Decisions\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: Hub\nsidebar_child_cap: 2\n---\n\nHub.\n',
      'adr/notes.md': '---\ntitle: Zulu notes\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: Explanation\n---\n\nNotes.\n',
      'adr/guide.md': '---\ntitle: Alpha guide\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: How-To\n---\n\nGuide.\n',
    };
    for (const [id, title] of [['0010', 'Beta'], ['0002', 'Gamma'], ['0001', 'Delta']]) {
      files[`adr/${id}-x.md`] = `---\ntitle: "ADR-${id}: ${title}"\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: ADR\n---\n\n# ADR-${id}\n\n## Status\n\nAccepted\n`;
    }
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, 'docs', rel)), { recursive: true });
      writeFileSync(path.join(root, 'docs', rel), body);
    }
    vi.spyOn(process, 'cwd').mockReturnValue(root);

    // The hub page's side, as Hub.astro composes it.
    const entries = Object.entries(files).map(([rel, body]) => {
      const parsed = matter(body);
      return { slug: rel.replace(/\.md$/, '').replace(/\/README$/, ''), data: parsed.data as { title: string; kind?: string }, body: parsed.content };
    });
    const { adrCards, others } = composeHubChildren(selectHubChildren(entries, 'adr'), { idRule: loadAdrIdRule(path.join(root, 'docs')) });
    const pageOrder = [...adrCards.map((c: { slug: string }) => c.slug), ...others.map((e) => e.slug)];

    // The hub data's side.
    const text = routeShapingSource({ docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true }, { unpublishedDirs: [], unpublishedPaths: [] });
    const hubs = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).hubCaps as Array<[string, HubCap]>;
    const dataOrder = hubs.find(([dir]) => dir === 'adr')![1].children.map((c) => c.slug);

    expect(pageOrder).toEqual(['adr/0001-x', 'adr/0002-x', 'adr/0010-x', 'adr/guide', 'adr/notes']);
    expect(dataOrder).toEqual(pageOrder);
  });
});

describe('pageLabelPrefix (FR-008, FR-009)', () => {
  it('is the words before the number, so "Page " + "3" reads as the full label', () => {
    expect(pageLabelPrefix('Page 3', 3)).toBe('Page ');
    expect(pageLabelPrefix('Seite 12', 12)).toBe('Seite ');
    expect(pageLabelPrefix('3', 3)).toBe('');
    // A translation without the number keeps the whole label, then a space.
    expect(pageLabelPrefix('Current page', 3)).toBe('Current page ');
    // The last occurrence: "Page 1 of 1" style labels keep their prefix intact.
    expect(pageLabelPrefix('Page 1, page 1', 1)).toBe('Page 1, page ');
  });
});

describe('assertListingAgrees (#342 WP04, C-001 the other way: WP03 review carry-over)', () => {
  const card = (slug: string): HubCard => ({ slug, title: slug });
  const data = (slugs: string[]): Pick<HubCap, 'count' | 'children'> => ({ count: slugs.length, children: slugs.map((slug) => ({ slug, label: slug })) });

  it('passes when the hub page and the hub data list the same children', () => {
    expect(() => assertListingAgrees('h', data(['h/a', 'h/b']), [card('h/b'), card('h/a')])).not.toThrow();
  });

  it('fails when the hub page has a card the hub data lacks, naming the hub and the page', () => {
    expect(() => assertListingAgrees('h', data(['h/a']), [card('h/a'), card('h/x')])).toThrow(
      '[dk-hubs] hub "h": its page lists "h/x" but the build\'s hub data does not; the paged listing would drop it',
    );
  });

  it('fails when the hub data has a child the hub page lacks', () => {
    expect(() => assertListingAgrees('h', data(['h/a', 'h/y']), [card('h/a')])).toThrow(
      '[dk-hubs] hub "h": the build\'s hub data lists "h/y" but its page does not',
    );
  });

  it('fails when the counts disagree', () => {
    expect(() => assertListingAgrees('h', { count: 3, children: data(['h/a']).children }, [card('h/a')])).toThrow(
      '[dk-hubs] hub "h": the build\'s hub data counts 3 children but its page lists 1',
    );
  });
});

describe('paginationItems edge folds (WP03 review carry-over)', () => {
  it('refuses a fractional page count', () => {
    expect(() => paginationItems(1, 2.5)).toThrow(RangeError);
  });

  it('shows all seven pages with the current page at either end', () => {
    const pages = (current: number) => paginationItems(current, 7).flatMap((i) => (i.type === 'page' ? [i.page] : ['…']));
    expect(pages(1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pages(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('never lists more than seven items', () => {
    for (let total = 1; total <= 300; total += 1) {
      for (const current of new Set([1, 2, Math.ceil(total / 2), total - 1, total].filter((n) => n >= 1 && n <= total))) {
        expect(paginationItems(current, total).length).toBeLessThanOrEqual(7);
      }
    }
  });
});

describe('pageCards: the checked slice both listing renderers use (G4)', () => {
  const card = (slug: string): HubCard => ({ slug, title: slug });
  const data = { count: 3, children: ['h/a', 'h/b', 'h/c'].map((slug) => ({ slug, label: slug })) };

  it('checks the hub data against the cards, then returns the cards of the page', () => {
    expect(pageCards('h', data, [card('h/c'), card('h/a'), card('h/b')], ['h/b', 'h/c']).map((c) => c.slug)).toEqual(['h/b', 'h/c']);
  });

  it('refuses to render a page when the hub data and the cards disagree', () => {
    expect(() => pageCards('h', data, [card('h/a'), card('h/b')], ['h/a'])).toThrow('[dk-hubs] hub "h"');
  });
});

describe('the listing route checks its cards against the hub data (G4; WP06 review, c)', () => {
  // The route cannot be rendered outside an Astro build, so its wiring is pinned on
  // its source: the cards it lists are `pageCards`' result (which runs
  // `assertListingAgrees`, C-001), never the composed cards unchecked.
  const source = readFileSync(path.join(import.meta.dirname, '..', 'lib', 'routes', 'paged-hub.astro'), 'utf8');

  it('slices through pageCards with the hub data and this page\'s slugs', () => {
    expect(source).toMatch(/import \{ pageCards \} from '\.\.\/hub-pagination\.js';/);
    expect(source).toMatch(/const listed = pageCards\(hub, data, cards, slugs\);/);
  });

  it('renders only the checked cards', () => {
    expect(source).toMatch(/<HubCardList cards=\{listed\}/);
    expect(source).not.toMatch(/<HubCardList cards=\{cards\}/);
  });
});
