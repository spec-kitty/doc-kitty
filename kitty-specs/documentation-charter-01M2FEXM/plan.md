# Implementation Plan: Documentation Charter (M7 consolidation)

**Branch**: `feat/documentation-charter` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/documentation-charter-01M2FEXM/spec.md`

## Summary

Consolidate doc-kitty's three already-shipped, scattered governance seams (the
`type`/`kind` vocabulary override, the section/IA registry, and — newly — the
`doc_status` and required-field policy) into **one authoritative, doc-kitty-native
`_meta/charter.yaml`** resolved by the existing fs-free pure-core ↔ thin fs-loader
triad, with **legacy `_meta/vocabulary.yaml` / `_meta/sections.yaml` honored during
a back-compat window** and superseded by the charter when both are present. Close
the last hardcoded knobs (`doc_status` extend-only with canonical statuses reserved;
required-field set configurable with `title` as the floor), reconcile the frozen
`SECTION_ORDER` fallback, record the native-vs-Spec-Kitty-engine stance as a new
ADR, and recast `docs/context/convention.md` as the narrative companion (retiring
its "will later be recast" promise). No new runtime dependencies; enforcement stays
build-free; the packed-tarball consumption path (N=2) must not regress.

## Technical Context

**Language/Version**: Node.js (Active LTS; repo targets Node 20+), pure ESM. TypeScript for Astro-side `src/lib/*.ts`; JSDoc-typed `.mjs` for the fs-free core (allowJs, no `.d.ts` sidecars — existing convention in `vocabulary-core.mjs`).
**Primary Dependencies**: None added. Reuse in-tree YAML parsing already used by `vocabulary-loader.mjs` (`js-yaml` / existing loader), `zod` for frontmatter schema, Astro/Starlight for the site side. **Supply-chain: no dependency added/upgraded/removed → directive 051 / supply-chain tactic is N/A for this mission (documented in research.md, not silently skipped).**
**Storage**: Files only — `<docsRoot>/_meta/charter.yaml` (new, authoritative), legacy `<docsRoot>/_meta/{vocabulary,sections}.yaml` (honored, deprecated). No DB.
**Testing**: Vitest toolkit unit suite (incl. the Astro-side ↔ bare-Node resolved-vocabulary **parity guard**), the bare-Node gates (`validate:docs`, `validate:example`, `validate:catalog`, `validate:links`, `validate:adr-index`), Playwright `test:a11y`, and the **packed-tarball consumption-test CI** (clean-room adopter build). New tests: charter parse/resolve, precedence, extend-only statuses, required-field policy, fail-closed, and a clean-room "zero Spec Kitty reference" assertion.
**Target Platform**: Node build/validate tooling + static Astro/Starlight site output; consumed as an npm-packed toolkit by an external adopter.
**Project Type**: single (toolkit repo with `src/lib`, `src/scripts`, `docs/`).
**Performance Goals**: No regression to build/validate time; charter resolution is O(corpus) file reads already performed. Resolution is deterministic and order-independent (NFR-007).
**Constraints**: Zero Spec Kitty runtime dependency (NFR-001, clean-room-verified); build-free enforcement (NFR-003); pure-core/thin-loader split preserved (NFR-004); OKF conformance preserved (NFR-006); warn-not-fail posture retained (C-001).
**Scale/Scope**: Small, surgical change across ~5 source files + their Astro/bare-Node twins + docs; touches `vocabulary-core.mjs`, `vocabulary-loader.mjs`, `validate-frontmatter.mjs`, `sections.ts`/`schema.ts`, `metadata.ts`, plus new `_meta/charter.yaml` handling and doc artifacts.

## Charter Check

*GATE: charter present at `.kittify/charter/charter.md` (doc-kitty's development charter — governs how THIS repo is built; distinct from the consumer-facing documentation charter this mission ships).*

- **Three separated axes (content / IA / presentation).** ✅ Aligns — this mission unifies the *governance surface* over those axes without collapsing the axes themselves. No conflict.
- **Flexibility outcome / "public, consumer-usable template."** ✅ Directly served; NFR-001 (zero Spec Kitty dependency) protects it.
- **ADR discipline (amend, don't fork; record decisions).** ✅ FR-012 / C-003 add a new/superseding ADR rather than editing Accepted ADR-0004 in place.
- **Curated-not-wiki / doc honesty.** ✅ FR-013 retires the stale promise in `convention.md`.
- **Semantic-compression, deep-module-design paradigms.** ✅ Reuse the existing resolver seams; no parallel governance engine; extend `parseVocabulary` rather than duplicate it.
- **Supply-chain directive 051.** ✅ N/A this mission (no dependency change) — documented, not silently skipped.

No violations → Complexity Tracking left empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/documentation-charter-01M2FEXM/
├── plan.md              # This file
├── research.md          # Phase 0 output — design decisions + rationale
├── data-model.md        # Phase 1 output — charter entities & resolution model
├── quickstart.md        # Phase 1 output — adopter authoring + migration walkthrough
├── contracts/           # Phase 1 output — charter file schema + resolution contract
└── tasks.md             # Phase 2 (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
src/
├── lib/
│   ├── vocabulary-core.mjs      # fs-free pure core — ADD: statuses axis + required-field policy + unified parseCharter
│   ├── vocabulary-loader.mjs    # thin fs loader — ADD: loadCharter(_meta/charter.yaml) + precedence over legacy + deprecation notice
│   ├── sections.ts              # Astro-side twin — mirror charter resolution (parity)
│   ├── schema.ts                # zod enums (DOC_TYPES/KINDS) — status enum becomes charter-aware
│   └── metadata.ts              # reconcile frozen SECTION_ORDER fallback with charter/registry resolution
├── scripts/
│   └── validate-frontmatter.mjs # bare-Node gate — consume resolved statuses + required-field policy; fail-closed on malformed charter
docs/
├── _meta/
│   ├── charter.yaml             # (doc-kitty's own) authoritative charter — dogfood the new surface
│   ├── vocabulary.yaml          # legacy (kept, honored, deprecated)
│   └── sections.yaml            # legacy (kept, honored, deprecated)
├── adr/
│   └── 00NN-native-documentation-charter.md   # NEW ADR — native, not Spec Kitty engine
├── context/
│   └── convention.md            # recast as narrative companion; retire the "will later be recast" hedge
└── guides/
    ├── consumer-setup.md        # extend with a governance chapter (charter reference)
    └── migrating-to-charter.md  # NEW — legacy _meta/*.yaml → charter.yaml migration
example/                          # consumer example — verify build under charter (may add a demonstrating charter.yaml)
```

**Structure Decision**: Single-project toolkit layout, unchanged. All new logic lands in the **existing** resolver triad (`vocabulary-core.mjs` pure → `vocabulary-loader.mjs` fs → `validate-frontmatter.mjs` gate) and its Astro-side parity twin (`sections.ts`/`schema.ts`/`metadata.ts`). No new packages, no new top-level directories.

## Complexity Tracking

*No Charter Check violations — none to justify.*

## Implementation Concern Map

> Concerns, not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Charter schema & pure resolution (fs-free core)

- **Purpose**: Define the `_meta/charter.yaml` shape and extend the pure core to resolve it: add a **statuses axis** (extend-only; canonical `STATUSES` reserved and non-removable) and a **required-field policy** (configurable, with `title` as an enforced floor), and a unified `parseCharter(raw)` that yields resolved `{ resolveType, resolveKind, resolveStatus, sections, requiredFields }` — reusing `makeAxisResolver`/`parseVocabularyAxis`, not duplicating them.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-005, FR-006; C-004, C-005; NFR-004, NFR-007.
- **Affected surfaces**: `src/lib/vocabulary-core.mjs` (pure; JSDoc-const discipline, no fs/Astro imports).
- **Sequencing/depends-on**: none (foundational).
- **Risks**: Must preserve the PURITY CONTRACT (fs-free, Astro-free, no `.d.ts`). Extend-only status validation must reject removal/forbid of a canonical status with a clear message.

### IC-02 — Charter loader, precedence & back-compat (fs)

- **Purpose**: Add `loadCharter(docsRoot)` reading `<docsRoot>/_meta/charter.yaml`; define **deterministic precedence** — when `charter.yaml` declares an axis, it fully owns that axis (no partial merge with the legacy file for the same axis); legacy `_meta/{vocabulary,sections}.yaml` remain honored when the charter is absent or silent on that axis; emit a **deprecation notice** when legacy files are present; **fail closed** (clear message naming file + offending key) on malformed charter.
- **Relevant requirements**: FR-001, FR-004, FR-008, FR-009, FR-010; C-006; NFR-002.
- **Affected surfaces**: `src/lib/vocabulary-loader.mjs` (thin fs; mirrors the existing `loadVocabulary`/`loadSectionRegistry` shape).
- **Sequencing/depends-on**: IC-01.
- **Risks**: N=2 consumption non-regression is the highest-risk item — legacy-only consumers must behave identically. Precedence must never silently partial-merge conflicting axes (edge case in spec).

### IC-03 — Enforcement wiring & SECTION_ORDER reconciliation (gate + Astro twin)

- **Purpose**: Consume the resolved charter in the bare-Node gate (`validate-frontmatter.mjs`: status enum becomes canonical ∪ charter-added; required-field requiredness consults the policy with `title` floor) **and** the Astro-side twin (`sections.ts`/`schema.ts` status enum, `metadata.ts`), and reconcile the frozen `SECTION_ORDER` fallback so ordering has one source of truth while a bare consumer still gets the canonical order. Keep the resolved-vocabulary **parity guard** green across both twins.
- **Relevant requirements**: FR-005, FR-006, FR-007; NFR-003, NFR-004, NFR-005, NFR-006.
- **Affected surfaces**: `src/scripts/validate-frontmatter.mjs`, `src/lib/sections.ts`, `src/lib/schema.ts`, `src/lib/metadata.ts`.
- **Sequencing/depends-on**: IC-01, IC-02.
- **Risks**: Twin drift — every new axis must be added to BOTH the Astro side and the bare-Node side or the parity guard fails. OKF: never emit an empty resolved `type`.

### IC-04 — Effective-charter visibility (derived-but-committed catalog)

- **Purpose**: Surface the resolved/effective charter (the derived-but-committed catalog analogue) so an adopter can verify what governance is actually in force — a small read-only projection, not a new engine.
- **Relevant requirements**: FR-015.
- **Affected surfaces**: a small emitter/CLI-adjacent read path (reuse existing generation hooks; no new heavy tooling).
- **Sequencing/depends-on**: IC-01, IC-02.
- **Risks**: Scope discipline — keep it a projection of resolved state, not a config UI. Candidate to fold into IC-02's WP if trivial.

### IC-05 — Doctrine ADR, convention recast & adopter docs

- **Purpose**: Record the **native-not-Spec-Kitty-engine** decision as a new/superseding ADR; recast `docs/context/convention.md` as the narrative companion (retire the "will later be recast" hedge; mark each governable dimension fixed vs overridable); add a consumer-facing **charter reference** (governance chapter in `consumer-setup.md` or a dedicated page) and a **migration guide**.
- **Relevant requirements**: FR-011, FR-012, FR-013, FR-014; C-003.
- **Affected surfaces**: `docs/adr/00NN-native-documentation-charter.md`, `docs/context/convention.md`, `docs/guides/consumer-setup.md`, `docs/guides/migrating-to-charter.md`. Must keep `validate:adr-index` and `validate:docs` green (ADR sequence, frontmatter).
- **Sequencing/depends-on**: none for the ADR (can start early); doc pages describe IC-01..IC-03 behavior, so finalize after those land.
- **Risks**: ADR numbering/immutability discipline; doc claims must match shipped behavior (no drift).

### IC-06 — Clean-room / consumption-path proof

- **Purpose**: Prove NFR-001 (zero Spec Kitty reference in a packed-tarball clean-room build) and NFR-002 (existing consumer non-regression) — extend the consumption test to author a charter and assert governance + a "no Spec Kitty on PATH / no `spec-kitty` import" check; dogfood by adding doc-kitty's own `_meta/charter.yaml`.
- **Relevant requirements**: NFR-001, NFR-002; SC-003.
- **Affected surfaces**: consumption-test workflow/fixtures, `docs/_meta/charter.yaml` (dogfood).
- **Sequencing/depends-on**: IC-01, IC-02, IC-03.
- **Risks**: CI wiring; ensure the assertion actually fails if a Spec Kitty import were introduced (guard must bite).
