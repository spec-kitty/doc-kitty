---
affected_files: []
cycle_number: 1
mission_slug: base-aware-generated-links-01M5PFPE
reproduction_command:
reviewed_at: '2026-10-24T14:28:39Z'
reviewer_agent: user
wp_id: WP02
---

# WP02 review: changes requested (Reviewer Renata)

1. NFR-002/T008: parity test (src/tests/okf-export-links.test.ts:112-125) pins only architecture/overview.md. DoD requires every bundle file. Capture the full exported Map from pre-fix code (original fixture graph, base '', origin siteUrl) into a toMatchFileSnapshot file and assert full equality.
2. src/lib/okf-export/core.mjs composeSiteUrl (~:381): a non-URL siteUrl such as 'docs.example.org/docs' throws in new URL, sitePath stays '' and the base is doubled. On parse failure take the path after the first '/' (or reject/warn), and add a row.
3. src/lib/okf-export/links.mjs resolveSourceLink (~:178): new URL clamps '..' above root, so '../../../CHANGELOG.md' resolves to a root 'CHANGELOG' node if one exists. Leave the link unchanged when it escapes the docs root (count '..' vs dir depth), and add a row with a CHANGELOG node.

Verified OK: D1/D2/D3, FR-002..005, C-001 (ids from same graph.nodes), red-first D2 (8 rows fail with .md branch removed), complexity <=15, eslint clean, 53/53 okf tests green.
