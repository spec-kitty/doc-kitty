# Tasks: Metadata / Vocabulary / Hub Consolidation

**Mission**: metadata-vocab-hub-consolidation-01M1MFVT
**Branch**: `feat/metadata-vocab-hub-consolidation`
**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Data model**: [data-model.md](./data-model.md)

## Overview

Four work packages, two lanes. Lane A is the #49 consolidation spine (sequential); Lane B is the independent #50 Hub card. #39 (`durable`) is folded into Lane A (the enum lands in the single source in WP01; `isPublished`/union wiring in WP02) because the enum's file is owned by the consolidation WPs — a separate WP would overlap ownership.

```
Lane A:  WP01 ──▶ WP02 ──▶ WP03      (#49 + #39)
Lane B:  WP04                        (#50, parallel)
```

MVP = **WP01** (the shared core; everything else builds on or beside it).

## Subtask Index

| ID | Description | WP | Parallel |
| --- | --- | --- | --- |
| T001 | Create fs-free `vocabulary-core.mjs` (enums incl. `durable`, SECTION_TYPE, expectedDocType, pure resolver, index-basename) | WP01 |  |
| T002 | Hand-write `vocabulary-core.d.ts` | WP01 |  |
| T003 | Create `vocabulary-loader.mjs` (loadVocabulary, loadSectionRegistry, sectionTypes/subtypes) | WP01 |  |
| T004 | Hand-write `vocabulary-loader.d.ts` | WP01 |  |
| T005 | Unit tests `vocabulary-core.test.ts` pinning core behavior | WP01 |  |
| T006 | Prove fs-free purity + bare-Node importability | WP01 |  |
| T007 | Rewire `schema.ts` onto core (drop enum literals) | WP02 |  |
| T008 | Rewire `metadata.ts` onto fs-free core; add `durable` to union; `isPublished` counts durable published | WP02 |  |
| T009 | Rewire `sections.ts` (re-export core+loader; preserve semantics) | WP02 |  |
| T010 | Rewire `validate-frontmatter.mjs` onto core+loader; delete the ~700-line twin | WP02 |  |
| T011 | Prove gate runs under bare `node`; all gates + build green | WP02 |  |
| T012 | Verify `durable` end-to-end (validates + published) | WP02 |  |
| T013 | Rewrite `vocabulary-resolver.test.ts` (NFR-004 parity → single-impl unit) | WP03 |  |
| T014 | Rewrite `section-type-parity.test.ts` → single-core unit | WP03 |  |
| T015 | Rewrite `schema-validator-parity.test.ts` (NFR-005 → single-impl unit) | WP03 |  |
| T016 | Confirm no coverage lost; full vitest green | WP03 |  |
| T017 | Export `extractAdrMeta` from `generate-adr-index.mjs` (single-source extraction) | WP04 | [P] |
| T018 | `Hub.astro`: derive ADR meta from `entry.body`; order ADR children by number | WP04 | [P] |
| T019 | Render status badge + date; graceful fallback | WP04 | [P] |
| T020 | Gate ADR ordering/badging to ADR-kind only; non-ADR + single-ADR unchanged | WP04 | [P] |
| T021 | `hub.css` badge styles (--dk-* tokens, dual-theme legible) | WP04 | [P] |
| T022 | `hub-adr-card.test.ts` (ordering, 1:1 fidelity, fallback, no-regress) | WP04 | [P] |

Record completion with `spec-kitty agent tasks mark-status T0xx --status done` (single or batch). Rows above are references, not checkboxes.

## Work Packages

### WP01 — Extract the two-layer pure-ESM vocabulary core (#49 IC-01, #39 enum)

- **Goal**: Establish the single source of truth — a fs-free derivation/enum core + a thin fs-loader layer, both plain `.mjs` with `.d.ts` sidecars. Add `durable` to the enum here (single-site).
- **Priority**: P1 (foundation / MVP).
- **Independent test**: `node --check` both `.mjs`; a bare-Node script imports both with no Astro; `vocabulary-core.test.ts` green (enum incl. `durable`, expectedDocType corpus, resolver identity/alias/forbidden).
- **Subtasks**: T001–T006.
- **Dependencies**: none.
- **Prompt**: `tasks/WP01-extract-vocabulary-core.md` (~180 lines).

### WP02 — Rewire toolkit + gate onto the core; delete the twin (#49 IC-02, #39 wiring)

- **Goal**: `schema.ts`, `metadata.ts`, `sections.ts`, and `validate-frontmatter.mjs` import the shared core; remove the ~700-line hand-mirrored twin; wire `durable` into the metadata union + `isPublished`.
- **Priority**: P1.
- **Independent test**: gate runs under bare `node`; example-tree frontmatter validation, build, and all `assert-*.mjs` gates green; a `durable` doc validates and is published.
- **Subtasks**: T007–T012.
- **Dependencies**: WP01.
- **Prompt**: `tasks/WP02-rewire-and-delete-twin.md` (~190 lines).

### WP03 — Collapse parity tests to single-impl unit tests (#49 IC-03)

- **Goal**: The three parity guards lose their second implementation; rewrite them to pin the one core's behavior (keep the assertions, drop the twin comparison).
- **Priority**: P2.
- **Independent test**: full vitest green; each rewritten test still exercises the resolved-output/path-corpus/shape assertions against the single core.
- **Subtasks**: T013–T016.
- **Dependencies**: WP02.
- **Prompt**: `tasks/WP03-parity-tests-to-unit.md` (~130 lines).

### WP04 — ADR-number-ordered, status-aware Hub card (#50 IC-05)

- **Goal**: `Hub.astro` orders ADR-kind children by number and badges full lifecycle status + date, reusing the ADR-index generator's extractor for 1:1 fidelity with the generated own-tree table.
- **Priority**: P3.
- **Independent test**: a hub over ≥2 ADRs lists them number-ordered with correct status badge + date matching the generated table; missing number/status falls back gracefully; non-ADR listings and the single-ADR demo unchanged.
- **Subtasks**: T017–T022.
- **Dependencies**: none (parallel with Lane A).
- **Prompt**: `tasks/WP04-adr-hub-card.md` (~180 lines).
