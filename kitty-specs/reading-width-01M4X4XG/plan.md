# Implementation Plan: Wider reading column and room for wide content

**Branch**: `issue-154-reading-width` | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/reading-width-01M4X4XG/spec.md`

## Summary

Raise `--dk-width-content` from 45rem to 52rem in the token sheet and the theme
catalog, and add a layout rule in the component sheet that lets a table written
directly in the page body grow past the reading column, centred on it, up to the
reading pane and a new `--dk-width-wide` cap (80rem), from the 72rem breakpoint
up. Test-first: a new Playwright layout spec is committed red against the
current layout, then the CSS turns it green. The existing geometry ratchet and
the two visual baselines move deliberately; the theming page, a new ADR and the
changelog record the change and the way back to 45rem.

## Technical Context

**Language/Version**: CSS (Chromium, Firefox, Safari current; uses container query units and `:dir()`), TypeScript 5 for `src/lib/theme.ts` and the Playwright spec, Node 22
**Primary Dependencies**: Astro 5.18.2, Starlight 0.32.6 (unchanged; no dependency added or upgraded)
**Storage**: N/A
**Testing**: Playwright 1.62.1 layout spec in `tests/a11y/` (ATDD, red first), the existing `layout-geometry.spec.ts` ratchet, visual baselines regenerated in `mcr.microsoft.com/playwright:v1.62.1-noble`; Vitest `layout-css-contract.test.ts` extended with the token agreement check
**Target Platform**: Static docsite in evergreen browsers
**Project Type**: single (toolkit `src/` + example site `example/`)
**Performance Goals**: No layout shift added by the rule (pure CSS, no script)
**Constraints**: 1px geometry tolerance; no horizontal page scroll at 390-2560px; below 72rem unchanged; collapsed-rail recentre (0,4,1) keeps winning
**Scale/Scope**: 2 token declarations, 1 new token, 2 CSS rules, 1 new spec, 1 ratchet table, 2 baselines, 4 docs files

## Charter Check

| Charter rule | How the plan meets it |
|---|---|
| Three separated axes; geometry survives a brand swap (ADR-0008, ADR-0045) | Token values in `theme.css`; the table rule in `dk-components.css` |
| ADRs immutable; decisions amended by new ADRs | New ADR-0052 records the default and the table rule; ADR-0045 is not edited |
| Living documentation | `docs/architecture/theming.md` updated in the same change |
| WCAG 2.2 AA | Axe lane unchanged; the fixture table wraps, so no new scroll region |
| Docs convention, Terminology Canon | `updated` bumped on touched pages; "Mission" for the work object |
| Path-scoped CI, `ci-ok` | Code and docs both change, so both lanes run |

No conflicts with the dispatch brief. One noted divergence from the issue's
proposal: 52rem instead of about 60rem, from the measurement (Decision Moment
`01M4X56F1GE5HAWSXBGWSNMAB9`); the PR states it.

## Project Structure

### Documentation (this mission)

```
kitty-specs/reading-width-01M4X4XG/
├── spec.md
├── plan.md
├── research.md
├── research/code-grounding.md
├── data-model.md
├── contracts/layout-contract.md
├── quickstart.md
└── tasks/
```

### Source Code (repository root)

```
src/styles/theme.css               # token defaults (content 52rem, wide 80rem)
src/lib/theme.ts                   # DEFAULT_TOKENS width lines only
src/styles/dk-components.css       # wide-table rule (>= 72rem)
src/scripts/assert-chrome-artifacts.mjs  # token list gains --dk-width-wide
src/tests/layout-css-contract.test.ts    # token agreement for both widths
tests/a11y/reading-width.spec.ts   # new ATDD layout spec
tests/a11y/routes.ts               # wide-table route constant
tests/a11y/layout-geometry.spec.ts # EXPANDED_MEASURE ratchet + evidence
tests/a11y/__screenshots__/visual.spec.ts/*.png  # regenerated in CI container
example/docs/architecture/overview.md    # wide-table fixture
docs/architecture/theming.md, docs/adr/0052-*.md, docs/adr/README.md, CHANGELOG.md
```

**Structure Decision**: single project; no new modules.

## Complexity Tracking

None. One new public token is added; it is the opt-out and cap the spec requires
(FR-004).

## Implementation Concern Map

### IC-01 — Acceptance spec and fixture (red first)

- **Purpose**: Encode the spec's layout scenarios as a Playwright spec and give the example a wide table, committed while the layout still fails them.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, NFR-001, NFR-002
- **Affected surfaces**: `tests/a11y/reading-width.spec.ts`, `tests/a11y/routes.ts`, `example/docs/architecture/overview.md`
- **Sequencing/depends-on**: none
- **Risks**: RTL must set `dir` on `<main>` as well as `<html>` (Starlight sets `dir` on `<main>`); the fixture must wrap, not scroll, to keep axe clean.

### IC-02 — Width default and wide-table rule

- **Purpose**: Change the default in both declarations, add `--dk-width-wide`, and add the container and table rules.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, C-001, C-002, C-003, C-004
- **Affected surfaces**: `src/styles/theme.css`, `src/lib/theme.ts`, `src/styles/dk-components.css`, `src/scripts/assert-chrome-artifacts.mjs`, `src/tests/layout-css-contract.test.ts`
- **Sequencing/depends-on**: IC-01
- **Risks**: `container-type` adds layout containment to `.content-panel` (contained positioned descendants: only visually-hidden spans; the glossary popover is on `<body>`). Shared file with the #114 dispatch.

### IC-03 — Deliberate rebaseline

- **Purpose**: Move the geometry ratchet to the new measures with evidence and regenerate the two visual baselines in the pinned container.
- **Relevant requirements**: FR-007, C-005, C-006
- **Affected surfaces**: `tests/a11y/layout-geometry.spec.ts`, `tests/a11y/__screenshots__/visual.spec.ts/*`
- **Sequencing/depends-on**: IC-02
- **Risks**: Baselines can only be produced by the `Update a11y baselines` workflow; a sibling dispatch may move the same images.

### IC-04 — Documentation and release note

- **Purpose**: Document both tokens and the restore line, record the decision, add the changelog entry.
- **Relevant requirements**: FR-008, C-007, SC-004
- **Affected surfaces**: `docs/architecture/theming.md`, `docs/adr/0052-reading-width-and-wide-tables.md`, `docs/adr/README.md` (generated), `CHANGELOG.md`
- **Sequencing/depends-on**: IC-02
- **Risks**: ADR number collision with a sibling dispatch; renumber on rebase if needed.
