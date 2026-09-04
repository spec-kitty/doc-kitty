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
branch_strategy: Planning artifacts for this mission were generated on feat/metadata-vocab-hub-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/metadata-vocab-hub-consolidation unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
history:
- created by /spec-kitty.tasks
- amended by post-tasks adversarial squad (F7, F8, F10, F11, F12)
agent_profile: node-norris
role: implementer
agent: claude
authoritative_surface: src/
execution_mode: code_change
owned_files:
- src/lib/schema.ts
- src/lib/metadata.ts
- src/lib/sections.ts
- src/scripts/validate-frontmatter.mjs
- src/scripts/new-doc.mjs
- src/scripts/scaffold.mjs
- src/tests/metadata.test.ts
create_intent: []
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. This is DISCIPLINED_REFACTORING: **behavior must not change** — you are swapping duplicated implementations for imports of the one core from WP01.

## Objective

Make `schema.ts`, `metadata.ts`, `sections.ts`, and the bare-Node `validate-frontmatter.mjs` gate consume the WP01 shared core, **delete the ~700-line hand-mirrored twin**, and wire `durable` into the metadata type union + `isPublished` with a committed test. After this WP, section vocabulary + type-derivation has exactly one implementation. Read `../plan.md` (IC-02, IC-04), `../research.md` (D1, D2, D4), `../data-model.md`, and WP01's `vocabulary-core.mjs`/`vocabulary-loader.mjs`. **Depends on WP01 — start from its MERGED result** (its new `.mjs` must exist in your worktree; F13).

## Critical context (squad-verified — file:line)

- Twin to DELETE in `validate-frontmatter.mjs`: enums `:45-57`, `SECTION_TYPE` `:239-253`, `expectedType` `:328-349`, resolver `:359-432`, registry readers `:263-311`, index-basename `:59-135`. Replace with imports from `../lib/vocabulary-core.mjs` / `../lib/vocabulary-loader.mjs`. Keep the gate's CLI surface, `{problems, warnings}` shape, and exit codes **identical**.
- **metadata.ts stays fs-free and must NOT import sections.ts or the loader** — import only `vocabulary-core.mjs` (`sections.ts:18-21`, `metadata.ts:222-223`).
- **Derive the unions, don't hand-edit them (F7/F8):** `metadata.ts:20-40` `DocType`/`DocStatus` literal unions are a residual twin of the core arrays. Replace them with `export type DocStatus = typeof STATUSES[number]` and `export type DocType = typeof DOC_TYPES[number]` (importing the JSDoc-const tuples from the core). Then `durable` is added in ONE place (WP01's array), never here.
- **`z.enum(STATUSES)` typing (F6):** `schema.ts:174` becomes `z.enum(STATUSES)` using the core's literal-tuple `STATUSES`; confirm `astro check` accepts it (WP01 T005 pre-verified the tuple typing). Keep Astro loader/starlight wiring (`:13,:15,:16`) intact.
- `sections.ts` re-exports `loadVocabulary`/`loadSectionRegistry`/`sectionTypes`/`sectionSubtypes` from the loader and the resolver from the core, **preserving every public export name** (`Hub.astro:53` imports `loadSectionRegistry, sectionOrder`).
- **Interim green (F12):** the gate currently exports `expectedType` (`:328`) which `section-type-parity.test.ts`/`deck-validator.test.ts` import; keep an `export { expectedDocType as expectedType }` alias from the gate so those tests stay green until WP03 rewrites them.
- **`isPublished` (F10/F11):** `metadata.ts:306` is `(data.doc_status ?? 'draft') !== 'draft'` — `durable` is **already** published; this is a **verify, not an edit** (do not add a special-case branch).
- **assert-chrome propagation (F12):** `assert-chrome-artifacts.mjs:26` imports `STATUSES`; `:173` `DOC_STATUS_LABELS = STATUSES`, so `durable` enlarges the label set. Run assert-chrome (not just assert-build) to catch any golden/shape assertion keyed on that set.

## Subtasks

### T007 — Rewire `schema.ts`
Import `STATUSES/DOC_TYPES/KINDS` from `../lib/vocabulary-core.mjs`; replace the literal `doc_status` z.enum (`:174` → `z.enum(STATUSES)`) and the `DOC_TYPES`/`KINDS` consts (`:34-53`). Confirm `astro check` green. Leave Astro wiring intact.

### T008 — Rewire `metadata.ts` + derive `durable`
Import `SECTION_TYPE`, `expectedDocType`, and the enum tuples from `../lib/vocabulary-core.mjs` (fs-free only). **Derive** `DocStatus = typeof STATUSES[number]` and `DocType = typeof DOC_TYPES[number]` (`:20-40`) — `durable` now flows in from the array with no edit here. Keep metadata.ts fs-free.

### T009 — Rewire `sections.ts`
Re-export loader + resolver from `vocabulary-loader.mjs`/`vocabulary-core.mjs`; delete the now-duplicated inline resolver/loader bodies (`:294-415`) while preserving every exported name/signature.

### T010 — Rewire the gate + delete the twin (all four twins — WP01 finding)
In `validate-frontmatter.mjs`, replace the duplicated blocks with imports from core + loader; **delete** the twin. Keep the `export { STATUSES }` re-export (assert-chrome:26) and add `export { expectedDocType as expectedType }` (F12). The gate must run under plain `node` (imports resolve to `.mjs`, never `.ts`).
**Also rewire the 3rd/4th twins WP01 surfaced:** `src/scripts/new-doc.mjs` and `src/scripts/scaffold.mjs` each carry their own hardcoded `expectedType` switch — import `expectedDocType` from `../lib/vocabulary-core.mjs` in both and delete their local copies (they are bare-Node scripts, so the `.mjs` core imports cleanly). WP01's single-source gate uses a **shrink-only ratchet**, so removing these twins simply drops the offender count below baseline and the gate stays green — you do NOT need to edit the WP01-owned `vocabulary-single-source.test.ts`. (A later cleanup can tighten the baseline to empty; if you do choose to, note it as a justified out-of-map edit.) If either script legitimately needs behavior the core lacks, keep it as-is with a one-line rationale — but prefer full rewire so NFR-001 is truly met.

### T011 — Prove bare-Node + gates green
Run the frontmatter gate under bare `node` on the example tree (no Astro import pulled in); run `validate-frontmatter`, `assert-build-artifacts.mjs`, **`assert-chrome-artifacts.mjs`** (F12), Astro build, and `astro check`. All green (or CI-verified with a clear note if local env broken).

### T012 — `durable` end-to-end + committed test
Add `durable` to the published-status loop in `src/tests/metadata.test.ts` (currently `['active','deprecated','superseded']`) AND a positive assertion `isPublished({title:'x', doc_status:'durable'}) === true` (F10). Point at / add a fixture doc with `doc_status: durable`; confirm it validates (gate + zod). No existing status changes meaning (NFR-002).

## Definition of Done
- All four source files import the WP01 core; the ~700-line twin is gone (grep: no second `SECTION_TYPE`/`expectedType`/resolver/enum definition outside the core — WP01's `vocabulary-single-source.test.ts` enforces this).
- `DocStatus`/`DocType` unions are derived (`typeof …[number]`), not hand-listed; `durable` exists only in the core array.
- Gate runs under bare `node`; frontmatter validation, `assert-build`, `assert-chrome`, Astro build, and `astro check` all green (or CI-verified with a note).
- `metadata.test.ts` asserts `durable` is published; `durable` validates; the four prior statuses unchanged.
- `metadata.ts` remains fs-free / no `sections.ts`/loader import.
- `spec-kitty agent tasks mark-status T007 … T012 --status done`.

## Risks / reviewer guidance
- **Deletion-to-pass** forbidden: the twin goes only because its logic now lives in the imported core; reviewer confirms behavior parity against WP01's golden-master, not just green tests.
- The pre-WP03 parity tests go tautological the moment both sides resolve to one core — do NOT treat "parity tests still pass" as proof of preserved behavior (that is WP01's golden-master's job).
- Keep `sections.ts` public API stable (`Hub.astro` + others depend on exact names); keep the `expectedType` alias until WP03.
