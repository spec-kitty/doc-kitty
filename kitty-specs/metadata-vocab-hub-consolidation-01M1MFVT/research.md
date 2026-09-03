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
- **Rationale**: `metadata.ts` carries a documented **fs-free** purity contract and "must never import `sections.ts`" (`sections.ts:18-21`, `metadata.ts:222-223`). A single core containing fs reads would break that invariant. The two-layer split single-sources everything while preserving the boundary. The `.ts`→shared-`.mjs` import direction already works under vitest/esbuild and Astro's Vite pipeline (11+ `.ts` files import `.mjs` today), so no build step or codegen is introduced.
- **Typing mechanism (corrected post-squad — see D4/F6)**: `allowJs` is **already global** (astro `base.json` sets `"allowJs": true`; `src/tsconfig.json`/`example/tsconfig.json` extend `astro/tsconfigs/strict`). So a hand-written `.d.ts` sidecar for a `./x.mjs` specifier is **ignored** by TS (it resolves `.d.mts`/`.mts`), and a plain `export const STATUSES = [...]` infers `string[]` — which breaks `z.enum(STATUSES)` under `astro check` (the CI `pnpm typecheck` gate, NFR-003). **Mechanism:** author the cores as `.mjs` with JSDoc `@type {const}` on the enum arrays (yielding readonly literal tuples), **no `.d.ts` sidecars**; and derive the `metadata.ts` `DocStatus`/`DocType` unions as `typeof STATUSES[number]` / `typeof DOC_TYPES[number]` so they stop being a hand-maintained third copy. DoD for the typing is a green `astro check`, not a sidecar file. (Alternative if JSDoc-const proves insufficient: rename cores to `.mts` with `.d.mts` sidecars — implementer picks whichever compiles.)
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

## Decision D4 — post-tasks adversarial-squad findings (convergent, verified)

A bounded 3-lens post-tasks squad (reviewer-renata anti-laziness, architect-alphonso seams/invariants, debugger-debbie test-efficacy) ran over the WPs before implementation. All findings below survived independent convergence and/or in-repo verification; dispositions are `accepted` (folded into the WPs/artifacts). No contested finding was dropped (adversarial-evidence contract).

| ID | Finding | Lenses | Disposition |
|----|---------|--------|-------------|
| F1 | `schema-validator-parity.test.ts` is NOT twin-redundant after WP02 — `docKittyFields` (schema.ts) and the gate's `frontmatterSchema` remain independent field-shape encodings; PRESENCE_LENIENT (build-lenient vs gate-strict) is an intentional two-arm divergence that cannot be a single-impl test | renata+debbie | accepted — WP03 keeps it two-arm; only the enum-derived rows single-sourced; add a `durable`-accepts row |
| F2 | `section-type-parity.test.ts` corpus + era cases + DOC_TYPES-coupling + index-basename/collision/registry-subtypes blocks are literal-less cross-impl comparisons → tautological if naively single-implemented | renata+debbie | accepted — WP03 adds a per-row literal oracle and enumerates every block to retain |
| F3 | Both `section-type-parity` and `vocabulary-resolver` NFR-004 go tautological the moment WP02 rewires both sides onto one core → they cannot catch extraction drift | renata+debbie | accepted — WP01 captures a golden snapshot of the pre-refactor twin (expectedType corpus, SECTION_TYPE, resolver over ALIAS/FORBID YAML) and asserts the core reproduces it |
| F4 | `vocabulary-resolver.test.ts` gate-wiring (US2-1/US2-3, FR-004/FR-005): the load-bearing assertions are that `validate()` applies the resolver to *derived* values — not the pure resolver — and WP03 named only the resolver | debbie | accepted — WP03 preserves the validate()-applies-override-to-derived assertions |
| F5 | WP04 fidelity risks tautology (compare extractor to itself) and single-source of `extractAdrMeta` is enforced only by reviewer prose | renata+debbie | accepted — test renders Hub's real output vs the extractor; add a grep gate: Hub imports `extractAdrMeta` and contains no independent status/number regex (satisfies NFR-001 for #50) |
| F6 | WP04 1:1 fidelity is falsifiable — the generator includes every numbered non-Template ADR regardless of `doc_status`, while Hub filters `isPublished` and would append number-less pages; the ordering key (number) is derived from filename in the generator but from slug in Hub → a NEW split-brain on the field NFR-004 orders by | debbie+renata+alphonso | accepted — `extractAdrMeta` is the SOLE number source for both callers; Hub's ADR inclusion matches `discoverAdrs` (exclude number-less + `type:Template`); NFR-004 scoped to the published+numbered set; edge rows added |
| F7 | `.d.ts`-sidecar / "no allowJs" typing rationale is false (allowJs is global); `z.enum(STATUSES)` needs a literal tuple | alphonso (verified) | accepted — see corrected typing mechanism in D1; DoD = green `astro check` |
| F8 | `metadata.ts` `DocStatus`/`DocType` unions remain a hand-mirrored twin; WP02 "add durable to the union" is a second edit site | alphonso | accepted — derive unions via `typeof STATUSES[number]` |
| F9 | NFR-001 "0 duplicate definitions" is only a one-time manual grep; nothing reds if a twin reappears | renata | accepted — WP01 commits a single-source + purity gate test (reds on a 2nd `SECTION_TYPE`/`expectedType`/resolver/enum def outside the core, or a `node:fs`/astro import in the fs-free core) |
| F10 | `durable`-published has no committed test and no owning WP (`metadata.test.ts` unowned) | debbie | accepted — WP02 gains `metadata.test.ts`; add a positive `isPublished(durable)===true` + published-loop row |
| F11 | `isPublished` already returns true for `durable` (`!== 'draft'` denylist) | all three | accepted — WP02 reframes as verify-not-edit (no needless branch) |
| F12 | `durable` auto-enlarges `DOC_STATUS_LABELS` (assert-chrome:173) — could shift an asserted artifact; gate export `expectedType` must alias core `expectedDocType` for interim green | alphonso | accepted — WP02 exercises assert-chrome + keeps an `expectedType` alias |
| F13 | WP01→WP02 lane gap: WP01 must be **merged** (not just approved) before WP02 branches, or its new `.mjs` are absent from WP02's worktree | alphonso (+memory) | accepted — operational, enforced during implement |

Confirmed sound by the squad (no change): the two-layer fs-free/loader boundary (metadata.ts stays fs-free), the bare-Node runtime import chain (C-001 holds at runtime), folding #39 across WP01+WP02 (a discrete WP would violate ownership non-overlap), and the generator output-stability constraint.

## Adversarial-evidence note

No security-impacting dependency decision was made, so no supply-chain adversarial pass is required. The post-tasks squad above is the recorded adversarial pass over the WPs; a pre-merge review squad over the delivered diff is planned before PR.
