---
work_package_id: WP03
title: Wide-screen frame cap + changelog (#67)
dependencies: []
requirement_refs:
- FR-007
- NFR-003
planning_base_branch: feat/deck-layout-polish
merge_target_branch: feat/deck-layout-polish
branch_strategy: Planning artifacts for this mission were generated on feat/deck-layout-polish. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/deck-layout-polish unless the human explicitly redirects the landing branch.
subtasks:
- T009
- T010
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/styles/dk-components.css
create_intent:
- docs/changelog/2026-09-05-deck-layout-polish.md
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/styles/dk-components.css
- docs/changelog/2026-09-05-deck-layout-polish.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_024 (cap at the shared frame element, not per-page), keep below-breakpoint behaviour byte-unchanged.

## Objective

Cap and center the reading frame on wide viewports so content is no longer marooned in a
large one-sided gutter, and record the mission changelog fragment. Read `../spec.md`,
`../plan.md` (IC-04), `../research.md` (D-07), `../contracts/stack-affordance.md`
(C-WIDE-1). Independent of WP01/WP02. Work in the lane worktree only.

## Critical context (verified in the built DOM, main 7531919)

- Starlight's real frame classes (confirmed in `example/dist/.../index.html`):
  `.main-frame` (full-bleed, spans the whole width and wraps `[sidebar-pane | main-pane]`),
  `.main-pane`, `.content-panel`, `.sl-container`. `.main-frame` is the correct cap target
  (C-005). There is NO `.main-frame` rule in `src/` today (it is Starlight's own class).
- Pixel measurements (BEFORE): `.main-pane` grows to 1312/1632/2272px at 1600/1920/2560
  while the reading column stays ~720px pinned left → large empty right gutter.
- `src/styles/dk-components.css` is the GLOBAL component sheet (in `customCss` DEFAULT_LAYER
  and linked by DeckLayout) that SURVIVES brand swaps — the correct home for a base layout
  cap (research D-07; the issue's suggestion of `brand-components.css` is rejected because a
  brand swap replaces that slot and would drop the cap).
- `--dk-width-*` tokens live in `theme.css`; you may reference `rem` literals here (90rem
  cap, 100rem breakpoint) — do not edit `theme.css`.

## Subtasks

### T009 — Wide-screen `.main-frame` cap + center
- Add to `src/styles/dk-components.css`:
  ```css
  @media (min-width: 100rem) {
    .main-frame { max-width: 90rem; margin-inline: auto; }
  }
  ```
- Add a comment naming the verified selector + the survives-branding rationale.
- If the pixel pass shows the fixed top header visually misaligned with the centered band,
  add a matching cap to the header's inner container (use the DOM-verified class) — only if
  needed; note it. Do NOT chase sidebar drag-resizing (C-007, out of scope).
- Confirm the layout below 100rem is byte-unchanged (the rule is inside the media query).
- **Files**: `src/styles/dk-components.css`.
- **Validation**: at 1600/1920/2560 `.main-frame` is ≤ ~90rem and centered; at 1280 the
  layout matches `main` (orchestrator pixel pass verifies).

### T010 — Dated changelog fragment
- Create `docs/changelog/2026-09-05-deck-layout-polish.md` following the existing dated-
  fragment convention in `docs/changelog/` (match an existing fragment's frontmatter/shape).
  Summarize all four fixes: deck now follows light/dark and the demo slide is legible in
  both (#65); the deck title slide fits the stage and vertical stacks show an up/down
  affordance (#66); wide screens cap and center the reading frame (#67); the
  stakeholder-profile (Persona) layout renders one clean identity card (scope addition).
- **Files**: `docs/changelog/2026-09-05-deck-layout-polish.md` (new).
- **Validation**: `pnpm validate` (frontmatter) passes; the fragment renders in the changelog.

## Branch Strategy

Planning branch: `feat/deck-layout-polish`. Final merge target: `feat/deck-layout-polish`.
Execution worktrees are allocated per computed lane from `lanes.json`; work only inside your
lane worktree. Do not merge or push to `main`.

## Definition of Done
- T009, T010 complete; `spec-kitty agent tasks mark-status T009 T010 --status done`.
- `pnpm validate` + `pnpm build` clean; the cap applies only ≥100rem.
- Cap lives in `dk-components.css` (survives branding), targets the verified `.main-frame`.

## Risks / reviewer guidance
- **Reviewer (opus)**: verify the selector matches the built DOM (`.main-frame`); verify the
  cap is inside the media query (no sub-breakpoint regression); verify the sheet choice
  survives a brand swap; verify the changelog fragment matches the dated-fragment convention
  and covers all three issues.
