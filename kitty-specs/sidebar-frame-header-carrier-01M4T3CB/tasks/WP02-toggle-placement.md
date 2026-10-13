---
work_package_id: WP02
title: Collapse toggle placement and semantics
dependencies:
- WP01
requirement_refs:
- FR-007
- FR-008
- FR-009
- FR-010
- NFR-004
- NFR-005
- C-003
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: 598fe766882468fe0a3e1001b77dc8cf09c495e2
created_at: '2026-10-13T08:14:08.687772+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
history: []
agent_profile: frontend-freddy
authoritative_surface: src/lib/toc-rail/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/toc-rail/**
- src/styles/toc-rail.css
- tests/a11y/toc-rail.interaction.spec.ts
- src/tests/toc-rail-build-html.test.ts
- src/tests/toc-rail-preference.test.ts
- src/tests/toc-rail-prepaint.test.ts
- example/docs/architecture/diagram-demonstrator.md
role: implementer
tags: []
tracker_refs: []
---

# WP02 — Collapse toggle placement and semantics

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`frontend-freddy`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Put the rail's collapse toggle on the rail edge in both states at every desktop width, and next to the rail in keyboard order, without changing the stored preference or the root attribute.

Requirements: FR-007, FR-008, FR-009, FR-010, FR-012, NFR-004, NFR-005, C-003. Research: R4, R7 (target size).

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## Why this is broken today

`src/lib/toc-rail/toc-rail.client.ts` appends the button to `<body>`; `src/styles/toc-rail.css` positions it with `position: fixed; right: var(--sl-sidebar-width)` and `right: 0` when collapsed.

Measured on the published site (toggle x against the rail's inner edge):

| Viewport | Toggle | Rail edge | Result |
|---|---|---|---|
| 1280 | 960–992 | 1000 | overlaps article text |
| 1440 | 1120 | 1080 | 40px inside the rail |
| 1920 | 1600 | 1320 | 280px inside the rail |

The button is focusable element 97 of 98 on a typical page (after the footer) and has no `aria-controls`.

WP01 has pinned the rail column to `var(--sl-sidebar-width)` and defined `--dk-frame-gutter` (0 by default, positive when a consumer caps the frame). Build on both.

## Subtask T007 — Mount the toggle beside the rail; `aria-controls`

**Purpose**: fix focus order and name the controlled region.

**Steps**:
1. In `initTocRail()`, find `.right-sidebar-container` and insert the button as its **first child** (before `.right-sidebar`), not on `<body>`. Keep the two guards (no rail → do nothing; already injected → do nothing).
2. The container is an ancestor of neither `.right-sidebar` (which gets `pointer-events: none` when collapsed) nor `.right-sidebar-panel` (which gets `display: none`), so the button stays operable. Check Starlight 0.32's markup in `node_modules/@astrojs/starlight/components/TwoColumnContent.astro` to confirm the nesting before relying on it.
3. Give the panel a stable id if it has none (for example `dk-toc-panel`, set from the client script on `.right-sidebar-panel`) and set `aria-controls` on the button to it. Keep `aria-expanded` and the accessible name as they are.
4. Update the module header comment: it currently explains why the button is body-mounted.
5. Keep the `astro:page-load` re-init listener and the idempotency guard.

**Do not change**: the storage key `dk-toc-collapsed`, the `data-toc-collapsed` attribute, `preference.ts` semantics, or the pre-paint script's behaviour (C-003, FR-009).

## Subtask T008 — Anchor the toggle with logical properties

**Purpose**: correct position at every width, mirrored in right-to-left.

**Steps** in `src/styles/toc-rail.css`:
1. Keep `position: fixed` (the rail scrolls and clips; a fixed button is not clipped by ancestor overflow as long as no ancestor creates a containing block with `transform`, `filter` or `contain` — verify none does).
2. Replace the physical offsets:
   ```css
   .dk-toc-toggle { inset-inline-end: calc(var(--dk-frame-gutter, 0px) + var(--sl-sidebar-width)); }
   html[data-toc-collapsed] .dk-toc-toggle { inset-inline-end: var(--dk-frame-gutter, 0px); }
   ```
   If the button is centred on the edge with a transform, flip that transform for `[dir='rtl']` (the `dir` attribute is on `<html>`).
3. The collapsed rail is a 1px column at the frame's end edge. Confirm the toggle and that hairline share an x-position with a capped frame as well as the default.
4. Update the block comment that explains the anchor; it describes the viewport-edge logic.
5. The chevron rotation for the collapsed state must also read correctly in right-to-left.

## Subtask T009 — Collapsed recentre without a left sidebar

**Purpose**: FR-010. The recentre rule is `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane`; a TOC page with no left sidebar keeps dead space.

**Steps**: add a sibling rule for `html[data-toc-collapsed][data-has-toc]:not([data-has-sidebar]) .main-pane` with the same declarations. Check which Starlight rule it has to beat on such a page and keep the specificity note in the comment accurate. Find or create a page without a left sidebar to verify (a splash-template page with a TOC, or a fixture under the test fixtures).

## Subtask T010 — TOC link target size; re-enable the demonstrator TOC

**Purpose**: NFR-004. `example/docs/architecture/diagram-demonstrator.md` suppresses its table of contents in front matter (lines 10–14) to avoid a target-size violation in the rail.

**Steps**:
1. In `toc-rail.css`, give rail links a minimum block size of 24px (padding or `min-block-size`), scoped to `.right-sidebar` so the mobile TOC is unaffected unless it has the same problem.
2. Remove the TOC suppression and its explanatory comment from the demonstrator page.
3. Run the axe suite for that route and confirm it is clean.

## Subtask T011 — Update toggle unit and interaction tests

**Steps**:
1. `src/tests/toc-rail-build-html.test.ts`, `toc-rail-prepaint.test.ts`, `toc-rail-preference.test.ts`: update anything that encodes the body mount. Preference and pre-paint tests should need no change; if one does, stop and check you have not altered stored state.
2. `tests/a11y/toc-rail.interaction.spec.ts`: add
   - the toggle's parent is `.right-sidebar-container`;
   - `aria-controls` resolves to an element that contains the TOC links;
   - tab order: the toggle is focused immediately before the first TOC link (or immediately after the last), and is not among the last two focusable elements of the page;
   - a pre-seeded `localStorage` value from before this change still yields a collapsed rail on load (FR-009, paired with a click that flips it);
   - collapsed, the toggle is still clickable (guards the `pointer-events` trap).
3. Leave multi-width geometry to WP03.

## Verification

`pnpm test`, then `pnpm clean && pnpm build && pnpm test:a11y -- toc-rail`. Check by hand at 1280 and 1920, expanded and collapsed, left-to-right and with `document.documentElement.dir = 'rtl'`.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP02 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- The toggle is a child of `.right-sidebar-container`, has `aria-controls`, and is adjacent to the rail in tab order.
- `toc-rail.css` uses logical properties for the anchor; no `right:` remains for the toggle.
- Recentre works with and without a left sidebar.
- Rail links meet the 24px minimum; the demonstrator page shows its TOC and passes axe.
- Storage key and root attribute unchanged; the returning-reader test passes.
- `pnpm test` and the toc-rail Playwright spec pass.

## Risks

- **Containing block**: any ancestor with `transform`/`filter`/`contain` would make `position: fixed` relative to it.
- **Collapsed state**: the 1px container must not clip or hide its first child.
- **Layout shift**: the button is injected after parse; it is fixed-positioned, so it must not move the reading column (NFR-005).
- **Baselines** move; WP03 regenerates them.

## Reviewer Guidance

- Tab through a page: the toggle must come with the rail, not after the footer.
- Collapse, reload, navigate: state persists.
- Check the right-to-left rendering, including chevron direction.
- Confirm no change to `preference.ts` semantics.
