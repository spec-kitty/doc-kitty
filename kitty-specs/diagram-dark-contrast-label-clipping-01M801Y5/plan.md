# Implementation Plan: Readable build-time diagrams in both themes

**Branch**: `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/diagram-dark-contrast-label-clipping-01M801Y5/spec.md`

## Summary

Two build-time defects and one ratchet, all in the ADR-0040 build render path:

1. **Label font (#370).** The render page and the reader's page resolve a
   Mermaid label's font differently when an author `%%{init}%%` replaces the
   theme font: the baked SVG then carries no label `font-family`, the render page
   measures in its default font, and the site shows the label in its own sans
   font. Fix: pin one Arial-metric stack on Mermaid labels on both sides — a
   stylesheet handed to the render page through `@beoe/rehype-mermaid`'s `css`
   option, and the same rule in toolkit CSS for the figure and its lightbox copy.
2. **Labels on author fills (#369 item 2).** A new rehype pass runs after the
   sentinel rewrite. For each Mermaid node or cluster, and each PlantUML entity,
   whose shape fill is a literal colour (not a `var(--dk-diagram-*)`) and whose
   label colour is themed, it pins the label colour to black or white, whichever
   contrasts more with that fill. An author label colour is left alone.
3. **Edges (#369 item 1).** No reproduction; a browser check ratchets themed
   edge contrast at 3:1 in both themes.

## Technical Context

**Language/Version**: TypeScript 5 on Node 22 (ESM), CSS
**Primary Dependencies**: Astro 5 + Starlight, `@beoe/rehype-mermaid` 0.4.2 (`mermaid-isomorphic` 3.1.0), `astro-plantuml`, Playwright 1.62 — all existing; no new dependency
**Storage**: N/A (build-time transform; the beoe disk cache salt changes so old renders are invalidated)
**Testing**: Vitest unit tests in `src/tests/` (pure hast/raw-string transforms, colour choice); one new Playwright spec in `tests/a11y/` over a new example fixture page, measured from screenshot pixels in both colour projects at 1280 px and 390 px
**Target Platform**: static site build (Linux CI with the pinned PlantUML server service), any evergreen browser
**Project Type**: single (toolkit `src/` + worked example `example/`)
**Performance Goals**: zero added client JavaScript (NFR-004); the build pass is a linear walk of each figure
**Constraints**: core only (C-001); none of PR #405's files (C-002); no new package or font file (C-003); PlantUML self-hosted only (C-004); the six-token theme contract unchanged (C-005)
**Scale/Scope**: about 6 source files, 1 fixture page, 2 test files

## Charter Check

- Three axes stay separate: the fix lives in the presentation layer's render path
  and its CSS; content and information architecture are untouched. ✅
- Living documentation: the diagram behaviour change updates the build-render
  guide in the same change and adds a changelog fragment. ✅
- Accessibility WCAG 2.2 AA: this mission adds direct contrast and fit checks. ✅
- Path-scoped CI and the single `ci-ok` check: no workflow edits; the new spec is
  picked up by the existing a11y lane through `testDir`. ✅
- ADRs: the change implements ADR-0040's contract (themed diagrams) and needs no
  new decision record; the font ownership assumption is reported for a ruling. ✅

No violations.

## Project Structure

### Documentation (this mission)

```
kitty-specs/diagram-dark-contrast-label-clipping-01M801Y5/
├── plan.md
├── research.md
├── quickstart.md
├── spec.md
└── tasks/
```

### Source Code (repository root)

```
src/lib/integrations/diagrams.ts        # render css option + cache salt; register the new pass
src/lib/rehype/diagram-label-contrast.ts # NEW: author-fill label colour pass (Mermaid hast + PlantUML raw)
src/styles/dk-components.css            # display-side label font rule (figure + lightbox)
src/tests/diagram-label-contrast.test.ts # NEW: unit tests
src/tests/diagram-preset.test.ts        # existing: registered build config assertions
tests/a11y/diagram-legibility.spec.ts   # NEW: pixel contrast + overflow, both themes, 1280/390
tests/a11y/helpers/legibility.ts        # NEW: measurement helper
tests/a11y/routes.ts                    # add the fixture route
example/docs/architecture/diagram-contrast-fixture.md  # NEW fixture page
docs/changelog/unreleased/369-diagram-label-legibility.md
```

**Structure Decision**: single project; the pass sits beside `diagram-figure.ts`
in `src/lib/rehype/`, the existing home of diagram rehype passes.

## Complexity Tracking

None.

## Implementation Concern Map

### IC-01 — Fixture and browser check

- **Purpose**: reproduce every defect on one example page and assert the fix in both themes, red first.
- **Relevant requirements**: FR-005, FR-006, NFR-001, NFR-002, NFR-003
- **Affected surfaces**: `example/docs/architecture/diagram-contrast-fixture.md`, `tests/a11y/diagram-legibility.spec.ts`, `tests/a11y/helpers/legibility.ts`, `tests/a11y/routes.ts`
- **Sequencing/depends-on**: none
- **Risks**: DOM-walk backdrop detection missed the defect in a probe; the check measures pixels with the label or edge hidden instead. In client render mode the spec must skip, as the defects are build-only.

### IC-02 — Label font pinning

- **Purpose**: render and display Mermaid labels in the same font so they fit their box.
- **Relevant requirements**: FR-004
- **Affected surfaces**: `src/lib/integrations/diagrams.ts`, `src/styles/dk-components.css`, `src/tests/diagram-preset.test.ts`
- **Sequencing/depends-on**: IC-01 (red check first)
- **Risks**: a reader device with no Arial-metric font falls back to a wider sans; documented residual risk.

### IC-03 — Label colour on author fills

- **Purpose**: keep a label readable on a fill the author fixed, in both themes and both engines.
- **Relevant requirements**: FR-001, FR-002, FR-003
- **Affected surfaces**: `src/lib/rehype/diagram-label-contrast.ts`, `src/lib/integrations/diagrams.ts`, `src/tests/diagram-label-contrast.test.ts`
- **Sequencing/depends-on**: IC-01
- **Risks**: PlantUML reaches rehype as a raw HTML string; the pass edits it per `<g class="entity">` block and must leave every other byte alone.

### IC-04 — Docs and changelog

- **Purpose**: say what changed for adopters.
- **Relevant requirements**: FR-007
- **Affected surfaces**: `docs/changelog/unreleased/`, the diagram guide under `docs/guides/`
- **Sequencing/depends-on**: IC-02, IC-03
- **Risks**: none
