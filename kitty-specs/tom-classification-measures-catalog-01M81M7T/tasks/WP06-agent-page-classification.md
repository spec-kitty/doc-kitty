---
work_package_id: WP06
title: Resolved tom_classification on the per-page agent record
dependencies:
- WP02
- WP03
requirement_refs:
- FR-008
- FR-010
- SC-001
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-tom-classification-measures-catalog-01M81M7T
base_commit: e8cdcae2ed71c7160052af6f6d4206ba721187a8
created_at: '2026-11-22T13:39:40.419569+00:00'
subtasks:
- T020
- T021
- T022
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/routes/agent-page.ts
create_intent:
- src/tests/agent-page-measures.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/agent-page.ts
- src/lib/contract.ts
- src/tests/agent-page-measures.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP06 - Resolved tom_classification on the per-page agent record

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

`/api/pages/<id>.json` gains `tom_classification`: each entry resolved to `{ measure, label, nature, scope, note? }`. The key appears only when the page has the field, so every other payload is byte-identical (FR-010). An unknown id fails the page's build, naming the page and the id.

Requirements: FR-008, FR-005 (page side), FR-010. Depends on: WP02, WP03.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP06 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `src/lib/routes/agent-page.ts` `GET`: builds `payload: AgentPagePayload` with conditional spreads (`...(data.sources ? { sources } : {})`). Follow that pattern.
- `src/lib/contract.ts:221` `AgentPagePayload` is the published type.
- The docs root for a route comes from `docsRoot()` in `src/lib/routes/shared.ts` (async, reads the collection). Use it: `loadMeasuresCatalog(await docsRoot())`. The loader memoises per root (WP02), so one build parses once.
- Contract: `contracts/machine-surfaces.md` `/api/pages` section. The payload entry does **not** include `frameworks` or `dpv`. Those live on the graph node. Keep the record small: `measure, label, nature, scope, note?`.

## Subtasks

### T020: Payload type

In `src/lib/contract.ts` add:

```ts
/** One resolved TOM classification entry on a page record (ADR-0080). */
export interface AgentPageMeasure {
  measure: string;
  label: string;
  nature: 'technical' | 'organisational' | 'legal' | 'physical';
  scope: 'system' | 'organisation';
  note?: string;
}
```

and `tom_classification?: AgentPageMeasure[];` on `AgentPagePayload`, with a doc comment saying it is present only when the page declares the field.

### T021: Route

- After `record` is built and before `payload`: when `data.tom_classification !== undefined`, run `resolveClassification(data.tom_classification, catalog.index, <page label>, catalog.source)` and map each entry to `AgentPageMeasure` in key order `measure, label, nature, scope, note?`.
- Page label: the entry's file path relative to the docs root, if it is available from the entry (`entry.filePath`, made relative to `docsRoot`). Otherwise the slug plus `.md`. It must name the page. Use the same label rule as WP05, and coordinate through the contract (`<page path>`).
- Spread `...(measures ? { tom_classification: measures } : {})` **after** `sources` and before `includes`, so existing key order is untouched.
- Do not resolve for the synthetic OpenAPI branch.

### T022: Tests (write first)

`src/tests/agent-page-measures.test.ts`: read how `agent-api.test.ts` and other route tests stub `astro:content` (search the tests for `vi.mock('astro:content'` or the helper that does it) and reuse that seam. Cover:

- a page with `[transmission-protection, { measure: accountability, scope: organisation, note: 'n' }]` gives `tom_classification` equal to the two expected objects, in order;
- a page without the field gives a payload that has no `tom_classification` key (`'tom_classification' in payload === false`), and its JSON is identical to the pre-change shape for the same entry (FR-010 ratchet). Positive control: the classified page on the same fixture;
- an unknown id makes `GET` reject (or throw) with a message containing the page label and the id.

If no reusable `astro:content` seam exists, extract the mapping into a small exported pure helper in `agent-page.ts`, for example `resolvePageMeasures(data, catalog, label)`. Unit-test it, and keep one thin integration assertion through the example build in WP08.

## Definition of done

- Tests green (red first); lint and typecheck clean; no suppressions.

## Risks

- The `/api/pages` route is mounted by the site (`src/pages/api/pages/[...slug].json.ts`), so a site may not have it. That is fine: WP05's graph route is the always-on fatal check.

## Reviewer guidance

- Key absent for unclassified pages; key order of the existing payload unchanged.
