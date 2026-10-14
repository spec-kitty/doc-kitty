---
work_package_id: WP01
title: Baseline re-measure, coverage map and suite timing
dependencies: []
requirement_refs:
- FR-004
- NFR-001
- NFR-002
- NFR-003
- NFR-005
- SC-003
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: planner-priti
authoritative_surface: kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/coverage-map.md
execution_mode: planning_artifact
model: sonnet
owned_files:
- kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/baseline.md
- kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/coverage-map.md
- kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs
role: planner
---
# WP01 — Baseline re-measure, coverage map and suite timing

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`planner-priti`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Objective

Freeze what "the same behaviour" means before anything is removed (plan IC-01). Re-confirm the frozen baseline at `050b168c` (9,321 test lines, 2,784 fixture lines, 558 cases), fill `research/coverage-map.md` with behaviour rows for **all 558** baseline cases, mark the C-006 rows, confirm the fixture-cut route, and record suite timing. This WP writes only files under `kitty-specs/`; it may run code (vitest, the count script) but changes no code.

## Subtasks

- **T001** Re-run `research/count-lines.mjs` at the current head; confirm it matches baseline.md (or record and explain any drift).
- **T002** Fill coverage-map rows per family (PARSE, RENDER, INCL, GEN, RES, E2E). One row = one input class to one output/warning/error. Every baseline test name appears in Before.
- **T003** Tag C-006 rows (`path-confinement`, `size-cap`, `privacy`) and name their current guards.
- **T004** Fixture budget (NFR-002: cut ≥ 696 of 2,784 fixture lines, i.e. ≤ 2,088). Write a table in baseline.md "Fixture risk": file, non-blank lines (from `count-lines.mjs --json`), owner WP, route (delete / replace with CCK / dedupe to one shared copy), and the test lines that must change. Give each trim WP a fixture-line budget; the budgets together reach ≥ 696. Start from this allocation (re-derived 2026-10-14 from the count script; correct it with evidence):
  - **WP02, 624 lines**: `results/cucumber-jvm.json` (260, the CCK `*.jvm.json` files cover the cucumber-jvm dialect); `results/cck/all-statuses.jvm.json` (285, dropped whole, C-002, only if the JSON status-word mapping keeps a break-checked survivor in `cucumber-js.json` or `retry.jvm.json`); `results/messages.ndjson` + `results/features/checkout.feature` (79, replaced by a CCK `.ndjson` + `.feature` pair, with the rename ripple in the four results suites). Kept with a written reason: `cucumber-js.json` (243, CCK has no cucumber-js JSON dialect), `filtered.ndjson` (24, `--tags` run) and `dry.ndjson` (51, `--dry-run`), which CCK lacks.
  - **WP03, 72 lines**: `generate/site/features/shipping/book-consignment.feature` (42, dedupe to one shared copy still pinned to the example), `load/source-a/shipping/book-consignment.feature` (18), plus ≥ 12 more lines from render/load/generate that you name by file.
  - **WP04, 0 lines required**: `include/**` cuts are welcome and count toward the total.
  - Every other CCK file (`all-statuses.ndjson`, `examples-tables.*`, `retry.*`, `rules-backgrounds.*`, `empty.*`) is read by `gherkin-results.test.ts:139-185`; it stays.
  If your table cannot reach ≥ 696 with C-002 and C-006 intact, mark WP01 blocked and report the gap in lines to the orchestrator (NFR-002 decision for the operator). WP04 reads `render/` fixtures but does not move them; only WP03 moves render/load/generate fixtures.
- **T005** Measure suite time: median of 3 runs of `node_modules/.bin/vitest run <the 25 vitest files>` from `src/`; record runs and median in baseline.md (NFR-005).

## Verification

A grep of `^\s*(it|test)(\.each)?\(` names in the 26 frozen files against the map shows none missing. Include the grep command and its empty diff in the hand-off.

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
