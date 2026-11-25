---
affected_files: []
cycle_number: 1
mission_slug: subprocessor-catalog-01M84X07
reproduction_command:
reviewed_at: '2026-11-25T10:44:42Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review, cycle 1: changes requested

Reviewer: claude::reviewer-renata. Reviewed lane-d at 04d6ba36, with the src tree unchanged after the auto-rebase to cb4364b4.

## Blocking

**F1. T023 does not guard FR-013 or NFR-001 at the build level. A route that leaks the build clock passes the whole suite.**

T023 requires three things:

- the served bytes equal WP04's renderers applied to the same input;
- two builds with the catalog;
- an assertion that `api/subprocessors.json` and `subprocessors.xml` are byte-identical across those builds.

`subprocessors-build.test.ts` does none of these:

- It compares only the parsed `records` and `changes` arrays, plus a few feed substrings.
- Its second "with catalog" build is a cache hit. `buildChromeFixture` keys the cache on `{options, files, env}`, so no second build actually runs.
- The file header still claims FR-013 and NFR-001.

Mutation probe M7: I changed `subprocessors-api-injected.ts` to prepend `"builtAt": new Date().toISOString()` to the rendered JSON. The integration, parity, served-surfaces and build tests all stayed green (build tier: 3/3 passed after a real rebuild), and the served `dist/api/subprocessors.json` carried `"builtAt": "2026-11-25T10:31:30.243Z"`.

Fix:

1. Assert byte equality of both served files against `renderSubprocessorsApi` and `renderSubprocessorsFeed`, given the loader's `normalised`/`changes`, the fixture's site and base URL, and its title.
2. Force a genuine second build with the catalog. A distinct `env` entry changes the cache key. Assert both files are byte-identical across the two builds, and add a comment that the clock override is covered by WP04's fake-timer test, as T023 allows.

Keep it to three real builds at most. You can drop or fold the duplicate `built(WITH_CATALOG)` in test 2 to stay under the limit.

## Non-blocking

**F2. The masks are pattern-wide, and the description of what they cover is incomplete.**

`masked()` replaces every ISO instant, every RFC 822 date and every 64-hex `buildId`, in every compared file, wherever it appears.

I ran the diff unmasked: stock against catalog, all 400+ lines. Apart from the two new `_links`, every changed line is one of these:

- `buildId` (40 lines);
- `generated.at`: 8 in JSON, 4 in OKF `_index.meta.yaml`;
- Atom `<updated>` (4);
- RSS `<pubDate>` (2).

So the masks hide nothing today, but they would also hide a future regression in any other timestamp. The hand-off says the masks cover "generated.at, the RSS dates and buildId". They also cover Atom `<updated>` and the OKF `at:`, which come from the same stamp. Either correct the comment, or scope the masks to those keys and elements.

**F3. Unverified flake claim, outside WP05's scope.** `src/tests/gherkin-generate.test.ts` is byte-identical to main and untouched by this WP. I ran it 20 times: the named test 12 times, and the full file 8 times concurrently under load. All passed.

The described mechanism, a `generated.at` second boundary, does not match the obvious suspect. "hub generated.at changes…" compares `generatedAt()`, which returns `content_hash` and not the time. Every other real-clock comparison in the file goes through `makeStamp`'s keep-at-when-unchanged rule. Please attach the failing assertion from run 2, or drop the attribution.

## Verified (no action)

- **Registration.** Placed after `content-graph`, before `page-atom` and `served-surfaces`. Pinned in `integration-names.ts`. Moving it after `served-surfaces` fails `config-invariants`.
- **No-file path is inert.** No `injectRoute`, `updateConfig`, `addWatchFile` or log call. Removing the presence guard fails the test.
- **Error.** One `Error`. The header is `[dk-subprocessors] invalid sub-processor catalog:` with one problem per line. It is thrown before `updateConfig` and `injectRoute`, and moving the throw after injection fails the test. It still throws when the site owns both routes. The real build exits non-zero with the message.
- **Site-owned routes.** Precedence holds for both routes, the full `ENDPOINT_EXTENSIONS` set and the `index.*` form. Dropping the `index.*` variant fails the test.
- **Parity.** It compares real hook output against the real `validateRoot` across 12 invalid catalogs plus a valid control. Dropping one problem line fails 12 cases.
- **Routes.** No rendering logic, only a call to WP04's renderers. Ignoring the `BASE_URL` I didn't set in my probe, the served records and changes equal the renderer output.
- **Contract.** Links are optional and default to false. Changing the default to true fails the test. `version` stays `"3"`. The MCP corpus loader checks only the known `_links` keys and rewrites hrefs in every `_links` container. The MCP tier passes 181/181.
- **Edits outside the file map.** All justified:
  - the `gherkin.ts` `ENDPOINT_EXTENSIONS` export reuses the list instead of copying it;
  - the key literals in `agent-api-build-identity` and `page-formats` are forced by `satisfies Record<keyof …>` and `ServedSurfaces`;
  - `vitest.workspace.ts` is needed to serialize the build suite;
  - `integration-names.ts` is the order pin;
  - `subprocessors-module.d.ts`, not listed in the hand-off, follows the per-module `*-module.d.ts` pattern that T019 asks for.

  No other WP claims any of these files.
- **Typecheck and lint.** `pnpm typecheck` reports 0 errors. eslint is clean on the WP05 files.

## Anti-pattern checklist

| # | Check | Result |
|---|-------|--------|
| 1 | Dead code | PASS |
| 2 | Synthetic fixture | PASS |
| 3 | Silent empty return | PASS. The `return` on `!present` is the documented file gate. |
| 4 | FR coverage | **FAIL** for FR-013 and NFR-001 at the build level (F1). FR-009, FR-010, FR-012 and NFR-002 pass. |
| 5 | Frozen surface | PASS |
| 6 | Locked decision | PASS |
| 7 | Shared-file ownership | PASS |
| 8 | Production fragility | PASS. The one `raise` is the fail-loud build gate, ruled by operator decision 01M8545YJX3DY4G3DEYX81G49Y. |
