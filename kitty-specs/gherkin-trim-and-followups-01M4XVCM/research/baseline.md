# Baseline: in-scope test surface (frozen)

- **Commit**: `050b168c0ce59aeeef75f37d831d5796c33df621` (branch `chore/gherkin-trim-and-followups`, 2026-10-14)
- **Command** (repo root): `node kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs` (`--json` for machine output)
- **Rules** (NFR-001/002):
  - *Test lines*: non-blank lines that are not `//` or `/* … */` comment lines, in the 26 frozen files plus every non-fixture file under `src/tests/` or `tests/` they import (transitively). Re-run the script after `pnpm lint --fix` / the formatter, per NFR-001.
  - *Fixture lines*: non-blank lines of every file under `src/tests/fixtures/gherkin/**` plus any other fixture a frozen file imports. CCK fixtures count at full size; a moved fixture counts once at its new path.
  - A new test, helper or fixture file created by the trim counts as soon as a frozen file imports it, or it sits under `src/tests/fixtures/gherkin/`. A new test file that is not imported (e.g. a split-out `*.test.ts`) must be added to the script's `FROZEN` list by the work package that creates it.
- **Grounding vs official**: the spec's 9,923 / 3,002 figures were raw `wc -l`. This file holds the official baseline under the rules above.

## Totals

| Measure | Baseline | Target (NFR) | Max after |
|---|---|---|---|
| Test files (frozen list) | 26 | — | — |
| Helper files imported | 5 | — | — |
| Test lines (tests + helpers) | **9,321** | −30% | **≤ 6,524** |
| Fixture files | 64 | — | — |
| Fixture lines | **2,784** | −25% | **≤ 2,088** |
| `it`/`test` cases (grep `^\s*(it|test)(\.each)?\(`) | 558 | — | — |

## Per-file test lines

| Kind | File | Lines |
|---|---|---|
| test | `src/tests/agent-page-includes.test.ts` | 239 |
| test | `src/tests/docs-loader-includes-build.test.ts` | 133 |
| test | `src/tests/docs-loader-includes.test.ts` | 455 |
| test | `src/tests/gherkin-check-cli.test.ts` | 248 |
| test | `src/tests/gherkin-codegen-guard.test.ts` | 144 |
| test | `src/tests/gherkin-example.test.ts` | 129 |
| test | `src/tests/gherkin-feature-core.test.ts` | 458 |
| test | `src/tests/gherkin-fence-build.test.ts` | 203 |
| test | `src/tests/gherkin-fence.test.ts` | 580 |
| test | `src/tests/gherkin-fixture-parity.test.ts` | 13 |
| test | `src/tests/gherkin-generate.test.ts` | 1034 |
| test | `src/tests/gherkin-include.test.ts` | 562 |
| test | `src/tests/gherkin-integration.test.ts` | 449 |
| test | `src/tests/gherkin-load.test.ts` | 195 |
| test | `src/tests/gherkin-mdast.test.ts` | 498 |
| test | `src/tests/gherkin-options.test.ts` | 266 |
| test | `src/tests/gherkin-parse.test.ts` | 284 |
| test | `src/tests/gherkin-render.test.ts` | 520 |
| test | `src/tests/gherkin-results-build.test.ts` | 130 |
| test | `src/tests/gherkin-results-render.test.ts` | 389 |
| test | `src/tests/gherkin-results.test.ts` | 505 |
| test | `src/tests/gherkin-scenario-anchors.test.ts` | 177 |
| test | `src/tests/gherkin-select.test.ts` | 252 |
| test | `src/tests/gherkin-view.test.ts` | 437 |
| test | `src/tests/scenario-index.test.ts` | 422 |
| test | `tests/a11y/gherkin.spec.ts` | 233 |
| helper | `src/tests/helpers/module-graph.ts` | 29 |
| helper | `src/tests/helpers/remark-stack.ts` | 95 |
| helper | `src/tests/helpers/restore-index-env.ts` | 9 |
| helper | `tests/a11y/mode.ts` | 51 |
| helper | `tests/a11y/routes.ts` | 182 |

The five helpers (366 lines) are shared with suites outside the scope. They count in the baseline, but the trim should leave them alone: editing them touches other suites. Treat them as a fixed 366 lines, which leaves 8,955 lines in the 26 files to absorb the 2,797-line cut (a 31% cut on those files).

## Fixture lines by folder

| Folder under `src/tests/fixtures/gherkin/` | Files |
|---|---|
| `results/` (incl. `results/cck/`) | 21 |
| `render/` | 18 |
| `load/` | 12 |
| `include/` | 9 |
| `generate/` | 4 |

Largest fixtures: `results/cck/examples-tables.jvm.json` 490, `cck/all-statuses.jvm.json` 285, `cck/rules-backgrounds.jvm.json` 281, **`results/cucumber-jvm.json` 260**, **`results/cucumber-js.json` 243**, `cck/retry.jvm.json` 106, `cck/examples-tables.ndjson` 80, `cck/all-statuses.ndjson` 72, `generate/expected/…/book-consignment.md` 62, **`results/messages.ndjson` 59**, `cck/retry.ndjson` 53, `results/dry.ndjson` 51. The full per-file list is the script's output.

## WP01 re-measure (T001)

- **Measured at** `0d26e1f7c932b2accf2abda6df9ee48a0d9de9a9` (2026-10-14), `node kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs --json`:
  `{"testFiles":26,"helperFiles":5,"fixtureFiles":64,"testLines":9321,"fixtureLines":2784}`.
- **Drift against the frozen baseline: none.** Test lines 9,321, fixture lines 2,784, fixture files 64, helpers 5, cases 558 (`grep -cE '^\s*(it|test)(\.each)?\('` over the 26 files). `git diff --stat 050b168c HEAD -- src tests example` is empty: only `kitty-specs/` changed since the baseline.
- The per-file table above lacked a row for `src/tests/gherkin-fixture-parity.test.ts` (13 lines). WP01 added it; the 9,321 total already included it.
- The 558 cases expand to **823** vitest tests at run time (`it.each` rows). Use 558 for the grep rule and 823 for run-time counts.

**Fixture risk.** The top-level `results/` reports (`cucumber-js.json`, `cucumber-jvm.json`, `messages.ndjson`, `filtered.ndjson`, `dry.ndjson`) are real cucumber-js 13.3.0 output from one synthetic run over `features/checkout.feature` (see `results/PROVENANCE.txt`), not hand-written. CCK files are dropped whole, never edited (C-002).

### Fixture budget (T004, NFR-002: cut at least 696 of 2,784, i.e. at most 2,088 after)

Verdict: **reachable with 730 lines (2,054 after, 34 lines of margin)**, C-002 and C-006 intact. Line counts are the script's non-blank counts at `0d26e1f7`. Readers were checked with grep against `src/tests`, `tests`, `src/lib`.

| # | Fixture (under `src/tests/fixtures/gherkin/`) | Lines | Owner WP | Route | Test lines that must change | Readers / guard that survives |
|---|---|---|---|---|---|---|
| 1 | `results/cucumber-jvm.json` | 260 | WP02 | delete | `gherkin-results.test.ts` L81-L88 (drop the jvm row of the dialect `it.each`), L203, L513, L522 (drop `cucumber-jvm.json` from the three `it.each` lists), L527 stays (inline JSON) | cucumber-jvm dialect (background element before each scenario) is read by `cck/rules-backgrounds.jvm.json` (L178) and `cck/examples-tables.jvm.json` (L168); the checkout stale checks stay on `cucumber-js.json`. Also remove its two lines in `results/PROVENANCE.txt` |
| 2 | `results/cck/all-statuses.jvm.json` (+ its CCK sibling files stay) | 285 | WP02 | delete whole file (C-002) | `gherkin-results.test.ts` L144: `it.each(['ndjson','jvm.json'])` becomes ndjson only; extend the `statusOf` table (L235) with `pending`, `skipped`, `undefined`, `ambiguous` | Named surviving guard: `statusOf` table, which both the JSON path (`results.mjs` L493, L582) and the Messages path (L397) call; plus `all-statuses.ndjson` (L144). Break-check: change one word in `statusOf`, the table goes red |
| 3 | `results/cck/retry.jvm.json` | 106 | WP02 | delete whole file (C-002) | `gherkin-results.test.ts` L164 retired (row RES-07) | Named surviving guard: L81 JSON row `cucumber-js` expects `s24: 'Passed'` for a scenario that was retried, i.e. JSON keeps only the final attempt (and `rr` L225, `rb` filtered/retry badges). `retry.ndjson` stays for L155 |
| 4 | `generate/site/features/shipping/book-consignment.feature` | 42 | WP03 | dedupe to one shared copy (`render/book-consignment.feature`, still pinned to `example/` by `gherkin-fixture-parity.test.ts`) | `gherkin-generate.test.ts` L44-L48 and L213-L217 (build the golden site from a temp tree via the render copy); `gherkin-codegen-guard.test.ts` L34-L35 (point `GOLDEN_FEATURE` at the render copy); `gherkin-fixture-parity.test.ts` L25-L28 (one entry) | `generate/expected/**` goldens stay (3 files, 86 lines). Byte-identity with the example holds, so the goldens do not change |
| 5 | `load/source-a/shipping/book-consignment.feature` | 18 to 4 | WP03 | shrink in place to a minimal valid feature (keep path and name) | none expected; `gherkin-load.test.ts` L44-L66, L118 read the path, bytes and sha only | Path stays so the code-unit order case (`Zeta` before `book-consignment`) is unchanged. Saves 14 |
| 6 | `render/background.feature` + `render/background.md` | 11 + 12 = 23 | WP03 | delete the pair (construct covered by `book-consignment`, which has a Feature Background, and by `rule-background`) | `gherkin-render.test.ts` L309-L319 (drop `'background'` from the expected set); goldens loops follow the directory listing (L322, L338, L506, L514, L624) | Break-check the retired construct against the survivors. `gherkin-fence.test.ts` and others do not read it |
| | **WP02 subtotal** | **651** | | | | `results/PROVENANCE.txt` loses about 2 more lines (bonus, not counted) |
| | **WP03 subtotal** | **79** (42 + 14 + 23) | | | | the plan asked for 72 |
| | **WP04 subtotal** | **0** | | | | `include/**` is not cut. See C-006 note below |
| | **Total** | **730** | | | | 2,784 to 2,054, a 26.2% cut (target at least 25%) |

**Plan route corrected (evidence):** the planned `messages.ndjson` + `features/checkout.feature` replacement (79 lines) is **not** used. `cucumber-js.json`, `filtered.ndjson` and `dry.ndjson` are reports of the same run and key on `checkout.feature` lines (`gherkin-results.test.ts` L106-L132, L577; `gherkin-results-render.test.ts` L248-L275, L448; `gherkin-results-build.test.ts` L106-L122; `scenario-index.test.ts` L393-L428). A CCK pair has no `@billing`/`@flaky` tags, no Examples with a failing row plus a Rule, so those three would have to be regenerated (not CCK, hand-made) and the net saving would be near zero. `retry.jvm.json` (106) replaces it in the budget. Margin if a row fails its break-check: `cck/empty.feature` + `empty.ndjson` (14, L184 would need an inline NDJSON) is the next candidate, not planned.

**Kept, with the reason:** `cucumber-js.json` (243, the only cucumber-js JSON dialect sample), `filtered.ndjson` (24, `--tags` run), `dry.ndjson` (51, `--dry-run`), `messages.ndjson` (59) + `checkout.feature` (20), `PROVENANCE.txt`. CCK files `all-statuses.ndjson`/`.feature`, `examples-tables.*`, `retry.ndjson`/`.feature`, `rules-backgrounds.*`, `empty.*` are read by `gherkin-results.test.ts` L144-L185.

**C-006 fixtures that no WP may delete or shrink:** `include/outside/secret.feature` (3), `include/features/nested/keep.txt` (1), `include/features/folder.feature/keep.txt` (1), `include/features/shipping.feature` (35, the include target and the `.`-root text-file case), `include/features/dupes.feature`, `broken.feature`, `empty.feature`, `metadata.feature`, `outlines.feature` (read by the include and fence suites). That is why WP04 owes 0 lines.

**Test-line side effect:** rows 1, 2, 4 add a handful of test lines (4 table rows, a temp-tree helper call). Count them against the 30% test-line target; they are small next to the 2,797-line cut.

## Suite time (NFR-005)

Measured 2026-10-14 at `0d26e1f7`, from `src/`: `node_modules/.bin/vitest run <the 25 vitest files> --reporter=json` (all 25 files together, default pool; the Playwright spec `tests/a11y/gherkin.spec.ts` is not part of it). Each run: 823 tests passed, 0 failed, 163 suites.

| Run | Wall time |
|---|---|
| 1 | 58.08 s |
| 2 | 58.38 s |
| 3 | 57.61 s |
| **Median** | **58.08 s** |

Per-file duration (ms, vitest `endTime - startTime`, files run in parallel so they do not sum to the wall time; runs 1/2/3 then median):

| File | Runs | Median |
|---|---|---|
| gherkin-fence-build | 32568 / 32820 / 32370 | **32568** |
| gherkin-results-build | 12470 / 12337 / 12236 | **12337** |
| docs-loader-includes-build | 9969 / 10110 / 9916 | **9969** |
| gherkin-check-cli | 2319 / 2332 / 2344 | 2332 |
| gherkin-render | 1278 / 1289 / 1285 | 1285 |
| gherkin-example | 1016 / 1013 / 998 | 1013 |
| gherkin-generate | 715 / 708 / 714 | 714 |
| gherkin-fence | 435 / 450 / 441 | 441 |
| gherkin-scenario-anchors | 293 / 282 / 289 | 289 |
| docs-loader-includes | 133 / 137 / 133 | 133 |
| gherkin-results-render | 171 / 146 / 142 | 146 |
| gherkin-include | 101 / 97 / 98 | 98 |
| agent-page-includes | 74 / 69 / 70 | 70 |
| gherkin-load | 65 / 65 / 60 | 65 |
| gherkin-integration | 57 / 57 / 58 | 57 |
| gherkin-results | 52 / 55 / 53 | 53 |
| scenario-index | 39 / 31 / 31 | 31 |
| gherkin-codegen-guard | 31 / 34 / 31 | 31 |
| gherkin-feature-core | 22 / 26 / 39 | 26 |
| gherkin-mdast | 23 / 26 / 28 | 26 |
| gherkin-view | 22 / 16 / 18 | 18 |
| gherkin-parse | 12 / 15 / 17 | 15 |
| gherkin-options | 13 / 10 / 13 | 13 |
| gherkin-select | 13 / 9 / 10 | 10 |
| gherkin-fixture-parity | 1 / 1 / 1 | 1 |

Reading: three build suites (fence-build, results-build, docs-loader-includes-build) are about 55 s of the per-file time and set the wall time; the trim cannot move them unless it touches them. NFR-005 is after ≤ before × 1.10, i.e. at most 63.89 s wall for the whole command on this machine; the pure-unit trims are within noise.
