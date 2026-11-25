/**
 * The paged hub listing on BUILT output (#342, WP04; FR-007, FR-008, FR-009,
 * FR-010, FR-011, FR-012, FR-016, FR-017, FR-018, NFR-003; SC-001, SC-003). A
 * fixture site with a `missions` hub of 200 generated children is built with the
 * default cap (50) and page size (50):
 *
 *  1. the hub lists children 1–50 and `missions/page/2/`..`/4/` the rest, in the
 *     hub's order, each child once; following the pagination alone reaches them;
 *  2. a listing page is in the Starlight frame, self-canonical, titled
 *     "Missions, page N", with the capped entry current, no Starlight prev/next,
 *     in the search index, and its pagination marks N current (not a link);
 *  3. the sitemap lists every child and every listing page once;
 *  4. variants: an exact multiple, the page-size levels, a consumer sidebar, a
 *     translated locale, a `page` child, and two identical builds;
 *  5. locales paged to different depths: a listing page's hreflang links and
 *     language picker name only the locale listing pages that are built (the
 *     operator's Q9 ruling, 2026-11-25).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { BASE, REPO_ROOT, buildSite, builtPages, missionChildren, writeSite } from './fixtures/large-hub/site.mjs';
import { unbuiltListingAlternates } from '../lib/listing-alternates.js';

const BUILD_TIMEOUT = 300_000;
const root = (name: string) => path.join(REPO_ROOT, 'example', `.dk-test-sidebar-cap-paged-${name}`);
const SITES = {
  main: root('main'),
  again: root('again'),
  multiple: root('multiple'),
  levels: root('levels'),
  custom: root('custom'),
  locale: root('locale'),
  locales: root('locales'),
  clash: root('clash'),
  noclash: root('noclash'),
};

function build(dir: string, options: Parameters<typeof writeSite>[1]): Map<string, string> {
  writeSite(dir, options);
  const result = buildSite(dir);
  if (result.status !== 0) throw new Error(`fixture build failed:\n${result.output.slice(-4000)}`);
  return builtPages(path.join(dir, 'dist'));
}

/** The hub's listing order: by title, which counts down as the slug counts up. */
const hubOrder = (n: number) => missionChildren(n).slice().sort((a, b) => a.title.localeCompare(b.title, 'en')).map((c) => c.slug);

/** The card hrefs of a page's hub listing, base-free and without the trailing slash. */
function cards(html: string): string[] {
  const start = html.indexOf('<section class="dk-hub"');
  if (start === -1) return [];
  const list = html.slice(start, html.indexOf('</section>', start));
  return [...list.matchAll(/<a class="dk-hub__card" href="([^"]+)"/g)].map((m) => m[1]!.slice(BASE.length + 1, -1));
}

/** The pagination `<nav>` of a page, or ''. */
function pager(html: string): string {
  const start = html.indexOf('<nav class="dk-hub-pagination"');
  return start === -1 ? '' : html.slice(start, html.indexOf('</nav>', start) + 6);
}
const pagerLinks = (html: string) => [...pager(html).matchAll(/<a [^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]!.slice(BASE.length + 1, -1));

/** A page's hreflang `<link>`s as `<lang> <route>`, in order. */
const hreflangs = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="[^"]*?\/site\/([^"]*?)\/?"\/?>/g)].map((m) => `${m[1]} ${m[2]}`);
/** A page's language picker options (desktop and mobile) as `<route> <label>`, in order. */
const pickerOptions = (html: string) =>
  [...html.matchAll(/<starlight-lang-select>[\s\S]*?<\/starlight-lang-select>/g)].flatMap((block) =>
    [...block[0].matchAll(/<option value="\/site\/([^"]*?)\/?"[^>]*>([^<]*)<\/option>/g)].map((m) => `${m[1]} ${m[2]}`),
  );

function sitemapLocs(dir: string): string[] {
  const dist = path.join(dir, 'dist');
  return readdirSync(dist)
    .filter((name) => /^sitemap-\d+\.xml$/.test(name))
    .flatMap((name) => [...readFileSync(path.join(dist, name), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!));
}

let main: Map<string, string>;

beforeAll(() => {
  main = build(SITES.main, { missions: 200 });
}, BUILD_TIMEOUT);

afterAll(() => {
  for (const dir of Object.values(SITES)) rmSync(dir, { recursive: true, force: true });
});

describe('a 200-child hub, default cap and page size (US1, SC-001)', () => {
  const order = hubOrder(200);

  it('lists 1–50 on the hub and 51–200 on page/2..4, in hub order', () => {
    expect(cards(main.get('missions')!)).toEqual(order.slice(0, 50));
    expect(cards(main.get('missions/page/2')!)).toEqual(order.slice(50, 100));
    expect(cards(main.get('missions/page/3')!)).toEqual(order.slice(100, 150));
    expect(cards(main.get('missions/page/4')!)).toEqual(order.slice(150, 200));
  });

  it('builds no page/1 and no page past the last', () => {
    expect(main.has('missions/page/1')).toBe(false);
    expect(main.has('missions/page/5')).toBe(false);
  });

  it('reaches every child, once, by following the pagination alone from the hub', () => {
    const seen: string[] = [];
    const queue = ['missions'];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const route = queue.shift()!;
      if (visited.has(route)) continue;
      visited.add(route);
      const html = main.get(route);
      expect(html, route).toBeDefined();
      seen.push(...cards(html!));
      for (const next of pagerLinks(html!)) if (!visited.has(next)) queue.push(next);
    }
    expect([...visited].sort()).toEqual(['missions', 'missions/page/2', 'missions/page/3', 'missions/page/4']);
    expect(seen.slice().sort()).toEqual(order.slice().sort());
    expect(new Set(seen).size).toBe(200);
  });
});

describe('a listing page (US2, US3: FR-008, FR-010, FR-011)', () => {
  it('sits in the Starlight frame, self-canonical, titled with its page', () => {
    const html = main.get('missions/page/3')!;
    expect(html).toContain('id="starlight__sidebar"');
    expect(html).toContain('<link rel="canonical" href="https://example.test/site/missions/page/3/"');
    expect(html).toMatch(/<title>Missions, page 3 \|/);
    expect(html).toContain('data-pagefind-body');
    expect(html).toContain('<p>Fixture page.</p>');
  });

  it('marks the capped entry, and only it, current in the sidebar', () => {
    const sidebar = main.get('missions/page/3')!.split('id="starlight__sidebar"')[1]!.split('data-dk-sidebar-reveal')[0]!;
    const current = [...sidebar.matchAll(/<a href="([^"]*)"[^>]*aria-current="page"[^>]*>\s*<span[^>]*>([^<]*)</g)].map((m) => [m[1], m[2]!.trim()]);
    expect(current).toEqual([[`${BASE}/missions/`, '200 pages']]);
  });

  it('has no Starlight prev/next: rel="prev"/"next" only inside the pagination', () => {
    for (const route of ['missions/page/2', 'missions/page/3', 'missions/page/4']) {
      const html = main.get(route)!;
      const outside = html.replace(pager(html), '');
      expect(outside, route).not.toMatch(/rel="(prev|next)"/);
    }
  });

  it('marks the current page as aria-current text, links the others with rel and labels (FR-008)', () => {
    const nav = pager(main.get('missions/page/3')!);
    expect(nav).toContain('<nav class="dk-hub-pagination" aria-label="Pagination">');
    expect(nav).toContain('<span class="dk-hub-pagination__current" aria-current="page"><span class="sr-only">Page </span>3</span>');
    expect(nav).not.toMatch(/<a [^>]*aria-current/);
    expect(nav).toMatch(new RegExp(`<a class="dk-hub-pagination__link dk-hub-pagination__step" href="${BASE}/missions/page/2/" rel="prev">Previous</a>`));
    expect(nav).toMatch(new RegExp(`<a class="dk-hub-pagination__link dk-hub-pagination__step" href="${BASE}/missions/page/4/" rel="next">Next</a>`));
    expect(nav).toContain(`<a class="dk-hub-pagination__link" href="${BASE}/missions/" aria-label="Page 1">1</a>`);
    expect(pager(main.get('missions')!)).toContain('dk-hub-pagination__step--off">Previous</span>');
    expect(pager(main.get('missions/page/4')!)).toContain('dk-hub-pagination__step--off">Next</span>');
  });
});

describe('the sitemap (FR-012, SC-003)', () => {
  it('lists every child and every listing page, each once', () => {
    const locs = sitemapLocs(SITES.main);
    for (const slug of hubOrder(200)) expect(locs.filter((l) => l === `https://example.test${BASE}/${slug}/`), slug).toHaveLength(1);
    for (const n of [2, 3, 4]) expect(locs.filter((l) => l === `https://example.test${BASE}/missions/page/${n}/`)).toHaveLength(1);
    expect(locs.some((l) => l.endsWith('/missions/page/1/'))).toBe(false);
  });
});

describe('variants (FR-003, FR-016, FR-017, FR-018, NFR-003)', () => {
  it('an exact multiple has no empty last page', () => {
    const pages = build(SITES.multiple, { missions: 100 });
    expect(pages.has('missions/page/2')).toBe(true);
    expect(pages.has('missions/page/3')).toBe(false);
  }, BUILD_TIMEOUT);

  it('the hub frontmatter page size wins over the site\'s', () => {
    const pages = build(SITES.levels, { missions: 200, hubPageSize: 30, pageSize: 80 });
    expect(cards(pages.get('missions')!)).toHaveLength(30);
    expect(pages.has('missions/page/7')).toBe(true);
    expect(pages.has('missions/page/8')).toBe(false);
    expect(cards(pages.get('missions/page/7')!)).toHaveLength(20);
  }, BUILD_TIMEOUT);

  it('a consumer sidebar gets the same listing pages, and its sidebar as written (FR-017)', () => {
    const pages = build(SITES.custom, { missions: 200, customSidebar: true });
    for (const route of ['missions', 'missions/page/2', 'missions/page/3', 'missions/page/4']) {
      expect(cards(pages.get(route)!), route).toEqual(cards(main.get(route)!));
      expect(pager(pages.get(route)!), route).toBe(pager(main.get(route)!));
    }
    expect(pages.get('missions/page/2')!).not.toContain('200 pages');
  }, BUILD_TIMEOUT);

  it('a translated locale hub gets its own listing pages with its strings (FR-009, FR-018)', () => {
    const pages = build(SITES.locale, { missions: 10, fr: 120 });
    const html = pages.get('fr/missions/page/2');
    expect(html).toBeDefined();
    expect(html).toContain('lang="fr"');
    expect(pager(html!)).toContain('aria-label="Pagination (fr)"');
    expect(pager(html!)).toContain('>Suivant</a>');
    // A string the locale does not translate falls back to English.
    expect(pager(html!)).toContain('rel="prev">Previous</a>');
    expect(pages.has('fr/missions/page/3')).toBe(true);
    expect(pages.has('missions/page/2')).toBe(false);
    // English is not paged, so a French listing page has no English alternate
    // and no x-default (both would name an unbuilt `missions/page/2/`) (Q9).
    expect(hreflangs(html!)).toEqual(['fr fr/missions/page/2']);
    expect(pickerOptions(html!)).toEqual(['fr/missions/page/2 Français', 'fr/missions/page/2 Français']);
    expect(hreflangs(pages.get('fr/missions')!), 'the hub page keeps every alternate').toHaveLength(3);
  }, BUILD_TIMEOUT);

  it('locales paged to different depths: alternates name only built listing pages (Q9)', () => {
    const pages = build(SITES.locales, { missions: 200, fr: 120 });
    const built = new Set([...pages.keys()]);
    // en has 4 listing pages, fr 3: en page/4 has no fr alternate in its head or picker.
    expect(hreflangs(pages.get('missions/page/4')!)).toEqual(['en missions/page/4', 'x-default missions/page/4']);
    expect(pickerOptions(pages.get('missions/page/4')!)).toEqual(['missions/page/4 English', 'missions/page/4 English']);
    // Where both are built, both stay.
    for (const route of ['missions/page/2', 'missions/page/3', 'fr/missions/page/2', 'fr/missions/page/3']) {
      const twin = route.startsWith('fr/') ? route.slice(3) : route;
      expect(hreflangs(pages.get(route)!), route).toEqual([`en ${twin}`, `fr fr/${twin}`, `x-default ${twin}`]);
      expect(pickerOptions(pages.get(route)!), route).toEqual([
        `${twin} English`, `fr/${twin} Français`, `${twin} English`, `fr/${twin} Français`,
      ]);
    }
    // The built-HTML check: no built page names an unbuilt listing page.
    for (const [route, html] of pages) expect(unbuiltListingAlternates(html, BASE, built), route).toEqual([]);
  }, BUILD_TIMEOUT);

  it('a page child of a paged hub fails the build; the same child under an unpaged hub builds (FR-016)', () => {
    writeSite(SITES.clash, { missions: 200, pageChild: true });
    const result = buildSite(SITES.clash);
    expect(result.status).not.toBe(0);
    expect(result.output).toContain('[dk-hubs] hub "missions" is paged, but its child "missions/page" would collide');
    expect(() => build(SITES.noclash, { missions: 200, pageChild: true, hubCap: 500 })).not.toThrow();
  }, 2 * BUILD_TIMEOUT);

  it('two builds give identical listing pages (NFR-003)', () => {
    const again = build(SITES.again, { missions: 200 });
    const mask = (html: string) => html.replaceAll(SITES.again, '<site>').replaceAll(SITES.main, '<site>');
    for (const route of ['missions', 'missions/page/2', 'missions/page/4']) expect(mask(again.get(route)!), route).toBe(mask(main.get(route)!));
  }, BUILD_TIMEOUT);
});
