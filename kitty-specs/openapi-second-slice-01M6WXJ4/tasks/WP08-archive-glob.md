---
work_package_id: WP08
title: Tagged-release archive input
dependencies:
- WP02
requirement_refs:
- FR-018
- FR-023
- FR-028
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: c633a1e7b9824c62c3f8703b8e5f2233f4f5f1e4
created_at: '2026-11-08T13:51:37.117125+00:00'
subtasks:
- T038
- T039
- T040
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: node-norris
authoritative_surface: src/lib/openapi/
create_intent:
- src/lib/openapi/archive.mjs
- src/tests/openapi-archive.test.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/archive.mjs
- src/tests/openapi-archive.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP08 - Tagged-release archive input

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Expand `openapi.archive` into spec versions, contained and capped (R8, FR-028).

Requirements: FR-018, FR-023. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T038: Red first

Write `tests/openapi-archive.test.ts` cases titled `[WP08] ...` before any implementation and run them: they must fail because the archive source is not registered. Record the red output in the commit message. Flip the matching `it.fails('[WP08] ...')` cases WP01 left in the seam test.

### T039: archive.mjs

`fs.globSync`, relative, no `..`, realpath under siteRoot, regular files, cap 200; POSIX path code-point sort appended after explicit (FR-023 archive part); label from group; released default true; one `specSources` register line.

### T040: Fail-closed

Zero matches, empty label, duplicate label, over 200, outside siteRoot. Switch the example third version to archive and keep `EXAMPLE_OPENAPI` in step.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-archive.test.ts tests/openapi-seam.test.ts
pnpm --filter example build && pnpm assert:openapi
```

## Acceptance checks

- [ ] Three files to three versions, stable order
- [ ] Archive rows fail `[dk-openapi]`
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP08 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Path separators.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
