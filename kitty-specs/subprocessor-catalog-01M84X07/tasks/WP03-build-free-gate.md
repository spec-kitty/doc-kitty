---
work_package_id: WP03
title: Build-free gate
dependencies:
- WP02
requirement_refs:
- FR-008
- NFR-002
- NFR-003
- NFR-005
- SC-001
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
subtasks:
- T010
- T011
- T012
- T013
agent: claude
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent:
- src/tests/validate-catalog-subprocessors.test.ts
execution_mode: code_change
owned_files:
- src/scripts/validate-catalog.mjs
- src/tests/validate-catalog-subprocessors.test.ts
- src/tests/fixtures/subprocessors-gate/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 - Build-free gate

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Make `node src/scripts/validate-catalog.mjs [<root> ...]` (and so `pnpm validate:catalog`)
check each root's `_meta/subprocessors.yaml` through WP02's
`checkSubprocessorCatalog`. The gate must not re-implement any check.

Requirements: FR-008, NFR-002 (the gate half), NFR-003, NFR-005. Depends on: WP02.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- Run `spec-kitty agent action implement WP03 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

- **Gate layout.** Read `src/scripts/validate-catalog.mjs` in full:
  - `validateRoot(root, problems)` returns counts.
  - `run(argv)` prints problems and a summary line, and sets the exit code.
  - The measures check imports the shared core and does not re-implement it. Follow that precedent.
- **Test precedent.** `src/tests/validate-catalog-measures.test.ts` is the closest existing test. Mirror how it invokes `run` or `validateRoot` and captures output.
- **Red first.**

## Subtasks

### T010 — Red-first tests and fixtures

**Fixtures.** Create under `src/tests/fixtures/subprocessors-gate/`, each a docs root:

- `ok/`: a valid `_meta/subprocessors.yaml` with 2 records, plus one ordinary page so the walk has content.
- `bad/`: a catalog with a duplicate id **and** a lower-case country code, which gives two problems.
- `none/`: one page and no catalog.

**`validate-catalog-subprocessors.test.ts`** asserts:

1. `ok` produces no problems. The summary reports `2 sub-processor record(s)`, with the exact wording you choose, kept consistent with the existing summary style.
2. `bad` produces exactly the two contract messages, in file order, and the exit code is 1.
3. `none` produces no problems, and the summary omits the sub-processor count or shows 0 (decide, and document it in the test). This is the positive-control pair with `ok`.
4. **Parity, the gate half.** The problems for `bad` equal `checkSubprocessorCatalog(root, label).problems` called directly, with the same label. This proves the gate adds nothing and loses nothing.

### T011 — Wire it in

In `validateRoot`:

- Call `checkSubprocessorCatalog(resolve(root), relative('.', join(root, '_meta', 'subprocessors.yaml')))`.
- Push its `problems` unchanged.
- Return a third count, `subprocessors` (records when present, else 0).

In `run`:

- Add the count to the summary line.
- Update the file header comment with a paragraph on the sub-processor check that names ADR-0086 and the shared loader.
- Keep the doc comment's "does NOT re-implement" stance explicit.

Do not change the behaviour of the citation or measures checks.

### T012 — Speed test (NFR-003)

- Generate a 200-record catalog in a temp directory inside the test, with valid fields and distinct ids.
- Time `validateRoot` and assert it takes under 2000 ms.
- Keep the generated data deterministic.
- If CI flakiness is a concern, also assert well under the limit locally, but keep only the 2000 ms assertion.

### T013 — Repository roots stay clean

- `pnpm validate:catalog` (roots `docs` and `example/docs`) must still exit 0.
- Neither root has a catalog yet; WP06 adds the example one. Confirm that an absent catalog adds no output noise.

## Definition of Done

- The tests were written first and now pass.
- The gate calls only `checkSubprocessorCatalog`, with no duplicated checks.
- The 200-record test passes in under 2 s.
- `pnpm validate:catalog` exits 0.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Reviewer guidance

- Grep the gate for any sub-processor rule logic. There must be none.
- Check that the message lines pass through untouched.
- Check the `none` fixture is a real positive-control pair with `ok`.
