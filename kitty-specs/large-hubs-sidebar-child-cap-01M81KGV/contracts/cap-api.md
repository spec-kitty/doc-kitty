# Contract: the cap API (exported from `@spec-kitty/doc-toolkit/route-shaping` sources, `src/lib/route-shaping.ts`)

```ts
export const DEFAULT_CHILD_CAP = 50;
export const CAPPED_LABEL_KEY = 'dockitty.sidebar.cappedEntry';
export const CAPPED_ENTRY_LABEL = '{count} pages';

export interface HubCap { cap: number; count: number; children: { slug: string; label: string }[] }
export type HubCapMap = ReadonlyMap<string, HubCap>;

/** Most specific first: hub frontmatter, section, site, default. */
export function resolveChildCap(levels: { hub?: number; section?: number; site?: number }): number;

/** Producer hint: should a child of a hub with `childCount` children be `sidebar.hidden`? */
export function cappedChildHidden(childCount: number, cap: number): boolean;

/** Option, else the locale's translation, else the default; `{count}` replaced. */
export function resolveCappedLabel(count: number, option?: string, translate?: (key: string) => unknown): string;

// ShapeSidebarOptions gains:
//   hubCaps?: HubCapMap;           // absent/empty = no capping
//   cappedLabel?: (count: number) => string;
//   currentSlug?: string;          // base-free slug of the page being rendered
//
// New pure helper for the middleware:
export function expandCappedGroups(shaped: readonly SidebarEntry[], hubCaps: HubCapMap, base: string, currentSlug: string): SidebarEntry[];
```

#342 consumes `HubCap.children` (order and count) and `resolveChildCap`.
