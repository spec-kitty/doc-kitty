---
work_package_id: WP12
title: Content graph node, OKF file and exclusion ratchets
dependencies:
- WP02
requirement_refs:
- FR-003
- FR-004
- FR-010
- FR-011
- FR-012
- SC-002
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: b30bfa808802f7bccac9bbbe10b8357f0e12487d
created_at: '2026-11-08T13:21:06.086617+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: node-norris
authoritative_surface: src/lib/okf-export/
create_intent:
- src/tests/openapi-graph-okf.test.ts
- src/tests/openapi-exclusions.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/content-graph.ts
- src/lib/okf-export/integration.ts
- src/lib/okf-export/core.mjs
- src/lib/okf-export/conformance.mjs
- src/tests/openapi-graph-okf.test.ts
- src/tests/openapi-exclusions.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP12 - Content graph node, OKF file and exclusion ratchets

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

One `resource` graph node and one OKF file per version, and pinned exclusions from autolinker, feeds and frontmatter gate.

Requirements: FR-003, FR-004, FR-010, FR-011, FR-012, SC-002. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T018: Red first

Write `tests/openapi-graph-okf.test.ts` cases titled `[WP12] ...` before any implementation and run them: they must fail because graph and OKF carry no spec versions. Record the red output in the commit message. Flip the matching `it.fails('[WP12] ...')` cases WP01 left in the seam test.

### T019: Graph node

`content-graph.ts`: `{id:"openapi:<label>", kind:"resource", ...}` (R11); no per-op nodes; no schema bump.

### T020: OKF file

OKF integration reads `DK_OPENAPI`, writes `<section>/<label>.md` with the shared summary; conformance accepts it; listed in `okf/index.md`; hostile fixture escaped.

### T021: Exclusion ratchets

`openapi-exclusions.test.ts` on the FR-001 fixture: no RSS/Atom item (negative invariant), no autolink markup in API pages, frontmatter gate skips API routes while a bad spec still fails.

### T022: Cross-surface

Same label and sha256 across agent API, graph, OKF (SC-002); two-build compare green for graph and okf. Flip [WP12] cases.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-graph-okf.test.ts tests/openapi-exclusions.test.ts tests/openapi-seam.test.ts
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption openapi-optin.test.ts )
```

## Acceptance checks

- [ ] One node and one OKF file per version
- [ ] Exclusions hold with paired controls
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP12 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

OKF conformance rules for generated files.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
