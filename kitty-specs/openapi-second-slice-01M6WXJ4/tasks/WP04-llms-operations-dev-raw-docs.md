---
work_package_id: WP04
title: llms.txt operation summary and raw documents in astro dev
dependencies:
- WP02
requirement_refs:
- FR-014
- FR-016
- FR-028
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: bad3506575330f52a204931a63cb7f48285d0dd8
created_at: '2026-11-08T13:21:15.272656+00:00'
subtasks:
- T023
- T024
- T025
- T026
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
- src/lib/openapi/llms.ts
- src/lib/integrations/openapi-dev.ts
- src/tests/openapi-llms.test.ts
- src/tests/openapi-dev.test.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/llms.ts
- src/lib/routes/llms-txt.ts
- src/lib/integrations/openapi-dev.ts
- src/tests/openapi-llms.test.ts
- src/tests/openapi-dev.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP04 - llms.txt operation summary and raw documents in astro dev

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Opt-in operation lines (contracts/llms-operations.md) and dev serving of raw documents with an exact route allowlist.

Requirements: FR-014, FR-016. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T023: Red first

Write `tests/openapi-llms.test.ts` cases titled `[WP04] ...` before any implementation and run them: they must fail because no operation lines are emitted and dev returns 404. Record the red output in the commit message. Flip the matching `it.fails('[WP04] ...')` cases WP01 left in the seam test.

### T024: llms.ts

Operation lines with fallbacks, flattened and link-escaped; off output byte-identical; `openApiLlmsLines` re-export points here.

### T025: Dev handler

`openapi-dev.ts` registered via one `devHandlers` push: exact allowlist of `<base><section>/<label>/openapi.<ext>[.sha256]` after base-aware parsing; GET/HEAD only; reject dot segments, `%2e`, encoded slashes.

### T026: Tests

On/off, fallbacks, zero ops, hostile; dev on root and base returns build-identical bytes (NFR-007 in dev); traversal cases 404/405; two-build compare green for llms.txt. Flip [WP04] cases.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-llms.test.ts tests/openapi-dev.test.ts tests/openapi-seam.test.ts
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption openapi-optin.test.ts )
```

## Acceptance checks

- [ ] Off byte-identical
- [ ] Dev bytes equal build
- [ ] Traversal rejected
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP04 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Rebase on #265 if it lands first.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
