# Tasks: Gherkin test trim, scenario-results follow-ups and a translatable Overview label

Mission `gherkin-trim-and-followups-01M4XVCM`. Issues: #166, #161. The work package
prompts in `tasks/` are authoritative; this file is the index. Subtask completion is
recorded with `spec-kitty agent tasks mark-status`, not by editing this file.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Re-measure the baseline with `research/count-lines.mjs` at the current head | WP01 | |
| T002 | Write the behaviour-row coverage map per family (PARSE, RENDER, INCL, GEN, RES, E2E) | WP01 | |
| T003 | Tag C-006 rows (path confinement, size cap, privacy) and name their guards | WP01 | |
| T004 | Fixture budget table per trim WP reaching at least 696 lines; block and escalate if not reachable | WP01 | |
| T005 | Suite timing: median of 3 runs of the in-scope vitest command | WP01 | |
| T006 | Results suites: map baseline tests to coverage rows | WP02 | |
| T007 | `gherkin-results.test.ts`: format matrix to `it.each`; fold the regressions block | WP02 | |
| T008 | `gherkin-results-render` and `scenario-index`: collapse layer-duplicate assertions | WP02 | |
| T009 | Swap results fixtures for CCK where covered; meet the 624-line fixture budget | WP02 | |
| T010 | Lint, count, mutation spot-check, timing | WP02 | |
| T011 | Hand-off: verdict table, retire log, counts, mutation evidence, timing | WP02 | |
| T012 | Core suites: map baseline tests to coverage rows | WP03 | [P] |
| T013 | Trim parse, feature-core, view, select, scenario-anchors | WP03 | |
| T014 | Trim render, mdast, fence, fence-build | WP03 | |
| T015 | Trim generate, codegen-guard, check-cli, options, load, integration, example, fixture-parity | WP03 | |
| T016 | Meet the 72-line fixture budget (rework the parity guard to one shared copy); lint, count, mutation check, timing | WP03 | |
| T017 | Hand-off: verdict table, retire log, counts, mutation evidence, timing | WP03 | |
| T018 | Include/loader suites and a11y spec: map baseline tests to coverage rows | WP04 | |
| T019 | Trim include, docs-loader-includes(-build), agent-page-includes | WP04 | |
| T020 | Trim `tests/a11y/gherkin.spec.ts`; pinned baselines unchanged | WP04 | |
| T021 | Lint, count, mutation check (including confinement), timing | WP04 | |
| T022 | Hand-off: verdict table, retire log, counts, mutation evidence, timing | WP04 | |
| T023 | Sentinel failure text, stack trace and attachment in the build test's report | WP05 | |
| T024 | Red-first: let the message through on purpose, show the test red, revert | WP05 | |
| T025 | Widen the dist tripwire to every built text file (`textFilesUnder`) | WP05 | |
| T026 | Hand-off: red/green evidence, out-of-map edit rationale | WP05 | |
| T027 | Missing report: three-state CI matrix plus empty/malformed report with CI set | WP06 | |
| T028 | `required: false` opt-out in options validation | WP06 | |
| T029 | Stale note on a single-scenario include result line, including a scenario missing from the report | WP06 | |
| T030 | Hand-mounted route warning, once per build across at least 2 pages | WP06 | |
| T031 | Set `CI` explicitly in every spawned build in tests (C-006 note) | WP06 | |
| T032 | Hand-off: red/green evidence and out-of-map edits | WP06 | |
| T033 | Red first: `indexLabel` option ignored today; default control stays "Overview" | WP07 | |
| T034 | DocKitty Starlight plugin injecting `dockitty.sidebar.indexLabel` with `en` default | WP07 | |
| T035 | Translation, option-wins and prev/next-keeps-title tests | WP07 | |
| T036 | Option validation and virtual-module field; compare the swap against the resolved label | WP07 | |
| T037 | Hand-off | WP07 | |
| T038 | ADR-0056 amending ADR-0055 (ADR-0055 not edited) | WP08 | |
| T039 | CHANGELOG [Unreleased] entries, user-focused, calling out `required: false` | WP08 | |
| T040 | Guides: authoring.md Overview label, consumer-setup.md results table and CI behaviour | WP08 | |
| T041 | Gate: final counts ≤ 6,524 test / ≤ 2,088 fixture lines and timing median ≤ baseline × 1.10 | WP08 | |

## Work Packages

### WP01 — Baseline re-measure, coverage map and suite timing
Prompt: `tasks/WP01-baseline-coverage-map-timing.md`. Dependencies: none.
T001 Re-measure the baseline (WP01)
T002 Coverage map (WP01)
T003 C-006 rows (WP01)
T004 Fixture budget (WP01)
T005 Suite timing (WP01)

### WP02 — Trim the results suites and swap in CCK fixtures
Prompt: `tasks/WP02-trim-results-suites-cck.md`. Dependencies: WP01.
T006 T007 T008 T009 T010 T011 (WP02)

### WP03 — Trim the core Gherkin suites
Prompt: `tasks/WP03-trim-core-gherkin-suites.md`. Dependencies: WP01.
T012 T013 T014 T015 T016 T017 (WP03)

### WP04 — Trim the include and loader suites and the a11y spec
Prompt: `tasks/WP04-trim-include-loader-a11y.md`. Dependencies: WP01, WP03.
T018 T019 T020 T021 T022 (WP04)

### WP05 — No report text in any built output
Prompt: `tasks/WP05-report-text-leak-guard.md`. Dependencies: WP02.
T023 T024 T025 T026 (WP05)

### WP06 — CI-required report, stale include note and hand-mounted route warning
Prompt: `tasks/WP06-result-handling-decisions.md`. Dependencies: WP02, WP03, WP04, WP05.
T027 T028 T029 T030 T031 T032 (WP06)

### WP07 — Translatable Overview label and indexLabel option
Prompt: `tasks/WP07-overview-label-i18n.md`. Dependencies: WP06 (shared `config.ts`).
T033 T034 T035 T036 T037 (WP07)

### WP08 — ADR-0056, CHANGELOG and adopter docs
Prompt: `tasks/WP08-adr-changelog-docs.md`. Dependencies: WP04, WP05, WP06, WP07.
T038 T039 T040 T041 (WP08)
