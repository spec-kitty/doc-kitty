/**
 * Static `kind → layout` map (ADR-0013 single-layer substrate, M1).
 *
 * Resolved at a SINGLE import site — the `MarkdownContent` carrier — which reads
 * `entry.data.kind` and wraps the content in `resolveLayout(kind)`.
 *
 * The map ships EMPTY in M1 (Default-only) on purpose: 6 `kind: Hub` pages are
 * already live after WP01's migration, and `Hub.astro` does NOT exist until
 * WP04. A `Hub: () => import('./Hub.astro')` entry here would fail Vite/Rollup
 * resolution and turn WP02's build red (violating C-010). So every kind — Hub
 * included — resolves to `Default` now; WP04 registers the `Hub` key as a
 * recorded out-of-map edit to THIS file once `Hub.astro` lands. M2 replaces this
 * static module with the merged theme manifest at the same carrier import site.
 */
import Default from './Default.astro';
import Hub from './Hub.astro';

/** An Astro layout component the carrier renders around the content slot. */
type LayoutComponent = typeof Default;

/**
 * `kind → layout` registrations. Open vocabulary (ADR-0009): keyed by the raw
 * `kind` string, so an unknown/absent kind simply misses the map and falls back
 * to `Default` in `resolveLayout`.
 *
 * WP04 recorded out-of-map edit: registers `Hub` now that `Hub.astro` exists, so
 * the 6 live `kind: Hub` pages (the section READMEs, tagged by WP01) resolve to
 * the bespoke in-frame Hub layout instead of `Default`. This is the single line
 * the M1 header of this WP02-owned file anticipated ("WP04 adds: `Hub`").
 */
export const kindLayouts: Record<string, LayoutComponent> = {
  Hub,
};

/** Resolve the layout for a page `kind`; unknown/absent → `Default`. */
export function resolveLayout(kind: string | undefined): LayoutComponent {
  return (kind && kindLayouts[kind]) || Default;
}
