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
1b. **Pin the toolkit version in WP05's golden (WP05 review cycle 2, N1).**
   `src/tests/llms-paged-hubs.test.ts` pins shas that fold `toolkitVersion()`
   (`src/package.json` version, now 0.7.1) into the build id. Any version bump
   turns all three T025 cases red (verified: 0.7.2 gives 3 failures). Mock
   `../lib/generator-stamp.mjs` `toolkitVersion` to `'0.7.1'` in that test so the
   lane-b golden stays meaningful. Do not re-bake the shas from current code.

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

8. WP05 review cycle 2 test gaps (surviving mutants):
   - H4: `readHubData` turning a missing or corrupt handoff file into `[]` survives.
     Pin today's fail-loud throw, and wrap it in a `[dk-hubs]` message that names
     `DK_HUB_DATA` and says to rerun the build. The raw error is ENOENT or a
     SyntaxError.
   - H9: the `config:done` handoff ignoring `state.unpublishedDirs` survives,
     because the handoff test uses no withheld draft directory. This goes with
     item 4 (I3/I4).
   - Note only: nothing prunes `<cacheDir>/doc-kitty-hubs/*.hubs.json`, the same
     as the `DK_OPENAPI` publication precedent. A failed cache write reports
     with the `[dk-openapi]` prefix (`writeCacheAtomic`).

## WP06 review carry-overs (approved at lane-f 28ff2c81; fold at R24)

- (a) The hub data handoff read error names `DK_HUB_DATA` and says to rerun the build.
- (b) The setup hook comment says the hub data is computed once; the virtual
  module still calls `siteHubData` again. Fix the comment, or serve the
  module's `hubCaps` from the handoff.
- (c) A test that the listing route calls `pageCards` (G4 at the route level).
- (d) PR body: quote the NFR-002 build-time spread (recorded +5%, reviewer rerun
  +9.6%, budget 10%).
- (e) WP07: the guide carries the pinned pagination CSP hash and documents the
  listing contract fields (`listing_of`, `page`, `of`, `children`,
  `ListingChild`). Checked: the guide at bda45d6e has neither.
- (f) Issue-matrix rows for #359 and #402 (the ADR-number mentions at research.md:90).
- (g) PR body: listing pages are absent from RSS and Atom by design.
- (h) The Playwright focus-ring assertion must not pass on the UA default outline.
- (i) Trailers in the final PR history: the dispatcher asks for no Co-Authored-By;
  the original brief asked for the model-free Co-Authored-By trailer. Confirm with
  the dispatcher before R24.

## Held for the operator

- Locales with different page counts: a listing page's hreflang alternates and
  the language picker point at listing pages that were never built (for example,
  `missions/page/4` links to `fr/missions/page/4`). The dispatcher asked the
  operator whether to build fallback listing pages or suppress those alternates.
  Do not change until the operator rules.
