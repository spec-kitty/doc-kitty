/**
 * The sidebar child cap (#341, large hubs slice 1): the pure API.
 *
 * A hub (a folder whose published index page has `kind: Hub`) that lists more
 * pages than its cap is shown in the sidebar as its index link plus one entry that links to
 * the hub ("200 pages"). This module holds the rules every surface shares: what
 * a valid cap is, which setting wins, when a generated producer should hide a
 * child, and how the entry is labelled. It is fs-free and Astro-free, so config
 * evaluation, the route-shaping integration, the route middleware and the paged
 * hub listing (#342) all import the same definitions.
 */

/** The cap when no setting applies. */
export const DEFAULT_CHILD_CAP = 50;

/** The Starlight UI-string key the capped entry's label is translated through. */
export const CAPPED_LABEL_KEY = 'dockitty.sidebar.cappedEntry';

/** The capped entry's English label; `{count}` is replaced with the child count. */
export const CAPPED_ENTRY_LABEL = '{count} pages';

/** One child of a capped hub, in the hub's listing order. */
export interface HubCapChild {
  /** Base-free route slug (`missions/alpha`). A sub-folder is listed by its own slug. */
  slug: string;
  /** The child's `sidebar.label`, else its `title`: what its sidebar link would read. */
  label: string;
}

/** What the build knows about one hub over its cap. */
export interface HubCap {
  /** The resolved cap. */
  cap: number;
  /** The number of published children, as the hub page lists them. */
  count: number;
  /** The children in the hub's listing order (`selectHubChildren`). */
  children: HubCapChild[];
  /**
   * Whether the hub is over its cap (`count > cap`), #342/#429. Optional in the
   * type so code written against slice 1 still type-checks; the build always sets it.
   */
  capped?: boolean;
  /**
   * The hub's resolved listing page size (#342). Optional in the type for the same
   * reason; the build always sets it.
   */
  pageSize?: number;
}

/**
 * Hub folder (`missions`, `plans/missions`) → its data. Since #429 it holds every
 * published `kind: Hub` hub, capped or not; `capped` tells them apart.
 */
export type HubCapMap = ReadonlyMap<string, HubCap>;

/** The one definition of a valid cap: a positive whole number. */
export function isChildCap(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * A hub's cap, most specific setting first: the hub's `sidebar_child_cap`
 * frontmatter, then its section's `sidebar.childCap` in `sections.yaml`, then
 * the site's `sidebar.childCap`, then {@link DEFAULT_CHILD_CAP}. The values are
 * validated where they are read.
 */
export function resolveChildCap(levels: { hub?: number; section?: number; site?: number }): number {
  return levels.hub ?? levels.section ?? levels.site ?? DEFAULT_CHILD_CAP;
}

/**
 * The hint for a generated-pages producer: should a child of a hub with
 * `childCount` children be written with `sidebar: { hidden: true }`? True
 * exactly when the hub is capped, so Starlight never builds entries the cap
 * would drop. Sidebar shaping does not depend on the hint.
 */
export function cappedChildHidden(childCount: number, cap: number): boolean {
  return childCount > cap;
}

/**
 * The capped entry's label: the `sidebar.cappedLabel` option, else the locale's
 * translation of {@link CAPPED_LABEL_KEY}, else {@link CAPPED_ENTRY_LABEL}, with
 * every `{count}` replaced by the plain count (no locale formatting, so the
 * build does not depend on the host). `translate` is Starlight's `locals.t`;
 * i18next echoes the key back for a missing string, which counts as none.
 */
export function resolveCappedLabel(count: number, option?: string, translate?: (key: string) => unknown): string {
  let template = option;
  if (!template) {
    const translated = translate?.(CAPPED_LABEL_KEY);
    template =
      typeof translated === 'string' && translated !== '' && translated !== CAPPED_LABEL_KEY
        ? translated
        : CAPPED_ENTRY_LABEL;
  }
  return template.replaceAll('{count}', String(count));
}

/*
 * The paged hub listing (#342, large hubs slice 2). A capped hub whose children
 * outnumber its page size lists its first page on the hub page and the rest on
 * `/<hub>/page/N/`. The rules below are shared by the hub page, the paged route,
 * the agent API and `llms.txt`, so they cannot disagree on a page's children.
 */

/** The listing page size when no setting applies. */
export const DEFAULT_HUB_PAGE_SIZE = 50;

/** The Starlight UI-string keys of the hub pagination. */
export const HUB_PAGINATION_KEYS = {
  label: 'dockitty.hub.pagination.label',
  previous: 'dockitty.hub.pagination.previous',
  next: 'dockitty.hub.pagination.next',
  page: 'dockitty.hub.pagination.page',
  title: 'dockitty.hub.pagination.title',
} as const;

/** A key of {@link HUB_PAGINATION_KEYS}. */
export type HubPaginationKey = (typeof HUB_PAGINATION_KEYS)[keyof typeof HUB_PAGINATION_KEYS];

/** The English defaults of the pagination strings. `{name}` is replaced by {@link resolveHubString}. */
export const HUB_PAGINATION_STRINGS: Readonly<Record<HubPaginationKey, string>> = {
  [HUB_PAGINATION_KEYS.label]: 'Pagination',
  [HUB_PAGINATION_KEYS.previous]: 'Previous',
  [HUB_PAGINATION_KEYS.next]: 'Next',
  [HUB_PAGINATION_KEYS.page]: 'Page {page}',
  [HUB_PAGINATION_KEYS.title]: '{title}, page {page}',
};

/**
 * A hub's listing page size, most specific setting first: the hub's
 * `hub_page_size` frontmatter, then its section's `hub.pageSize`, then the site's
 * `hub.pageSize`, then {@link DEFAULT_HUB_PAGE_SIZE}. The values are validated
 * where they are read.
 */
export function resolveHubPageSize(levels: { hub?: number; section?: number; site?: number }): number {
  return levels.hub ?? levels.section ?? levels.site ?? DEFAULT_HUB_PAGE_SIZE;
}

/** What paging needs to know about a hub. */
export type PagedHubInput = Pick<HubCap, 'count' | 'capped' | 'pageSize'>;

/**
 * A hub's page size, checked: the default when unset, a `RangeError` when it is
 * not a positive whole number. The API is exported for page producers (FR-019),
 * so a bad value must fail rather than page forever or slice nothing.
 */
function checkedPageSize(pageSize: number | undefined): number {
  if (pageSize === undefined) return DEFAULT_HUB_PAGE_SIZE;
  if (!isChildCap(pageSize)) throw new RangeError(`[dk-hubs] page size ${pageSize} is not a positive whole number`);
  return pageSize;
}

/**
 * Is the hub paged? Only a hub over its sidebar child cap is, and only when its
 * children outnumber its page size. Every other hub lists all its children on
 * its own page, as before #342.
 */
export function isPagedHub(hub: PagedHubInput): boolean {
  const pageSize = checkedPageSize(hub.pageSize);
  return hub.capped === true && hub.count > pageSize;
}

/** The number of listing pages: one per page size of children when paged, else one. */
export function hubPageCount(hub: PagedHubInput): number {
  return isPagedHub(hub) ? Math.ceil(hub.count / checkedPageSize(hub.pageSize)) : 1;
}

/**
 * The children listed on page `page` (1-based). Throws a `RangeError` for a page
 * that is not a whole number from 1 to the last page; a hub with no children has
 * one, empty, page.
 */
export function hubPageSlice<T>(children: readonly T[], page: number, pageSize: number): T[] {
  checkedPageSize(pageSize);
  const pages = Math.max(1, Math.ceil(children.length / pageSize));
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    throw new RangeError(`[dk-hubs] page ${page} is outside 1..${pages}`);
  }
  return children.slice((page - 1) * pageSize, page * pageSize);
}

/** The base-free route slug of listing page `page`: the hub itself for 1, `<hub>/page/<page>` after. */
export function pagedHubSlug(hub: string, page: number): string {
  if (!Number.isInteger(page) || page < 1) throw new RangeError(`[dk-hubs] page ${page} is not a whole number from 1`);
  return page === 1 ? hub : `${hub}/page/${page}`;
}

/** One listing page from 2 on: the pages the paged route builds and the agent surfaces list. */
export interface HubListingPage {
  /** The hub folder (`missions`). */
  hub: string;
  /** The page number, 2 or more. */
  page: number;
  /** The hub's page count. */
  of: number;
  /** The page's base-free route slug (`missions/page/2`). */
  slug: string;
  /** The children listed on the page, in the hub's order. */
  children: HubCapChild[];
}

/**
 * Every listing page from 2 on of every paged hub, by hub folder (code-unit order)
 * then page. Page 1 is the hub page itself, so it is not listed. A hub folder
 * that occurs twice in an iterable is listed once, from its first entry (as the
 * build keeps the first index of a duplicate slug).
 */
export function hubListingPages(hubs: HubCapMap | Iterable<readonly [string, HubCap]>): HubListingPage[] {
  const first = new Map<string, HubCap>();
  for (const [hub, data] of hubs) if (!first.has(hub)) first.set(hub, data);
  const entries = [...first].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const out: HubListingPage[] = [];
  for (const [hub, data] of entries) {
    if (!isPagedHub(data)) continue;
    const of = hubPageCount(data);
    const pageSize = checkedPageSize(data.pageSize);
    for (let page = 2; page <= of; page += 1) {
      out.push({ hub, page, of, slug: pagedHubSlug(hub, page), children: hubPageSlice(data.children, page, pageSize) });
    }
  }
  return out;
}

/**
 * A pagination string: the locale's translation of `key`, else its English
 * default, with every `{name}` replaced by `vars[name]`. `translate` is
 * Starlight's `locals.t`; i18next echoes the key back for a missing string,
 * which counts as none (as in {@link resolveCappedLabel}).
 */
export function resolveHubString(
  key: HubPaginationKey,
  vars: Readonly<Record<string, string | number>>,
  translate?: (key: string) => unknown,
): string {
  const translated = translate?.(key);
  const template =
    typeof translated === 'string' && translated !== '' && translated !== key ? translated : HUB_PAGINATION_STRINGS[key];
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));
}

/**
 * The hubs the sidebar caps: the entries marked `capped`, and an entry without
 * the flag (a module generated before #429 listed capped hubs only). Since #429
 * the build data lists every hub, so sidebar shaping filters it through here and
 * an uncapped hub keeps its group exactly as before.
 */
export function cappedHubCaps(hubs: Iterable<readonly [string, HubCap]>): Map<string, HubCap> {
  const out = new Map<string, HubCap>();
  for (const [hub, data] of hubs) if (data.capped !== false) out.set(hub, data);
  return out;
}
