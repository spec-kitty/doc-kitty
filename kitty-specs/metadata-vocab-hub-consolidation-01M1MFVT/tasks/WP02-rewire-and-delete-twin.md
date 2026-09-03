---
work_package_id: WP02
title: 'Rewire toolkit + gate onto the core; delete the twin (#49 IC-02 + #39 wiring)'
dependencies:
- WP01
requirement_refs:
- FR-002
- FR-003
- FR-005
- NFR-002
- NFR-003
planning_base_branch: feat/metadata-vocab-hub-consolidation
merge_target_branch: feat/metadata-vocab-hub-consolidation
branch_strategy: Planning artifacts were generated on feat/metadata-vocab-hub-consolidation. Branch from the WP01 result during /spec-kitty.implement; completed changes merge back into feat/metadata-vocab-hub-consolidation unless the human redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/schema.ts
- src/lib/metadata.ts
- src/lib/sections.ts
- src/scripts/validate-frontmatter.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. This is DISCIPLINED_REFACTORING: **behavior must not change** — you are swapping duplicated implementations for imports of the one core from WP01.

## Objective

Make `schema.ts`, `metadata.ts`, `sections.ts`, and the bare-Node `validate-frontmatter.mjs` gate all consume the WP01 shared core, and **delete the ~700-line hand-mirrored twin** from the gate. Wire `durable` into the metadata type union and `isPublished`. After this WP, section vocabulary + type-derivation has exactly one implementation. Read `../plan.md` (IC-02, IC-04), `../research.md` (D1, D2), `../data-model.md`, and WP01's `vocabulary-core.mjs`/`vocabulary-loader.mjs` exports. **Depends on WP01** — start from its result.

## Critical context (file:line)

- The gate twin to DELETE lives in `src/scripts/validate-frontmatter.mjs`: enum arrays `:45-57`, `SECTION_TYPE` `:239-253`, `expectedType` `:328-349`, resolver `:359-432`, section-registry readers `:263-311`, index-basename helpers `:59-135`. Replace each with an import from `./` + `../lib/vocabulary-core.mjs` / `../lib/vocabulary-loader.mjs`. Keep the gate's CLI surface, `{problems, warnings}` return shape, and exit codes **identical**.
- `metadata.ts` MUST stay fs-free and MUST NOT import `sections.ts` or the loader — import only `vocabulary-core.mjs` (`sections.ts:18-21`, `metadata.ts:222-223`).
- `metadata.ts:20-40` holds the `DocStatus`/`DocType` unions — add `durable` to `DocStatus` (FR-005). `isPublished` is `metadata.ts:306` — ensure a `durable` doc is **published** (never-retire ⇒ visible; today only draft is excluded — confirm `durable` is not treated as unpublished).
- `schema.ts:34-53` currently defines `DOC_TYPES`/`KINDS` and `:174` the `doc_status` z.enum as **literals** — replace with the core's `STATUSES/DOC_TYPES/KINDS` so the zod enum is single-sourced (this is how `durable` reaches validation). Keep the Astro loader wiring (`:13,:15,:16`) untouched.
- `sections.ts` should re-export `loadVocabulary`/`loadSectionRegistry`/`sectionTypes`/`sectionSubtypes` from the loader and the resolver types from the core, preserving its current public API (callers like `Hub.astro:53` import `loadSectionRegistry, sectionOrder` from it — do not break those names).
- Consumers that enumerate statuses do so via the imported `STATUSES` (`assert-chrome-artifacts.mjs:26`), so `durable` propagates automatically — but **verify** `assert-build-artifacts.mjs`/`assert-chrome-artifacts.mjs` still pass (they key on specific values for draft-exclusion + agent-index shapes).

## Subtasks

### T007 — Rewire `schema.ts`
Import `STATUSES/DOC_TYPES/KINDS` from `../lib/vocabulary-core.mjs`; replace the literal `doc_status` enum (`:174`) and the `DOC_TYPES`/`KINDS` consts (`:34-53`) with the core values. Leave Astro loader/starlight schema wiring intact.

### T008 — Rewire `metadata.ts` + add `durable`
Import `SECTION_TYPE`, `expectedDocType`, and the enum/union sources from `../lib/vocabulary-core.mjs` (fs-free only — no loader import). Add `durable` to the `DocStatus` union (`:20-40`). Ensure `isPublished` (`:306`) returns `true` for `durable`. Keep metadata.ts fs-free.

### T009 — Rewire `sections.ts`
Re-export the loader functions and resolver from `vocabulary-loader.mjs`/`vocabulary-core.mjs`; delete `sections.ts`'s now-duplicated inline resolver/loader bodies (`:294-415` region) while preserving every exported name and its behavior/signatures.

### T010 — Rewire the gate + delete the twin
In `validate-frontmatter.mjs`, replace the duplicated blocks (enums, SECTION_TYPE, expectedType, resolver, registry readers, index-basename) with imports from the core + loader; **delete** the twin code. The gate must still run under plain `node` with no Astro/build context (imports resolve to `.mjs`, never `.ts`). Preserve `STATUSES` re-export if `assert-chrome-artifacts.mjs:26` imports it from here — either keep a `export { STATUSES } from '../lib/vocabulary-core.mjs'` shim or update that import (prefer the shim to minimize blast radius; if you change the import, that edit is a justified out-of-map one-liner — record the rationale).

### T011 — Prove bare-Node + gates green
- Run the frontmatter gate under bare `node` against the example tree; confirm no Astro import is pulled in.
- Run the full gate/build set: `validate-frontmatter`, `assert-build-artifacts.mjs`, `assert-chrome-artifacts.mjs`, and the Astro build. All green. (If local `node_modules` is broken, rely on `node --check` + CI and say so — do not fake results.)

### T012 — Verify `durable` end-to-end
Add/point at a fixture doc with `doc_status: durable`; confirm it validates (gate + zod) and that `isPublished` counts it published (it appears in published-set generators). No existing status changes meaning (NFR-002).

## Definition of Done
- All four owned files import the WP01 core; the ~700-line twin is gone (grep: no second `SECTION_TYPE`/`expectedType`/resolver definition remains outside the core).
- Gate runs under bare `node`; frontmatter validation, `assert-*` gates, and Astro build all green (or CI-verified with a clear note if local env is broken).
- `durable` validates and is treated as published; the four pre-existing statuses are unchanged.
- `metadata.ts` remains fs-free and free of any `sections.ts`/loader import.
- `spec-kitty agent tasks mark-status T007 … T012 --status done`.

## Risks / reviewer guidance
- **Deletion-to-pass** is forbidden: the twin is removed only because its logic now lives in the imported core — reviewer confirms behavior parity, not just that tests are green (WP03 rewrites the parity tests; until then the existing parity tests should still pass because both sides now resolve to the same core).
- Watch the `.js`→`.ts` vs `.mjs` specifier resolution: the gate must import `.mjs` paths that exist on disk for bare Node.
- Keep `sections.ts` public API stable — `Hub.astro` and other callers depend on the exact export names.
