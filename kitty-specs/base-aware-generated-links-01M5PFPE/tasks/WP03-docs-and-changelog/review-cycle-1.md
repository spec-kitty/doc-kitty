---
affected_files: []
cycle_number: 1
mission_slug: base-aware-generated-links-01M5PFPE
reproduction_command:
reviewed_at: '2026-10-24T14:36:42Z'
reviewer_agent: user
wp_id: WP03
---

# WP03 review: changes requested

One claim does not match the code, in two places.

- docs/guides/export-okf-bundle.md ("Site URL and base": "ends with the base on a path-segment boundary")
- docs/adr/0059 addendum item 4 ("only when the URL path does not already end with it on a segment boundary")

Code: src/lib/okf-export/core.mjs composeSiteUrl uses `sitePath === base || sitePath.endsWith(base)`, with no boundary check. So `https://x.org/mydocs` with base `/docs` is treated as already based, and the base is NOT added.

plan.md:61 requires the segment boundary, so the code is the defect. Fix: `sitePath === base || sitePath.endsWith(base)` is replaced by a check that the character before the base is `/` (or simply `sitePath === base || sitePath.endsWith(base) && sitePath[sitePath.length-base.length-1]==='/'`... note base starts with `/`, so a boundary check is `sitePath === base || sitePath.endsWith(base)` only when the preceding segment ends cleanly), plus a test. If the fix is not made, drop "on a segment boundary" from both docs.

Every other claim checks out. Gates pass. MD038 at CHANGELOG.md:372 was already there (line 359 on the base branch).
