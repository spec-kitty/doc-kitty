# Tasks: Deck & Layout Polish

**Mission**: deck-layout-polish-01M1R1EB · **Branch**: `feat/deck-layout-polish`
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)

Decomposed by **file ownership** (the deck fixes share `dk-reveal-theme.css` and
`showcase-deck.md`, so they cannot be one-WP-per-issue without ownership overlap).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Deck sheet: `@media (prefers-color-scheme: dark)` dark `--dk-*` palette | WP01 | |
| T002 | Parity-guard test (deck dark == theme.css dark) + no-raw-hex source scan | WP01 | [P] |
| T003 | Stage-relative slide-content/image cap (replace `65vh`) | WP01 | |
| T004 | Up/down affordance button CSS (+ hidden state, focus, print) | WP01 | |
| T005 | `DeckController` route-awareness + up/down wiring (reveal `availableRoutes`) | WP02 | |
| T006 | Up/down labelled `<button>`s in `.dk-deck-controls` (AX-2) | WP02 | |
| T007 | Demo slide: hardcoded navy → theme-flipping surface token | WP02 | |
| T008 | Title-slide reshape: move intro+diagram off (insert `##`) | WP02 | |
| T009 | Wide-screen `.main-frame` cap + center (≥100rem → ~90rem) | WP03 | [P] |
| T010 | Dated changelog fragment (#65/#66/#67 + persona) | WP03 | [P] |
| T011 | PageTitle: gate `kind==='Persona'` → suppress page-hero + default h1 + band | WP04 | [P] |
| T012 | Persona passport = sole identity header, single `<h1 id="_top">` | WP04 | |
| T013 | Verify single-h1 + non-Persona byte-unchanged + `.dk-passport` preserved | WP04 | |

## Work Packages

### WP01 — Deck styling: theme mechanism, stage-fit, affordance CSS
- **Goal**: Make the out-of-frame deck theme-aware (route-isolated), bound slide content
  to the stage, and provide the affordance's visual styles.
- **Priority**: P1 (unblocks the a11y fix and #66 visuals).
- **Independent test**: `pnpm test` runs the parity guard green; a built deck flips
  palette under emulated dark scheme; the title-slide image caps in stage units.
- **Requirements**: FR-001, FR-002, FR-005.
- **Subtasks**: T001, T002, T003, T004.
- **Owned files**: `src/styles/dk-reveal-theme.css`, `src/tests/deck-theme-parity.test.ts` (new).
- **Dependencies**: none.
- **Est. prompt size**: ~330 lines.

### WP02 — Deck behavior + content: affordance wiring, demo token, title reshape
- **Goal**: Wire the vertical-stack affordance, make the demo slide legible via a
  theme-flipping token, and reshape the title slide.
- **Priority**: P1.
- **Independent test**: built deck shows up/down only on stacked slides; demo slide legible
  in both schemes; title slide = h1+hero, intro+diagram on their own slide; sentinel still
  indexed.
- **Requirements**: FR-003, FR-004, FR-006, FR-008.
- **Subtasks**: T005, T006, T007, T008.
- **Owned files**: `src/layouts/DeckLayout.astro`, `src/lib/deck/reveal-init.client.ts`, `example/docs/presentations/showcase-deck.md`.
- **Dependencies**: WP01 (affordance CSS + deck theme for the demo token to flip).
- **Est. prompt size**: ~400 lines.

### WP03 — Wide-screen frame cap + changelog
- **Goal**: Cap + center the reading frame on wide viewports; record the mission changelog.
- **Priority**: P2.
- **Independent test**: at 1600/1920/2560 `.main-frame` is capped ≤~90rem and centered;
  below 100rem unchanged; changelog fragment present.
- **Requirements**: FR-007.
- **Subtasks**: T009, T010.
- **Owned files**: `src/styles/dk-components.css`, `docs/changelog/2026-09-05-deck-layout-polish.md` (new).
- **Dependencies**: none.
- **Est. prompt size**: ~180 lines.

### WP04 — Persona (stakeholder profile) layout polish
- **Goal**: Make a `kind: Persona` page render one coherent identity (the passport) — no
  broken giant hero, no triple identity, one `<h1>`, no duplicated metadata — while every
  other kind stays byte-identical.
- **Priority**: P2 (scope addition, 2026-09-05).
- **Independent test**: built Persona page shows one identity card + one `<h1>`; a Default/Hub
  page header is byte-unchanged; `.dk-passport` marker + fields present.
- **Requirements**: FR-009, FR-010, FR-011.
- **Subtasks**: T011, T012, T013.
- **Owned files**: `src/components/PageTitle.astro`, `src/layouts/Persona.astro`.
- **Dependencies**: none (independent of WP01/WP02/WP03; distinct files).
- **Est. prompt size**: ~250 lines.

## Mission-level verification (orchestrator, not a WP)
- **NFR-005 pixel pass** (after all WPs merge to `feat/deck-layout-polish`): rebuild
  (`pnpm clean && pnpm build`), Playwright+chromium AFTER captures vs `scratchpad/before`:
  deck demo slide in light+dark, title slide + stack slide, docs at 1600/1920/2560.
- **NFR-004 gates**: `pnpm test`, `pnpm typecheck`, `pnpm test:a11y`, build-artifact / link /
  markua asserts stay green; in-frame Starlight theming unchanged.

## Execution order
WP01 → WP02 (dependency). WP03 and WP04 parallel with WP01/WP02 (independent files).
MVP = WP01 + WP02 (the deck a11y + UX). WP03 (wide cap) + WP04 (persona) complete the polish.
