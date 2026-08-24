---
work_package_id: WP05
title: 'Agent surface: resolved related + audience'
dependencies:
- WP01
- WP02
requirement_refs:
- FR-014
planning_base_branch: feat/audience-related-external-references
merge_target_branch: feat/audience-related-external-references
branch_strategy: Planning artifacts for this mission were generated on feat/audience-related-external-references. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/audience-related-external-references unless the human explicitly redirects the landing branch.
subtasks:
- T027
- T028
- T029
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: node-norris
authoritative_surface: src/lib/routes/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- src/lib/routes/shared.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load node-norris` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md)
(US5), [../contracts/agent-surface.contract.md](../contracts/agent-surface.contract.md),
and `docs/adr/0009-finalize-metadata-contract.md`.

> If `src/lib/routes/` filenames differ from those in `owned_files`, adjust to the
> actual agent-index / agent-page / shared route modules and note the correction.

## Objective

Enrich the per-page agent record with `audience` and a **resolved** `related` array,
**without** making `toAgentRecord` corpus-aware, and bump the agent-API `version`.

## Subtasks

### T027 — Compose `resolveRelated` in the route
In the agent route(s), build the docs index and enrich each record's `related` from
raw refs to `{ ref, title, kind, doc_status }` via WP01's `resolveRelated`. Note the
**index-shape adaptation**: `collectDocEntries()` (`shared.ts`) yields
`DocEntry{ slug, data }`, but `resolveRelated` expects a flat
`{ slug, title, kind, doc_status, description }` index — flatten before calling.
Carry `audience` as authored. `toAgentRecord(entry)` stays **pure/single-entry** — do
not edit `metadata.ts` (WP01-owned); enrich in the route. **Type honesty**: type the
enriched record against WP01's exported `ResolvedRelated` type (not an inline `as`
cast), so the emitted JSON does not diverge from a declared type.

### T028 — Bump the agent-API `version` [P]
The version is a **default**, not a literal in the example: `agentIndexRoute` falls
through to `options.version ?? '1'` (`src/lib/routes/agent-index.ts:35`). Bump that
**owned default** so every consumer's `related`-shape change is versioned
(DIRECTIVE_018). WP06/T031 asserts the concrete new value (not just its type).

### T029 — Keep gating intact
`doc_status` gating unchanged — a `draft` page stays absent from `/api/index.json`,
RSS, sitemap. `/api/bibliography.json` (WP02) is a catalog projection, not page-gated.

## Branch Strategy

Planning branch and final merge target: `feat/audience-related-external-references`.
Worktree per `lanes.json`; changes merge back into the mission branch.

## Definition of Done

- Each page record carries `audience` + resolved `related` (objects, not slugs).
- `toAgentRecord` unchanged (pure); enrichment lives in the route.
- Agent-API `version` incremented.
- `pnpm typecheck/lint/test` + `build-example` green (WP06 pins the emitted shape).

## Risks & reviewer guidance

- **Purity**: reviewer confirm `metadata.ts`/`toAgentRecord` untouched; enrichment is
  route-local (composes WP01's `resolveRelated`).
- **Version bump**: a shape change without a version bump is a silent
  published-contract break — verify the bump.
