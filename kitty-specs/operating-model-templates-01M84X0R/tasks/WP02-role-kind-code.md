---
work_package_id: WP02
title: Role kind in the vocabulary and the gate
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- NFR-001
- NFR-002
- C-003
planning_base_branch: feat/402-operating-model-templates
merge_target_branch: feat/402-operating-model-templates
branch_strategy: Planning artifacts for this mission were generated on feat/402-operating-model-templates. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/402-operating-model-templates unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-operating-model-templates-01M84X0R
base_commit: 4a7b32034dae4f5d045aee8a3e20b03663f95c8e
created_at: '2026-11-23T22:34:23.447072+00:00'
subtasks:
- T004
- T005
- T006
- T007
history:
- timestamp: '2026-11-23T22:30:23Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/vocabulary-core.mjs
create_intent:
- src/tests/role-kind.test.ts
- src/tests/fixtures/valid/role.md
- src/tests/fixtures/err/role-no-role.md
- src/tests/fixtures/err/role-no-responsibilities.md
execution_mode: code_change
owned_files:
- src/lib/vocabulary-core.mjs
- src/scripts/validate-frontmatter.mjs
- src/tests/role-kind.test.ts
- src/tests/vocabulary-core.test.ts
- src/tests/fixtures/valid/role.md
- src/tests/fixtures/err/role-no-role.md
- src/tests/fixtures/err/role-no-responsibilities.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 - Role kind in the vocabulary and the gate

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Make `Role` a canonical kind and give a `kind: Role` page its requiredness rule. Write the tests first and commit them failing (NFR-001).

Requirements: FR-001, FR-002, FR-003; NFR-001, NFR-002; C-003 (single source).

## Branch strategy

- Planning branch and final merge target: `feat/402-operating-model-templates`.
- Run `spec-kitty agent action implement WP02 --agent claude --mission operating-model-templates-01M84X0R`. The worktree comes from `lanes.json`; never pick a base by hand.

## Context

- `KINDS` lives in `src/lib/vocabulary-core.mjs` (around line 471), and the list ends with `'Schematic'`. `src/lib/schema.ts` imports it, so the build zod schema picks up a new member automatically.
- The Persona requiredness block is in `src/scripts/validate-frontmatter.mjs` (around lines 637–660), under `if (data.kind === 'Persona')`. Its messages read `` `role`: persona requires a non-empty string ``.
- `src/tests/vocabulary-core.test.ts` pins the full list and `toHaveLength(15)`.
- Fixture pattern: `src/tests/fixtures/valid/*.md` and `src/tests/fixtures/err/*.md`. Look at how the existing gate tests drive them, for example the tests that use `fixtures/valid/tom-classification.md`; grep for `fixtures/valid` in `src/tests`.

## Subtasks

### T004 — Red tests

Create `src/tests/role-kind.test.ts`, which covers:

1. `KINDS` contains `'Role'`.
2. The fixture `fixtures/valid/role.md` has `kind: Role`, `role: Data Protection Officer` and `responsibilities: [Advise on data protection impact assessments]`, with no `goals`. The gate reports 0 problems.
3. In `fixtures/err/role-no-role.md` the gate reports a problem mentioning `` `role` `` and `role`.
4. In `fixtures/err/role-no-responsibilities.md` (`responsibilities: []`) the gate reports a problem mentioning `` `responsibilities` ``.
5. `responsibilities: ['  ']` (blank entries) fails, which is the non-vacuity pair for check 4.
6. Persona is unchanged: a Persona page without `goals` still fails on `goals` (FR-003).

Use the same gate entry point the existing fixture tests use, so the assertions run the production path. Update `vocabulary-core.test.ts` to expect `'Role', // appended (ADR-0085)` and a length of 16.

Commit the tests failing first: `test(role): red tests for the Role kind (#402)`.

### T005 — Append Role to KINDS

Add `'Role'` after `'Schematic'`, with a comment that points to ADR-0085. Do not reorder the list.

### T006 — Gate rule

Next to the Persona block, add:

```js
if (data.kind === 'Role') {
  // role + responsibilities required (ADR-0085); goals optional
}
```

Reuse the Persona checks by extracting a small helper, for example `requireNonEmptyString(data, field, label)` and `requireNonEmptyStringList(...)`, so both kinds share one implementation. Messages use `role` as the label, for example `` `role`: role requires a non-empty string ``. Keep the Persona messages byte-identical, since existing tests may assert them.

### T007 — Full suite green

- Run the full `pnpm test`, covering both the toolkit and mcp projects. Report the counts.
- Run `pnpm validate:docs`.
- Grep the repo for any other pinned kind count or snapshot (`toHaveLength(15)`, inline kind lists in tests) and fix it.

## Definition of Done

- The red commit precedes the green commit.
- `pnpm test` passes fully; record the src and mcp counts in the hand-off.
- Persona messages and behaviour are unchanged.

## Reviewer guidance

- Mutation check: deleting the Role block must turn test 3 and test 4 red. Removing `'Role'` from KINDS must turn test 1 and test 2 red.
