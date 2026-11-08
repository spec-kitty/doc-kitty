---
work_package_id: WP07
title: Version switcher with same-operation mapping
dependencies:
- WP02
requirement_refs:
- FR-017
- NFR-005
- SC-003
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: cf5dd04c4be456566f776ba2ad6f9424255bfa79
created_at: '2026-11-08T13:34:36.802792+00:00'
subtasks:
- T034
- T035
- T036
- T037
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/lib/openapi/switcher.ts
- src/tests/openapi-switcher.test.ts
execution_mode: code_change
owned_files:
- src/components/OpenApiVersionNav.astro
- src/lib/openapi/switcher.ts
- src/styles/dk-openapi.css
- src/tests/openapi-switcher.test.ts
- tests/a11y/openapi.spec.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 - Version switcher with same-operation mapping

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Native disclosure of plain links upgraded by `src/lib/disclosure/`, landing on the same operation when it exists (reads `current.operationSlug`).

Requirements: FR-017, NFR-005, SC-003. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T034: Red first

Write `tests/openapi-switcher.test.ts` cases titled `[WP07] ...` before any implementation and run them: they must fail because the nav links overviews only. Record the red output in the commit message. Flip the matching `it.fails('[WP07] ...')` cases WP01 left in the seam test.

### T035: switcher.ts

Per version `{label, released, href, current}`; target op route or overview; base-aware; labels flattened.

### T036: Component and styles

`<details>` + links, `aria-current`, "unreleased" text; no inline script, no CSP hash; trailing-slash fix (debrief bug 6).

### T037: Tests

Mapping incl. duplicate suffix and v1-only op fallback; no-script reach; axe on overview, operation, fallback in light and dark.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-switcher.test.ts
pnpm test:a11y -- openapi.spec.ts
```

## Acceptance checks

- [ ] Same op in 100% where it exists
- [ ] 0 axe violations; CSP list unchanged
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP07 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Renderer slug coupling (C-007).

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
