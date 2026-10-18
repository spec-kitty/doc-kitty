---
affected_files: []
cycle_number: 1
mission_slug: okf-alignment-content-graph-01M56PNW
reproduction_command:
reviewed_at: '2026-10-18T06:34:42Z'
reviewer_agent: claude
wp_id: WP07
---

# WP07 review: changes requested

## BLOCKER: original body links are copied unchanged and dangle in the bundle
`conceptDocument()` (src/lib/okf-export/core.mjs) keeps the original body as written. The fixtures contain no body links, so the tests never exercise this. I exported example/dist/api/content-graph.json with example/docs (indexBasename README): 78 files, 89 `/`-prefixed links whose target is not in the bundle. Examples:
- architecture/blocks-demonstrator.md -> /context/audience/example-persona/
- architecture/blocks-demonstrator.md -> /architecture/overview/
- guides/scenarios-in-pages.md -> /behaviour/
- plans/missions/index.md -> /architecture/

These are site routes (trailing slash, no .md). The criterion is that every link points to a target in the bundle or to an external URL, and these links break it. They will also break SC-003 (contract item 5: page-to-page body links equal graph edges) on real content. The checker still returns [] because it has no link-resolution check.

Required:
1. Rewrite each body link that resolves to a bundle node (site route, with or without base/trailing slash/anchor) to `/<bundle path>.md` (keep the anchor). Links that do not resolve become external absolute URLs or plain text; record which in a code comment. Use the existing route resolution, not a new parallel rule (C-003).
2. Add a fixture page whose body has a route link and a dangling link, and assert both results.
3. Add a test that exports example-like content and checks that every `/` link resolves in the bundle. A small extra rule in the checker is fine.

## Notes, not blocking
- contracts/okf-export.md shows index entries as `: desc`, but the code uses `- desc` (OKF §8). Leave this for WP09 to correct.
- vocabulary-core.mjs is not touched by 546e7b7a (OK).
- Body is preserved and relations are appended (OK). FR-025 a/b/c, determinism, sidecar, drafts, and the root/non-root index rules are all tested (OK).
