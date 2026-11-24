# Contract: the cap API

The pure API lives in `src/lib/child-cap.ts`, is served as the package export
`@spec-kitty/doc-toolkit/child-cap`, and is re-exported from `src/lib/route-shaping.ts`.

```ts
export const DEFAULT_CHILD_CAP = 50;
export const CAPPED_LABEL_KEY = 'dockitty.sidebar.cappedEntry';
export const CAPPED_ENTRY_LABEL = '{count} pages';

export interface HubCapChild { slug: string; label: string }
export interface HubCap { cap: number; count: number; children: HubCapChild[] }
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
export function isChildCap(value: unknown): value is number;
export function isCappedEntry(entry: SidebarEntry): entry is CappedEntry; // dkCappedHub marker
export function expandCappedGroups(shaped: SidebarEntry[], hubCaps: HubCapMap, currentSlug: string): SidebarEntry[];
// hrefs follow the capped entry's own href form (base, trailing slash), so no base argument
```

#342 consumes `HubCap.children` (order and count) and `resolveChildCap`.
