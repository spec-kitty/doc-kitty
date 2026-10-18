---
work_package_id: WP02
title: Trim the results suites and swap in CCK fixtures
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-003
- FR-004
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- C-001
- C-002
- C-004
- C-006
- SC-001
- SC-002
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: be9d1ba385f9a63c637457a0488bbebaafd41341
created_at: '2026-10-14T19:11:55.793090+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
- T011
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/tests/gherkin-results.test.ts
execution_mode: code_change
lane: planned
mission_id: 01M4XVCM3XBX6BXHXDZFBPX7ZV
model: sonnet
owned_files:
- src/tests/gherkin-results.test.ts
- src/tests/gherkin-results-render.test.ts
- src/tests/gherkin-results-build.test.ts
- src/tests/scenario-index.test.ts
- src/tests/fixtures/gherkin/results/**
role: implementer
wp_code: WP02
---
# WP02 — Trim the results suites and swap in CCK fixtures

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`implementer-ivan`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Trim rules (read before touching a test)

1. **Measurement (NFR-001/002).** Count exactly with `node kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs --json` from the repo root. Run the formatter and linter (`pnpm lint --fix` or the project formatter) and make them pass **before** counting. New helpers, new fixtures and split-out test files count; a split-out `*.test.ts` that no frozen file imports must be added to the script's `FROZEN` list. List FROZEN additions (count-lines.mjs) as an exact diff in your hand-off; counts are invalid until the orchestrator applies it. Report before/after for your files.
2. **Coverage-map protocol (FR-004, NFR-003).** Use the WP01 map in `research/coverage-map.md`. Every baseline `it`/`test` in your files maps to a behaviour row. Each test gets a verdict: KEEP, RETIRE or SPLIT. Each RETIRE names its survivor as `file:"test name"` plus the asserting line (`:L<n>`), which must assert that row's behaviour. You may **not** commit files under `kitty-specs/` (this is a code WP). Put the full verdict table (rows, After cell, verdict, security tag, break-checked) and the retire log in your **hand-off report**; the orchestrator commits it as `research/test-verdicts-WPxx.md` and updates the coverage map.
3. **C-002**: CCK fixtures under `results/cck/` are never edited. You may drop a whole CCK file only if no remaining test needs it; provenance stays recorded.
4. **C-006**: no RETIRE may remove the only guard of include path confinement, the report size cap, or report-text privacy. Verdict table rows tagged C-006 name the surviving guard (`file:"test name":L<n>`) and are break-checked (rule 7).
5. **C-004**: tests and fixtures only. No production change.
6. **Pinned baselines**: a11y and example baselines unchanged.
7. **Mutation spot-check (NFR-004, FR-004).** Per suite family you own: break ≥1 behaviour in source and show a KEEP goes red. Break ≥20% (min 2) of RETIRE rows, including every C-006-tagged RETIRE, and show each named survivor goes red. Revert every break. Put the evidence (break, test, red output line) in the report. A survivor that stays green blocks the WP.
8. **Suite time (NFR-005).** Record median of 3 runs of your files against WP01's per-file baseline (informational). The gate is WP08's whole-command run.

## Objective

Plan IC-02: the largest single cut. Collapse the format matrix (cucumber-js JSON, cucumber-jvm JSON, messages NDJSON) into `it.each` tables, fold the review-regression tests into the rows they guard, and replace the top-level `results/` reports with the existing CCK fixtures wherever CCK covers the case. The top-level fixtures (`messages.ndjson`, `cucumber-js.json`, `cucumber-jvm.json`, `filtered.ndjson`, `dry.ndjson`, `features/checkout.feature`) are **real** cucumber-js 13.3.0 output from a synthetic run (`PROVENANCE.txt`), not hand-written; `cck/` is already used (`gherkin-results.test.ts:139-185`). Keep a top-level fixture only with a written reason naming the case CCK lacks. Update `PROVENANCE.txt` for every fixture you add or remove. **Your fixture budget is 624 lines** (WP01 T004 table; use the corrected number if WP01 changed it). You are the sole trim owner of the four suites and `fixtures/gherkin/results/**`. WP05 and WP06 edit `gherkin-results-build`, `gherkin-results-render` and `scenario-index` tests after you.

## Subtasks

- **T006** Map every baseline case in your four files to WP01 rows; draft verdicts.
- **T007** `gherkin-results.test.ts`: format matrix to `it.each`; fold regressions.
- **T008** `gherkin-results-render` and `scenario-index`: collapse layer-duplicate assertions.
- **T009** Swap top-level reports for CCK and meet your WP01 fixture budget (624 lines): delete `cucumber-jvm.json`; drop `cck/all-statuses.jvm.json` whole once the JSON status-word survivor is break-checked; replace `messages.ndjson` + `features/checkout.feature` with a CCK pair. Keep `cucumber-js.json`, `filtered.ndjson`, `dry.ndjson` with a reason line each in `PROVENANCE.txt`. Rename ripple to fix in the same commit: `gherkin-results-build.test.ts:106,122` and `gherkin-results-render.test.ts:139,226,258,448` (messages/filtered/dry paths); `scenario-index.test.ts:381,393` (reads `messages.ndjson` + `features/checkout.feature`); `gherkin-results-render.test.ts:43,255` create a `.tmp-` dir inside the results fixture folder, so keep that folder and delete the temp dir in `afterEach`. Keep size-cap and privacy guards (C-006). Report the fixture lines cut; below 624 blocks the WP unless WP01's table assigned the gap elsewhere.
- **T010** Lint/format, count, mutation spot-check, timing.
- **T011** Hand-off: verdict table, retire log, counts, mutation evidence, timing.

## Shared context (all work packages)

- **Mission documents**: `kitty-specs/gherkin-trim-and-followups-01M4XVCM/spec.md`, `plan.md` (Implementation Concern Map), `research.md`, `research/baseline.md`, `research/coverage-map.md`, `research/count-lines.mjs`, `data-model.md`, `contracts/*.md`, `quickstart.md`, `decisions/DM-*.md`.
- **Do not add, upgrade or remove a dependency** (DIRECTIVE_051). Stop and report if one seems needed.
- **Test economy (C-001, DIRECTIVE_041)**: strengthen existing tests before adding new ones; every new guard has a paired positive control (tactic acceptance-criteria-non-vacuity).
- **Frozen shared helpers**: `src/tests/helpers/*` and `tests/a11y/{mode,routes}.ts` are not edited by any WP.
- **Pinned baselines**: pinned a11y and example-output baselines must not change (NFR-006), except where FR-007/FR-009 intends it.

## Environment gotchas

- Run vitest from `src/` with `node_modules/.bin/vitest run <files>`. Do not use `pnpm exec` (it has install side effects). Run other bins directly too.
- If the default npm registry is unreachable, use `https://registry.npmjs.org/`.
- In markdown, never start a line with `#` followed by a digit (C-005; the doc sanity gate fails).
- The ADR index is generated: `node src/scripts/generate-adr-index.mjs`. Never edit it by hand.
- Example builds create directories relative to `example/`; delete any stray output dirs they leave before committing.
- PlantUML being absent locally is expected; related local reds are not yours. CI is the verifier.
- Commit only your owned files. A file outside `owned_files` is an out-of-map edit and must be named with a rationale in your hand-off.
