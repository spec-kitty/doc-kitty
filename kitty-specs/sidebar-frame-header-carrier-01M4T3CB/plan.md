# Implementation Plan: Sidebar, TOC rail and page-frame remediation with Header carrier

**Branch**: `fix/sidebar-frame-header-carrier` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`

## Summary

The published docsite's frame, left sidebar and collapsible "On this page" rail only align near one desktop width, drafts leak into navigation, sidebar groups show directory names, and themes cannot replace the header. This plan fixes the geometry with a registered frame-width token and a definite rail column, moves the collapse toggle next to the rail in the DOM, shapes the sidebar and table of contents through Starlight's route-data middleware, gates draft publication on one environment setting that defaults to off, and adds a fifth toolkit-owned carrier for the header under a new decision record. A multi-width geometry guard replaces the single-width check that let the defects through.

Planning questions were not put to the owner: this is a semi-auto run and the four owner decisions are fixed in the spec's intent summary. Design choices below are recorded with rationale in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 on Node.js >= 22; Astro components; plain CSS; pure-ESM `.mjs` for gate scripts
**Primary Dependencies**: Astro ^5.2 and @astrojs/starlight ^0.32.6 (unchanged, C-001); no dependency is added, upgraded or removed
**Storage**: none (static site; reader preference in `localStorage` under the existing `dk-toc-collapsed` key)
**Testing**: Vitest unit and build-project tests under `src/tests/`; Playwright e2e and axe under `tests/a11y/`; packed-consumer test under `tests/consumption/`; pinned visual and a11y baselines regenerated in the project container
**Target Platform**: static HTML/CSS/JS for evergreen browsers; built on Linux in GitHub Actions; published to GitHub Pages
**Project Type**: single package (`src/` toolkit) with an `example/` consumer site that is also the published docsite
**Performance Goals**: no layout shift from the toggle mount or the sidebar reveal (NFR-005); no added client JavaScript beyond one small inline script
**Constraints**: alignment within 1 CSS px at 1152/1280/1600/1920/2560 (NFR-001); reading column >= 720px at >= 1600px (NFR-002); header markup byte-identical without a theme header (NFR-007); Starlight 0.32 has no cascade layers, so every override must win on specificity or load order
**Scale/Scope**: about 12 source files changed, 2 added components/modules, 1 ADR, 1 new e2e spec, about 68 built pages re-baselined

**Supply chain**: no dependency decision is made, so DIRECTIVE_051 controls have nothing to evaluate. If implementation finds a dependency is needed, it stops and returns to planning.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Source | Result |
|---|---|---|
| Carrier count is a locked invariant | DIRECTIVE_001, ADR-0013, ADR-0015 | **Deliberate amendment.** FR-027 requires a new accepted ADR that supersedes the four-carrier clause before the map changes. Tracked in Complexity Tracking. |
| Decisions that change architecture get an ADR | DIRECTIVE_003 | Pass: ADR for the Header carrier and for the frame-width token / retired wide-screen constraint. |
| Generated indexes, never hand-maintained | project doctrine | Pass: sidebar labels and order derive from page metadata; no hand-written sidebar. |
| Tests guard behaviour, not baselines alone | DIRECTIVE_030/034 | Pass: geometry is asserted numerically; baselines are secondary. |
| Changelog and docs move with behaviour | Documentation policy | Pass: IC-07. |
| Token namespace | C-002 | Pass: new tokens use the `--dk-*` namespace; measurements come from this repository's builds and tests. |

Post-design re-check: unchanged. The only amendment is the carrier count, and it is covered by FR-027.

## Project Structure

### Documentation (this mission)

```
kitty-specs/sidebar-frame-header-carrier-01M4T3CB/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── public-surface.md
└── tasks.md             # created by /spec-kitty.tasks
```

### Source Code (repository root)

```
src/
├── components/
│   ├── Header.astro                 # NEW fifth carrier
│   └── Head.astro                   # noindex for published drafts
├── lib/
│   ├── config.ts                    # carriers map, route middleware wiring, draft setting
│   ├── draft-publication.mjs        # NEW pure resolver for the setting (shared with gates)
│   ├── route-shaping.ts             # NEW pure sidebar/TOC shaping + middleware entry
│   ├── manifest.ts                  # `dk:site-header` slot
│   ├── theme.ts                     # DEFAULT_BASE gains --dk-width-frame
│   └── toc-rail/toc-rail.client.ts  # toggle mount point, aria-controls
├── styles/
│   ├── theme.css                    # --dk-width-frame
│   ├── dk-components.css            # @property, frame, sidebar/header gutter, rail pin
│   └── toc-rail.css                 # toggle anchoring, logical properties
├── scripts/                         # link and artifact gates learn the draft setting
└── tests/                           # unit + CSS-contract tests
tests/
├── a11y/layout-geometry.spec.ts     # NEW multi-width guard
├── a11y/toc-rail.interaction.spec.ts
└── consumption/                     # token, setting, header slot from the packed tarball
example/
├── .env.development                 # drafts on for local dev
└── docs/                            # index titles and order for nested sections
docs/adr/                            # two new records
.github/workflows/deploy.yml         # explicit drafts-off on the live build
```

**Structure Decision**: single-package layout as it exists today. New logic goes into two pure modules (`draft-publication.mjs`, `route-shaping.ts`) so it is unit-testable without a build; CSS stays in the two sheets that survive a brand swap.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Fifth carrier breaks the four-carrier lock | Owner decision 3: a theme must be able to replace the whole header through the toolkit's slot mechanism | Leaving consumers to Starlight's raw `components` escape hatch bypasses the theme layer and its tests; a sub-slot inside an existing carrier cannot replace a component Starlight renders itself |

## Implementation Concern Map

> Implementation concerns are not work packages. `/spec-kitty.tasks` translates them.

### IC-01 — Frame, sidebar, header and rail geometry

- **Purpose**: Make the frame full-width by default with one public token for a cap, and keep sidebar, header content and rail attached to the frame at every desktop width.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-012, FR-030, NFR-001, NFR-002, NFR-003
- **Affected surfaces**: `src/styles/dk-components.css`, `src/styles/theme.css`, `src/lib/theme.ts`
- **Sequencing/depends-on**: none
- **Risks**: specificity ties against Starlight 0.32 rules (see research R2, R3); every desktop baseline moves.

### IC-02 — Collapse toggle placement and semantics

- **Purpose**: Put the toggle on the rail edge in both states and next to the rail in focus order.
- **Relevant requirements**: FR-007, FR-008, FR-009, FR-010, FR-012, NFR-004, NFR-005, C-003
- **Affected surfaces**: `src/lib/toc-rail/toc-rail.client.ts`, `src/styles/toc-rail.css`, `tests/a11y/toc-rail.interaction.spec.ts`
- **Sequencing/depends-on**: IC-01 (uses the frame gutter and the pinned rail width)
- **Risks**: the collapsed sheet sets `pointer-events: none` and `display: none` on rail descendants; the toggle must sit outside those subtrees.

### IC-03 — Sidebar and table-of-contents shaping

- **Purpose**: Label and order nested sidebar groups from index-page metadata, put each index first, reveal the current entry, and drop the rail when the table of contents is near-empty.
- **Relevant requirements**: FR-011, FR-019, FR-020, FR-021, FR-022, FR-023, NFR-005, NFR-006, C-004
- **Affected surfaces**: `src/lib/route-shaping.ts` (new), `src/lib/config.ts`, `src/lib/sections.ts`, `example/docs/**/index.md`
- **Sequencing/depends-on**: none
- **Risks**: depends on Starlight 0.32 route-data middleware being able to rewrite `sidebar` and `toc`; the first task is a spike that proves it, with the fallback in research R5.

### IC-04 — Draft publication setting

- **Purpose**: One environment setting decides whether drafts are emitted, listed and indexable; default off; all surfaces agree.
- **Relevant requirements**: FR-013, FR-014, FR-015, FR-016, FR-017, FR-018, NFR-006
- **Affected surfaces**: `src/lib/draft-publication.mjs` (new), `src/lib/config.ts`, content loader wiring, `src/components/Head.astro`, `src/scripts/*.mjs` gates, `example/.env.development`, `.github/workflows/deploy.yml`, CI build lanes
- **Sequencing/depends-on**: none; coordinates with IC-03 on sidebar content
- **Risks**: existing gates and route lists assume drafts are built (a11y routes, URL baseline, hub draft-exclusion guard); CI must build with drafts on for those and add a drafts-off assertion lane. A published page linking to a draft becomes a broken link when off.

### IC-05 — Header carrier and decision record

- **Purpose**: Add the wrapper-free Header carrier with a theme slot and record the move from four to five carriers.
- **Relevant requirements**: FR-024, FR-025, FR-026, FR-027, NFR-007
- **Affected surfaces**: `src/components/Header.astro` (new), `src/lib/config.ts`, `src/lib/manifest.ts`, `src/package.json` exports, `src/tests/config-invariants.test.ts`, `docs/adr/`
- **Sequencing/depends-on**: none; IC-01's header gutter rule must target the stock header only
- **Risks**: tests and comments that assert "exactly four"; byte-neutrality must be proven against a pre-change build.

### IC-06 — Multi-width guard and baselines

- **Purpose**: Assert geometry numerically at five widths, add a CSS-contract unit test, and regenerate moved baselines deliberately.
- **Relevant requirements**: FR-028, NFR-001, NFR-002, NFR-003, NFR-004, C-005
- **Affected surfaces**: `tests/a11y/layout-geometry.spec.ts` (new), `playwright.config.ts`, `src/tests/`, pinned baselines
- **Sequencing/depends-on**: written first against the unfixed layout to prove it fails (SC-007), then turned green by IC-01 and IC-02
- **Risks**: baseline regeneration needs the project container; local `node_modules` is unreliable on this machine, so CI is the verifier.

### IC-07 — Documentation, catalog, changelog and packed-consumer coverage

- **Purpose**: Document the token, the setting and the header contract; list the token in the catalog; cover all three from the packed tarball.
- **Relevant requirements**: FR-026, FR-029, FR-030, C-006
- **Affected surfaces**: `docs/`, `example/docs/`, root `CHANGELOG.md`, token catalog data, `tests/consumption/`
- **Sequencing/depends-on**: IC-01, IC-04, IC-05
- **Risks**: none beyond keeping wording consumer-oriented.
