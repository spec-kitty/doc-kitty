---
work_package_id: WP01
title: Deck styling — theme mechanism (route-isolated), stage-fit cap, affordance CSS (#65/#66)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-005
- NFR-002
planning_base_branch: feat/deck-layout-polish
merge_target_branch: feat/deck-layout-polish
branch_strategy: Planning artifacts for this mission were generated on feat/deck-layout-polish. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/deck-layout-polish unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-deck-layout-polish-01M1R1EB
base_commit: 907eec0f77eb6b695a20b51f4250be4c97c016ff
created_at: '2026-09-05T06:21:57.972975+00:00'
subtasks:
- T001
- T002
- T003
- T004
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/styles/dk-reveal-theme.css
create_intent:
- src/tests/deck-theme-parity.test.ts
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/styles/dk-reveal-theme.css
- src/tests/deck-theme-parity.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_001 (one source of truth — no forked colour catalog; guard parity instead), DIRECTIVE_024 (fix at the shared seam), red-first tests.

## Objective

Give the out-of-frame reveal deck a real light/dark theme that follows the viewer's
`prefers-color-scheme`, implemented ONLY in the route-isolated deck sheet
`src/styles/dk-reveal-theme.css` (never the shared `theme.css`/chrome layer), and bound
slide content to reveal's stage so nothing overflows. Also add the CSS for the vertical-
stack up/down affordance (WP02 adds its markup + wiring). Read `../spec.md`, `../plan.md`
(IC-01, IC-03), `../research.md` (D-01, D-02, D-04), `../contracts/deck-theme.md`. The
approach is decided — implement it, don't re-litigate. Work in the lane worktree only.

## Critical context (verified on main 7531919)

- `dk-reveal-theme.css` is imported with `?url` **only** by `DeckLayout.astro` (ADR-0022
  D5 route-import isolation). A rule added here reaches the deck route and nothing else —
  this is what keeps the deck theme separable from Starlight chrome (C-001) and guarantees
  in-frame pages are untouched (C-002).
- The deck's `--dk-* → --r-*` map already lives at `:root` in this sheet and reads
  `--dk-color-*`. Redeclaring the dark `--dk-color-*` values under a media query flips the
  whole deck (bg/text/heading/link/surface/diagram) for free.
- `theme.css` defines the dark palette under `:root[data-theme='dark']` (lines ~143–190).
  Those exact values are the single source of truth — the parity test enforces equality.
- Today `.reveal .slides section img { max-block-size: 65vh }` (lines ~135–140) caps the
  hero against the **viewport**, not reveal's transform-scaled ~700px stage — the root
  cause of the title-slide overflow. reveal gives `.slides > section` a definite pixel
  height (the stage), so a percentage of the section tracks the stage.
- The deck is out-of-frame with NO theme script; before this WP it is permanently light.

## Subtasks

### T001 — Deck dark palette via `@media (prefers-color-scheme: dark)`
- In `src/styles/dk-reveal-theme.css`, add a `@media (prefers-color-scheme: dark) { :root { … } }`
  block declaring the dark `--dk-color-*` tokens copied **verbatim** from
  `theme.css`'s `:root[data-theme='dark']` block (surfaces, text, accent, state pairs,
  diagram tokens — every `--dk-color-*` / `--dk-diagram-*` line present there).
- Keep the existing `:root` `--dk→--r` map and light behaviour intact; the media block only
  restates the dark VALUES so the map resolves to dark when the viewer prefers dark.
- Add a short comment explaining the route-isolation + parity-guard rationale (point at
  `deck-theme-parity.test.ts`).
- **Files**: `src/styles/dk-reveal-theme.css`.
- **Validation**: a built deck under emulated dark scheme shows a dark background + light
  text (WP-level; the orchestrator's pixel pass confirms visually).

### T002 — Parity-guard test (single-source enforcement) — palette parity ONLY
- Create `src/tests/deck-theme-parity.test.ts` (vitest). It must:
  1. Read `src/styles/theme.css` and `src/styles/dk-reveal-theme.css` as text.
  2. Parse the `--dk-color-*` declarations from `theme.css` `:root[data-theme='dark']` and
     from `dk-reveal-theme.css` `@media (prefers-color-scheme: dark)`; assert the two maps
     are equal (same keys, same values). A drift fails.
- Prefer a small, robust regex/line parser; do not add a CSS-parser dependency
  (DIRECTIVE_051 — no new deps).
- **Scope note (analyze C1)**: this test asserts ONLY the deck↔chrome dark-palette parity —
  its concern. Do NOT scan `showcase-deck.md` here: that file is WP02-owned and still holds
  the raw hex until WP02 lands, so a scan here would be red in WP01's isolated lane. The
  "no raw hex on the demo slide" guard is WP02's responsibility (T007 validation).
- **Files**: `src/tests/deck-theme-parity.test.ts` (new).
- **Validation**: `pnpm test` includes it and it is GREEN in WP01's lane (parity holds once
  T001 copies the values verbatim).

### T003 — Stage-relative slide-content cap
- Replace the `65vh` image cap with a stage-relative bound. Recommended:
  `max-block-size: min(60%, 65vh)` on `.reveal .slides section img` (percentage resolves
  against the definite-height stage section; `65vh` stays as a secondary guard). Tune the
  percentage if the pixel pass shows clipping/whitespace.
- Ensure the rule still excludes rendered Mermaid (`figure`/`svg`) — it targets `section img`
  only, which does not match diagram output; do not touch diagram sizing.
- **Files**: `src/styles/dk-reveal-theme.css`.
- **Validation**: title-slide hero fits within the stage (WP-level; orchestrator pixel pass
  confirms the title slide content height ≤ stage height).

### T004 — Vertical-stack affordance CSS
- Add styles for an up/down control pair that WP02 will render inside `.dk-deck-controls`
  (e.g. `.dk-deck-up`, `.dk-deck-down`): same 2.75rem target, brand surface, border, hover,
  `:focus-visible` ring, and hidden state via `[hidden]` (buttons start hidden and are
  shown only when a vertical route exists — WP02 toggles `hidden`).
- Keep them hidden in `@media print` alongside the existing controls/footer.
- Do NOT change the existing `.dk-deck-controls` layout contract (T007 spacing above the
  footer) — extend it so up/down sit alongside ‹/› cleanly.
- **Files**: `src/styles/dk-reveal-theme.css`.
- **Validation**: the classes exist with the AX-2 target size + focus ring; WP02 renders
  and toggles them.

## Branch Strategy

Planning branch: `feat/deck-layout-polish`. Final merge target: `feat/deck-layout-polish`.
Execution worktrees are allocated per computed lane from `lanes.json`; work only inside your
lane worktree. Do not merge or push to `main`.

## Definition of Done
- T001–T004 complete; `spec-kitty agent tasks mark-status T001 T002 T003 T004 --status done`.
- `pnpm typecheck` clean for the test file; `dk-reveal-theme.css` valid CSS.
- The dark media block is byte-parity with `theme.css` dark (the parity test proves it).
- No change to `theme.css` or any chrome sheet (C-001).

## Risks / reviewer guidance
- **Reviewer (opus)**: verify the dark values are IDENTICAL to `theme.css` (not merely
  similar); verify the sheet is still linked only by DeckLayout (grep for other importers);
  verify the stage cap uses a stage-relative unit (not `vh` alone); verify no in-frame sheet
  changed. Confirm the affordance CSS meets the ≥44px target + visible focus (AX-2).
