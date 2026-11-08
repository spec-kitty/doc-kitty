---
affected_files: []
cycle_number: 3
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T13:59:25Z'
reviewer_agent: claude:claude-opus-5-5:orchestrator
wp_id: WP02
---

# WP02 reopened — regressions found by WP05 review (lane-b HEAD 50c7ad1; pass on origin/main and WP01 tip 6cdac79)
1. src/tests/config-invariants.test.ts "pins the runtime export list": config.ts:90 adds exports composeSitemapPredicates and sitemapPredicates; update the pinned list (or don't export them from the public surface if they're internal — prefer internal).
2. src/tests/sidebar-build-html.test.ts "top-level groups in registry order": extra "API v1-1" group; update expectation to the intended group list.
3. src/tests/header-carrier*.test.ts "builds the same pages" and "theme header exactly once": the THEMED build lacks the 4 reference/api/v1-1/* pages the stock build has. Find the root cause — this may be a real bug (a version dropped under a theme), not just a stale expectation. Fix the cause; only update expectations if both builds legitimately differ.
