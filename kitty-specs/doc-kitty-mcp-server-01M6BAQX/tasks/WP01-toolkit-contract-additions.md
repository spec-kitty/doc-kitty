---
work_package_id: WP01
title: 'Toolkit contract additions: types, sections, buildId, pointer'
dependencies: []
requirement_refs:
- FR-003
- FR-008
- FR-009
- C-006
planning_base_branch: feat/doc-kitty-mcp-server
merge_target_branch: feat/doc-kitty-mcp-server
branch_strategy: Planning artifacts for this mission were generated on feat/doc-kitty-mcp-server. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/doc-kitty-mcp-server unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-doc-kitty-mcp-server-01M6BAQX
base_commit: ae9075d1029a74849311d8fcf08c2be5032ef071
created_at: '2026-11-01T15:54:34.473927+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- '2026-11-01 planned: created from IC-01 of plan.md after post-plan squad amendments'
authoritative_surface: src/lib/
create_intent:
- src/lib/contract.ts
execution_mode: code_change
mission_slug: doc-kitty-mcp-server-01M6BAQX
owned_files:
- src/lib/contract.ts
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- src/lib/routes/scenario-index.ts
- src/lib/routes/llms-txt.ts
- src/lib/routes/shared.ts
- src/package.json
- src/tests/**
- example/**
tags: []
tracker_refs: []
---

# WP01 - Toolkit contract additions: types, sections, buildId, pointer

## Objective

Make the published agent-API self-describing so a generic external consumer (the MCP server, WP02+) can consume it without reinterpreting anything:

1. Export a **dependency-free** TypeScript contract module for every machine artifact (`index.json`, per-page JSON, `scenarios.json`) as `@spec-kitty/doc-toolkit/contract`.
2. Emit a `sections[]` array into the machine index, sourced from the section registry (`docs/_meta/sections.yaml`).
3. Stamp a `buildId` into the index, every per-page artifact, and the scenarios artifact - the same value everywhere in one build - computed from canonical source inputs, never from emitted bytes.
4. Emit an opt-in MCP wiring pointer (`_links.mcp` in the index, a one-line mention in `llms.txt`), config-gated, default off for now.

Squad context you must respect (post-plan review, verdicts folded into the plan):

- **A1 (architect)**: the routes currently emit anonymous inline shapes; only `AgentRecord` is exported, and importing the package root drags in `astro:content`, which does not resolve outside Astro. That is why the contract module must be its own file with **zero imports** (only `export type/interface`), and why the routes must be retyped to it.
- **V2 (reviewer)**: today's index has **no `sections[]` at all** (verified against `example/dist/api/index.json`); FR-003's section listing is impossible without this emission.
- **A3 (architect)**: hashing emitted bytes is self-referential and requires the generator to re-derive sibling route outputs. Hash **source inputs** instead. Reproducibility holds because no artifact carries a build clock (`updated` is frontmatter-derived).

## Context

Mission: `kitty-specs/doc-kitty-mcp-server-01M6BAQX/` - read `spec.md`, `plan.md` (IC-01), `research.md` (R3 as amended), `squad-dispositions.md` rows A1/A3/A9/V2/D3.

Repo facts (verified by the squad, re-verify before relying):

- Routes live in `src/lib/routes/`: `agent-index.ts`, `agent-page.ts`, `scenario-index.ts`, `llms-txt.ts`, with `shared.ts` holding `absolute()`.
- Example build output exists at `example/dist/api/` (`index.json` with `version: "3"`, `count`, `pages`, etc.).
- `src/package.json` has an `exports` map (add the new subpath there, not at package root).
- Section registry: `example/` (or a consuming site's) `docs/_meta/sections.yaml`; the toolkit already loads it for the section registry feature - find the existing loader and reuse it; do not re-implement YAML parsing.
- Toolkit unit tests live under `src/tests/` (check `src/vitest.workspace.ts` for the project names).

## Subtask guidance

### T001 - Contract-types module

Create `src/lib/contract.ts` exporting **types only** (no runtime code, no imports from other modules):

```ts
export interface AgentIndex {
  title: string;
  version: string;           // contract major handshake (today "3")
  count: number;
  buildId: string;           // T004
  generatedFrom?: string;    // existing field; keep optional as today
  sections: SectionRecord[]; // T003
  pages: AgentRecordEntry[];
  _links: IndexLinks;        // T005 adds mcp
}
export interface AgentPagePayload { /* per-page artifact shape incl. markdown, keywords, buildId */ }
export interface ScenarioIndex { /* features[].scenarios[] envelope incl. version + buildId */ }
```

Rules:
- Authority check: diff every interface against the real artifacts (mint them with `pnpm --filter example build`; `example/dist` is gitignored, so build first) - the artifacts, not this prompt, are the mirror authority. Enumerations verified 2026-11-01: per-page payloads additionally carry `authors`; scenarios.json top level is `version` (int), `generated_from` (snake_case - NOT the index's camelCase `generatedFrom`), `count`, `results {report, format, as_of}` (results per feature: `current`), `features[]`; scenario optionality: `examples?`, `rule?`, `result?`.
- Mirror today's emitted shapes exactly first (fields per the real artifacts: `slug`, `route`, `section`, `title`, `description`, `type`, `doc_status`, `kind`, `tags`, `related`, `priority`, `updated`, `source`, `audience`, `url`, `_links` on page records; per-page payloads additionally carry `keywords` + `markdown`).
- Then add the new fields (`buildId`, `sections`, `_links.mcp`).
- Add the subpath export in `src/package.json` `exports` as a BARE string (`"./contract": "./lib/contract.ts"`), matching the existing bare-string style (`".": "./index.ts"` etc.); the package ships raw TS - the mcp package consumes it with `import type` only. Note: the routes construct via object spread, so excess-property checks alone won't catch drift - the T002 retyping must type the RETURN values, not just add annotations.

### T002 - Retype generator routes

- Give `agent-index.ts`, `agent-page.ts`, `scenario-index.ts` explicit return/emit types from T001's module. The route handlers must construct values satisfying those types; the goal is "emitted JSON and published type cannot diverge" (type error at build time when they do).
- Keep behavior identical otherwise; this is typing plus the additions below.
- Existing test topology: run `pnpm --filter @spec-kitty/doc-toolkit test` (fast lane) until green after typing.

### T003 - sections[] emission

- Emit `sections: [{ id, label, order, purpose? }]` into `index.json`, in registry order, sourced from the section registry loader already used by the site build.
- A site without a registry emits `sections: []` rather than failing (absent-registry precedent in the codebase: absent registry filters nothing).
- Update example snapshot tests accordingly.

### T004 - buildId stamps

- Implement `buildIdForBuild(inputs)` in `src/lib/routes/shared.ts` or a new small module: sha256 hex over a canonical serialization of (per entry: id + body bytes + serialized frontmatter) + generator-relevant config + toolkit version. Keep the serializer deterministic (stable key order).
- Stamp the **same** computed value into: index `buildId`, each per-page payload's `buildId`, and the scenarios artifact's `buildId`.
- Determinism test: build the example site twice in the test lane, assert identical buildId across both runs, and assert the three artifact kinds share one value within a build.

### T005 - MCP wiring pointer (config-gated, default off)

- Add config knob `links.mcp` (boolean, default false) beside the existing `links.pages` gate in the agent-index config.
- When enabled: `_links.mcp: { "href": "npm:@spec-kitty/doc-kitty-mcp", "title": "Doc-Kitty MCP server", "usage": "<space-separated launch command with this site's base URL>" }`. Until the C-002 publishing ruling, the `usage` string documents the tarball launch form (see mission `quickstart.md`), NOT an npmjs `npx` line.
- When enabled, `llms.txt` gains one line: name of the MCP capability and pointer to the machine index.
- Tests: enabled run emits the pointer with the site's own base URL substituted; disabled run (default) emits none.

## Definition of Done

- [ ] All five subtasks complete; `pnpm --filter @spec-kitty/doc-toolkit test` green.
- [ ] Example site rebuilds; emitted index contains `sections[]`, `buildId`, and (with knob on) `_links.mcp`; per-page and scenarios artifacts carry the same `buildId`.
- [ ] A committed, non-manual proof under `src/tests/` (a minimal scratch tsconfig fixture project run in the toolkit lane): a file importing **only** types from `@spec-kitty/doc-toolkit/contract` compiles with `tsc --noEmit` outside Astro - so a later import regression into `contract.ts` fails CI on the spot, not WP02 (A1 close-out).
- [ ] Determinism test passes (two rebuilds, identical buildId) and a content edit changes it.
- [ ] No behavior change to any other route output (snapshot diffs show only the new fields).

## Risks / reviewer guidance

- Reject any import in `contract.ts` - it must stay dependency-free (run a check; A1's whole point).
- Reject `buildId` computed from emitted JSON bytes (self-reference trap, A3).
- Reject a `buildId` that only knows the index (torn page fetches are the actual tear site).
- Reviewer: check the example snapshot diff wire-by-wire; additive fields only.
- Terminology per repo rules: refer to the surfaces as the machine index / agent-API; no "feature" wording (Mission canon).

## Branch strategy

Planning base branch: `feat/doc-kitty-mcp-server`; merge target: `main`. Execution worktree and lane come from `lanes.json` (finalize-tasks); this WP is the base of the dependency chain - later WPs branch onto whatever lane order finalize computes.

Implementation command: `spec-kitty agent action implement WP01 --agent <name> --mission doc-kitty-mcp-server-01M6BAQX`
