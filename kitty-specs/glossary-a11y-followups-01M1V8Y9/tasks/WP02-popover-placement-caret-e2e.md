---
work_package_id: WP02
title: Popover placement + caret e2e regression guard
dependencies: []
requirement_refs:
- FR-004
planning_base_branch: feat/glossary-a11y-followups
merge_target_branch: feat/glossary-a11y-followups
branch_strategy: Planning artifacts for this mission were generated on feat/glossary-a11y-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/glossary-a11y-followups unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
history: []
agent_profile: implementer-ivan
authoritative_surface: tests/a11y/
create_intent: []
execution_mode: code_change
owned_files:
- tests/a11y/glossary.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your agent profile:

```
/ad-hoc-profile-load implementer-ivan
```

Adopt its identity, boundaries, and quality discipline for the whole work package.

## Objective

Add an end-to-end regression guard for the glossary popover's positioning added in
#64 (issue #78): assert `data-placement` (bottom for a term with room below, top for
a term forced low in the viewport) and caret presence — so a future refactor of
`preview-popover.client.ts` `position()` cannot silently regress the caret or the flip.

## Context (read these first)

- `src/lib/glossary/preview-popover.client.ts` — `position()` (~L204+): sets
  `popover.dataset.placement = 'top'` when `spaceBelow < popoverHeight && spaceAbove
  > spaceBelow` (viewport-bottom flip), else `'bottom'`. It sets
  `popover.style.setProperty('--dk-glossary-caret-left', ...)`. The caret itself is
  drawn by `::before`/`::after` pseudo-elements keyed on
  `.dk-glossary-popover[data-placement='bottom'|'top']` (see `ensureStyle`), so
  there is **no caret element** to query — assert observable proxies.
- `tests/a11y/glossary.spec.ts` — the existing Playwright suite. Reuse its helpers:
  `gotoInMode(page, ROUTES.glossaryDemo, mode)`, `waitForIslandMounted(page)`,
  `modeOf(testInfo.project.name)`, the `CARGO_LINK` / `POPOVER` selectors, and run in
  BOTH colour modes like the sibling tests. Note the count-pins in the "T034" block —
  they MUST stay unchanged (SC-004).
- The demonstrator route has three auto-linked `cargo` terms (one per H2 section)
  plus the `:term` `policy` link — pick a HIGH one (first section) and a LOW one
  (last section) for the two placement cases.

## Subtasks

### T007 — Assert `data-placement="bottom"` + caret for a high term

- Add a test (both modes) that opens the popover on a term high in the viewport
  (first `cargo`, ample space below) via hover or focus, then asserts:
  - `await expect(popover).toHaveAttribute('data-placement', 'bottom')`.
  - caret proxy: the popover has a non-empty `--dk-glossary-caret-left` custom
    property (read via `page.evaluate` on `getComputedStyle(el).getPropertyValue(...)`
    or `el.style`), and the `::after` pseudo-element for the active placement has a
    non-`none` `border-bottom-color` (read via
    `getComputedStyle(el, '::after').borderBottomColor`).

### T008 — Assert `data-placement="top"` flip for a low-in-viewport term

- Force the flip: set a short viewport (e.g. `page.setViewportSize({width, height})`
  small enough that a low term has `spaceBelow < popoverHeight`), scroll the LAST
  `cargo` term to near the viewport bottom (`scrollIntoViewIfNeeded` then nudge, or
  `scrollIntoView({block:'end'})` via `evaluate`), open its popover, and assert
  `data-placement` is `'top'`.
- Guard the precondition so the test is honest: assert the anchor's
  `getBoundingClientRect().bottom` is in the lower part of the viewport before
  opening, so a layout change that stops reproducing "low term" fails loudly rather
  than silently testing the bottom case again.

### T009 — Assert caret for the flipped case; confirm count-pins unchanged

- For the flipped (`top`) popover, assert the caret proxy for the upward caret: the
  `::before`/`::after` for `data-placement='top'` has a non-`none`
  `border-top-color`, and `--dk-glossary-caret-left` is set.
- Re-run / keep the existing count-pin assertions intact; do not modify the "T034"
  numbers. If your new tests share the file, ensure they don't perturb the pinned
  counts.

## Branch Strategy

- Planning base and final merge target: **`feat/glossary-a11y-followups`**.
- Direct-to-feat: the orchestrator commits your changes. Work in the repo root checkout.

## Definition of Done

- New assertions for `data-placement="bottom"` (high term), `data-placement="top"`
  (flipped low term), and caret presence for both placements, in both colour modes.
- The "low term" case provably forces the flip (precondition asserted).
- `pnpm run test:a11y` green; existing count-pins unchanged (SC-004).
- No production source edited — this WP is test-only (`owned_files` is the spec file).

## Reviewer Guidance

- Confirm the flip test genuinely reproduces the low-space-below condition (not a
  false green that re-tests `bottom`).
- Confirm caret assertions read the pseudo-element / custom property, not a
  non-existent caret DOM node.
- Confirm no count-pin drift.
