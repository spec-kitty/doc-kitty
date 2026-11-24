---
affected_files: []
cycle_number: 2
mission_slug: tom-annex-export-01M84YDP
reproduction_command:
reviewed_at: '2026-11-24T06:16:34Z'
reviewer_agent: claude::reviewer-renata
wp_id: WP05
---

# WP05 review cycle 2: REJECT

Reviewer: claude::reviewer-renata. Lane head reviewed: 1eea728 (code in 2fc2210; 214bfc5 and 1eea728 carry status files only, `git diff 2fc2210 1eea728 -- . ':!kitty-specs'` is empty).

## Blocking

**Issue 1: SC-001 still has a hole. A measure counts as covered because it sits under `scopes.*`, not because it has evidence.**
`accountingProblems` builds `covered` from every entry id under `scopes.system` and `scopes.organisation`. It never requires that an entry have evidence. So this edit to the good fixture passes the gate with **zero problems**:

```js
const u = a.uncovered.shift();                      // 'backup', a catalog measure with no evidence page
a.scopes.system.push({ id: u.id, label: u.label, evidence: [] });
```

`backup` is now missing from `uncovered`, which breaks SC-001 ("every uncovered measure ... 0 missing"). The triple checks cannot catch it, because an entry with no evidence adds no triples. `buildTomAnnex` never emits an entry with empty evidence, so the gate should reject one.

Fix: a scope entry with no evidence is a problem. Alternatively, take `covered` from the measures that have expected triples (the content graph), not from what the index lists. Add a negative unit case.

**Issue 2: "Exactly once" is not enforced inside a scope.**
If a measure's entry appears twice under the same scope, the gate passes. For example, `a.scopes.system.push({ ...a.scopes.system[0], evidence: [] })` gives zero problems. The same is true with real evidence split across the two entries, because the triple sets still match.

Showing a measure in both scopes is legitimate: the builder emits one entry per scope. Showing it twice in one scope is not. Reject a repeated id within a scope, and add a negative case.

## Non-blocking

- **N1: one mutation survives.** I narrowed the "not in the catalog" loop from `[...covered, ...listed]` to `[...listed]`, and every test still passed. No test puts a stray id under `scopes.*`. Today the triple check would catch such an id when it has evidence. Once Issue 1 is fixed, that gap closes in practice. Still, add a stray-covered-id case.

## Verified as fixed or accepted

- **Cycle-1 blocker 1 (SC-001 set checks).**
  - Each of the four requested negative cases exists and fails under mutation: unaccounted, both, uncovered twice, not in the catalog.
  - So does the duplicate-triple case (N1 from cycle 1). Mutating each check turns exactly its own test red.
  - The catalog ids come from `loadMeasuresCatalog(EXAMPLE_DOCS_DIR)`. That is the same loader and docs root that `site-graph.ts` uses to build the index.
- **Cycle-1 blocker 2 (NFR-002).**
  - The method follows T025: the example as-is against the copy stripped of `tom_classification`, two runs each, with no CI timing assertion.
  - The arithmetic holds. The means are 12323 ms and 12128.5 ms, so the index adds +194.5 ms (1.6%).
  - The budget is 2% or 1 s, whichever is larger, so the limit here is 1 s. The run-to-run spread (about 200 ms) is the same size as the measured gap, but the result sits far inside 1 s, so the conclusion holds. I did not re-measure.
- **N2 (#103 negative control).** Present, and red without the gate prefix.
- **N3.** The reason given holds.
  - `assertTomAnnex` runs only on the example. The example has edges, as `assertTomClassification` already asserts.
  - The no-edge branch is decided inside `tomAnnexProblems`. That function is unit-tested on the bare graph, and the bare fixture build test runs it too.
  - Only the `ok()` message choice is left untested.
- **Surface.** Cycle 2 touches only `verify.mjs` (recorded), `assert-build-artifacts.mjs`, and two WP05-owned tests. Across the whole WP05 range, the only file outside the owned list besides `verify.mjs` is `.gitignore`: three lines for the fixture directories, added in cycle 1.
- **Tests.**
  - The full `pnpm test` passes: src 237 files / 4594 tests, mcp 23 files / 181 tests.
  - `pnpm lint` and `pnpm typecheck` exit 0.
