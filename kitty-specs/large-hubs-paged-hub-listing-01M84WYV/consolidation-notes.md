# Consolidation notes: large-hubs-paged-hub-listing-01M84WYV

Carry-overs from reviews that must be done at or before consolidation. They are
not part of any WP's approved scope, so each lands as a fold after the lanes
merge, red first where a test is named, with the full `pnpm test` before the
hand-off.

## Mandatory

1. **One hub-data computation (WP04 review, item 3).** Lanes d (WP04) and e
   (WP05) merge with no git conflict, so nothing prompts this. WP04's `siteHubs`
   in `src/lib/integrations/route-shaping.ts` duplicates WP05's `shapingPages` +
   `siteHubData`. Fix:
   - make the `astro:config:setup` hook call
     `siteHubData(options, shapingPages(options, state, new Set(state.unpublishedDirs)))`
     and delete `siteHubs`;
   - move WP05's helpers out from between `routeShapingSource`'s `@internal`
     JSDoc and the function, so that comment is not orphaned;
   - add a test that fails if two hub-data computations exist.
   - add a test that the route is injected iff `pagedHubListing()` (the
     handoff's listing) is non-empty, so the mount and the agent surfaces agree
     (WP05 review cycle 1, item 7). With WP05's file handoff (`DK_HUB_DATA` is a
     path since cycle 1), the setup hook computes the data; consider writing the
     handoff there too and dropping the separate `config:done` computation.

## Before or with WP06 / WP07

2a. An MCP-side build-fixture test (WP06) that loads a paged corpus, modelled on
    `mcp/tests/corpus/openapi-entries.test.ts` (WP05 review cycle 1).
2. A cross-surface test (WP06): every listing URL appears exactly once in the
   sitemap, Pagefind, `/api/index.json`, `/api/pages`, `llms.txt` and the MCP
   listing; children are never duplicated.
3. `hub-cards.ts` reads `cwd/docs` while the hub data reads `options.docsDir`. A
   paged hub with a custom `docsDir` fails `assertListingAgrees`. Make
   `composeHubCards` take the docs root; test with a custom `docsDir`.
4. Test gaps (surviving mutants): the injection condition with withheld drafts
   (I3/I4); the route's `assertListingAgrees` call (G4). From WP02: an upper-case
   hub folder clash (M1), a published draft in a drafts-on build (M14), sort the
   clash so the message names a deterministic page (M12).
5. Optional: memoise card composition per hub in the route (today O(pages ×
   entries)).
6. WP07: `cappedHubCaps` row in `contracts/paging-api.md` and the docs; the
   pagination inline-style `style-src` hash, computed from the final build and
   pinned by a build assertion (the reviewer's recorded hash predates WP04's
   focus-ring fold).
7. PR body: a page with Starlight `draft: true` and `doc_status: active` is not
   routed in production yet trips the `page` guard (deliberate fail-loud).

## Held for the operator

- Locales with different page counts: a listing page's hreflang alternates and
  the language picker point at listing pages that were never built (for example,
  `missions/page/4` links to `fr/missions/page/4`). The dispatcher asked the
  operator whether to build fallback listing pages or suppress those alternates.
  Do not change until the operator rules.
