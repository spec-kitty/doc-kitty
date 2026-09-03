# Research: Metadata / Vocabulary / Hub Consolidation

**Mission**: metadata-vocab-hub-consolidation-01M1MFVT
**Phase**: 0 (Outline & Research)
**Date**: 2026-09-04

This mission is a brownfield refactor + two additive enhancements; "research" here is a grounded audit of the current split-brain and the resulting design decisions, not a greenfield technology survey.

## Current-state audit (ground truth)

The section vocabulary + type-derivation knowledge has **no single source of truth**. It is duplicated across a pure-TS toolkit and a bare-Node `.mjs` gate that is an explicit hand-mirrored twin:

| Concept | Canonical-ish TS site | Hand-mirrored `.mjs` twin |
|---|---|---|
| Enum arrays `STATUSES`/`DOC_TYPES`/`KINDS` | `src/lib/schema.ts:34-53` (+ union types `src/lib/metadata.ts:20-40`) | `src/scripts/validate-frontmatter.mjs:45-57` ("kept in sync by hand") |
| Frozen `SECTION_TYPE` fallback map | `src/lib/metadata.ts:188-202` | `src/scripts/validate-frontmatter.mjs:239-253` |
| `expectedDocType` / `expectedType` + adr/plans/operations switch | `src/lib/metadata.ts:235-263` | `src/scripts/validate-frontmatter.mjs:328-349` |
| Vocabulary resolver (`makeAxisResolver`, `parseVocabulary`, `loadVocabulary`, identity) | `src/lib/sections.ts:294-415` | `src/scripts/validate-frontmatter.mjs:359-432` |
| Section-registry readers (`loadSectionRegistry`, `sectionTypes`, `sectionSubtypes`) | `src/lib/sections.ts` | `src/scripts/validate-frontmatter.mjs:263-311` |
| Index-basename detection | `src/lib/metadata.ts:407-525` | `src/scripts/validate-frontmatter.mjs:59-135` |

**Why the twin exists**: `schema.ts` imports `astro/loaders` and `@astrojs/starlight/schema` (`schema.ts:13,15`), so it cannot load in bare Node. `metadata.ts`/`sections.ts` are Astro-free but carry TS-only syntax and `.js`→`.ts` specifier resolution (`tsconfig` `moduleResolution: "Bundler"`), which bare `node file.mjs` cannot execute. So the gate re-implements the pure core.

**Vocabulary DATA already lives on disk**: `docs/_meta/vocabulary.yaml` (aliases/forbidden) and `docs/_meta/sections.yaml` (per-section `type`). The split-brain is in the **code** (enum consts + derivation logic + resolver/loader functions), not the data. Only the hardcoded enum sets and the frozen `SECTION_TYPE` fallback are code-resident vocabulary.

**Parity guards today** (three): `src/tests/vocabulary-resolver.test.ts` (NFR-004 mjs↔ts resolved-output parity), `src/tests/section-type-parity.test.ts` (SECTION_TYPE + expectedType corpus parity), `src/tests/schema-validator-parity.test.ts` (NFR-005 zod shape parity).

## Decision D1 — #49 consolidation mechanism: two-layer pure-ESM shared core

- **Decision**: Extract a **two-layer** shared pure-ESM core, both layers plain `.mjs`:
  1. **fs-free derivation core** — canonical `STATUSES`/`DOC_TYPES`/`KINDS`, the frozen `SECTION_TYPE` fallback, `expectedDocType` + the adr/plans/operations sub-path switch, and the pure vocabulary/axis resolver functions (`makeAxisResolver`, `parseVocabulary`, `parseVocabularyAxis`, `identityVocabulary`) and index-basename detection. Imported by `metadata.ts` and `schema.ts`.
  2. **fs-loader layer** — `loadVocabulary`, `loadSectionRegistry`, `sectionTypes`/`sectionSubtypes` readers of `docs/_meta/*.yaml`. Imported by `sections.ts` and the bare-Node `validate-frontmatter.mjs` gate.
- **Rationale**: `metadata.ts` carries a documented **fs-free** purity contract and "must never import `sections.ts`" (`sections.ts:18-21`, `metadata.ts:222-223`). A single core containing fs reads would break that invariant. The two-layer split single-sources everything while preserving the boundary. The `.ts`→shared-`.mjs` import direction already works under vitest/esbuild and Astro's Vite pipeline (11+ `.ts` files import `.mjs` today), so no build step or codegen is introduced. TS consumers get types from a hand-written `.d.ts` next to each core `.mjs` (no repo-wide `allowJs`, which would loosen checking elsewhere).
- **Alternatives considered**:
  - *Codegen / generate a `.mjs` twin from `.ts`* — **rejected**: reintroduces exactly the generated-staleness class #49 exists to eliminate; still needs a parity/staleness guard.
  - *Single shared core incl. fs reads* — rejected: bends metadata.ts's fs-free boundary (DM `plan.consolidation.core-structure`).
  - *TS loader (tsx/ts-node) in the gate so it imports `.ts` directly* — rejected: violates C-001 "bare Node, no build" and adds a runtime dep to the gate.
- **Done-bar (from spec DM)**: structural single-sourcing — divergence impossible by construction. On success the three parity tests are **rewritten as ordinary unit tests** (they still pin behavior) rather than deleted (C-003).

## Decision D2 — #39 sequencing and blast radius

- **Decision**: Land #39 **after/with** the D1 consolidation so `durable` is added in exactly one place (the shared enum core). Ensure `isPublished` (`metadata.ts:306`) treats `durable` as **published** (never-retire ⇒ visible). Additive only — no existing status changes.
- **Rationale**: Today `durable` would need editing in both `schema.ts:174` (literals) and `validate-frontmatter.mjs:45` (`STATUSES`), plus type union `metadata.ts:20-40` — the very split-brain D1 removes. Adding it post-D1 is a true one-liner and cannot half-apply.
- **Consumers checked** (no breakage expected; verify): `assert-build-artifacts.mjs` and `assert-chrome-artifacts.mjs` reference specific status values (draft/active/superseded) for draft-exclusion and agent-index shapes; they enumerate via imported `STATUSES` (`assert-chrome-artifacts.mjs:26`), so a single-sourced `durable` propagates automatically.
- **Alternatives**: adding `durable` before D1 (rejected — double edit + risk of new drift).

## Decision D3 — #50 ADR status source: reuse the generator's extraction

- **Decision**: The status-aware Hub card derives ADR **number**, **lifecycle status**, and **date** by reusing the extraction logic already in `src/scripts/generate-adr-index.mjs` (single-source it into an importable helper), rather than re-parsing in `Hub.astro`. Order ADR children by ADR number; badge Proposed/Accepted/Superseded/Deprecated + date.
- **Rationale**: The generated own-tree table and the rendered hub must match **1:1** (NFR-004). Sharing one extractor makes that true by construction and honors the project's "generate indexes from metadata/derivation, never hand-maintain" doctrine. `Hub.astro` today reads only frontmatter (`entry.data`) and sorts alphabetically by title (`Hub.astro:90-96`); the body-only `## Status` is reachable via the Astro entry `body`, which the shared extractor parses.
- **Scope boundary**: ADR-specific ordering/badging must be gated to the ADR `kind`/section only — non-ADR Hub listings keep alphabetical-by-title (C-005). Missing number or `## Status` ⇒ graceful unbadged fallback, no hub break.
- **Alternatives considered**: requiring ADR status in frontmatter (rejected — breaks the conventional body `## Status`, churns existing ADRs); re-parsing independently in Hub.astro (rejected — creates a *new* split-brain against the generator, the opposite of this mission's intent).

## Supply-chain note (DIRECTIVE_051)

No dependencies are added, upgraded, or removed. The shared core is first-party pure ESM; #50 reuses existing in-repo parsing. No registry/lifecycle-script/Node-LTS exposure introduced. Advisory posture: **no supply-chain surface in this mission**.

## Adversarial-evidence note

No security-impacting dependency decision was made, so no supply-chain adversarial pass is required. A pre-merge adversarial-squad pass on the refactor's behavior-preservation (D1) is recommended at review time and tracked in the plan's risks, not here.
