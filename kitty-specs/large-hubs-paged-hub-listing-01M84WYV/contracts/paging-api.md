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

/** Is this hub paged? `capped && count > pageSize`. */
export function isPagedHub(hub: Pick<HubCap, 'count' | 'capped' | 'pageSize'>): boolean;

/** Number of listing pages: ceil(count / pageSize) when paged, else 1. */
export function hubPageCount(hub: Pick<HubCap, 'count' | 'capped' | 'pageSize'>): number;

/** The children on page `page` (1-based). Throws RangeError outside 1..hubPageCount. */
export function hubPageSlice<T>(children: readonly T[], page: number, pageSize: number): T[];

/** Base-free slug of listing page N: the hub itself for 1, `<hub>/page/<N>` otherwise. */
export function pagedHubSlug(hub: string, page: number): string;
```

The build reports a `page` collision (R8) as an error thrown from the route-shaping data generation, not through this pure API.
