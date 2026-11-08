---
work_package_id: WP09
title: Multi-file bundling, Swagger 2 and the $ref gate
dependencies:
- WP02
requirement_refs:
- C-006
- FR-019
- FR-020
- FR-022
- FR-028
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: 6e867279bcf421eef9eaaf78d4d4b38f11388662
created_at: '2026-11-08T13:21:34.013817+00:00'
subtasks:
- T041
- T042
- T043
- T044
- T045
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
- src/lib/openapi/bundle.mjs
- src/tests/openapi-bundle.test.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/bundle.mjs
- src/package.json
- pnpm-lock.yaml
- src/tests/openapi-bundle.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP09 - Multi-file bundling, Swagger 2 and the $ref gate

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Bundle multi-file definitions under strict containment, accept Swagger 2 with original bytes (R4, R9, X4).

Requirements: FR-019, FR-020, FR-022, C-006. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T041: Red first

Write `tests/openapi-bundle.test.ts` cases titled `[WP09] ...` before any implementation and run them: they must fail because external refs are still rejected wholesale. Record the red output in the commit message. Flip the matching `it.fails('[WP09] ...')` cases WP01 left in the seam test.

### T042: Dependency

`@readme/openapi-parser` 4.1.2 pinned; lockfile transitive set unchanged; no lifecycle scripts.

### T043: Ref gate

Realpath root and targets, regular files, symlinks inside, reject absolute/`file://`/`http` and encoded separators, resolvers deny-by-default (http off), ref count/depth bound, external cycle chain.

### T044: Bundle and Swagger 2

Deterministic serialisation; bytes via `writeCacheAtomic`; Swagger 2 original bytes; register both sources.

### T045: Tests

All `$ref` rows; internal cycle kept; two-build compare of bundled bytes.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-bundle.test.ts tests/openapi-seam.test.ts
pnpm install --frozen-lockfile
```

## Acceptance checks

- [ ] Bundled file + sha256 published
- [ ] Every ref row fails closed
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP09 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Parser output order.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
