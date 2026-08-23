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

/** An Astro layout component the carrier renders around the content slot. */
type LayoutComponent = typeof Default;

/**
 * `kind → layout` registrations. Open vocabulary (ADR-0009): keyed by the raw
 * `kind` string, so an unknown/absent kind simply misses the map and falls back
 * to `Default` in `resolveLayout`.
 *
 * EMPTY in M1. WP04 adds: `Hub: HubLayout`.
 */
export const kindLayouts: Record<string, LayoutComponent> = {};

/** Resolve the layout for a page `kind`; unknown/absent → `Default`. */
export function resolveLayout(kind: string | undefined): LayoutComponent {
  return (kind && kindLayouts[kind]) || Default;
}
