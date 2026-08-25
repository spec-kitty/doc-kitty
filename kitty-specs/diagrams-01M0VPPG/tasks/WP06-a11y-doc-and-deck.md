---
work_package_id: WP06
title: a11y (doc + deck) — render-gate, direct name/figure, footprint
dependencies:
- WP04
- WP05
requirement_refs:
- FR-011
- NFR-001
- NFR-006
planning_base_branch: feat/diagrams
merge_target_branch: feat/diagrams
branch_strategy: Planning artifacts for this mission were generated on feat/diagrams. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/diagrams unless the human explicitly redirects the landing branch.
subtasks:
- T019
- T020
- T021
history:
- '2026-08-25: authored by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/diagram.spec.ts
execution_mode: code_change
owned_files:
- tests/a11y/routes.ts
- tests/a11y/axe.spec.ts
- tests/a11y/diagram.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

`/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its initialization,
boundaries, directives, and tactics. Then read this WP, [../spec.md](../spec.md),
[../plan.md](../plan.md),
[../contracts/render-token-and-assertions.md](../contracts/render-token-and-assertions.md),
and `docs/adr/0023-diagram-render-and-metadata-seam.md`.

## Objective

Prove the diagram accessibility contract on **both** shells (starlight doc + out-of-frame
deck). Because the SVG renders **client-side**, the axe harness must first **wait for the
render** before scanning, and — since axe's `svg-img-alt` may not fire on the runtime SVG —
assert the accessible **name** and the `<figure>` **directly** (Playwright), not only via axe.
Add the demonstrator and the deck to the scanned set, cover both colour modes and the
`[data-theme]` re-render, and add the runtime **footprint** network capture.

## Subtasks

### T019 — Harness change: render-gate + direct name/figure (`routes.ts`, `axe.spec.ts`, `diagram.spec.ts`)
- **Declarative, unconditional, count-aware render-gate** (contract DX-1; squad F1/F2):
  - Add a field to `AxePage` in `routes.ts` — e.g. `renderWait?: string` (a locator) plus the
    **expected diagram count** for that route — and mark the diagram routes with it.
  - In `axe.spec.ts`, when a route declares `renderWait`, await it **unconditionally** before
    `analyze()`. **Do NOT** write a "if a `figure.dk-diagram` exists, wait for it" conditional —
    a gate that only fires when the element is already present can never fail (the vacuity trap:
    a route whose diagram silently failed to render would scan the bare `<pre>` and pass).
  - **Count-aware**: the demonstrator has **two** diagrams, so
    `page.locator('figure.dk-diagram svg[aria-labelledby]')` matches 2 → a bare `.toBeVisible()`
    is a strict-mode throw and `.first()` would gate only one. Assert
    `await expect(locator).toHaveCount(<expected>)` and that **each** is visible (iterate
    `locator.all()`), and also assert `pre.mermaid` no longer holds the raw source.
  - **Metadata-eligibility note**: `svg[aria-labelledby]` only appears when `accTitle`/`accDescr`
    were injected, i.e. the fence carried `%%` metadata. A gate-eligible (scanned) diagram MUST
    carry metadata — a bare fence on a scanned route would hang the gate. Note this on the field.
- **Direct assertions, targeting the fallback by identity** (contract DX-2; squad F4), in a new
  `diagram.spec.ts`: the rendered `<svg>` has a **non-empty accessible name** and
  `<figure role="group">` + `<figcaption>` are present — Playwright-direct, **not** axe. Assert
  the name on the **title-absent (description-only) diagram by its own selector**, not `.first()`
  / "some svg", or the accTitle→description fallback (R-01) is proven vacuously by the all-fields
  diagram.
- **Single-loop runtime assertion** (squad F5 / NFR-007): in `diagram.spec.ts`, assert **exactly
  one `<svg>` under each `pre.mermaid`** after render (`autoTheme:false` disables theme-watching,
  not rendering — a stray astro-mermaid render would double the SVG and this is the real guard,
  since mermaid's per-run random IDs can dodge axe's duplicate-id rule).
- **[data-theme] re-render** (DX-4): toggle `data-theme`, assert the diagram re-renders in the
  other mode's colours and **still exactly one `<svg>`** per node (no orphaned duplicate).

### T020 — Scan the demonstrator; tighten the already-present deck (`routes.ts`, `axe.spec.ts`)
- **Add the demonstrator** (WP04) to `ROUTES` / `AXE_PAGES` with the T019 `renderWait` +
  expected diagram count.
- **The showcase deck is ALREADY in `AXE_PAGES`** (`routes.ts:97`, scanned by `axe.spec.ts` +
  `deck.interaction.spec.ts` from the slide-decks mission — squad F-A). Do **NOT** add a second
  deck entry — **update** the existing one with the `renderWait` for its new first-slide diagram
  (DX-5). Duplicating the deck route is the trap to avoid.
- Run axe in **both** modes (light + dark) on both; **zero serious/critical** violations (DX-3).
- **Extend `guardRoots` for diagram routes (squad F3)**: add
  `figure.dk-diagram svg[aria-labelledby]` to the diagram routes' `guardRoots` so the scan's own
  non-vacuity contract covers a **rendered** diagram (not just the page chrome). `guardRoots`
  uses instantaneous `.count()` with no auto-wait, so it must be evaluated **after** the
  `renderWait` gate — confirm ordering. Keep the existing non-vacuity check intact.

### T021 — Footprint capture (`diagram.spec.ts`)
- Playwright network capture (contract FP-1 / NFR-006): a **diagram page** requests the
  `mermaid` library chunk; a **diagram-free control route** does **not** request it — proving
  the "JS loads only where a diagram exists" guarantee. No external/CDN host in either trace.

## Branch Strategy

Planning branch: `feat/diagrams`. Final merge target: `feat/diagrams`. **Depends on WP04
(demonstrator) + WP05 (deck)** — both must be `approved`. Implement with
`spec-kitty agent action implement WP06 --agent claude`.

## Definition of Done

- Render-gate is a **declarative `renderWait`** awaited **unconditionally** and **count-aware**;
  it precedes every diagram-route scan (doc + deck) — no scan runs pre-render, no vacuity trap.
- Direct accessible-name + `<figure>`/`<figcaption>` assertions green on both shells; the name is
  asserted on the **title-absent diagram by identity** (fallback proven, not vacuously).
- **Exactly one `<svg>` per `pre.mermaid`** after initial render and after `[data-theme]` toggle
  (the real single-loop guard, NFR-007).
- axe zero serious/critical, both modes, on demonstrator + the already-present deck (**updated**,
  not duplicated); diagram-route `guardRoots` include the rendered svg (post-gate).
- Footprint: diagram page loads the mermaid chunk, control route does not; no CDN.
- `ci-ok` green (a11y lane now covers diagrams on both shells).

## Risks / Reviewer guidance

- **Render-gate is the crux** — an axe scan that runs before the client render sees only
  `<pre>` and passes vacuously. Verify the gate waits for `svg[aria-labelledby]` *and* that
  `pre.mermaid` no longer holds the raw source.
- **Direct name assertion** — do not rely on axe `svg-img-alt` for the SVG name; the direct
  Playwright assertion is the real guarantee (NFR-001).
- **Both modes + re-render** — confirm the dark-mode scan actually toggled `data-theme` and the
  single render loop re-drew (no duplicate/stale SVG left behind).
- **guardRoots non-vacuity** — the scanned set must be provably non-empty; a diagram route that
  silently dropped out would make the lane pass without testing anything.
