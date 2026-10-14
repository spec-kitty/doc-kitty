---
affected_files: []
cycle_number: 1
mission_slug: route-rule-consolidation-01M4WE27
reproduction_command:
reviewed_at: '2026-10-14T07:24:59Z'
reviewer_agent: claude
wp_id: WP06
---

**Issue 1 (accuracy, CHANGELOG #136 new-doc/scaffold entry)**: "A `--section` value that is not one of your index names exits 2" is wrong. `--section` is a boolean in new-doc (src/scripts/new-doc.mjs:98). The value checked against the site's index names is `--index-basename` (new-doc.mjs:79-95, scaffold.mjs:34-51, exit 2). Reword: "An `--index-basename` value that is not one of your index names exits 2."

**Issue 2 (accuracy, CHANGELOG same entry + ADR-0050 line 79)**: `dockitty-scaffold --section` does not exist. scaffold takes `--sections <list>` (scaffold.mjs:27) and always writes the index file using the first configured name or `--index-basename`. Change to "`dockitty-new-doc --section` and `dockitty-scaffold`" in both places. ADR-0050 is new in this mission, so editing it is allowed (C-002 covers accepted ADRs only).

Everything else checked and correct: check-links exits 2 on flag mismatch/config load failure, exit 1 on collisions; README default; order/case-insensitive comparison (site-index-names.mjs:35); CLI list matches resolveSiteIndexBasenames callers; issue refs; ADR index --check clean; description 144 chars; no MD018 lines; check-links, validate-frontmatter, CI markdownlint all exit 0; #131 stale advice replaced; known limits recorded in ADR.
