# Contract: paging additions to `@spec-kitty/doc-toolkit/child-cap`

These are additions only. Every slice-1 export keeps its signature (FR-002).

```ts
/** The page size when no setting applies. */
export const DEFAULT_HUB_PAGE_SIZE = 50;

/** UI-string keys for the pagination (English defaults in the i18n plugin). */
export const HUB_PAGINATION_KEYS = {
  label: 'dockitty.hub.pagination.label',       // "Pagination"
  previous: 'dockitty.hub.pagination.previous', // "Previous"
  next: 'dockitty.hub.pagination.next',         // "Next"
  page: 'dockitty.hub.pagination.page',         // "Page {page}"
  title: 'dockitty.hub.pagination.title',       // "{title}, page {page}"
} as const;

export interface HubCap {
  cap: number;
  count: number;
  children: HubCapChild[];
  /** #342/#429: count > cap. Optional in the type so slice-1 producers still type-check; the build always sets it. */
  capped?: boolean;
  /** #342: the resolved page size. Optional in the type for the same reason; the build always sets it. */
  pageSize?: number;
}

/** Hub folder → its data. Since #429: every published `kind: Hub` hub, capped or not. */
export type HubCapMap = ReadonlyMap<string, HubCap>;

/** Most specific first: hub frontmatter `hub_page_size`, section `hub.pageSize`, site `hub.pageSize`, then 50. */
export function resolveHubPageSize(levels: { hub?: number; section?: number; site?: number }): number;

/** The input of the paging predicates. */
export type PagedHubInput = Pick<HubCap, 'count' | 'capped' | 'pageSize'>;

/**
 * Is this hub paged? `capped && count > pageSize`. Throws RangeError when
 * `pageSize` is set but not a positive whole number, whether or not the hub is capped.
 */
export function isPagedHub(hub: PagedHubInput): boolean;

/** Number of listing pages: ceil(count / pageSize) when paged, else 1. Throws RangeError as `isPagedHub`. */
export function hubPageCount(hub: PagedHubInput): number;

/** The children on page `page` (1-based). Throws RangeError outside 1..hubPageCount, or for an invalid `pageSize`. */
export function hubPageSlice<T>(children: readonly T[], page: number, pageSize: number): T[];

/** Base-free slug of listing page N: the hub itself for 1, `<hub>/page/<N>` otherwise. */
export function pagedHubSlug(hub: string, page: number): string;

/** One listing page from 2 on. */
export interface HubListingPage {
  hub: string;           // the hub folder
  page: number;          // 2 or more
  of: number;            // the hub's page count
  slug: string;          // `<hub>/page/<page>`, base-free
  children: HubCapChild[]; // the children on this page, in the hub's order
}

/** Every listing page from 2 on of every paged hub, hubs in code-unit order; the first entry of a repeated hub wins. */
export function hubListingPages(hubs: HubCapMap | Iterable<readonly [string, HubCap]>): HubListingPage[];

/** A pagination UI-string key. */
export type HubPaginationKey = (typeof HUB_PAGINATION_KEYS)[keyof typeof HUB_PAGINATION_KEYS];

/** The English defaults of the pagination strings, by key. */
export const HUB_PAGINATION_STRINGS: Readonly<Record<HubPaginationKey, string>>;

/**
 * A pagination string: the locale's translation of `key` (Starlight's `locals.t`),
 * else the English default, with each `{name}` replaced from `vars`. A translation
 * that drops a placeholder of the English template (`{page}`, `{title}`) is not used.
 */
export function resolveHubString(
  key: HubPaginationKey,
  vars: Readonly<Record<string, string | number>>,
  translate?: (key: string) => unknown,
): string;

/**
 * #429: the hubs the sidebar caps, from data that lists every hub. Keeps the entries
 * whose `capped` is not `false` (an entry without the flag, from data generated
 * before #429, counts as capped). Sidebar shaping filters the build data through it,
 * so an uncapped hub keeps its sidebar group exactly as before.
 */
export function cappedHubCaps(hubs: Iterable<readonly [string, HubCap]>): Map<string, HubCap>;
```

The build reports a `page` collision (R8) as an error thrown from the route-shaping data generation, not through this pure API.
