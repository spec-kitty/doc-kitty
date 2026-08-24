---
work_package_id: WP05
title: Deck a11y (static axe both modes + Playwright interaction test)
dependencies:
- WP04
requirement_refs:
- FR-016
- FR-021
planning_base_branch: feat/slide-decks
merge_target_branch: feat/slide-decks
branch_strategy: Planning artifacts for this mission were generated on feat/slide-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/slide-decks unless the human explicitly redirects the landing branch.
subtasks:
- T022
- T023
- T024
- T025
history:
- '2026-08-24: authored by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/deck.interaction.spec.ts
execution_mode: code_change
owned_files:
- tests/a11y/routes.ts
- tests/a11y/deck.interaction.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md) (US2,
NFR-001/003/007), [../plan.md](../plan.md),
[../contracts/deck-route-and-build-assertions.md](../contracts/deck-route-and-build-assertions.md)
(the AX/IX rows), and `docs/adr/0011-*.md` (mandatory fallback) + `docs/adr/0022-*.md`.

## Objective

Prove the deck is accessible. Two complementary layers, because **axe cannot exercise
keyboard navigation, keyboard traps, or transition state** (squad R-01): a **static axe**
scan (both light and dark) for the things axe *does* check, and a **Playwright interaction
test** for keyboard + reduced-motion + no-JS. Adding the deck to `AXE_PAGES` here is what
finally scans it; until this WP the deck was correctly unscanned (unscanned ≠ red).

## Subtasks

### T022 — Register the deck route
- Add the showcase deck route to `tests/a11y/routes.ts` (`ROUTES` + `AXE_PAGES`) so the
  existing axe lane scans `/presentations/showcase-deck/` in **both** color modes
  (`wcag22aa`; serious/critical fail the build).

### T023 — Axe passes (static)
- Confirm the deck clears axe for what axe checks: every `<section>` has an accessible name
  (heading or `aria-label`); navigation controls are real `<button>`s with accessible
  labels; a single labelled main region; **WCAG 2.2 AA size-aware** contrast (≥4.5:1
  normal, ≥3:1 large) on the mapped `--dk-*` tokens. Fix any violation at its source
  (mostly in WP01's layout/theme — a small, recorded out-of-map edit if needed).

### T024 — Interaction test: keyboard
- `tests/a11y/deck.interaction.spec.ts` (Playwright): load the deck with JS enabled; drive
  arrow/space/Esc and assert **every slide becomes active**; assert focus is **visible**
  (`:focus-visible`) and there is **no keyboard trap** (focus can leave the deck).

### T025 — Interaction test: reduced motion + no-JS
- Same spec: under emulated `prefers-reduced-motion: reduce`, assert
  `getComputedStyle(currentSlide).transitionDuration === '0s'`.
- No-JS fallback — **two separable checks** (axe cannot run in a JS-disabled page, since
  axe-core executes as injected page JS, RT-04): (a) **text presence/order** — load the deck
  in a `javaScriptEnabled: false` context (or fetch the raw HTML) and assert every slide's
  text is present in the initial HTML in document order; (b) **axe on the pre-enhancement
  SSR DOM** — in a normal JS-enabled context, run axe against the served **static** HTML
  **before** reveal initializes (or run `axe-core` over the static `dist` HTML via jsdom),
  asserting no serious/critical violations. State which mechanism is used.

## Branch Strategy

Planning branch: `feat/slide-decks`. Final merge target: `feat/slide-decks`. Depends on
WP04; runs **parallel to WP06**. Implement with
`spec-kitty agent action implement WP05 --agent claude`.

## Definition of Done

- The deck is in `ROUTES`/`AXE_PAGES` and clears axe in light and dark.
- The interaction test proves keyboard reachability, no trap, visible focus, reduced-motion
  `0s`, and no-JS text presence.
- `a11y` lane green with the deck now scanned; other lanes unaffected.

## Risks / Reviewer guidance

- A committed **visual** baseline is **out of scope** (C-008) — reveal's canvas is
  screenshot-flaky; do not add one.
- If axe fails on contrast, that is a **hand-back to WP01** (whose T005 AA hard gate should
  have caught it), not a WP05 fix — WP05 owns only `tests/a11y/*`. Flag it; do not patch the
  theme locally (scope creep + ownership violation).
