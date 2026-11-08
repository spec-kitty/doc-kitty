---
work_package_id: WP05
title: Unreleased versions out of the sitemap and search
dependencies:
- WP02
requirement_refs:
- FR-013
- FR-015
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: aaeea962940de1830cbf8fc7c1738251a3df5a6e
created_at: '2026-11-08T13:21:24.631763+00:00'
subtasks:
- T027
- T028
- T029
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
- src/lib/openapi/indexing.ts
- src/tests/openapi-indexing.test.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/indexing.ts
- src/tests/openapi-indexing.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 - Unreleased versions out of the sitemap and search

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Drop unreleased versions from sitemap and Pagefind; keep released operations searchable (R2).

Requirements: FR-013, FR-015. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T027: Red first

Write `tests/openapi-indexing.test.ts` cases titled `[WP05] ...` before any implementation and run them: they must fail because unreleased pages still carry `data-pagefind-body` and sitemap entries. Record the red output in the commit message. Flip the matching `it.fails('[WP05] ...')` cases WP01 left in the seam test.

### T028: indexing.ts

`pagefind` page-props hook and sitemap predicate; registered with one push each into `pagePropsHooks` and `sitemapPredicates`.

### T029: Tests

Unreleased: no `data-pagefind-body`, no fragment, no sitemap URL; all-unreleased variant; released ops findable by summary, method, path (paired control). Flip [WP05].

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-indexing.test.ts tests/openapi-seam.test.ts
pnpm --filter example build && pnpm assert:openapi
```

## Acceptance checks

- [ ] No unreleased URL in sitemap or pagefind
- [ ] Released ops searchable
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP05 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Splice guard must still throw on renderer change.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
