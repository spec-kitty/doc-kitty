/**
 * The sidebar child cap's settings and pure API (#341, WP01; FR-001, FR-002,
 * FR-006, FR-008). Each level of the cap is asserted with the less specific
 * levels set to other values, and each refused value is paired with an accepted
 * value of the same setting.
 */
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';
import {
  CAPPED_ENTRY_LABEL,
  CAPPED_LABEL_KEY,
  DEFAULT_CHILD_CAP,
  DEFAULT_HUB_PAGE_SIZE,
  HUB_PAGINATION_KEYS,
  HUB_PAGINATION_STRINGS,
  cappedChildHidden,
  cappedHubCaps,
  hubListingPages,
  hubPageCount,
  hubPageSlice,
  isChildCap,
  isPagedHub,
  pagedHubSlug,
  resolveCappedLabel,
  resolveChildCap,
  resolveHubPageSize,
  resolveHubString,
  type HubCap,
} from '../lib/child-cap.js';
import { defineDocKittyIntegrations, type DocKittyOptions } from '../lib/config.js';
import { parseSectionRegistry } from '../lib/sections.js';
import { docKittyFields } from '../lib/schema.js';
import { DOC_KITTY_I18N_PLUGIN } from '../lib/i18n-plugin.js';
import { validate } from '../scripts/validate-frontmatter.mjs';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

/** The options each `defineDocKittyIntegrations` call hands the route-shaping integration. */
const routeShapingCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../lib/integrations/route-shaping.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/integrations/route-shaping.js')>();
  return {
    ...actual,
    routeShapingIntegration: (options: Record<string, unknown>, ...rest: unknown[]) => {
      routeShapingCalls.push(options);
      return (actual.routeShapingIntegration as (...args: unknown[]) => unknown)(options, ...rest);
    },
  };
});

restoreInternalEnv();

describe('resolveChildCap (FR-001)', () => {
  it('takes the most specific level that is set', () => {
    expect(resolveChildCap({ hub: 5, section: 40, site: 20 })).toBe(5);
    expect(resolveChildCap({ section: 40, site: 20 })).toBe(40);
    expect(resolveChildCap({ site: 20 })).toBe(20);
    expect(resolveChildCap({})).toBe(DEFAULT_CHILD_CAP);
    expect(DEFAULT_CHILD_CAP).toBe(50);
  });
});

describe('cappedChildHidden (FR-008)', () => {
  it('hides a child exactly when the hub has more children than its cap', () => {
    expect(cappedChildHidden(51, 50)).toBe(true);
    expect(cappedChildHidden(50, 50)).toBe(false);
    expect(cappedChildHidden(0, 1)).toBe(false);
  });
});

describe('isChildCap (FR-002)', () => {
  it('accepts a positive whole number only', () => {
    expect(isChildCap(1)).toBe(true);
    expect(isChildCap(5000)).toBe(true);
    for (const bad of [0, -1, 1.5, '10', Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(isChildCap(bad)).toBe(false);
    }
  });
});

describe('resolveCappedLabel (FR-006)', () => {
  const translate = (strings: Record<string, string>) => (key: string) => strings[key] ?? key;

  it('defaults to "{count} pages"', () => {
    expect(CAPPED_ENTRY_LABEL).toBe('{count} pages');
    expect(resolveCappedLabel(200)).toBe('200 pages');
  });

  it('uses the locale translation, and treats an echoed key as none', () => {
    expect(resolveCappedLabel(7, undefined, translate({ [CAPPED_LABEL_KEY]: '{count} Seiten' }))).toBe('7 Seiten');
    expect(resolveCappedLabel(7, undefined, translate({}))).toBe('7 pages');
    expect(resolveCappedLabel(7, undefined, () => '')).toBe('7 pages');
  });

  it('lets the site option win, and replaces every {count}', () => {
    expect(resolveCappedLabel(3, 'All {count} ({count})', translate({ [CAPPED_LABEL_KEY]: '{count} Seiten' }))).toBe('All 3 (3)');
    expect(resolveCappedLabel(3, 'Browse all')).toBe('Browse all');
  });
});

describe('site option sidebar.childCap / sidebar.cappedLabel (FR-001, FR-002, FR-006)', () => {
  const define = (sidebar: unknown) => () =>
    defineDocKittyIntegrations({ title: 'Docs', sidebar: sidebar as DocKittyOptions['sidebar'] });

  it('accepts a positive whole number and a non-empty label', () => {
    expect(define({ childCap: 30 })).not.toThrow();
    expect(define({ cappedLabel: 'All {count}' })).not.toThrow();
  });

  it.each([0, -1, 1.5, '10'])('refuses childCap %j, naming the setting', (value) => {
    expect(define({ childCap: value })).toThrow('[dk-config] sidebar.childCap must be a positive whole number');
  });

  it('refuses a blank or non-string cappedLabel', () => {
    expect(define({ cappedLabel: '  ' })).toThrow('[dk-config] sidebar.cappedLabel must be a non-empty string');
    expect(define({ cappedLabel: 3 })).toThrow('[dk-config] sidebar.cappedLabel must be a non-empty string');
  });

  it('hands both options to the route-shaping integration, and nothing when unset', () => {
    routeShapingCalls.length = 0;
    define({ childCap: 30, cappedLabel: 'All {count}' })();
    define({ indexLabel: 'Start' })();
    expect(routeShapingCalls).toHaveLength(2);
    expect(routeShapingCalls[0]).toMatchObject({ childCap: 30, cappedLabel: 'All {count}' });
    expect(routeShapingCalls[1]).not.toHaveProperty('childCap');
    expect(routeShapingCalls[1]).not.toHaveProperty('cappedLabel');
  });

  it('lists the new keys in the unknown-key message', () => {
    expect(define({ childcap: 3 })).toThrow(
      '[dk-config] unknown key "childcap" under sidebar; expected indexLabel, collapsed, titleIsIndex, childCap or cappedLabel',
    );
  });
});

describe('section sidebar.childCap in sections.yaml (FR-001, FR-002)', () => {
  const registry = (sidebar: string) =>
    parseSectionRegistry(
      `version: 1\nsections:\n  - id: adr\n    label: Decision Records\n    order: 30\n${sidebar}`,
      { source: 'sections.yaml', warn: () => {} },
    );

  it('carries a valid cap on the entry', () => {
    expect(registry('    sidebar:\n      childCap: 100\n')[0]!.sidebar).toEqual({ childCap: 100 });
    expect(registry('')[0]!.sidebar).toBeUndefined();
  });

  it('refuses an invalid cap, naming the section', () => {
    expect(() => registry('    sidebar:\n      childCap: 0\n')).toThrow(
      'sections.yaml: section "adr" sidebar.childCap must be a positive whole number',
    );
    expect(() => registry('    sidebar: 5\n')).toThrow('sections.yaml: section "adr" "sidebar" must be a mapping');
    expect(() => registry('    sidebar:\n      child_cap: 10\n')).toThrow(
      'sections.yaml: section "adr" sidebar has unknown key "child_cap"; known keys: childCap',
    );
  });
});

describe('hub frontmatter sidebar_child_cap (FR-001, FR-002)', () => {
  const build = z.object(docKittyFields).pick({ sidebar_child_cap: true } as never);
  const page = (extra: Record<string, unknown>) => ({
    title: 'Missions',
    description: 'All missions.',
    doc_status: 'active',
    updated: '2026-11-23T00:00:00Z',
    kind: 'Hub',
    ...extra,
  });

  it('is kept by the site schema when valid, and refused when not', () => {
    expect(build.safeParse({ sidebar_child_cap: 10 })).toMatchObject({ success: true, data: { sidebar_child_cap: 10 } });
    for (const bad of [0, -3, 2.5, '10']) expect(build.safeParse({ sidebar_child_cap: bad }).success).toBe(false);
  });

  it('is checked by the standalone frontmatter gate', () => {
    expect(validate('missions/README.md', page({ sidebar_child_cap: 10 })).problems).toEqual([]);
    expect(validate('missions/README.md', page({ sidebar_child_cap: 0 })).problems.join('\n')).toMatch(/sidebar_child_cap/);
  });
});

describe('UI string (FR-006)', () => {
  it('ships dockitty.sidebar.cappedEntry in English', () => {
    const injected: Array<Record<string, Record<string, string>>> = [];
    (DOC_KITTY_I18N_PLUGIN.hooks['i18n:setup'] as (arg: { injectTranslations: (t: Record<string, Record<string, string>>) => void }) => void)({
      injectTranslations: (t) => injected.push(t),
    });
    expect(injected[0]!.en![CAPPED_LABEL_KEY]).toBe(CAPPED_ENTRY_LABEL);
  });
});

/*
 * The paged hub listing (#342, WP01; FR-002, FR-003, FR-009, FR-019): the page
 * size, the paging arithmetic, the listing pages and the pagination strings.
 */
describe('resolveHubPageSize (#342, FR-003)', () => {
  it('takes the most specific level that is set, else 50', () => {
    expect(resolveHubPageSize({ hub: 5, section: 40, site: 20 })).toBe(5);
    expect(resolveHubPageSize({ section: 40, site: 20 })).toBe(40);
    expect(resolveHubPageSize({ site: 20 })).toBe(20);
    expect(resolveHubPageSize({})).toBe(DEFAULT_HUB_PAGE_SIZE);
    expect(DEFAULT_HUB_PAGE_SIZE).toBe(50);
  });
});

describe('isPagedHub and hubPageCount (#342, FR-005)', () => {
  const hub = (count: number, capped: boolean | undefined, pageSize?: number) => ({ count, capped, pageSize });

  it('pages a capped hub only when its children outnumber the page size', () => {
    expect(isPagedHub(hub(50, true, 50))).toBe(false);
    expect(isPagedHub(hub(51, true, 50))).toBe(true);
    expect(isPagedHub(hub(5000, false, 50))).toBe(false);
    expect(isPagedHub(hub(5000, undefined, 50))).toBe(false);
    // No page size recorded: the default applies.
    expect(isPagedHub(hub(51, true))).toBe(true);
    expect(isPagedHub(hub(50, true))).toBe(false);
  });

  it('counts the pages, with no empty last page', () => {
    expect(hubPageCount(hub(200, true, 50))).toBe(4);
    expect(hubPageCount(hub(120, true, 50))).toBe(3);
    expect(hubPageCount(hub(100, true, 50))).toBe(2);
    expect(hubPageCount(hub(51, true, 50))).toBe(2);
    expect(hubPageCount(hub(50, true, 50))).toBe(1);
    expect(hubPageCount(hub(5000, false, 50))).toBe(1);
  });
});

describe('hubPageSlice (#342, FR-007)', () => {
  const items = Array.from({ length: 120 }, (_, i) => `c${i + 1}`);

  it('splits the children into pages whose union is the input, in order, each once', () => {
    const pages = [1, 2, 3].map((page) => hubPageSlice(items, page, 50));
    expect(pages.map((p) => p.length)).toEqual([50, 50, 20]);
    expect(pages[0]![0]).toBe('c1');
    expect(pages[1]![0]).toBe('c51');
    expect(pages[2]!.at(-1)).toBe('c120');
    expect(pages.flat()).toEqual(items);
  });

  it('refuses a page outside 1..pages and a fractional page', () => {
    for (const bad of [0, 4, 1.5, -1, Number.NaN]) expect(() => hubPageSlice(items, bad, 50)).toThrow(RangeError);
    expect(hubPageSlice([], 1, 50)).toEqual([]);
    expect(() => hubPageSlice([], 2, 50)).toThrow(RangeError);
  });
});

describe('pagedHubSlug (#342, FR-007)', () => {
  it('is the hub for page 1 and <hub>/page/<n> after', () => {
    expect(pagedHubSlug('missions', 1)).toBe('missions');
    expect(pagedHubSlug('a/b', 3)).toBe('a/b/page/3');
    for (const bad of [0, -1, 2.5]) expect(() => pagedHubSlug('missions', bad)).toThrow(RangeError);
  });
});

describe('hubListingPages (#342, FR-007, FR-013)', () => {
  const children = (hub: string, n: number) =>
    Array.from({ length: n }, (_, i) => ({ slug: `${hub}/c-${i + 1}`, label: `C ${i + 1}` }));

  it('lists pages 2..n of every paged hub, by hub folder then page', () => {
    const hubs = new Map<string, HubCap>([
      ['zeta', { cap: 2, count: 5, children: children('zeta', 5), capped: true, pageSize: 2 }],
      ['alpha', { cap: 50, count: 120, children: children('alpha', 120), capped: true, pageSize: 50 }],
      ['small', { cap: 50, count: 3, children: children('small', 3), capped: false, pageSize: 1 }],
    ]);
    const pages = hubListingPages(hubs);
    expect(pages.map((p) => p.slug)).toEqual(['alpha/page/2', 'alpha/page/3', 'zeta/page/2', 'zeta/page/3']);
    expect(pages[0]).toMatchObject({ hub: 'alpha', page: 2, of: 3 });
    expect(pages[0]!.children.map((c) => c.slug)).toEqual(children('alpha', 120).slice(50, 100).map((c) => c.slug));
    expect(pages[3]!.children.map((c) => c.slug)).toEqual(['zeta/c-5']);
    expect(hubListingPages([...hubs.entries()])).toEqual(pages);
  });

  it('is empty when no hub is paged', () => {
    expect(hubListingPages(new Map())).toEqual([]);
    expect(hubListingPages([['x', { cap: 50, count: 10, children: children('x', 10), capped: false, pageSize: 5 }]])).toEqual([]);
  });
});

describe('HubCap widening (#342/#429, FR-002)', () => {
  it('still accepts a slice-1 HubCap, and types the new fields as optional', () => {
    const legacy: HubCap = { cap: 1, count: 2, children: [] };
    expect(legacy.capped).toBeUndefined();
    expectTypeOf<HubCap['capped']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<HubCap['pageSize']>().toEqualTypeOf<number | undefined>();
  });
});

describe('pagination UI strings (#342, FR-009)', () => {
  it('ships every pagination key in English', () => {
    const injected: Array<Record<string, Record<string, string>>> = [];
    (DOC_KITTY_I18N_PLUGIN.hooks['i18n:setup'] as (arg: { injectTranslations: (t: Record<string, Record<string, string>>) => void }) => void)({
      injectTranslations: (t) => injected.push(t),
    });
    expect(Object.values(HUB_PAGINATION_KEYS)).toHaveLength(5);
    for (const key of Object.values(HUB_PAGINATION_KEYS)) expect(injected[0]!.en![key]).toBe(HUB_PAGINATION_STRINGS[key]);
    expect(HUB_PAGINATION_STRINGS[HUB_PAGINATION_KEYS.label]).toBe('Pagination');
    expect(HUB_PAGINATION_STRINGS[HUB_PAGINATION_KEYS.title]).toBe('{title}, page {page}');
  });

  it('resolves a string with its variables, a translation, and an echoed key as none', () => {
    const translate = (strings: Record<string, string>) => (key: string) => strings[key] ?? key;
    expect(resolveHubString(HUB_PAGINATION_KEYS.title, { title: 'Missions', page: 2 })).toBe('Missions, page 2');
    expect(resolveHubString(HUB_PAGINATION_KEYS.page, { page: 3 }, translate({}))).toBe('Page 3');
    expect(resolveHubString(HUB_PAGINATION_KEYS.page, { page: 3 }, translate({ [HUB_PAGINATION_KEYS.page]: 'Seite {page}' }))).toBe('Seite 3');
    expect(resolveHubString(HUB_PAGINATION_KEYS.next, {}, () => '')).toBe('Next');
  });

  it('falls back to English when a translation drops a placeholder (squad: WCAG 2.5.3, 2.4.2)', () => {
    // A page label without {page} would give every page link one name and every
    // listing page one title; the English template keeps the number.
    const t = (strings: Record<string, string>) => (key: string) => strings[key] ?? key;
    expect(resolveHubString(HUB_PAGINATION_KEYS.page, { page: 3 }, t({ [HUB_PAGINATION_KEYS.page]: 'Ga naar pagina' }))).toBe('Page 3');
    expect(resolveHubString(HUB_PAGINATION_KEYS.title, { title: 'M', page: 2 }, t({ [HUB_PAGINATION_KEYS.title]: '{title}' }))).toBe('M, page 2');
    expect(resolveHubString(HUB_PAGINATION_KEYS.title, { title: 'M', page: 2 }, t({ [HUB_PAGINATION_KEYS.title]: 'p. {page} — {title}' }))).toBe('p. 2 — M');
    expect(resolveHubString(HUB_PAGINATION_KEYS.next, {}, t({ [HUB_PAGINATION_KEYS.next]: 'Volgende' }))).toBe('Volgende');
  });
});

/*
 * WP01 review folds (review cycle 1, folded in WP02): the pure API refuses an
 * invalid page size, ignores inherited names in its templates, lists a hub once,
 * and the surviving mutants are pinned.
 */
describe('page-size guard (WP01 review fold 1)', () => {
  const kids = Array.from({ length: 5 }, (_, i) => ({ slug: `h/${i}`, label: `${i}` }));

  it.each([0, -2, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('refuses page size %j with a RangeError', (size) => {
    expect(() => isPagedHub({ count: 5, capped: true, pageSize: size })).toThrow(RangeError);
    expect(() => hubPageCount({ count: 5, capped: true, pageSize: size })).toThrow(RangeError);
    expect(() => hubPageSlice(kids, 1, size)).toThrow(RangeError);
    expect(() => hubListingPages([['h', { cap: 1, count: 5, children: kids, capped: true, pageSize: size }]])).toThrow(RangeError);
  });

  it('still accepts a hub with no page size (the default) and a valid one', () => {
    expect(hubPageCount({ count: 5, capped: true })).toBe(1);
    expect(hubPageCount({ count: 5, capped: true, pageSize: 2 })).toBe(3);
  });
});

describe('resolveHubString templates (WP01 review folds 2 and 3)', () => {
  it('leaves an unknown or inherited {name} literal', () => {
    expect(resolveHubString(HUB_PAGINATION_KEYS.title, { page: 2 })).toBe('{title}, page 2');
    const custom = (template: string) => () => template;
    expect(resolveHubString(HUB_PAGINATION_KEYS.page, { page: 1 }, custom('{constructor} {toString} {page}'))).toBe(
      '{constructor} {toString} 1',
    );
  });

  it('defaults Previous to "Previous"', () => {
    expect(resolveHubString(HUB_PAGINATION_KEYS.previous, {})).toBe('Previous');
    expect(HUB_PAGINATION_STRINGS[HUB_PAGINATION_KEYS.previous]).toBe('Previous');
  });
});

describe('hubListingPages lists each hub once (WP01 review fold 4)', () => {
  it('keeps the first entry of a duplicate hub key from an iterable', () => {
    const kids = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `h/${i}`, label: `${i}` }));
    const pages = hubListingPages([
      ['h', { cap: 1, count: 4, children: kids(4), capped: true, pageSize: 2 }],
      ['h', { cap: 1, count: 6, children: kids(6), capped: true, pageSize: 2 }],
    ]);
    expect(pages.map((p) => [p.slug, p.of])).toEqual([['h/page/2', 2]]);
  });
});

describe('cappedHubCaps (#342 WP02: the sidebar sees capped hubs only)', () => {
  it('keeps capped hubs, and an entry without the flag (a module from before #429)', () => {
    const hub = (capped?: boolean): HubCap => ({ cap: 1, count: 2, children: [], ...(capped === undefined ? {} : { capped }) });
    const map = cappedHubCaps([
      ['a', hub(true)],
      ['b', hub(false)],
      ['c', hub()],
    ]);
    expect([...map.keys()]).toEqual(['a', 'c']);
  });
});
