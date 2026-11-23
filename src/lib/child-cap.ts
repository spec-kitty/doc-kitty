/**
 * The sidebar child cap (#341, large hubs slice 1): the pure API.
 *
 * A hub (a folder with an index page) whose published child count is above its
 * cap is shown in the sidebar as its index link plus one entry that links to
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
}

/** Hub folder (`missions`, `plans/missions`) → its cap data. Only hubs over their cap. */
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
