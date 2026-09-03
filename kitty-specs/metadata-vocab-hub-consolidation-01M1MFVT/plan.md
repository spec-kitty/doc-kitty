# Implementation Plan: Metadata / Vocabulary / Hub Consolidation

**Branch**: `feat/metadata-vocab-hub-consolidation` | **Date**: 2026-09-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/metadata-vocab-hub-consolidation-01M1MFVT/spec.md`

## Summary

Three deferred adoption enablers on the metadata → vocabulary → Hub surface. The headline (#49) eliminates the mjs↔ts vocabulary/type-derivation split-brain by extracting a **two-layer pure-ESM shared core** (fs-free derivation/enum core + thin fs-loader layer) that both the bare-Node `validate-frontmatter.mjs` gate and the Astro-side toolkit import — making divergence impossible by construction while preserving `metadata.ts`'s fs-free purity contract (DM `plan.consolidation.core-structure`). On top of that single source, #39 adds the `durable` `doc_status` value as a true one-liner, and #50 makes the ADR Hub card order by ADR number and badge full lifecycle status + date by reusing the existing ADR-index generator's extraction (1:1 with the generated own-tree table). See [research.md](./research.md) for the current-state audit and decisions D1–D3.

## Technical Context

**Language/Version**: TypeScript 5.x (toolkit `src/lib/*.ts`) + plain ESM JavaScript (bare-Node `src/scripts/*.mjs`), Node.js ≥ Active LTS; Astro 4.x / Starlight docsite
**Primary Dependencies**: Astro + `@astrojs/starlight`, `zod`, `gray-matter`, `js-yaml` (all already present — none added, upgraded, or removed)
**Storage**: Filesystem only — `docs/_meta/vocabulary.yaml`, `docs/_meta/sections.yaml`, ADR markdown under `docs/adr/` and `example/docs/adr/`
**Testing**: Vitest (unit + parity) in `src/tests/`; Playwright a11y/behavior lanes; bare-Node assertion gates (`assert-build-artifacts.mjs`, `assert-chrome-artifacts.mjs`); frontmatter gate `validate-frontmatter.mjs`
**Target Platform**: Static docsite build (Node build host) + browser
**Project Type**: single (monorepo with `src/` toolkit + `example/` adopter package)
**Performance Goals**: No runtime perf target; gate + build wall-clock must not regress materially (refactor is import-graph-neutral)
**Constraints**: C-001 bare-Node gate — no Astro build context, no Astro-coupled imports, shared core is pure ESM (`node:fs` allowed only in the loader layer); C-002 preserve `sections.ts` canonical semantics; C-004 additive enum only (not a bulk edit); C-005 non-regressive Hub change; metadata.ts stays fs-free and must not import sections.ts
**Scale/Scope**: ~3 toolkit modules refactored (`schema.ts`, `metadata.ts`, `sections.ts`) + 1 gate (`validate-frontmatter.mjs`) + 2 new shared `.mjs` (+`.d.ts`); 3 parity tests rewritten to unit tests; 1 enum value; 1 layout (`Hub.astro`) + shared ADR extractor; ~700-line duplicated surface collapsed

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/charter/`), loaded in compact mode. This mission **advances** the charter rather than tensioning it:

- **DIRECTIVE_044 (one source of truth)** — directly served: #49 collapses a triplicated vocabulary/enum surface into one; #50 single-sources ADR-status extraction with the generator. ✅
- **DISCIPLINED_REFACTORING** — #49 is behavior-preserving; parity tests are rewritten (not dropped) to keep behavior pinned (C-003). ✅
- **DIRECTIVE_024 (locality of change)** — after D1, vocabulary/enum edits (like #39) become single-site. ✅
- **DIRECTIVE_001 (architectural integrity)** — the two-layer split preserves the `metadata.ts` fs-free boundary rather than bending it. ✅
- **"Three separated axes" (type/audience/status)** — untouched semantically; `durable` is an additive point on the existing status axis. ✅
- **DIRECTIVE_051 (supply-chain)** — N/A: no dependency changes (research.md). ✅

No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/metadata-vocab-hub-consolidation-01M1MFVT/
├── plan.md              # This file
├── research.md          # Phase 0 output (current-state audit + D1–D3)
├── data-model.md        # Phase 1 output (enum + ADR-entry + core-API shapes)
├── spec.md              # Mission spec
└── checklists/requirements.md
```

(No `contracts/` — this mission adds no API endpoints or external event shapes; the "contracts" are the shared-core function signatures, captured in data-model.md.)

### Source Code (repository root)

```
src/
├── lib/
│   ├── vocabulary-core.mjs      # NEW — fs-free derivation/enum core:
│   │                            #   STATUSES/DOC_TYPES/KINDS, SECTION_TYPE,
│   │                            #   expectedDocType + adr/plans/operations switch,
│   │                            #   pure vocabulary/axis resolver, index-basename logic
│   ├── vocabulary-core.d.ts     # NEW — hand-written types for TS consumers
│   ├── vocabulary-loader.mjs    # NEW — fs-loader layer: loadVocabulary,
│   │                            #   loadSectionRegistry, sectionTypes/sectionSubtypes
│   ├── vocabulary-loader.d.ts   # NEW — types for the loader layer
│   ├── schema.ts                # EDIT — import enums/shape from vocabulary-core (drop literals)
│   ├── metadata.ts              # EDIT — import fs-free core (stays fs-free; add `durable`)
│   └── sections.ts              # EDIT — re-export from core + loader (canonical semantics preserved)
├── scripts/
│   ├── validate-frontmatter.mjs # EDIT — import core + loader; delete the ~700-line twin
│   └── generate-adr-index.mjs   # EDIT — export the ADR number/status/date extractor for reuse
├── layouts/
│   └── Hub.astro                # EDIT — ADR-kind: order by number + status/date badge (reuse extractor)
└── tests/
    ├── vocabulary-resolver.test.ts   # REWRITE — NFR-004 parity → single-impl unit test
    ├── section-type-parity.test.ts   # REWRITE — parity → unit test of the one core
    ├── schema-validator-parity.test.ts # REWRITE — NFR-005 parity → unit test
    └── hub-adr-card.test.ts          # NEW/EXTEND — ADR ordering + status/date fidelity
```

**Structure Decision**: Single project. Two new pure-ESM modules under `src/lib/` implement the two-layer core; the gate and toolkit become thin importers. `.d.ts` sidecars give TS consumers types without a repo-wide `allowJs`. No new packages, no build step, no codegen.

## Complexity Tracking

*No Charter Check violations — section intentionally empty.*

## Implementation Concern Map

> Concerns are not work packages. `/spec-kitty.tasks` maps these to WPs.

### IC-01 — Extract the two-layer pure-ESM vocabulary core

- **Purpose**: Create the single source of truth: a fs-free derivation/enum core + a thin fs-loader layer, both plain `.mjs` with `.d.ts` sidecars (D1).
- **Relevant requirements**: FR-001, FR-002, NFR-001; C-001, C-002
- **Affected surfaces**: NEW `src/lib/vocabulary-core.mjs`+`.d.ts`, `src/lib/vocabulary-loader.mjs`+`.d.ts`; content sourced from `schema.ts:34-53`, `metadata.ts:20-40,188-202,235-263`, `sections.ts:294-415`
- **Sequencing/depends-on**: none (foundation)
- **Risks**: Preserving exact semantics of `expectedDocType` + resolver; keeping the fs-free layer genuinely fs-free; `.js`→`.ts` specifier resolution vs bare-Node `.mjs` specifiers.

### IC-02 — Rewire toolkit + gate onto the core; delete the twin

- **Purpose**: Make `schema.ts`, `metadata.ts`, `sections.ts`, and `validate-frontmatter.mjs` import the shared core and remove the ~700-line hand-mirrored duplication (FR-002, FR-003).
- **Relevant requirements**: FR-002, FR-003, NFR-001, NFR-003; C-001, C-002
- **Affected surfaces**: `src/lib/schema.ts`, `src/lib/metadata.ts`, `src/lib/sections.ts`, `src/scripts/validate-frontmatter.mjs`
- **Sequencing/depends-on**: IC-01
- **Risks**: Astro-free purity of the import chain; gate must still run under plain `node`; behavior-preservation across all existing gate call sites.

### IC-03 — Collapse parity tests to single-impl unit tests

- **Purpose**: The three parity guards lose their second implementation; rewrite them to pin the one core's behavior rather than compare twins (C-003).
- **Relevant requirements**: NFR-001, NFR-003; C-003
- **Affected surfaces**: `src/tests/vocabulary-resolver.test.ts`, `src/tests/section-type-parity.test.ts`, `src/tests/schema-validator-parity.test.ts`
- **Sequencing/depends-on**: IC-02
- **Risks**: Not losing coverage — keep the resolved-output and path-corpus assertions, retargeted at the single core.

### IC-04 — Add `durable` to the doc_status enum

- **Purpose**: Additive `durable` status in the single enum source; ensure `isPublished` treats it as published (D2).
- **Relevant requirements**: FR-004, FR-005, NFR-002; C-004
- **Affected surfaces**: `src/lib/vocabulary-core.mjs` (enum), `src/lib/metadata.ts` union + `isPublished:306`; verify `assert-*.mjs` consumers
- **Sequencing/depends-on**: IC-01 (so it is genuinely single-site); may land with IC-02
- **Risks**: A durable doc must render on every status-consuming surface and be counted published; no existing status changes meaning.

### IC-05 — ADR-number-ordered, status-aware Hub card

- **Purpose**: `Hub.astro` orders ADR-kind children by number and badges lifecycle status + date, reusing the generator's extractor for 1:1 fidelity with the generated table (D3).
- **Relevant requirements**: FR-006, FR-007, NFR-004; C-005
- **Affected surfaces**: `src/layouts/Hub.astro:90-96` (sort), `src/scripts/generate-adr-index.mjs` (export extractor), `src/styles/hub.css` (badge), NEW/extended `src/tests/hub-adr-card.test.ts`
- **Sequencing/depends-on**: none functionally (independent of IC-01..04); shares the "single-source extraction" theme
- **Risks**: ADR-only gating (don't alter non-ADR listings, C-005); graceful fallback for missing number/status; single-ADR demo must not regress; reading body `## Status` via the Astro entry `body`.
