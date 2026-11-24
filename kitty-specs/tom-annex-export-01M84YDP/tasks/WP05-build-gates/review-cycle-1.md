---
affected_files: []
cycle_number: 1
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T01:20:34Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review: REJECT (reviewer-renata)

Reviewed lane-e at c45447b0 (WP05 commits c4a052bc and c45447b0) against base daccab22.

## What holds

- **Gates are green on lane-e.** Typecheck passes and lint passes. `pnpm test` passes: src 4588/4588 (237 files) and mcp 181/181.
- **Every check in `tomAnnexProblems` is load-bearing.** I made 11 mutations; each one turned `assert-build-artifacts-tom-annex.test.ts` red:
  - dropped the extra-triple check;
  - dropped the missing-triple check;
  - left scope out of the triple, and separately ignored scope in `actual`;
  - dropped `pageBuilt`;
  - compared counts instead of sets;
  - dropped the label check;
  - dropped the format check;
  - loosened the version regex to `\d+\.\d+`;
  - dropped the `_links` check;
  - made the no-edge branch always pass;
  - ignored the measure id.
- **The triples are compared as sets, not counts**, as the reviewer guidance asks.
- **The #103 prefix fix is sound.** It derives the prefix exactly as `assertAgentLinksResolve` does (`self` minus `/<INDEX_RELPATH>`). That function has already failed the build when `self` does not end in the index path, so the slice is safe. `example-adopter.test.ts` runs it end to end with `--index-path v2/data/index.json`.
- **`BASE_URL` and `DK_OUTDIR` do not leak.** Both are deleted from the fixture build's environment.
- **The FR-007 test is real.** `diffSurfaces` compares raw bytes with no mask, and the new `existsSync` guard keeps `api/tom-annex.json` from passing vacuously.
- **FR-006 is shown on a real build**, with a positive control in the same build: the draft is absent, the draft-only measure is uncovered, and the published page is present.
- **FR-012 and SC-004 are shown on a real build**: no file, no link and no OKF copy, and the gate rules pass. The classified site is the paired positive control.
- **The files outside the file map are justified.**
  - `src/lib/tom-annex/verify.mjs` is a new file that no other WP owns. It is the single shared rule set for the gate and both tests.
  - The `.gitignore` entries are for the transient fixture sites.
- **No stray changes.** The only other files in the diff are spec-kitty status files.

## Blocking

**Issue 1: SC-001 is only half asserted.** SC-001 belongs to WP05 alone. It requires that, on the example, "every evidence page **and every uncovered measure** … 0 extra and 0 missing".

- The gate proves the evidence half: the triples equal the graph.
- Nothing checks `uncovered` against the catalog. The gate accepts an annex whose `uncovered` is `[]`, or one that lists a covered measure, or one that repeats an id.
- The fixture build test only checks one id it contains and one it does not.

Fix: in `tomAnnexProblems`, take the effective catalog's measure ids (the gate can load them the way `assertTomClassification` and the OKF Measures check do) and assert:
- the measure ids under `scopes.*` and the ids in `uncovered` are disjoint;
- together they equal the catalog ids;
- `uncovered` has no duplicates.

Add a negative unit case for each, by mutating `uncovered` in the good fixture. Make the check red-first.

**Issue 2: NFR-002 was not measured on the example, and no numbers were handed off.** The Definition of Done says "Build-time numbers are reported", and T025 asks for the example build with the annex against the classified-stripped copy. The hand-off note has no numbers.

- The only timing is the console line from the five-page fixtures: `{"classified":3535,"bare":3567}` ms. That shows no measurable cost at that size, but it does not test the budget on the example, where cost scales with page count.

Fix: build the example once as is and once with `tom_classification` stripped from its two classified pages, in a temp copy with its own out dir. Report both wall times and the ratio in the hand-off note. Do not add a CI timing assertion.

## Non-blocking (fix if cheap)

- **N1. A duplicated triple in the annex passes the gate.** Both sides are Sets. Core keys evidence by URL in a Map, so this cannot happen today. Counting duplicates while building `actual` would close it.
- **N2. The #103 unit case has no negative control.** It only shows that an explicit `sitePrefix` passes. Add the inverse, without `sitePrefix`, so the case shows why the parameter exists.
- **N3. The gate script's no-edge path is never run end to end.** T024 asked to run the gate script on the bare dist. The test calls the pure function instead, so `assertTomAnnex`'s wiring for that path (`loadContentGraph`, `builtRelOf`, `ok` text) is never run on a bare site. A `spawnSync(node, [assert-build-artifacts.mjs, dist])` would close this only if the full gate tolerates the tiny fixture; if it does not, say so in the hand-off.
