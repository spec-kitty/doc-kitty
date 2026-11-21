---
affected_files: []
cycle_number: 1
mission_slug: diagram-dark-contrast-label-clipping-01M801Y5
reproduction_command:
reviewed_at: '2026-11-21T22:24:00Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP01
---

# WP01 review cycle 1 — REQUEST_CHANGES (reviewer: claude::reviewer-renata)

1. Blocker — tests/a11y/helpers/legibility.ts: hiding a label owner with `visibility:hidden` also hides its own background (`.edgeLabel p{background-color:var(--dk-diagram-node-fill)}`), so edge labels read the translucent `.labelBkg` layer and report a false 2.8–2.88:1. Hide only the glyphs.
2. Minor — edges with no parseable stroke or all points under labels are skipped silently; assert per-figure counts (3, 2, 2, 3) or report skips.
3. Minor — sample points are not clipped to the figure's visible box (`.dk-diagram` scrolls horizontally).
4. Minor — a label colour with alpha < 1 is treated as opaque; blend or reject.
5. Minor — fixture uses `doc_status: draft` where the WP said `active`; justified (published projects do not run this spec; precedent draft-preview.md), record it in the WP history.

Addressed in c1930bd (1–4). (5): draft keeps the page out of the published sitemap, whose count is pinned in src/scripts/assert-build-artifacts.mjs, a file PR #405 owns (C-002).
