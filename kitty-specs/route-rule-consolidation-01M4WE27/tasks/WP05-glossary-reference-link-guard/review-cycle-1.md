---
affected_files: []
cycle_number: 1
mission_slug: route-rule-consolidation-01M4WE27
reproduction_command:
reviewed_at: '2026-10-14T06:35:47Z'
reviewer_agent: claude
wp_id: WP05
---

# WP05 review feedback (reviewer-renata)

Guard change and tests are correct and non-vacuous (removing linkReference/definition from isGuardType turns 4 new tests red; 31/31 green with it). One required fix:

1. src/tests/glossary-autolink.test.ts header comment (lines 4-5) says the matrix runs "over hand-built mdast — no Astro, unified, or vfile runtime". The new FR-011 block now imports `unified` + `remark-parse` and parses real Markdown. Update the comment to be accurate, e.g. "mostly over hand-built mdast (the FR-011 reference-link cases parse with unified+remark-parse to get real linkReference/definition shapes); no Astro or vfile runtime."

No other changes requested.
