---
work_package_id: WP03
title: Synthetic entries on the agent index, agent pages and MCP corpus
dependencies:
- WP02
requirement_refs:
- C-001
- FR-001
- FR-002
- FR-005
- NFR-004
- NFR-007
- SC-001
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: e670436ad30965d3c733f5cd7b5d880856f2bff2
created_at: '2026-11-08T13:20:56.969788+00:00'
subtasks:
- T013
- T014
- T015
- T016
- T017
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: node-norris
authoritative_surface: src/lib/routes/
create_intent:
- src/tests/openapi-agent-entries.test.ts
- mcp/tests/corpus/openapi-entries.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- src/tests/openapi-agent-entries.test.ts
- mcp/tests/corpus/openapi-entries.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP03 - Synthetic entries on the agent index, agent pages and MCP corpus

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

One synthetic record per version on `/api/index.json` and `/api/pages/<section>/<label>.json`, per contracts/synthetic-entry.md, including `related: []` and `audience: []`.

Requirements: FR-001, FR-002, FR-005, SC-001, NFR-004, NFR-007, C-001. Depends on: WP02.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T013: Red first

Write `tests/openapi-agent-entries.test.ts` cases titled `[WP03] ...` before any implementation and run them: they must fail because no synthetic records are emitted. Record the red output in the commit message. Flip the matching `it.fails('[WP03] ...')` cases WP01 left in the seam test.

### T014: Agent index

Append one record per version after docs records (R10 values), base-aware `url`, `source`, `rawDocumentUrl`, lowercase `sha256`, `released`; text through `flattenText`.

### T015: Agent pages

`getStaticPaths` adds `<section>/<label>`; payload with `markdown` from `openApiSummaryMarkdown`, `related: []`, `audience: []`, `_links.describedby`, `keywords`, `authors: []`, `buildId`. Contract major `"3"`.

### T016: MCP corpus

`mcp/tests/corpus/openapi-entries.test.ts` runs the corpus shape assertions on the built two-versions agent API; no MCP source change.

### T017: Growth and checksum

ops-1 and ops-200 each add exactly one entry (NFR-004, C-001); sha256 equals bytes at `rawDocumentUrl` on root and based builds; hostile fixture escaped; two-build compare green for `api/`. Flip [WP03] cases in seam and arm B.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-agent-entries.test.ts tests/openapi-seam.test.ts
pnpm --filter @spec-kitty/mcp exec vitest run tests/corpus/openapi-entries.test.ts
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption openapi-optin.test.ts )
```

## Acceptance checks

- [ ] N entries for N versions incl. unreleased
- [ ] Payload passes MCP shape assertions
- [ ] No per-operation entries
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP03 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

Shared with #280; isolate the OpenAPI branch.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
