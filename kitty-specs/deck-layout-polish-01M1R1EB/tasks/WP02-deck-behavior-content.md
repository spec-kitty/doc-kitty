---
work_package_id: WP02
title: Deck behavior + content — stack affordance wiring, legible demo slide, title reshape (#65/#66)
dependencies:
- WP01
requirement_refs:
- FR-003
- FR-004
- FR-006
- FR-008
- NFR-001
planning_base_branch: feat/deck-layout-polish
merge_target_branch: feat/deck-layout-polish
branch_strategy: Planning artifacts for this mission were generated on feat/deck-layout-polish. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/deck-layout-polish unless the human explicitly redirects the landing branch.
subtasks:
- T005
- T006
- T007
- T008
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/deck/
create_intent: []
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/layouts/DeckLayout.astro
- src/lib/deck/reveal-init.client.ts
- example/docs/presentations/showcase-deck.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_024 (pure-wire the affordance through the DeckController facade — DeckLayout gains no reveal knowledge), red-first where practical, keep the SSR/no-JS fallback intact.

## Objective

Complete the deck fixes on top of WP01: (1) wire a vertical-stack up/down affordance
through the existing `DeckController` facade; (2) make the demo background slide legible in
both schemes via a theme-flipping token; (3) reshape the title slide so it is `h1 + hero`
only, moving the intro paragraph (search sentinel) + first diagram to their own slide. Read
`../spec.md`, `../plan.md` (IC-02, IC-03), `../research.md` (D-03, D-05, D-06),
`../contracts/deck-theme.md`, `../contracts/stack-affordance.md`. Depends on WP01 (its
affordance CSS + deck theme). Work in the lane worktree only.

## Critical context (verified on main 7531919)

- `src/lib/deck/reveal-init.client.ts` is the SOLE `import('reveal.js')` site and returns a
  narrow `DeckController` facade (`onSlideChange`, `isPrintView`, `currentSlide`). reveal 6
  exposes `availableRoutes()` → `{left,right,up,down}` and `up()`/`down()`. DeckLayout must
  gain ZERO reveal knowledge — extend the facade, don't leak reveal into the layout.
- `DeckLayout.astro` renders `<nav class="dk-deck-controls">` with labelled ‹/› `<button>`s
  wired in the client `<script>`; the diagram render runs AFTER `whenRevealReady()` — do not
  disturb that ordering (NFR-004 / INV-A11Y-ORDERING).
- `example/docs/presentations/showcase-deck.md`: line 36 is
  `<!-- .slide: data-background-color="#101828" -->` on the "Horizontal slide with
  directives" slide. The title slide is SYNTHESIZED (`deck-split.internal.ts` `titleChildren`
  = h1 + hero); everything before the first `##` (the intro paragraph carrying
  **`quokka showcase sentinel`** + the first ```mermaid``` pipeline diagram) currently
  appends to the title slide → the overflow.
- reveal applies `data-background-color` as an inline style on the slide-background element.

## Subtasks

### T005 — DeckController route-awareness + up/down wiring
- Extend the `DeckController` facade with a way to observe vertical navigability, e.g. add
  `availableRoutes(): { up: boolean; down: boolean; left: boolean; right: boolean }` (read
  from reveal's `getAvailableRoutes()`/`availableRoutes()`), and expose `up()`/`down()` (or
  wire them internally). Keep the inert-controller fallback (no `.reveal` root) consistent.
- Wire the deck's `.dk-deck-up`/`.dk-deck-down` buttons to `deck.up()`/`deck.down()` here
  (mirroring the existing prev/next wiring), and update their `hidden` state on init +
  `slidechanged` based on whether an up/down route exists.
- Do all reveal access in this module only; DeckLayout stays a pure wire.
- **Files**: `src/lib/deck/reveal-init.client.ts` (and the wiring invoked from DeckLayout's
  script — see T006).
- **Validation**: on a stacked slide the down button is visible; on a flat slide it is
  hidden; keyboard nav still works.

### T006 — Up/down buttons markup in `.dk-deck-controls`
- Add two labelled `<button>`s to `.dk-deck-controls` in `DeckLayout.astro`:
  `class="dk-deck-up" aria-label="Up (previous slide in stack)"` (▲) and
  `class="dk-deck-down" aria-label="Down (next slide in stack)"` (▼), both starting with the
  `hidden` attribute (WP01's CSS styles them; T005 toggles `hidden`).
- In DeckLayout's existing client `<script>`, invoke the WP01/T005 wiring so the buttons are
  connected once the controller resolves (keep it after `initDeck()` like prev/next). Do not
  add reveal imports to DeckLayout.
- **Files**: `src/layouts/DeckLayout.astro`.
- **Validation**: buttons render, are labelled, keyboard-reachable, hidden until a route
  exists; a11y gate stays green (unique labels, ≥44px from WP01 CSS).

### T007 — Legible demo background slide (theme-flipping token)
- In `showcase-deck.md`, change the demo directive to a theme surface token, e.g.
  `<!-- .slide: data-background-color="var(--dk-color-surface-2)" -->`.
- Rebuild and CONFIRM reveal applies the `var()` (the slide shows a real, non-default
  surface that is light in light mode / dark in dark mode, with legible text).
- **Fallback ownership (analyze I1)**: the `var()` inline-style path is the intended
  mechanism. If a build shows reveal does NOT resolve the inline `var()`, DO NOT edit
  `dk-reveal-theme.css` (it is WP01-owned) — STOP and flag the orchestrator, who will apply
  the class-based fallback (research D-03) as a coordinated cross-lane step. This keeps WP02
  inside its owned files.
- Keep the slide's demonstrative purpose (it still demonstrates a `.slide` background
  directive). No raw hex.
- **No-raw-hex guard (analyze C1)**: after the edit, run
  `grep -nE 'data-background-color="#' example/docs/presentations/showcase-deck.md` and
  confirm ZERO matches (the guard that moved here from WP01's test). Record the clean result
  in the WP history.
- **Files**: `example/docs/presentations/showcase-deck.md`.
- **Validation**: demo slide legible in both emulated schemes (orchestrator pixel pass); the
  grep guard returns no matches.

### T008 — Title-slide reshape
- In `showcase-deck.md`, insert a `##` heading immediately BEFORE the current opening intro
  paragraph (e.g. `## Out-of-frame deck pipeline`). This makes the transform put the intro
  paragraph + the first pipeline ```mermaid``` diagram on their own horizontal slide, leaving
  the title slide as `h1 + hero` only.
- Verify the `quokka showcase sentinel` text stays on a published (indexed) slide inside the
  `data-pagefind-body` region (it will — it moves to the new slide, still published).
- Do not remove the hero frontmatter or the diagram; only re-slice via the heading.
- **Files**: `example/docs/presentations/showcase-deck.md`.
- **Validation**: title slide = h1 + hero, nothing clipped; new slide shows intro + diagram
  (orchestrator pixel pass); deck still builds; sentinel indexed.

## Branch Strategy

Planning branch: `feat/deck-layout-polish`. Final merge target: `feat/deck-layout-polish`.
This WP depends on WP01 — branch from WP01's merged base per `lanes.json`. Work only inside
your lane worktree. Do not merge or push to `main`.

## Definition of Done
- T005–T008 complete; `spec-kitty agent tasks mark-status T005 T006 T007 T008 --status done`.
- `pnpm typecheck` + `pnpm build` clean; deck builds and enhances.
- Affordance shows only on stacked slides; demo slide legible both schemes; title slide
  reshaped; sentinel still indexed.
- DeckLayout gained no reveal import; diagram-render ordering preserved.

## Risks / reviewer guidance
- **Reviewer (opus)**: verify the facade stays narrow and DeckLayout imports no reveal;
  verify up/down `hidden` toggles correctly on init + slidechanged (deep-link safe); verify
  the demo `var()` actually resolves in the built HTML (or the fallback is correctly applied
  and justified); verify the title reshape leaves the sentinel in a published slide and does
  not orphan the diagram; confirm no regression to prev/next or the notes aside.
