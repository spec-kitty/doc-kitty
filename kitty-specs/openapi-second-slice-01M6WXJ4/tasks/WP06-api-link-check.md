---
work_package_id: WP06
title: Build-time link check over API page HTML
dependencies:
- WP02
requirement_refs:
- FR-009
- FR-028
- NFR-006
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: 7da5c186d70c7448b84bb4f7d337a9a5930237c3
created_at: '2026-11-08T13:31:50.386335+00:00'
subtasks:
- T030
- T031
- T032
- T033
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: node-norris
authoritative_surface: src/lib/integrations/
create_intent:
- src/lib/integrations/openapi-link-check.ts
- src/tests/openapi-link-check.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/openapi-link-check.ts
- src/tests/openapi-link-check.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP06 - Build-time link check over API page HTML

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Fail the build on broken or dangerous links in rendered API pages, after publication (R6).

Requirements: FR-009, NFR-006. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T030: Red first

Write `tests/openapi-link-check.test.ts` cases titled `[WP06] ...` before any implementation and run them: they must fail because broken links build cleanly. Record the red output in the commit message. Flip the matching `it.fails('[WP06] ...')` cases WP01 left in the seam test.

### T031: Classifier and resolver

Relative `.md`, root-relative, fragment, external skipped; `javascript:`, `data:`, `vbscript:` fail; base stripped; raw docs count.

### T032: Hook

One push into `buildDoneHooks` (runs after the publisher); `[dk-openapi] <route>: broken link <target>`.

### T033: Tests

Each class; dangerous schemes; example root and based builds 0 broken (with `assert-no-broken-links.mjs`).

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-link-check.test.ts
pnpm --filter example build && node src/scripts/assert-no-broken-links.mjs example/dist --base /doc-kitty
```

## Acceptance checks

- [ ] Each broken class fails naming route and target
- [ ] Dangerous schemes fail
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP06 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Renderer markup; pin on 0.27.0.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
