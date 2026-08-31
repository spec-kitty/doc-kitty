# Implementation Plan: QOL Adoption-Enabler Cluster

**Branch**: `feat/qol-adoption-enablers` | **Date**: 2026-08-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/qol-adoption-enablers-01M1BTPE/spec.md` (rev2, post-squad)

## Summary

Land four brownfield adoption enablers (#38 optional/derived `type`/`kind`; #40 overridable vocabulary + targeted own-corpus correction; #41 era-tolerant ADR-typing guard; #44 doc-honesty) on the shared `_meta/` registry + `validate-frontmatter.mjs` + `metadata.ts` surface. The technical spine is a **hand-mirrored mjs/ts pair**: the bare-Node gate (`src/scripts/validate-frontmatter.mjs`) and the Astro-side schema (`src/lib/schema.ts` + `src/lib/metadata.ts` + `src/lib/sections.ts`) must resolve identical results, pinned by parity tests. Two decisions from the post-spec squad shape the approach: the own-tree ADR index is a **generated artifact** (script + lockfile-style sync-check) because doc-kitty's own `docs/` tree is never Astro-rendered (only `example/` is built), and the `Feature` correction is a **targeted per-page** fix (keep `Feature` valid). Convergent squad evidence: `decisions/post-spec-squad.md`.

## Technical Context

**Language/Version**: Node.js ≥22 (Active LTS; `engines.node ">=22"`), TypeScript 5.x (toolkit `src/`), JavaScript ESM `.mjs` (bare-Node gates). Astro 5 + Starlight (example site only).
**Primary Dependencies**: Astro, `@astrojs/starlight`, `zod`, `gray-matter` (already used by the gate to parse frontmatter *and* `_meta/*.yaml` top-level mappings — the vocabulary resolver reuses it), Vitest. **No new runtime/build dependency is planned** (see Supply-Chain note).
**Storage**: N/A — static Markdown + `_meta/*.yaml` governance data on disk.
**Testing**: Vitest (`pnpm --filter @commondocs-kitty/toolkit test`); the standalone gate `node src/scripts/validate-frontmatter.mjs docs` (`validate:docs`); build assertions `src/scripts/assert-build-artifacts.mjs`; Playwright a11y. Parity is enforced by `src/tests/section-type-parity.test.ts`, `schema-validator-parity.test.ts`, `type-registry-authority.test.ts`, `metadata-sections.test.ts`.
**Target Platform**: Node CLI gates (bare Node, no build context) + static Astro site (`example/`).
**Project Type**: single monorepo (pnpm workspace: `@commondocs-kitty/toolkit` in `src/` + `example/`).
**Performance Goals**: N/A (dev-time gates); the ADR-index generator runs over ~30 ADRs in well under a second.
**Constraints**: the gate + override must run in bare Node with **no** `astro build` (NFR-003); mjs and ts must agree on the **resolved** vocabulary/derivation (NFR-004); no test deleted/weakened to pass (NFR-001); `Feature` stays a valid default type (FR-006).
**Scale/Scope**: 30 ADRs, 19 `docs/plans/features/` pages, 13 sections; reference adopter corpus ~790 docs (backward-compat target).

### Supply-Chain note (DIRECTIVE_051, advisory)

This mission adds **no** dependency. `_meta/vocabulary.yaml` is parsed with the already-present `gray-matter` (the same mechanism the gate uses for `sections.yaml`). If a future refinement genuinely needs a YAML parser, it must clear the five threat-class controls (registry authenticity, freshness, deny-by-default lifecycle scripts, Node Active-LTS awareness, incident/IoC posture) before addition. No lifecycle scripts are introduced. Node target is Active LTS (≥22).

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Compact charter loaded (`software-dev-default`). Relevant directives and their disposition:

- **DIRECTIVE_042 Common Docs Standard** — PASS/ADVANCES. #44 makes the toolkit obey its own convention (honest AGENTS.md/README, generated ADR index). #40/#38 keep frontmatter governed; `Feature` remains governed, now overridable.
- **DIRECTIVE_035 Bulk-Edit Occurrence Classification** — DEVIATION (owner-authorized, C-002). FR-006 is a bounded single-class per-page correction (frontmatter values in `docs/plans/features/`); the bulk-edit flow misbehaves in split-goal missions. Compensating check: "zero residual path-mismatch warnings". Justified in Complexity Tracking.
- **DIRECTIVE_037 Living Documentation Sync** — PASS. FR-009/FR-010/FR-012 update AGENTS.md, READMEs, and `convention.md` in lockstep with the behavior change; ADR amendments (C-005) travel in the same WPs.
- **DIRECTIVE_041 Tests-as-Scaffold** — PASS. Acceptance criteria are pinned to structured returns / rendered output (FR-003, FR-013), both-polarity fixtures (FR-008), and retargeted (not deleted) assertions (NFR-001).
- **DIRECTIVE_043/044 Close-by-Construction / Canonical Sources** — PARTIAL. The ADR-index generator closes the drift class by construction (FR-007). The mjs↔ts split-brain is *not* consolidated here (would balloon scope); it is filed as a follow-up (C-006) and its risk is contained by the resolved-vocab parity tests (NFR-004).
- **DIRECTIVE_001 Architectural Integrity** — PASS. The vocabulary resolver is one seam (`sections.ts` + mirrored mjs twin); the ADR generator is a separate script; no cross-boundary coupling to the deferred loader/symlink work (C-001, squad-confirmed).

No unjustified violations. Proceed.

## Project Structure

### Documentation (this mission)

```
kitty-specs/qol-adoption-enablers-01M1BTPE/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (entities: vocabulary override, ADR-index record)
├── quickstart.md        # Phase 1 output (how to verify each enabler)
├── contracts/           # Phase 1 output (vocabulary.yaml schema; ADR-index generator contract)
├── decisions/
│   └── post-spec-squad.md   # convergent squad evidence (already committed)
└── tasks.md             # Phase 2 (/spec-kitty.tasks — NOT created here)
```

### Source Code (repository root)

```
src/
├── scripts/
│   ├── validate-frontmatter.mjs      # bare-Node gate — relax type/kind; read+apply vocabulary.yaml (mjs twin)
│   ├── generate-adr-index.mjs        # NEW — regenerate docs/adr/README.md table from ADR files
│   ├── assert-adr-index.mjs          # NEW (or a flag on the generator) — lockfile-style sync-check
│   ├── scaffold.mjs / new-doc.mjs    # keep the hardcoded plans/features→Feature subtype in lockstep (unchanged term)
│   └── assert-build-artifacts.mjs    # extend: assert a new ADR fixture appears in built /adr/ HTML (FR-013)
├── lib/
│   ├── schema.ts                     # zod already optional; wire vocabulary override into type/kind resolution
│   ├── metadata.ts                   # expectedDocType (ts derivation twin) — override applied to derived value
│   └── sections.ts                   # NEW loadVocabulary(docsRoot) beside loadSectionRegistry (canonical resolver)
├── layouts/Hub.astro                 # unchanged (example ADR hub auto-lists; ordering follow-up filed)
└── tests/                            # retarget missing-kind fixture; resolved-vocab parity; depth-guard; ref-integrity; generator

docs/                                 # doc-kitty's OWN tree (validated, NOT Astro-rendered)
├── adr/README.md                     # becomes a GENERATED artifact (generator output; sync-checked)
├── adr/000N-*.md                     # amended ADR-0004/0009; NEW vocabulary-override ADR (next number)
├── plans/features/*.md               # targeted per-page corrections (FR-006)
├── context/convention.md            # living-docs sync (FR-012)
└── AGENTS.md, README.md (repo root), src/README.md   # doc-honesty prose (FR-009/010)

example/docs/adr/README.md            # DELETE redundant table → Hub auto-lists (FR-013)
_meta/vocabulary.yaml                 # NEW governance data (default vocab); consumer override resolves over it
```

**Structure Decision**: single monorepo, no new packages. Two new bare-Node scripts (`generate-adr-index.mjs` + sync-check), one new resolver function (`loadVocabulary` in `sections.ts`) with a hand-mirrored twin in the gate, one new `_meta/vocabulary.yaml`, plus test and doc updates. No change to the Astro build topology (C-001).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| DIRECTIVE_035 bulk-edit flow waived for FR-006 (C-002) | The 19 corrections are one occurrence class (frontmatter values under `docs/plans/features/`); the bulk-edit occurrence-classification flow misbehaves in split-goal missions (owner-confirmed) | Running the bulk-edit gate would block the split-goal mission; the compensating "zero residual path-mismatch warnings" check + single isolated commit gives the same safety for a single-class change |
| New generator script instead of deleting the ADR table (C-004) | doc-kitty's own `docs/adr/` is never Astro-rendered, so "delete table → Hub generates" leaves no index and does not close the drift class for the tree where it recurs | A pure hand-table + append-0030 (no generator) leaves the recurrence path open; a full second Astro build of `docs/` is Mission-B-scale build-topology change |

## Implementation Concern Map

> Concerns, not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Frontmatter contract relaxation + registry-derived type (#38, #41 guard)

- **Purpose**: Make `type` optional (derived from the section registry, filling only the absent case) and `kind` optional in the bare-Node gate, honoring authored-wins + advisory-warn; pin era-tolerant ADR typing on both derivation twins.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-011; NFR-001, NFR-003; amends ADR-0004/0009 (C-005).
- **Affected surfaces**: `src/scripts/validate-frontmatter.mjs` (`:100`, `:277-287`), `src/lib/metadata.ts` (`:223-243`), `src/lib/schema.ts` (already optional — confirm), `src/tests/schema-validator-parity.test.ts` (retarget `missing-kind`), `section-type-parity.test.ts` + `metadata-sections.test.ts` (depth-guard), `docs/adr/0004-*.md`, `docs/adr/0009-*.md`.
- **Sequencing/depends-on**: none (spine head). Its ADR amendments gate IC-05 prose.
- **Risks**: authored-vs-derived precedence must stay advisory-warn via structured `warnings[]`; non-total derivation (root/orphan) must be deterministic; retarget the `missing-kind` fixture (do not delete).

### IC-02 — Vocabulary override seam (#40 mechanism)

- **Purpose**: Introduce `_meta/vocabulary.yaml` (default→consumer) and a resolver that aliases/neutralizes/forbids `type`/`kind` terms, applied to **authored and derived** values, mirrored across the mjs gate and ts schema; parity asserts agreement on the **resolved** vocabulary.
- **Relevant requirements**: FR-004, FR-005; NFR-003, NFR-004; new vocabulary-override ADR (C-005).
- **Affected surfaces**: `src/lib/sections.ts` (new `loadVocabulary`), `src/scripts/validate-frontmatter.mjs` (twin resolver + apply at authored path and derivation switch), `src/lib/schema.ts` / `src/lib/metadata.ts` (apply to derived), new `_meta/vocabulary.yaml`, new/extended parity test comparing resolved vocab, new `docs/adr/00NN-vocabulary-override.md`.
- **Sequencing/depends-on**: IC-01 (same hot file + the derivation it relaxes; vocab resolves against the possibly-derived type).
- **Risks**: split-brain — the override transform must be applied identically on both twins and at both authored+derived points; malformed YAML must fail clearly, absent file → defaults (`Feature` valid).

### IC-03 — Targeted own-corpus correction (#40 dogfood)

- **Purpose**: Correct only genuinely-misplaced `docs/plans/features/` pages so authored == derived (zero residual path-mismatch warnings); keep `Feature` valid and leave correctly-typed pages untouched.
- **Relevant requirements**: FR-006; SC-005; C-002 (plain per-page edits, one isolated commit).
- **Affected surfaces**: a reviewed subset of the 19 `docs/plans/features/*.md` pages (per-page judgement); no derivation-subtype change (Feature stays).
- **Sequencing/depends-on**: IC-02 (so the override behavior + effective-type semantics are settled) — lands last on the spine, isolated commit.
- **Risks**: must not mistype content; a single genuinely-misplaced page may need relocation (single-file, low-risk) rather than a re-type; the full folder rename is out of scope (C-006).

### IC-04 — ADR index generation + integrity (#44 generated surface)

- **Purpose**: Generate the own-tree `docs/adr/README.md` table from ADR frontmatter + body `## Status` (number-ordered, ID/Title/Status/Date) with a lockfile-style sync-check; add a referential-integrity guard (dangling ADR refs, both polarities); delete `example/docs/adr/`'s redundant table so the Hub auto-lists (verified against built HTML).
- **Relevant requirements**: FR-007, FR-013, FR-008, FR-012; SC-003a/b, SC-004; C-004.
- **Affected surfaces**: new `src/scripts/generate-adr-index.mjs` + sync-check, `src/scripts/assert-build-artifacts.mjs` (extend for FR-013), `docs/adr/README.md` (regenerated), `example/docs/adr/README.md` (table removed), `docs/context/convention.md` (FR-012), CI wiring (`package.json` scripts), new tests (generator + ref-integrity).
- **Sequencing/depends-on**: none (independent files — parallel track). Do NOT re-introduce a bijection/hand-maintenance gate (C-004).
- **Risks**: generator must be deterministic (stable ordering, idempotent) so the sync-check has no false diffs; Status parsed from body `## Status` must be robust; recursive ADR walk so era ADRs appear (FR-011 consistency).

### IC-05 — Doc-honesty prose (#44 narrative)

- **Purpose**: Bring AGENTS.md, root `README.md`, `src/README.md`, and `convention.md` into truth: `doc_status` not `status`, full section list, the **amended** optional-frontmatter contract, no "early scaffold" claim, UNLICENSED stated honestly.
- **Relevant requirements**: FR-009, FR-010 (FR-012 shared with IC-04); SC-005.
- **Affected surfaces**: `AGENTS.md`, `README.md`, `src/README.md`, `docs/context/convention.md`.
- **Sequencing/depends-on**: IC-01 + IC-02 (must describe the *amended* contract — gated after the ADR amendments settle).
- **Risks**: must describe the post-mission contract, not the pre-mission "required" posture (the planner-flagged freshly-stale-on-landing trap); no overclaim (license).
