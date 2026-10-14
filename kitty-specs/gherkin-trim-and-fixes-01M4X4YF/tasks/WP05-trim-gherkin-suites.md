---
work_package_id: WP05
title: Trim the Gherkin test suites
dependencies:
- WP04
requirement_refs:
- FR-010
- FR-011
- FR-012
- NFR-001
- NFR-002
- NFR-004
- C-003
- C-004
- C-008
- SC-006
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-fixes-01M4X4YF
base_commit: 106eb6d2b0b40abb7d645cbd032f0ea4c716385d
created_at: '2026-10-14T12:43:13.363478+00:00'
subtasks:
- T018
- T019
- T020
- T021
history: []
agent_profile: randy-reducer
authoritative_surface: src/tests/gherkin-include.test.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/tests/gherkin-parse.test.ts
- src/tests/gherkin-select.test.ts
- src/tests/gherkin-view.test.ts
- src/tests/gherkin-mdast.test.ts
- src/tests/gherkin-fence.test.ts
- src/tests/gherkin-include.test.ts
- src/tests/gherkin-fence-build.test.ts
- src/tests/gherkin-render.test.ts
- src/tests/gherkin-scenario-anchors.test.ts
- src/tests/gherkin-load.test.ts
- src/tests/gherkin-codegen-guard.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP05 — Trim the Gherkin test suites

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`randy-reducer`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Judge every Gherkin test (KEEP / RETIRE / SPLIT-BY-KIND / MERGE) and retire only proven duplicates (#156). Plan: IC-06. Research: R6. Input: `research/gherkin-test-inventory.md` (first-pass verdicts and planted breaks).

## Branch strategy

Planning artifacts were generated on `issue-156-gherkin-trim-and-fixes`; completed changes merge back into `issue-156-gherkin-trim-and-fixes`, which goes to `main` as one draft PR the operator merges. The execution worktree is allocated per computed lane from `lanes.json`; run `spec-kitty agent action implement <WP> --agent claude --mission gherkin-trim-and-fixes-01M4X4YF`.

## Shared context

- Read `spec.md`, `plan.md` (your IC), `research.md`, `data-model.md`, `contracts/public-surface.md` and `research/code-grounding.md` first.
- Node 22, pnpm, Vitest. No dependency change.
- In a lane worktree run `pnpm install --offline --frozen-lockfile` once; revert mode-only changes under `src/scripts/` with `git checkout -- src/scripts`. Run tests per file: `cd src && ./node_modules/.bin/vitest run tests/<file>`.
- Locate code by symbol, not line: earlier WPs edit the same files.
- Every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifier in commits.
- Terminology: "Mission" for the Spec Kitty work object; Gherkin "Feature" is a domain term.

## Subtasks

### T018 — Inventory and verdicts

Start from `research/gherkin-test-inventory.md`; re-check each row against the suite as it stands after WP01–WP04 (line numbers moved). Record the final verdict table per file (17 files) in `research/test-verdicts.md` (planning artifact, committed on the planning branch), with reasons. Doctrine: `development-assist-test-cleanup`, DIRECTIVE_041, testing-principles and test-desiderata styleguides. Keep `tests/a11y/gherkin.spec.ts` and `tests/consumption/scripts/assert-consumer-gherkin.mjs` (C-008).

### T019 — Planted breaks

For each RETIRE / MERGE, plant the named one-line mutation alone, run the covering test, record red (test name + failing assertion), revert. A covering test that stays green means the RETIRE is coverage disguised as a duplicate: KEEP it (or merge its unique assertion into the covering test) instead. Also record, per kept emitter smoke, the fix it guards going red when reverted (the issue's "each KEEP shown red").

### T020 — Retire / merge

Delete the proven duplicates (delete-the-assertion-not-the-test: keep unique setup and edge cases). MERGE renders/builds where the inventory proposes it (fence 274/321/367 into 265; fence-build 190 into 258) without dropping an assertion. Out-of-map edits (recorded) to the suites owned by WP01–WP04 (`feature-core`, `generate`, `check-cli`, `integration`, `options`, `example`) for their RETIRE rows. Re-point any source comment that names a retired test.

### T021 — Re-run

`pnpm test`; record per-file before/after `it` counts and lines (reported, not gated; C-004).

## Definition of done

- 17/17 files have a verdict table; every RETIRE has recorded red evidence; `pnpm test` green.

## Risks and reviewer guidance

- The trap is coverage disguised as a duplicate: when in doubt, KEEP.
- No skip/xfail; no new ratchet.
