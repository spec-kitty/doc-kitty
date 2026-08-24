# Implementation Plan: Audience, Related & External References

**Branch**: `feat/audience-related-external-references` | **Date**: 2026-08-24 | **Spec**: [spec.md](./spec.md) (rev 2)
**Input**: Feature specification from `kitty-specs/audience-related-external-references-01M0S3F4/spec.md`

## Summary

M3 wires the M1-frozen `audience` / `related` / `external_references` frontmatter
into consistent, accessible on-page blocks; relocates personas to
`context/audience/` with attribute fields plus an Audiences hub; and adds a
`bibliography`/`tools` citation catalog resolved at build with a
`/api/bibliography.json` agent projection. The work is primarily **wiring +
resolution** over M1/M2 foundations, plus one genuinely new build (the catalog).
Resolution is centralized as pure functions in `src/lib/metadata.ts`; the
build-free doc-sanity gates parity-duplicate it (the M1 standalone pattern);
`.astro` block bodies stay thin. Four decisions the spec handed to plan are settled
here as ADRs **0017–0020**. Everything lands in the Layered order the spec names,
keeping `ci-ok` (four lanes) green at every boundary (C-007).

## Technical Context

**Language/Version**: TypeScript 5.x on Node ≥22 (Astro 5 + Starlight); `.astro`
components; build-free gates as Node ESM `.mjs` (zero-import, parity-tested).
**Primary Dependencies**: Astro 5, Starlight, zod, gray-matter (already shipped);
Astro content-layer `file()` loader for the two catalog collections; Playwright +
`@axe-core/playwright` for the a11y lane. **No new runtime/build dependency**
(NFR-006) — CSL-JSON-lite is a hand-rolled subset, no citation-processing library.
**Storage**: build-time static; catalog data as YAML under `docs/_meta/`
(mirrored `example/docs/_meta/`); no runtime datastore.
**Testing**: vitest (pure resolvers + schema/validator parity), build-artifact
assertions (`assert-chrome-artifacts.mjs`, `assert-build-artifacts.mjs`), Playwright
axe (`tests/a11y/`), and the build-free doc-sanity gates (`validate-frontmatter.mjs`,
`check-links.mjs`, a new catalog validator).
**Target Platform**: static site (GitHub Pages) + agent-consumable JSON endpoints.
**Project Type**: single (pnpm workspace — the `src/` toolkit package + the
`example/` consumer site).
**Performance Goals**: build-time only; no runtime perf budget beyond keeping the
build and the four CI lanes green.
**Constraints**: `ci-ok` (code-quality, doc-sanity, build-example, a11y) green at
**every** work-package boundary (C-007); AA by construction (C-003); `--dk-*` is the
only theme surface (C-007-from-M1); frozen field shapes not re-litigated (C-004);
carriers read `Astro.locals.starlightRoute` (C-008).
**Scale/Scope**: ~9 implementation concerns; the example tree (~14 files) grows by
the Audiences hub + a block demonstrator and loses the persona as its draft subject
(a draft page is retained) — the pinned counts move accordingly (FR-023).

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/charter/charter.md`); governance loaded (compact).
Relevant directives and how this plan satisfies them:

- **DIRECTIVE_001 (component boundaries)** — resolution is isolated in pure
  `metadata.ts` functions; `.astro` bodies and API routes compose them; the theme
  boundary (`--dk-*` only) is untouched. **Pass.**
- **DIRECTIVE_003 (decision documentation)** — the four settled decisions become
  ADR-0017–0020. **Pass.**
- **DIRECTIVE_010 (spec fidelity)** — the IC map traces every IC to spec FRs. **Pass.**
- **DIRECTIVE_018 (versioning)** — the agent-API `version` is bumped because
  `AgentRecord.related` changes shape (IC-08). **Pass.**
- **DIRECTIVE_024 / 025 (locality / boy-scout)** — the persona relocation lands
  atomically across its four hard-coded sites; the `ReferenceItem` accessible-name
  fix is folded in the touched area. **Pass.**
- **DIRECTIVE_031 (ubiquitous language)** — the spec's Domain Language section fixes
  the citation/reference/catalog-record vocabulary; the catalog ADR carries the
  glossary home for "CSL-JSON-lite" and the catalog-`type` overload. **Pass.**
- **DIRECTIVE_035 (bulk edit)** — **N/A.** The persona relocation is a localized move
  (one page + its asset + four assertion sites + one doc), not a cross-file identifier
  rename; `change_mode` stays default. No `occurrence_map.yaml`.
- **DIRECTIVE_051 (supply-chain install safety)** — **no dependency is added**
  (NFR-006), so there is no install-safety surface; recorded in `research.md`. **Pass.**

No violations → Complexity Tracking is empty.

## Project Structure

### Documentation (this mission)

```
kitty-specs/audience-related-external-references-01M0S3F4/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions, supply-chain, adversarial evidence
├── data-model.md        # Phase 1 output — entities, record shapes, resolution outcomes
├── quickstart.md        # Phase 1 output — authoring audience / related / citations / a persona
├── contracts/           # Phase 1 output — catalog + agent-record + bibliography-endpoint contracts
├── reviews/post-spec-squad.md   # post-spec adversarial squad (rev 2 inputs)
└── tasks.md             # /spec-kitty.tasks output (NOT created here)
```

### Source Code (repository root)

```
src/                                   # the doc-kitty toolkit package
├── lib/
│   ├── metadata.ts                    # + pure resolvers: resolveRelated / resolveProfile / resolveCitation; type sync
│   ├── schema.ts                      # + catalog collection schemas (exported); lenient persona fields
│   ├── catalog.ts                     # NEW — catalog load/resolve model (Astro-free)
│   └── routes/                        # + /api/bibliography.json; resolved-related composed here
├── components/
│   └── MarkdownContent.astro          # carrier-body render of the three data blocks (ADR-0017)
│   └── slots/                         # NEW default block bodies: Audience.astro / Related.astro / ExternalReferences.astro
├── layouts/
│   └── Persona.astro                  # + renders persona attribute fields
├── scripts/
│   ├── validate-frontmatter.mjs       # + persona-field requiredness (path/kind-aware)
│   ├── check-links.mjs                # (unchanged behaviour; related integrity retained)
│   ├── validate-catalog.mjs           # NEW build-free catalog validator (parity)
│   ├── assert-chrome-artifacts.mjs    # + three-block assertions; relocated persona path
│   └── assert-build-artifacts.mjs     # + enriched record shape; recomputed count pins
├── themes/spec-kitty/
│   ├── components/molecules/ReferenceItem.astro   # accessible name = title (not key)
│   └── tokens.css / brand-components.css          # + --dk-color-tint-lilac AA pair
└── tests/                             # + resolver + parity + fixtures

docs/
├── adr/                               # + 0017 (rendering seam) 0018 (catalog) 0019 (persona fields) 0020 (persona location)
├── architecture/metadata-model.md     # + catalog section; persona location of record
├── architecture/theming.md            # + the three wired blocks + persona attributes
└── _meta/bibliography.yaml, tools.yaml # NEW catalog data

example/docs/
├── context/audience/                  # relocated persona(s) + README.md (Audiences hub)
├── _meta/bibliography.yaml, tools.yaml # NEW mirrored catalog data
└── <demonstrator>.md                  # published page rendering the three blocks (a11y lane); + a retained draft page

tests/a11y/routes.ts                   # relocated persona route; demonstrator added to AXE_PAGES
```

**Structure Decision**: Single pnpm workspace (toolkit `src/` + consumer
`example/`), unchanged from M1/M2. New code clusters in `src/lib/` (resolution +
catalog model, framework-agnostic and unit-tested), thin `.astro` block bodies under
`src/components/slots/`, and the two build-free gate additions in `src/scripts/`.

## Implementation Concern Map

> Concerns are NOT work packages. `/spec-kitty.tasks` translates these into WPs —
> the atomic groups (IC-02, IC-03) may each become one WP; IC-05/06/07 may fan out
> or merge. The Layered-landing note in the spec is the sequencing authority.

### IC-01 — Resolution core
- **Purpose**: The single Astro-free home for ref/profile/citation resolution that
  the build, the API routes, and (by parity duplication) the build-free gates share.
- **Relevant requirements**: FR-016, FR-018.
- **Affected surfaces**: `src/lib/metadata.ts` (`resolveRelated`, `resolveProfile`,
  `resolveCitation`; `DocKittyFrontmatter` type sync for `audience`/`external_references`/`moscow`);
  `src/tests/` (vitest: hit/miss/warn, note-over-description precedence).
- **Sequencing/depends-on**: none (foundation).
- **Risks**: resolution must not silently swallow a missing `related` ref (FR-004);
  keep functions pure so the gates can parity-duplicate rather than import (ADR-0017/architecture note).

### IC-02 — Citation catalog + agent endpoint
- **Purpose**: The new build — two data collections, their build-free validator, and
  the dereferenceable `/api/bibliography.json`.
- **Relevant requirements**: FR-007, FR-008, FR-015; ADR-0018.
- **Affected surfaces**: `src/lib/catalog.ts`, `src/lib/schema.ts` (exported catalog
  schema + loader), `src/scripts/validate-catalog.mjs`, `src/lib/routes/`,
  `docs/_meta/*.yaml` + `example/docs/_meta/*.yaml`, `content.config.ts` wiring.
- **Sequencing/depends-on**: IC-01.
- **Risks**: fail-fast couples consumers to two collection wirings — the toolkit
  must export schema+loader (one-step wiring); the first `{type,id}` demonstrator
  citation co-lands with its catalog record or the build reds (C-007).

### IC-03 — Persona-atomic (relocation + fields + hub + count pins)
- **Purpose**: Give audiences a home and identity, reconciled to the design of
  record — the single most hazard-dense boundary.
- **Relevant requirements**: FR-010, FR-011, FR-012, FR-013, FR-023, FR-022 (retained draft); ADR-0019, ADR-0020.
- **Affected surfaces**: move `example/docs/personas/example-persona.md` →
  `example/docs/context/audience/`; `type: Guide`→`Context`; `doc_status`→`active`;
  add `context/audience/README.md` (Audiences hub); `src/lib/schema.ts` (lenient
  persona fields) + `src/scripts/validate-frontmatter.mjs` (requiredness) + parity
  fixtures; `src/layouts/Persona.astro` (passport render); **all four hard-coded
  sites** — `assert-chrome-artifacts.mjs:188,190`, `tests/a11y/routes.ts:13,22`;
  `assert-build-artifacts.mjs:54,57` count pins; `metadata-model.md`.
- **Sequencing/depends-on**: none strictly, but lands as ONE atomic WP (a half-move
  reds a11y/chrome; a new published page without its pin reds build-example).
- **Risks**: the count delta (persona promotion +1, hub +1, demonstrator +1, retained
  draft −1) must be recomputed and cross-checked against `example/docs/` in the same WP.

### IC-04 — Content-block rendering seam
- **Purpose**: The carrier-body wiring the three blocks plug into, without
  double-rendering against the existing no-props theme passthrough.
- **Relevant requirements**: C-002, FR-021 (rendering-seam ADR); ADR-0017.
- **Affected surfaces**: `src/components/MarkdownContent.astro`;
  `src/components/slots/{Audience,Related,ExternalReferences}.astro` scaffolds.
- **Sequencing/depends-on**: IC-01.
- **Risks**: ADR-0017 decides the three slots become doc-kitty-owned carrier-body
  renders styled by theme **tokens** (the no-props component-override passthrough for
  exactly these three slots is retired and documented) — an implementer must not
  reinstate a props-carrying slot override (ADR-0015-incompatible).

### IC-05 — Audience block
- **Purpose**: The "Who is this for" block with soft persona resolution.
- **Relevant requirements**: FR-001, FR-002.
- **Affected surfaces**: `src/components/slots/Audience.astro`; the warn channel
  (printed build-log line) in the resolver path.
- **Sequencing/depends-on**: IC-01, IC-03 (persona pages to link), IC-04.
- **Risks**: soft-warn (not fail) on a missing persona — a defined, observable channel.

### IC-06 — Related block
- **Purpose**: Resolved related cards + the stale-target status marker.
- **Relevant requirements**: FR-003, FR-004, FR-005.
- **Affected surfaces**: `src/components/slots/Related.astro`;
  `src/themes/spec-kitty/components/molecules/RelatedCard.astro` (real props).
- **Sequencing/depends-on**: IC-01, IC-04.
- **Risks**: build-fail on a dangling ref must survive the render path (FR-004);
  declared-direction only (no backlinks).

### IC-07 — External-references block
- **Purpose**: Inline references + catalog citations via `ReferenceItem`.
- **Relevant requirements**: FR-006, FR-009.
- **Affected surfaces**: `src/components/slots/ExternalReferences.astro`;
  `ReferenceItem.astro` (accessible name = title; citation key secondary).
- **Sequencing/depends-on**: IC-01, IC-02 (catalog), IC-04.
- **Risks**: the accessible-name-is-title fix must be asserted (FR-019), not assumed.

### IC-08 — Agent surface (resolved related + audience)
- **Purpose**: Enrich the per-page agent record without breaking the pure model.
- **Relevant requirements**: FR-014.
- **Affected surfaces**: `src/lib/routes/` (compose `resolveRelated(refs, index)`);
  `toAgentRecord` stays pure/single-entry; agent-API `version` bump.
- **Sequencing/depends-on**: IC-01, IC-02.
- **Risks**: `AgentRecord.related` shape change is a published-contract change →
  version bump (DIRECTIVE_018) and a new (non-string) assertion.

### IC-09 — Hardening, assertions, demonstrator & docs
- **Purpose**: The green-boundary proof — assertions, the a11y demonstrator, the AA
  token, fixtures, and the docs of record.
- **Relevant requirements**: FR-017, FR-019, FR-020, FR-022 (demonstrator), FR-021 (docs); NFR-001, NFR-003, NFR-004, NFR-005.
- **Affected surfaces**: `assert-chrome-artifacts.mjs` (three blocks, title-name,
  own-fragment Pagefind, relocated path, `/api/bibliography.json`);
  `assert-build-artifacts.mjs` (enriched record shape); the published demonstrator
  page + `AXE_PAGES`; `--dk-color-tint-lilac` in `REQUIRED_DK_TOKENS`; fixtures split
  by owning lane; `metadata-model.md` + `theming.md`.
- **Sequencing/depends-on**: IC-04..IC-08 (hardens what they build).
- **Risks**: assertions must bind to the citing page's OWN Pagefind fragment and to
  a demonstrator the axe lane actually scans (post-spec findings R1/R6/R2).
