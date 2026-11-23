---
affected_files: []
cycle_number: 3
mission_slug: large-hubs-sidebar-child-cap-01M81KGV
reproduction_command:
reviewed_at: '2026-11-23T10:26:25Z'
reviewer_agent: claude::implementer-ivan
wp_id: WP04
---

# WP04 rework: fold the review-cycle-2 follow-ups before consolidation

Requested by the dispatcher (relaying the operator's preference for re-review on lane-d over a deferred issue).

- F1: a label-only `{ label }` override (no `link`) is not treated as label-only; with the OpenAPI renderer on it gets the capped entry's neighbour.
- F2: on a child hidden from Starlight's tree, a label-only override gets no link with OpenAPI off (`shapePagination`'s `at === -1` branch).
- Fix: one `paginationFollow` normaliser, used by `shapePagination` (the capped-only branch) and the OpenAPI hand-off.
- Nits: name `src/tests/sidebar-child-cap.test.ts` as out-of-map; move the #341 AXE_PAGES entries out from between the #250 comment and its entry; drop the stale arithmetic from the sitemap fail message; ABBA order in `measure.mjs`.
