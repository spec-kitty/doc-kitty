# Implementation Plan: Component system + swappable theme

**Branch**: `feat/component-system-and-theme` | **Date**: 2026-08-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/component-system-and-theme-01M0QHDH/spec.md`

## Summary

Grow the M1 single-layer chrome substrate (ADR-0013) into the complete ADR-0011
theme layer: `defineDocKittyIntegrations({ theme })` merges default → brand →
consumer; a merged virtual manifest carries `slots` + `layouts` to the four carriers
(layouts resolved at the single `MarkdownContent` import site, slots per-carrier —
ADR-0015); the Spec Kitty brand theme ships self-contained and derived; the `Persona`
per-kind layout shell proves manifest-driven override beyond `Hub`; and a Playwright
accessibility lane joins `ci-ok`. Every M1 gate stays green; any deviation is a new
ADR (ADR-0015 already records the slot-resolution seam).

## Technical Context

**Language/Version**: TypeScript 5.x (strict) + Astro 5.18.2 component/integration API; ESM; `.astro` components.
**Primary Dependencies**: `@astrojs/starlight@0.32.6` (pinned, ADR-0014), `astro@5.18.2`, `@astrojs/sitemap`, `zod`, `gray-matter`. **New dev-only**: `@playwright/test` + `@axe-core/playwright` (accessibility lane; not shipped runtime deps — NFR-005).
**Storage**: N/A — static site generation over the repo-root `docs/` tree; no datastore.
**Testing**: `vitest` (toolkit unit tests incl. the merge-resolver no-theme byte-compat test); `astro check` (typecheck gate); the zero-runtime-dep node assertion scripts `assert-build-artifacts.mjs` + `assert-chrome-artifacts.mjs` (stub-and-fail discipline); **new** Playwright + axe-core a11y lane (both modes, enumerated pages); mutation testing on the changed scope (merge resolver + touched assertions) per USE_MUTATION_TESTING.
**Target Platform**: static site deployed to GitHub Pages; Node build (Active-LTS aware, DIRECTIVE_051).
**Project Type**: single pnpm workspace — toolkit (`@commondocs-kitty/toolkit`, `src/`) + `example/` site.
**Performance Goals**: `ci-ok` stays green and path-efficient (ADR-0007 path-scoped lanes); no Starlight/Astro version regression; the new a11y lane reuses the example build artifact rather than rebuilding.
**Constraints**: the three ADR-0013 seams (single layout import site + synchronous `resolveLayout` signature; CSS-after-tokens cascade; `components` map = four carriers); Starlight pin 0.32.6; Astro 5.18.2; pnpm `sharp`/`@img/*` hoist; WCAG 2.2 AA both modes; brand derived-not-imported (no `@spec-kitty/*`); Pagefind searchable-region preserved; zero-runtime-dep assertions.
**Scale/Scope**: 9 implementation concerns (IC-01…IC-09); the toolkit theme layer + one brand theme + one new per-kind layout + the a11y harness + updated gates.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present (`.kittify/charter/charter.md`). Relevant directives and how the plan satisfies each:

- **DIRECTIVE_001 (Architectural Integrity) / DIRECTIVE_024 (Locality of Change)** — the theme layer is added as bounded modules (`src/lib/theme.ts`, `src/lib/manifest.ts`), and the M1 render sites are extended at the three named seams only. ✅
- **DIRECTIVE_010 (Spec Fidelity) / DIRECTIVE_003 (Decision Documentation)** — the one design tension found post-spec is recorded as ADR-0015; no silent deviation. ✅
- **DIRECTIVE_030 / DIRECTIVE_034 (Test-First + Typecheck gate) / DIRECTIVE_041 (Tests as scaffold)** — every FR lands with a non-fakeable assertion or unit test written to fail first; stub-and-fail proof for any touched/added assertion. ✅
- **DIRECTIVE_037 (Living Documentation)** — theming docs + ADR cross-refs updated in the same change; changelog at landing. ✅
- **DIRECTIVE_042 (Common Docs standard) / DIRECTIVE_047 (Audience-Oriented Writing)** — ADR-0015 and the changelog carry the metadata contract and pass doc-sanity (validator + links + markdownlint + Vale hedge rule). ✅
- **DIRECTIVE_051 (Supply-Chain Install Safety)** — the two new dev deps (`@playwright/test`, `@axe-core/playwright`) are evaluated against the five threat classes in `research.md` (registry authenticity, freshness, lifecycle-script discipline, Node LTS, incident posture). ✅
- **USE_C4_MODEL_TECHNIQUES** — the plan's layering + resolution diagrams are the Container/Component views; no deeper level earns its keep. ✅
- **USE_MUTATION_TESTING_TO_VALIDATE_TEST_QUALITY** — mutation run on the changed scope (merge resolver + assertion modules) to prove the new gates kill mutants. ✅

No charter violations requiring Complexity Tracking.

## Project Structure

### Documentation (this mission)

```
kitty-specs/component-system-and-theme-01M0QHDH/
├── plan.md              # This file
├── research.md          # Phase 0 — transport-mechanism decision + supply-chain + adversarial evidence
├── data-model.md        # Phase 1 — DocKittyTheme, Layer, Manifest, TokenCatalog entities
├── quickstart.md        # Phase 1 — how a consumer selects/overrides a theme
├── contracts/
│   ├── theme-contract.md    # The DocKittyTheme interface + merge semantics
│   └── manifest-contract.md # The merged manifest shape + resolution rules
└── tasks.md             # /spec-kitty.tasks output (NOT created here)
```

### Source Code (repository root)

```
src/                                  # @commondocs-kitty/toolkit
├── lib/
│   ├── config.ts                     # defineDocKittyIntegrations — gains { theme } (IC-01)
│   ├── theme.ts                      # NEW — DocKittyTheme type, mergeTheme, token emission (IC-01/02)
│   ├── manifest.ts                   # NEW — merged virtual manifest + Astro integration/vite hook (IC-03)
│   └── schema.ts                     # unchanged (Persona already in KINDS)
├── layouts/
│   ├── kind-layouts.ts               # resolveLayout backed by the manifest, same signature (IC-03)
│   ├── Default.astro                 # unchanged
│   ├── Hub.astro                     # unchanged
│   └── Persona.astro                 # NEW — passport shell, .dk-passport marker (IC-05)
├── components/                       # the four carriers — per-carrier slot reads (IC-03)
│   ├── Head.astro / PageTitle.astro / MarkdownContent.astro / Footer.astro
│   └── slots/                        # existing own-chrome slots
├── themes/
│   └── spec-kitty/                   # NEW — brand theme (IC-04)
│       ├── index.ts                  # DocKittyTheme definition (tokens, assets, slots, layouts)
│       ├── tokens.css                # brand --dk-* overrides, both modes
│       ├── components/               # brand atoms/molecules/organisms
│       └── assets/                   # logo, favicon, fonts, diagram token values (own copies)
├── styles/
│   └── theme.css                     # base --dk-* catalog + --dk-*→--sl-* bridge (unchanged base)
├── scripts/
│   ├── assert-build-artifacts.mjs    # updated: components-map invariant (IC-08)
│   └── assert-chrome-artifacts.mjs   # updated: Persona marker, cascade order, mode-varying (IC-08)
└── tests/                            # vitest — merge resolver no-theme byte-compat (IC-08)

example/                              # the live site
├── astro.config.mjs                  # wire the Spec Kitty brand theme (IC-06)
├── content.config.ts                 # unchanged schema
└── docs/**                           # + one Persona fixture page (IC-06)

tests/a11y/                           # NEW — Playwright + axe-core lane (IC-07)
playwright.config.ts                  # NEW
.github/workflows/                    # a11y lane added to ci-ok (IC-07)
```

**Structure Decision**: single pnpm workspace, extending the M1 toolkit in place. The
theme layer is two new `src/lib` modules (`theme.ts`, `manifest.ts`) plus a `src/themes/`
tree for the brand; the M1 carriers and `src/styles/theme.css` base sheet are extended,
not rewritten. The a11y harness is a top-level `tests/a11y/` + `playwright.config.ts`,
wired as its own CI lane.

## Complexity Tracking

No Charter Check violations. Section intentionally empty.

## Implementation Concern Map

> Implementation concerns are NOT work packages. `/spec-kitty.tasks` translates these
> into executable WPs — one concern may split into several WPs, or small concerns may
> merge. Concerns are not sequenced with WP-style IDs.

### IC-01 — Theme resolution and layer merge

- **Purpose**: Add the `{ theme }` parameter and resolve default → brand → consumer (per-key last-wins; `customCss` concatenates; `tokens` shallow-merge), backward-compatible with the M1 `(options)` call.
- **Relevant requirements**: FR-001, FR-002, FR-015; NFR-002.
- **Affected surfaces**: `src/lib/config.ts`, new `src/lib/theme.ts` (`DocKittyTheme`, `mergeTheme`).
- **Sequencing/depends-on**: none.
- **Risks**: the no-theme path must stay byte-identical (single static `theme.css`, generation bypassed) — pinned by a unit test.

### IC-02 — Token emission and cascade order

- **Purpose**: Emit the merged `--dk-*` map as a generated stylesheet carrying the `--dk-*→--sl-*` bridge, positioned tokens-before-overrides, with brand/consumer `customCss` appended after; brand/consumer sheets carry zero direct `--sl-*` assignments.
- **Relevant requirements**: FR-003, FR-004.
- **Affected surfaces**: `src/lib/theme.ts` (emit), `src/styles/theme.css` (base bridge preserved), the emitted sheet + `customCss` array order in `config.ts`.
- **Sequencing/depends-on**: IC-01.
- **Risks**: cascade order regression; the `--dk-*`-only invariant.

### IC-03 — Merged virtual manifest transport

- **Purpose**: Replace the static `kind-layouts` module with the merged manifest — layouts resolved at the single `MarkdownContent` import site via a **synchronous** `resolveLayout(kind): LayoutComponent` (carrier body byte-unchanged); slots resolved per-carrier; `components` map stays the four carriers.
- **Relevant requirements**: FR-005, FR-006, FR-007, FR-008, FR-018; C-001, C-006.
- **Affected surfaces**: new `src/lib/manifest.ts` (virtual module + Astro integration hook), `src/layouts/kind-layouts.ts` (manifest-backed, same signature), the four carriers (per-carrier slot reads).
- **Sequencing/depends-on**: IC-01.
- **Risks**: Astro-5.18.2 synchronous resolution (codegen or eager `import.meta.glob`, never a runtime dynamic import of a string path) — de-risked by the Phase-0 build spike; carrier byte-stability; the components-map invariant.

### IC-04 — Spec Kitty brand theme (self-contained, derived)

- **Purpose**: Ship the brand theme — own `--dk-*` values (colour, type, radius, focus, caps tracking) both modes, atomic components, logo/favicon/fonts, diagram token values, native `logo`/`title` header — no `@spec-kitty/*` dependency.
- **Relevant requirements**: FR-009, FR-010, FR-011, FR-012; NFR-001; C-005.
- **Affected surfaces**: `src/themes/spec-kitty/**`; asset copies.
- **Sequencing/depends-on**: IC-01, IC-02, IC-03.
- **Risks**: derived-not-imported discipline; mode-varying token completeness; AA contrast in both modes (esp. the derived light column).

### IC-05 — Persona per-kind layout shell

- **Purpose**: Author the `Persona` passport shell (identity strip, name `<h1>`, `<dl>` of existing generic frontmatter, avatar from `hero_image.alt`, layout-unique `.dk-passport` marker), resolved through the manifest, in-frame, introducing no new frontmatter fields.
- **Relevant requirements**: FR-013; NFR-004; C-007, C-010.
- **Affected surfaces**: `src/layouts/Persona.astro`; brand registers it via `layouts` in the manifest.
- **Sequencing/depends-on**: IC-03, IC-04.
- **Risks**: M3 drift (generic fields only, no persona-attribute schema); keep content in the searchable region.

### IC-06 — Example rebrand and Persona fixture

- **Purpose**: Wire the example to the brand theme (deployed live) and add one `Persona` fixture page at a fixed route, without copying toolkit files, keeping the example content stable so content-derived M1 assertions still hold.
- **Relevant requirements**: FR-014; SC-001.
- **Affected surfaces**: `example/astro.config.mjs`, `example/docs/**` (one new fixture).
- **Sequencing/depends-on**: IC-04, IC-05.
- **Risks**: changing example content would shift the pinned agent-index count (12) / share-image demonstrators — the fixture must be accounted for in the pinned counts if it publishes.

### IC-07 — Playwright accessibility lane

- **Purpose**: Stand up the axe-core (both modes, enumerated pages) + bounded visual-regression harness as a new `ci-ok` member lane that consumes the example build artifact and does not break the existing three lanes.
- **Relevant requirements**: FR-016; NFR-001, NFR-003, NFR-005.
- **Affected surfaces**: `playwright.config.ts`, `tests/a11y/**`, `.github/workflows/**` (lane + `ci-ok` aggregation), `package.json` scripts.
- **Sequencing/depends-on**: IC-06.
- **Risks**: `ci-ok` required-check wiring; dev-only dep discipline + supply-chain review; both-modes drive mechanism; not folding into `code-quality`.

### IC-08 — Assertion updates and no-theme unit test

- **Purpose**: Extend the non-fakeable gates for the themed surface — Persona `.dk-passport` marker + persona-unique Pagefind text, `components`-map-is-four-carriers, cascade order (brand/consumer after tokens), mode-varying token completeness — and add the no-theme merge-resolver byte-compat unit test; keep every M1 gate green with stub-and-fail proof.
- **Relevant requirements**: FR-017; NFR-002, NFR-004; C-004; SC-003, SC-004.
- **Affected surfaces**: `src/scripts/assert-chrome-artifacts.mjs`, `src/scripts/assert-build-artifacts.mjs`, `src/tests/**`.
- **Sequencing/depends-on**: IC-05, IC-06 (needs rendered artifacts).
- **Risks**: assertions strengthened, never weakened; each new/touched assertion proven to fail on a stub.

### IC-09 — Living documentation

- **Purpose**: Keep the theming docs and ADR cross-references consistent with the shipped behaviour (ADR-0015 authored; theming.md/ADR-0013 cross-links; the mission changelog at landing).
- **Relevant requirements**: C-009; DIRECTIVE_037.
- **Affected surfaces**: `docs/adr/**`, `docs/architecture/theming*.md`, `docs/changelog/**`.
- **Sequencing/depends-on**: none (proceeds alongside).
- **Risks**: doc-sanity (validator + links + markdownlint + Vale hedge rule).
