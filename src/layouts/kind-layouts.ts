/**
 * Static `kind → layout` map (ADR-0013 single-layer substrate, M1).
 *
 * Resolved at a SINGLE import site — the `MarkdownContent` carrier — which reads
 * `entry.data.kind` and wraps the content in `resolveLayout(kind)`.
 *
 * Shipped state (M1, after WP04): `Hub` is the ONLY registered kind — the 6
 * live `kind: Hub` pages (the section READMEs tagged by WP01) resolve to the
 * bespoke in-frame `Hub.astro` layout. Every OTHER kind — known or unknown —
 * falls back to `Default` via `resolveLayout`. M2 swaps this static module for
 * the merged theme manifest at the single carrier import site (MarkdownContent),
 * without changing that call site.
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
