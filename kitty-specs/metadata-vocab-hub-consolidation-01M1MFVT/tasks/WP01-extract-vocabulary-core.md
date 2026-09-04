---
work_package_id: WP01
title: 'Extract the two-layer pure-ESM vocabulary core (#49 IC-01 + #39 enum)'
dependencies: []
requirement_refs:
- FR-001
- FR-004
- NFR-001
planning_base_branch: feat/metadata-vocab-hub-consolidation
merge_target_branch: feat/metadata-vocab-hub-consolidation
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-vocab-hub-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-vocab-hub-consolidation unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- created by /spec-kitty.tasks
- amended by post-tasks adversarial squad (F3, F6, F7, F8, F9)
agent_profile: node-norris
role: implementer
agent: claude
authoritative_surface: src/lib/
execution_mode: code_change
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/vocabulary-loader.mjs
- src/tests/vocabulary-core.test.ts
- src/tests/vocabulary-single-source.test.ts
create_intent:
- src/lib/vocabulary-core.mjs
- src/lib/vocabulary-loader.mjs
- src/tests/vocabulary-core.test.ts
- src/tests/vocabulary-single-source.test.ts
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. This is DISCIPLINED_REFACTORING: a **behavior-preserving extraction** — the new core must reproduce existing logic exactly in effect.

## Objective

Create the single source of truth for section vocabulary + type-derivation as **two plain-ESM `.mjs` layers**, so both the bare-Node gate and the Astro toolkit can later import one implementation (WP02). This WP creates the new modules + their tests only; it does NOT rewire existing consumers (WP02). Read `../spec.md` (FR-001, FR-004, NFR-001; C-001, C-002), `../plan.md` (IC-01), `../research.md` (Decisions D1 + D4, and the current-state audit table), and `../data-model.md`.

## Critical context (brownfield, squad-verified — file:line)

- **schema.ts is Astro-coupled** (`schema.ts:13` `astro/loaders`, `:15/:16` `@astrojs/starlight/schema`) → cannot load in bare Node. The core must be `.mjs`.
- **metadata.ts is fs-free and must never import sections.ts** (`sections.ts:18-21`, `metadata.ts:222-223`). Hence **two layers**: fs-free core (safe for metadata.ts) + fs-loader (safe only for sections.ts + the gate). No `node:fs` in the fs-free layer.
- **Typing (D4/F6 — allowJs is already global):** `astro/tsconfigs/base.json` sets `"allowJs": true`; `src/tsconfig.json` extends it. So a `.d.ts` sidecar for a `./x.mjs` specifier is **ignored** (TS resolves `.d.mts`/`.mts`), and a plain `export const STATUSES = [...]` infers `string[]` → `z.enum(STATUSES)` fails `astro check` (CI `pnpm typecheck`). **Do NOT write `.d.ts` sidecars.** Give the enum arrays literal-tuple types via JSDoc const: `export const STATUSES = /** @type {const} */ (['draft','active','deprecated','superseded','durable'])`. (If JSDoc-const proves insufficient under `astro check`, fall back to `.mts` cores with `.d.mts` sidecars — pick whatever compiles; the DoD is a green `astro check`, not a particular file.)
- Source material to reproduce EXACTLY: enums `schema.ts:34-53`; `SECTION_TYPE` `metadata.ts:188-202`; `expectedDocType` + adr/plans/operations switch `metadata.ts:235-263`; resolver `makeAxisResolver`/`parseVocabularyAxis`/`parseVocabulary`/`identityVocabulary` `sections.ts:294-415` (gray-matter fence trick `:381-394`); index-basename helpers `metadata.ts:407-525`; registry readers in `sections.ts`.
- **No new dependency**: reuse existing `gray-matter`/`js-yaml`.
- Env hazard: local `node_modules` may be root-owned/broken — if `pnpm`/`vitest`/`astro check` can't run locally, rely on `node --check` + CI as verifier and **say so**; never fake a run.

## Subtasks

### T001 — Create `src/lib/vocabulary-core.mjs` (fs-free derivation/enum core)
Plain ESM, **zero** `node:fs`/Astro imports:
- `STATUSES` (append `durable` to the existing four, in order — #39/FR-004), `DOC_TYPES` (17), `KINDS` (13) — each a JSDoc-const literal tuple (so `z.enum(...)` and `typeof X[number]` work in WP02).
- `SECTION_TYPE` — frozen map from `metadata.ts:188-202`.
- `expectedDocType(relPath, typesBySection=SECTION_TYPE, subtypesBySection?)` — exact semantics of `metadata.ts:235-263` incl. registry-subtype precedence, the adr(`template.md`→`Template`)/plans(`epics`→`Epic`,`features`→`Feature`)/operations(`runbooks`→`Runbook`) switch, and null-for-unknown-section.
- Pure resolver factories + parsers (string-in/resolver-out halves of `sections.ts:294-415`).
- Pure index-basename helpers (`metadata.ts:407-525`).

### T002 — Create `src/lib/vocabulary-loader.mjs` (fs-loader layer)
May use `node:fs`. Imports the pure parsers from `./vocabulary-core.mjs`. Export `loadVocabulary(docsRoot)` (reads `_meta/vocabulary.yaml`, else `identityVocabulary()`), `loadSectionRegistry(docsRoot)`, `sectionTypes(registry)`, `sectionSubtypes(registry)`.

### T003 — Golden-master unit test `src/tests/vocabulary-core.test.ts` (F3 — the independent oracle)
Because both twins will resolve to this core in WP02 (making the parity tests tautological), this test is the standalone oracle proving the extraction preserved behavior. Assert with **literal expected values** (derive the literals by observing the CURRENT twin during development — a throwaway scratch against `metadata.ts`/`validate-frontmatter.mjs` — then commit the literals, not a twin import):
- `STATUSES` = exactly `['draft','active','deprecated','superseded','durable']`.
- `expectedDocType` full corpus, a literal per row: section-default ADR, `adr/template.md`→`Template`, `plans/epics/e.md`→`Epic`, `plans/features/f.md`→`Feature`, `operations/runbooks/r.md`→`Runbook`, a registry-subtype case (`plans/missions/m.md`→`Mission` with a subtype registry), era-partitioned depth cases, and `unknown-section/p.md`→`null`.
- Index-basename: root-index verdict under default vs opted-in `["README","index"]`; both-index collision winner + demoted set.
- Resolver: identity YAML→identity; alias YAML resolves `effective`; forbidden term → forbidden verdict; kind axis.

### T004 — Single-source + purity gate `src/tests/vocabulary-single-source.test.ts` (F8/F9/NFR-001)
A committed structural gate that makes "impossible by construction" real:
- Greps the repo (excluding the core files) and **fails** if a second definition of `SECTION_TYPE`, `expectedType`/`expectedDocType`, the vocabulary resolver, or the `STATUSES`/`DOC_TYPES`/`KINDS` arrays reappears outside `vocabulary-core.mjs` (allow re-exports/imports; forbid re-definitions).
- **Fails** if `vocabulary-core.mjs` contains any `node:fs`/`fs` or `astro`/`@astrojs` import (fs-free + Astro-free, C-001).

### T005 — Confirm literal-tuple typing compiles (F6/F7 spike)
With JSDoc-const arrays in place, confirm `z.enum(STATUSES)` and `typeof STATUSES[number]` typecheck under `astro check` (5-line scratch, deleted after). De-risks WP02's `schema.ts`/`metadata.ts` rewire. If local `astro check` can't run, note CI verifies and leave the JSDoc-const in place.

### T006 — Prove fs-free purity + bare-Node importability
`node --check` both `.mjs`; a `node -e "import('./src/lib/vocabulary-loader.mjs')…"` proves both import under plain Node with no Astro context (C-001).

## Definition of Done
- `vocabulary-core.mjs` + `vocabulary-loader.mjs` created; **no `.d.ts` sidecars**; enum arrays are literal tuples (JSDoc-const or `.mts`).
- `vocabulary-core.test.ts` (golden-master, literal oracles) + `vocabulary-single-source.test.ts` (structural gate) created and passing (or CI-verified with a note).
- Core is provably fs-free + Astro-free; both modules pass `node --check` and import under bare Node.
- No existing consumer edited (that is WP02).
- `spec-kitty agent tasks mark-status T001 … T006 --status done`.

## Risks / reviewer guidance
- **Semantic drift** is the cardinal risk (reviewer: diff extracted logic against the cited line ranges; confirm golden literals were derived from real current behavior, not guessed).
- Keep the fs/no-fs boundary clean — any `node:fs` in `vocabulary-core.mjs` fails T004.
- WP02 must be **merged** (not just approved) before it branches — WP01's new `.mjs` must be present in WP02's worktree (F13, lane-hygiene).
