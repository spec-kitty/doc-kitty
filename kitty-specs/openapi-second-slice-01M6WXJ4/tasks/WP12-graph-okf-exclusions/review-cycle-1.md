---
affected_files: []
cycle_number: 1
mission_slug: openapi-second-slice-01M6WXJ4
reproduction_command:
reviewed_at: '2026-11-08T15:00:38Z'
reviewer_agent: claude:claude-opus-5-5:reviewer
wp_id: WP12
---

# WP12 review: REJECT

## Must-fix
1. **src/lib/routes/content-graph.ts:46** builds the overview address by hand (`/${publication.section}/${version.label}/`). `tests/route-address-guard.test.ts` now fails, and WP12 introduced that failure. Build it with routeOfSlug/hrefOfSlug, then wrap it with absolute().
2. **The RSS ratchet is vacuous.** src/tests/openapi-exclusions.test.ts:81 looks for `rss.xml`, but the openapi fixture site (src/tests/fixtures/openapi/site) has no rss.xml route, so the RSS feed is never checked. Mutation proof: pushing a `reference/api/v1` item into the entries in src/lib/routes/rss.ts left all 3 tests green. Add an rss.xml route to the fixture. Assert that rss.xml exists and carries a docs item as the positive control.
3. **The frontmatter-gate ratchet is vacuous.** It runs validate-frontmatter.mjs on `docs/`, which never contains generated API pages. Its bad-spec half tests the build, not the gate. Make it exercise a path where API output could reach the gate, and assert something that would fail if output did reach it. If no such path exists, say so in the test docstring.

## Nice-to-have
a. In addOpenApiDocuments in src/lib/okf-export/core.mjs, the raw document URL loses the base when no siteUrl is set, because composeSiteUrl returns ''. Prefix the base.
b. Add a test with a non-root `base` for the graph url and overview and for the OKF "Raw document" line.

## Verified passing
- The 7 WP12 tests pass, including OKF conformance, sha256 matching the published bytes, hostile-string escaping, and two-build byte identity.
- The consumption openapi-optin tests pass 16/16, including arm A byte identity.
- The full suite has 5 failures. 4 are the known WP02 ones; the fifth is route-address-guard, which belongs to WP12.
