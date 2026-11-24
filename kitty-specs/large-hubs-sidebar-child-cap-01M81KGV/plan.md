# Implementation Plan: Large hubs: sidebar child cap

**Branch**: `feat/341-sidebar-child-cap` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)
**Input**: Mission specification from `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`

## Summary

A hub whose published child count is above its resolved cap is shown in the
sidebar as its index link plus one capped entry ("200 pages") that links to the
hub. The cap resolves hub frontmatter → section → site → 50. The count, the order
and the child routes come from `selectHubChildren`, computed at build time by the
route-shaping integration and handed to the middleware through
`virtual:doc-kitty/route-shaping`. `shapeSidebar` replaces a capped group's
entries; the middleware marks the capped entry current on any descendant page and
re-derives prev/next from a tree where the capped group is expanded in hub order.
When no hub is over its cap, no code path changes its input, so output is
byte-identical.

## Technical Context

**Language/Version**: TypeScript 5 and native ESM `.mjs` on Node 22+ (`.nvmrc` 24)
**Primary Dependencies**: Astro 7.4, `@astrojs/starlight` 0.42 (route-data middleware, `sidebar.hidden`), zod (schema), gray-matter (build-time frontmatter read)
**Storage**: N/A (build-time data only, serialised into a virtual module)
**Testing**: Vitest unit tests for the pure functions (`src/tests/`), a Vitest build suite on a generated fixture site under `example/.dk-test-sidebar-cap` (the `*-build.test.ts` pattern), Playwright + axe on the deployed example's capped hub (`tests/a11y/`)
**Target Platform**: Static site build (GitHub Pages), any modern browser
**Project Type**: single (toolkit package `src/` + example site `example/`)
**Performance Goals**: sidebar links per page in a capped group ≤ 2; capped median page HTML ≥ 50% smaller than uncapped on a 1,000-child fixture (NFR-004)
**Constraints**: pure shaping functions (C-002); no new carrier (C-001); byte-identical output when nothing is capped (NFR-002); deterministic module and HTML (NFR-003)
**Scale/Scope**: hubs of up to a few thousand children; ~8 source files touched, 1 new build suite, 1 new guide

## Charter Check

| Charter rule | How the plan meets it |
|---|---|
| Three separated axes | The section setting lives in `sections.yaml` (IA axis); the hub setting in content frontmatter; the label in i18n. No theme change. |
| Living documentation | A guide page, consumer-setup and authoring updates, the plan's measurements, and a changelog fragment ship in the same change. |
| Determinism (NFR-006 of route shaping) | Hub data is sorted by code unit and emitted from a total comparator (`selectHubChildren`). |
| Tests (Vitest + example build + Playwright) | Red-first unit tests, a fixture build suite asserting the built HTML, Playwright/axe on the example. |
| WCAG 2.2 AA | One `aria-current` entry; the capped entry is an ordinary link with a count in its text; axe on the capped hub. |
| ADR discipline | No ADR needed: the design is the accepted research note; ADR-0063 is respected (no new carrier). |

Gate result: pass. Re-checked after Phase 1: pass.

## Project Structure

### Documentation (this mission)

```
kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/
├── plan.md, research.md, data-model.md, quickstart.md
└── contracts/cap-api.md
```

### Source Code (repository root)

```
src/lib/
├── route-shaping.ts            # resolveChildCap, cappedChildHidden, capped group in shapeSidebar,
│                               # capped-entry marker, pagination expansion, label resolution
├── route-middleware.ts         # passes hub data, current page slug, label
├── route-shaping-module.d.ts   # module type: hubCaps, cappedLabel
├── integrations/route-shaping.ts  # reads caps + children, builds hub data via selectHubChildren
├── config.ts                   # sidebar.childCap / sidebar.cappedLabel split + validation
├── sections.ts                 # section `sidebar.childCap`
├── schema.ts                   # `sidebar_child_cap` frontmatter
└── i18n-plugin.ts              # dockitty.sidebar.cappedEntry
src/scripts/validate-frontmatter.mjs  # `sidebar_child_cap`
src/tests/
├── sidebar-child-cap.test.ts         # pure unit tests
├── sidebar-child-cap-build.test.ts   # 200-child fixture build suite
└── fixtures/large-hub/measure.mjs    # 1,000-child measurement
tests/a11y/sidebar-child-cap.spec.ts  # Playwright + axe on example
example/docs/guides/capped-hub/       # small capped hub (cap 3, 5 children)
docs/guides/sidebar-child-cap.md      # configuration page
docs/_meta/sections.yaml              # adr: sidebar.childCap 100
docs/changelog/unreleased/341-sidebar-child-cap.md
```

**Structure Decision**: single project; all logic in the existing route-shaping seam.

## Implementation Concern Map

### IC-01 — Cap settings and resolution

- **Purpose**: read and validate the three settings and the label, and resolve a hub's cap.
- **Relevant requirements**: FR-001, FR-002, FR-006, FR-009
- **Affected surfaces**: `config.ts`, `sections.ts`, `schema.ts`, `validate-frontmatter.mjs`, `route-shaping.ts` (`resolveChildCap`, `resolveCappedLabel`), `i18n-plugin.ts`
- **Sequencing/depends-on**: none
- **Risks**: the charter-aware section path (`charter.yaml` `sections.entries`) shares `normalizeSectionEntries`, so both paths get the key.

### IC-02 — Build-time hub data and the hidden hint

- **Purpose**: compute, per hub over its cap, the cap, count and ordered children, and ship them in the virtual module; export the producer hint.
- **Relevant requirements**: FR-004, FR-008, FR-009, C-003
- **Affected surfaces**: `integrations/route-shaping.ts`, `route-shaping-module.d.ts`, `hub-children.mjs` (reused, unchanged), `route-shaping.ts` (`cappedChildHidden`, `HubCap` type)
- **Sequencing/depends-on**: IC-01
- **Risks**: withheld drafts must not count; uncapped hubs are not emitted, so an uncapped site's module only gains an empty list.

### IC-03 — Shaping, current marking and pagination

- **Purpose**: replace a capped group's entries, mark the capped entry current on descendants, and re-derive prev/next in hub order.
- **Relevant requirements**: FR-003, FR-005, FR-007, NFR-001, NFR-002
- **Affected surfaces**: `route-shaping.ts` (`shapeSidebar`, `markCappedCurrent`, `expandCappedGroups`, `shapePagination`, `relabelledLinks`, `decorateSidebarIcons`), `route-middleware.ts`
- **Sequencing/depends-on**: IC-01, IC-02
- **Risks**: the capped entry shares the hub's href with the index link, so pagination, relabelling and icons skip it by a non-HTML marker (`dkCappedHub`). A pre-hidden current page is absent from Starlight's tree, so `shapePagination` must re-derive when only the expanded tree holds it.

### IC-04 — Proof: fixture build, example hub, browser checks, measurement

- **Purpose**: assert the spec on built HTML and in a browser, and measure cost.
- **Relevant requirements**: NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, SC-001..SC-004
- **Affected surfaces**: `src/tests/sidebar-child-cap-build.test.ts`, `src/tests/fixtures/large-hub/measure.mjs`, `example/docs/guides/capped-hub/`, `tests/a11y/sidebar-child-cap.spec.ts`
- **Sequencing/depends-on**: IC-03
- **Risks**: example tests that count guides pages or snapshot the guides sidebar may need the new hub accounted for.

### IC-05 — Documentation and dogfood

- **Purpose**: document the feature, record measurements, keep this repo's ADR sidebar.
- **Relevant requirements**: FR-010, FR-011, NFR-004
- **Affected surfaces**: `docs/guides/sidebar-child-cap.md`, `docs/guides/consumer-setup.md`, `docs/guides/authoring.md`, `docs/plans/features/large-hubs.md`, `docs/_meta/sections.yaml`, changelog fragment
- **Sequencing/depends-on**: IC-01 (settings exist), IC-04 (numbers)
- **Risks**: Vale and markdownlint on new prose.
