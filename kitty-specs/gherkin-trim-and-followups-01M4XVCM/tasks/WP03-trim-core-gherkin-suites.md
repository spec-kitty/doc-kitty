---
work_package_id: WP03
title: Trim the core Gherkin suites
dependencies:
- WP01
requirement_refs:
- FR-002
- FR-003
- FR-004
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-005
- C-001
- C-004
- C-006
- SC-001
- SC-002
- SC-003
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: 6074713f0f0f9a6a7bd5b4736565b55fef0fac73
created_at: '2026-10-14T19:12:21.585662+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/tests/gherkin-generate.test.ts
execution_mode: code_change
lane: planned
mission_id: 01M4XVCM3XBX6BXHXDZFBPX7ZV
model: sonnet
owned_files:
- src/tests/gherkin-parse.test.ts
- src/tests/gherkin-feature-core.test.ts
- src/tests/gherkin-view.test.ts
- src/tests/gherkin-select.test.ts
- src/tests/gherkin-scenario-anchors.test.ts
- src/tests/gherkin-render.test.ts
- src/tests/gherkin-mdast.test.ts
- src/tests/gherkin-fence.test.ts
- src/tests/gherkin-fence-build.test.ts
- src/tests/gherkin-generate.test.ts
- src/tests/gherkin-codegen-guard.test.ts
- src/tests/gherkin-check-cli.test.ts
- src/tests/gherkin-options.test.ts
- src/tests/gherkin-load.test.ts
- src/tests/gherkin-integration.test.ts
- src/tests/gherkin-example.test.ts
- src/tests/gherkin-fixture-parity.test.ts
- src/tests/fixtures/gherkin/render/**
- src/tests/fixtures/gherkin/load/**
- src/tests/fixtures/gherkin/generate/**
role: implementer
wp_code: WP03
---
# WP03 — Trim the core Gherkin suites

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

Plan IC-03: the same moves across parser, render, generate and options suites, with layer-duplicate assertions collapsed (an assertion made at parse, then again at render, then again at mdast keeps the lowest layer that proves it plus one end-to-end witness). You are the sole trim owner of the 17 listed suites and `fixtures/gherkin/{render,load,generate}/**`; you alone move or dedupe shared features such as `book-consignment.feature` within those folders. Do not move files that WP04's include fixtures import. **Fixture budget: 72 lines** (WP01 T004 table). **Parity guard rework**: `gherkin-fixture-parity.test.ts:22-27` pins `render/book-consignment.feature` and `generate/site/features/shipping/book-consignment.feature` byte-for-byte to `example/features/shipping/book-consignment.feature`, and `gherkin-codegen-guard.test.ts:35` reads the generate copy. Keep one shared copy, point both readers at it, and keep the parity test pinning that copy to the example (it still guards drift). `gherkin-fence.test.ts:478` reads `fixtures/gherkin/include` (WP04's folder) and `:644` reads `render/i18n-nl.feature`: keep both paths valid. `gherkin-fixture-parity` and `gherkin-example` pin example output: keep their pins. `gherkin-generate.test.ts` (1,034 lines) is the biggest file: work it `describe` by `describe`. WP06 edits `gherkin-options` and `gherkin-mdast` tests after you.

## Subtasks

- **T012** Map every baseline case to WP01 rows; draft verdicts.
- **T013** PARSE family: parse, feature-core, view, select, scenario-anchors.
- **T014** RENDER family: render, mdast, fence, fence-build.
- **T015** GEN family: generate (by describe), codegen-guard, check-cli, options, load, integration, example, fixture-parity.
- **T016** Fixture dedupe in render/load/generate to meet the 72-line budget (rework the parity guard as above); lint/format, count, mutation spot-check, timing. Below 72 lines blocks the WP.
- **T017** Hand-off: verdict table, retire log, counts, mutation evidence, timing.

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
