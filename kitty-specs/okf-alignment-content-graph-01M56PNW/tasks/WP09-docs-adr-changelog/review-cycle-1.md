---
affected_files: []
cycle_number: 1
mission_slug: okf-alignment-content-graph-01M56PNW
reproduction_command:
reviewed_at: '2026-10-18T07:34:46Z'
reviewer_agent: claude
wp_id: WP09
---

# WP09 review: REJECTED

## Blocker
- docs/guides/export-okf-bundle.md:96 ships a placeholder: "Upstream issue: TODO(operator): add the upstream issue URL once filed."
  No TODO/placeholder may appear in a published page. Remove that line entirely and make the FR-020 sentence neutral, e.g.:
  "The OKF reference viewer currently skips `/`-prefixed links, so it may show fewer edges than the content graph."
  The upstream report link is added later by the operator.
- After the fix, grep -rn "TODO" over every docs/ file this WP added or changed must be empty; re-run validate:docs / validate:links.

## Not a blocker
- The CHANGELOG entry is deferred to closeout (orchestrator decision).
