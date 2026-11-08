---
work_package_id: WP10
title: Pinned remote URL with cache and offline mode
dependencies:
- WP02
requirement_refs:
- FR-021
- FR-028
- NFR-008
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: 4bc635d1283b82e621abfaa2fb6946a3127b0971
created_at: '2026-11-08T14:35:09.090659+00:00'
subtasks:
- T046
- T047
- T048
- T049
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
- src/lib/openapi/remote.mjs
- src/tests/openapi-remote.test.ts
- src/tests/helpers/https-stub.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/remote.mjs
- src/tests/openapi-remote.test.ts
- src/tests/helpers/https-stub.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP10 - Pinned remote URL with cache and offline mode

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Fetch https definitions pinned by sha256, cache by digest, offline from cache (R5, X6-X8).

Requirements: FR-021, NFR-008. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T046: Red first

Write `tests/openapi-remote.test.ts` cases titled `[WP10] ...` before any implementation and run them: they must fail because the remote source is not registered. Record the red output in the commit message. Flip the matching `it.fails('[WP10] ...')` cases WP01 left in the seam test.

### T047: remote.mjs

Manual redirects (5, https), timeout 30 s, 10 MB cap, userinfo rejected, query redacted, no auth headers; hash verified before parse; `writeCacheAtomic`; one register line.

### T048: Offline

`openapi.offline` or `DOCKITTY_OFFLINE=1`: no fetch; corrupted cache refetched online, fails offline.

### T049: Tests

Local https stub: match, mismatch, 6 redirects, http hop, timeout, oversize, userinfo, offline cold/warm (fetch spy 0, byte-identical), corrupted, parser-spy before hash.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-remote.test.ts tests/openapi-seam.test.ts
```

## Acceptance checks

- [ ] Offline warm: 0 requests, identical output
- [ ] All remote rows fail closed
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP10 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Never hit real hosts.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
