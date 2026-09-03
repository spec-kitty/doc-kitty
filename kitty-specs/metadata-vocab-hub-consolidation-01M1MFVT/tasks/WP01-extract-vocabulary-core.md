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
branch_strategy: Planning artifacts were generated on feat/metadata-vocab-hub-consolidation. This WP may branch from a lane base during /spec-kitty.implement, but completed changes merge back into feat/metadata-vocab-hub-consolidation unless the human redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/vocabulary-core.mjs
- src/lib/vocabulary-core.d.ts
- src/lib/vocabulary-loader.mjs
- src/lib/vocabulary-loader.d.ts
- src/tests/vocabulary-core.test.ts
execution_mode: code_change
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/vocabulary-core.d.ts
- src/lib/vocabulary-loader.mjs
- src/lib/vocabulary-loader.d.ts
- src/tests/vocabulary-core.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. You are a Node/TypeScript implementer under ATDD/TDD discipline (DIRECTIVE_034/041) and DISCIPLINED_REFACTORING: this is a **behavior-preserving extraction** — the new core must reproduce existing logic byte-for-byte in effect.

## Objective

Create the single source of truth for section vocabulary + type-derivation as **two plain-ESM `.mjs` layers** with `.d.ts` sidecars, so both the bare-Node gate and the Astro toolkit can later import one implementation (WP02). This WP only creates the new modules + their unit tests; it does **not** yet rewire the existing consumers (that is WP02). Read `../spec.md` (FR-001, FR-004, NFR-001; C-001, C-002), `../plan.md` (IC-01, Structure Decision), `../research.md` (Decision D1 + the current-state audit table), and `../data-model.md` (the two core contracts).

## Critical context (brownfield, investigation-verified — file:line)

- **schema.ts is Astro-coupled** (`src/lib/schema.ts:13` `astro/loaders`, `:15/:16` `@astrojs/starlight/schema`) → cannot load in bare Node. **This is why the core must be `.mjs`, not `.ts`.**
- **metadata.ts is contractually fs-free and must never import sections.ts** (`src/lib/sections.ts:18-21`, `src/lib/metadata.ts:222-223`). Therefore the core is **two layers**: a fs-free layer (safe for metadata.ts) and a fs-loader layer (safe only for sections.ts + the gate). Do not put any `node:fs` in the fs-free layer.
- Source material to extract (reproduce semantics exactly):
  - Enums: `STATUSES/DOC_TYPES/KINDS` — `schema.ts:34-53` (+ union types `metadata.ts:20-40`) and the hand-mirror `validate-frontmatter.mjs:45-57`.
  - Frozen `SECTION_TYPE` fallback — `metadata.ts:188-202` (mirror `validate-frontmatter.mjs:239-253`).
  - `expectedDocType(relPath, typesBySection=SECTION_TYPE, subtypesBySection?)` incl. the adr/plans/operations sub-path switch — `metadata.ts:235-263` (mirror `validate-frontmatter.mjs:328-349`).
  - Vocabulary resolver `makeAxisResolver`, `parseVocabularyAxis`, `parseVocabulary`, `identityVocabulary` — `sections.ts:294-415` (mirror `validate-frontmatter.mjs:359-432`). Uses the gray-matter fenced-parse trick (`sections.ts:381-394`).
  - Index-basename detection helpers — `metadata.ts:407-525` (mirror `validate-frontmatter.mjs:59-135`).
  - Section-registry readers `loadSectionRegistry`, `sectionTypes`, `sectionSubtypes` — in `sections.ts` (mirror `validate-frontmatter.mjs:263-311`).
- **No new dependency**: reuse the existing `gray-matter`/`js-yaml` already used by `sections.ts`.
- The `.ts`→`.mjs` import direction already works under vitest/esbuild and Astro Vite (11+ `.ts` tests import `.mjs` today), so no build step / no `allowJs`: TS consumers get types from the `.d.ts` sidecars you write.

## Subtasks

### T001 — Create `src/lib/vocabulary-core.mjs` (fs-free derivation/enum core)
Export, as plain ESM with **zero** `node:fs`/Astro imports:
- `export const STATUSES = ['draft','active','deprecated','superseded','durable']` — **`durable` added here** (this is #39's single-site landing; FR-004). Keep the existing four unchanged and in order; append `durable`.
- `export const DOC_TYPES` (the 17-item set) and `export const KINDS` (the 13-item set), verbatim from `schema.ts:34-53`.
- `export const SECTION_TYPE` — the frozen map from `metadata.ts:188-202` (use `Object.freeze`).
- `export function expectedDocType(...)` — line-for-line semantics of `metadata.ts:235-263` incl. the adr(`template.md`→`Template`)/plans(`epics`→`Epic`,`features`→`Feature`)/operations(`runbooks`→`Runbook`) switch and the `null`-for-unknown-section rule.
- The pure resolver: `makeAxisResolver`, `parseVocabularyAxis`, `parseVocabulary(rawYaml, sourceLabel)`, `identityVocabulary()` — the string-in/resolver-out halves of `sections.ts:294-415` (the fs read stays in the loader layer, T003).
- Pure index-basename helpers from `metadata.ts:407-525` (`isIndexPath`, `isRootIndex`, `detectIndexCollisions`, `escapeRegExp`, `indexBasenamePattern`, `normalizeIndexBasenames`).

### T002 — Create `src/lib/vocabulary-core.d.ts`
Hand-write declarations for every T001 export: the enum arrays (`readonly string[]` or precise string-literal unions where the TS side needs them — match what `metadata.ts`/`schema.ts` currently rely on), `SECTION_TYPE`, `expectedDocType`, and the `VocabularyResolver` interface (`{ resolveType, resolveKind }`, `sections.ts:308-311`) plus the resolver factories. No `allowJs`.

### T003 — Create `src/lib/vocabulary-loader.mjs` (fs-loader layer)
May use `node:fs`. Import the pure parsers from `./vocabulary-core.mjs`. Export:
- `loadVocabulary(docsRoot)` — reads `<docsRoot>/_meta/vocabulary.yaml`, returns `identityVocabulary()` when absent (semantics of `sections.ts:410-415`).
- `loadSectionRegistry(docsRoot)`, `sectionTypes(registry)`, `sectionSubtypes(registry)` — reading `<docsRoot>/_meta/sections.yaml` (semantics of the `sections.ts` readers). Reuse the gray-matter fence trick.

### T004 — Create `src/lib/vocabulary-loader.d.ts`
Declarations for the loader exports (return types reference `VocabularyResolver`/registry types from the core `.d.ts`).

### T005 — Unit tests `src/tests/vocabulary-core.test.ts`
Pin the core's behavior directly (single implementation, no twin):
- `STATUSES` contains `durable` **and** still contains all of `draft/active/deprecated/superseded`.
- `expectedDocType` over a path corpus covering adr/plans(epics,features)/operations(runbooks)/unknown-section→null (reuse the corpus shape from `section-type-parity.test.ts` if helpful — but read, do not import the twin).
- Resolver: identity YAML → identity; an alias YAML resolves `effective`; a forbidden term yields the forbidden verdict.

### T006 — Prove fs-free purity + bare-Node importability
- `node --check src/lib/vocabulary-core.mjs` and `node --check src/lib/vocabulary-loader.mjs`.
- Grep-assert `vocabulary-core.mjs` imports **no** `node:fs` and nothing from `astro`/`@astrojs`.
- A one-off `node -e "import('./src/lib/vocabulary-loader.mjs').then(...)"` (or a tiny scratch `.mjs`) proves both layers import under plain Node with no Astro context (C-001).

## Definition of Done
- Both `.mjs` modules + both `.d.ts` sidecars + `vocabulary-core.test.ts` created under `src/lib/` and `src/tests/`.
- `vocabulary-core.mjs` is provably fs-free and Astro-free; both modules pass `node --check` and import under bare Node.
- New unit tests pass. **No existing consumer is edited in this WP** (that is WP02) — existing gates stay green because nothing they use has changed yet.
- `spec-kitty agent tasks mark-status T001 T002 T003 T004 T005 T006 --status done` after each is complete.

## Risks / reviewer guidance
- **Semantic drift** is the cardinal risk: the extracted functions must reproduce the originals exactly (reviewer: diff logic against the cited line ranges). Do not "improve" logic here.
- Keep the fs/no-fs boundary clean — any `node:fs` leaking into `vocabulary-core.mjs` fails the mission's core invariant (C-001 + metadata.ts purity).
- Note for WP02: the local environment may have a broken `node_modules` (root-owned/half-materialized) — if `pnpm`/`vitest` can't run locally, rely on `node --check` + CI as the verifier and say so; do not fake test runs.
