---
affected_files: []
cycle_number: 1
mission_slug: large-hubs-paged-hub-listing-01M84WYV
reproduction_command:
reviewed_at: '2026-11-24T21:12:54Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review — cycle 1 — REJECT (claude::reviewer-renata)

Reviewed lane-e @ 8202719f against lane-b's approved tip 2654a68f. The listing records, per-page JSON, llms.txt placement, the build-id fold and locales all behave as specified. I verified by hand that byte identity holds against lane-b's code (index, llms.txt and all 122 per-page artifacts hash the same for an unpaged corpus). Three findings block approval: one design defect in the `DK_HUB_DATA` handoff, one gating inconsistency, and one missing byte-identity guard.

## Blocking

**Issue 1 (HIGH): the `DK_HUB_DATA` handoff can break every child process the build spawns on large sites.**
`astro:config:done` writes the full child list of *every* `kind: Hub` hub (capped or not) into one process env var. Child processes inherit `process.env`, and Linux caps a single env string at 128 KiB (`MAX_ARG_STRLEN`). I checked this here: `spawnSync('true')` succeeds at 127 KiB and fails with `E2BIG` at 129 KiB. Windows caps a variable at 32,767 characters. Two child processes run after `config:done`:
- Starlight's search step at `astro:build:done`, through `pagefind@1.5.2` `lib/service.js`, which calls `child_process.spawn` with an inherited env;
- the OpenAPI `bundle.mjs` and `remote.mjs` `spawnSync` children;
- plus any consumer integration.

At about 60–80 bytes per child, a site with roughly 1,900 hub children in total (about 450 on Windows) loses its search index or its build. Those are exactly the sites #342 targets. The `DK_OPENAPI` precedent doesn't carry over, because that payload is small and bounded.

Fix:
- Hand the data off through a file instead: write the JSON to a build-unique file under Astro's `cacheDir`, or under `os.tmpdir()`, and put only the *path* in `DK_HUB_DATA`. Alternatively, use a `globalThis[Symbol.for(...)]` slot, which survives Vite's separate SSR module graph in one process.
- Memoise `readHubData()` on the raw value. Today every per-page stamp (`memoizedBuildIdForEntries` → `openApiStampConfig` → `pagedHubListing` → `JSON.parse`) re-parses the whole hub data once per page artifact.
- Add a test that publishes more than 128 KiB of hub data and then runs `spawnSync(process.execPath, ['-e', ''])` successfully.

**Issue 2 (MEDIUM): index listing records ignore the hub's own agent gating, so the index and llms.txt disagree.**
`agent-index.ts` builds `hubsBySlug` from `all` (the full corpus), not from the gated `ranked` set. A hub with `agent: { discoverable: false }` is therefore missing from the index, but its listing records still appear there. llms.txt correctly omits them, because its lines hang off the hub's own line. Probe result: `hubInIndex false, listingInIndex 2, listingInLlms false`. This also contradicts the code comment "gated … like the hub itself".

Fix: build `hubsBySlug` from `ranked` (the feeds gate can stay as a guard), and add a test for a non-discoverable hub.

**Issue 3 (MEDIUM): the byte-identity tests are self-referential, and a mutant that breaks byte identity survives.**
"adds nothing, byte for byte" and "is byte-identical without a paged hub" both compare the *new* code with itself (no env vs. an unpaged env). T024 and T025 ask for a red-first snapshot of the pre-change output. `src/tests/llms-paged-hubs.test.ts` (from `create_intent`) was never created. I tested a mutant where `openApiStampConfig` returns `{}` instead of `undefined` with no OpenAPI and no paged hub. It changes the build id of every unpaged site, yet it passes all 140 related tests.

Fix: pin a golden value. Either assert `openApiStampConfig()` is `undefined` with no handoff, or (better) commit the expected `buildId`, or a sha of the index and llms.txt, for an unpaged fixture produced by lane-b's code.

## Non-blocking (fix in the same cycle)

**Issue 4 (LOW): the child-order part of the build-id fold is untested.** A mutant that sorts `pagedHubs[].children` before folding survives. The current code is right: my probe shows a reversed child order changes the id. Add an assertion that the same child set in a different order gives a different `buildId`. A second mutant also survives: setting the listing record's `section` to the raw hub slug instead of `sectionOf(hub)`. Nothing tests a nested hub (`plans/missions`), so add a nested-hub case that asserts `section: 'plans'`.

**Issue 5 (LOW): "after the docs records, before the OpenAPI records" is not pinned.** No test sets `DK_OPENAPI` together with a paged hub. The order is correct by reading. Add one case using the existing OpenAPI test helpers.

**Issue 6 (LOW): orphaned JSDoc in `route-shaping.ts`.** `shapingPages` and `siteHubData` were inserted between `routeShapingSource`'s JSDoc (including its `@internal` tag) and the function. That doc block now documents nothing. Move the two helpers above it.

**Issue 7 (coordination, mandatory at consolidation): this WP duplicates WP04 in `route-shaping.ts`.** I trial-merged lane-d @ fcccc3b7 into lane-e and git **auto-merges with no conflict**. The planned "hand-merge" will therefore not be triggered by a conflict. The risk is silent duplication: WP04's `siteHubs()` gates `injectRoute` at `astro:config:setup`, while WP05's `shapingPages`/`siteHubData` feed the agent surfaces at `astro:config:done`. If their inputs ever differ, the agent API and llms.txt would list listing URLs that are never mounted, or the reverse. Consolidation must merge them into one helper, compute it once, and add a test that the route is injected if and only if `pagedHubListing()` is non-empty. Record this as a mandatory consolidation step, not an option.

## Checked and fine

- **R5 and Q3**: every index URL appears once; every llms.txt URL appears once; each listing URL appears once per surface; children keep their single record and line. The hub's own record lists no children (index records carry no child list), so nothing is listed again. Children appear only in the per-page listing JSON, which R5 explicitly allows as the iterative-deepening path.
- **MCP (U2)**: I re-ran the probe myself (throwaway, not committed). I rendered the index, every per-page JSON and scenarios.json for an en+fr paged corpus and loaded them through the real `FsCorpusSource` + `loadSnapshot`. All 186 records loaded with no warnings, and the build ids agreed.
  - `wantIndexRecord` checks `kind` only as a string (no enum or union), so older clients accept `Listing`.
  - The listing per-page payload satisfies `assertPageShape`.
  - `search_pages` is an unranked registry-order prefix cut of 25 over title, description and keywords. Appending the records after the docs means they can't crowd docs out.
  - Recommendation: add a committed MCP-side test in **WP06**, a build fixture loaded through the MCP loader like `mcp/tests/corpus/openapi-entries.test.ts`. It need not block WP05, which can't edit `mcp/`.
- **Feeds-gating deviation** (per-page listing JSON not feeds-gated): consistent with the code. `agent-page.ts` never applies `feedsSurface` to docs pages, and `section-registry.md` defines the `agent` feed as a filter on the index. The JSON exposes only child slugs, titles and URLs, which the HTML listing page and the children's own per-page JSON already expose. It's no new leak. Whether per-page artifacts should honour `feeds` at all is a pre-existing policy question, raised separately.
- **Build id**: deterministic. Swapping hub entry order leaves it unchanged; `[]` and an absent handoff give the same id; it changes with page size and with child order. The index, the per-page JSON and scenarios.json carry the same stamp.
- **Locales**: `fr/missions` gets `fr/missions/page/2` with section `fr`, which matches the hub's own record and its gating. The llms.txt line follows the fr hub line. Fallback hubs are not in the hub data (R6).
- **`DK_HUB_DATA` registration**: it is in the internal-env table and in `INTERNAL_ENV_NAMES`, and `clearInternalEnv` resets it at config definition. Its isolation is the same as the other handoffs. JSON keeps slug characters safe. Size is Issue 1.

## Gates and mutation summary

- Full `pnpm test` on lane-e: src 244 files and 4803 tests pass; mcp 23 files and 181 tests pass. `pnpm lint` exits 0 and `pnpm typecheck` exits 0. Nothing was red, so no comparison with lane-b was needed.
- Mutation testing: 15 mutants, run against the WP05, agent-api, llms, openapi-agent-entries, agent-page, route-shaping and internal-env suites. 12 were killed. The 3 survivors are M5 (child order in the fold; Issue 4), M6 (stamp config `{}` when absent; Issue 3) and M15 (listing section taken as the raw hub slug; Issue 4).
- Anti-pattern checklist:
  1. Dead code: PASS.
  2. Synthetic fixtures: PASS. The tests drive the real routes.
  3. Silent empty returns: PASS. `readHubData` returning `[]` is documented, and so is the 404 branch.
  4. FR coverage: PASS for FR-013. FR-015 is covered for the agent API at the unit level; the build tier is WP06.
  5. Frozen surfaces: PASS.
  6. Locked decisions: PASS.
  7. Shared-file ownership: FAIL until the Issue 7 note is recorded. `route-shaping.ts` and `internal-env.mjs` are out of the file map, and WP04 also changes `route-shaping.ts`.
  8. Production fragility: PASS. No new raise.
