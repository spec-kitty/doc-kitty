---
work_package_id: WP02
title: Toggle client + rail CSS
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-006
- FR-007
- NFR-002
planning_base_branch: feat/collapsible-toc-rail
merge_target_branch: feat/collapsible-toc-rail
branch_strategy: Planning artifacts for this mission were generated on feat/collapsible-toc-rail. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/collapsible-toc-rail unless the human explicitly redirects the landing branch.
subtasks:
- T005
- T006
- T007
- T008
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/
create_intent:
- src/lib/toc-rail/toc-rail.client.ts
- src/styles/toc-rail.css
execution_mode: code_change
owned_files:
- src/lib/toc-rail/toc-rail.client.ts
- src/styles/toc-rail.css
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (chrome boundary — no component override), DIRECTIVE_010 (spec fidelity), plus the a11y (WCAG 2.1/2.2 AA) axe gate.

## Objective

Build the accessible fixed toggle (client island) and the token-driven collapsed-rail CSS —
the visible feature. Uses WP01's preference API. **Do NOT override Starlight's PageSidebar**
(four-carrier lock); augment the rendered `.right-sidebar` DOM from the client island.

Read first: `../contracts/toc-rail-contract.md` (**C-2, C-3, C-4**), `../research.md` (D1/D4/D5 + dispositions), `../plan.md` (IC-02/IC-03), and the Starlight internals it names (`@astrojs/starlight@0.32.6` TwoColumnContent.astro / PageSidebar.astro). WP01's `src/lib/toc-rail/preference.ts` is available.

## Subtasks

### T005 — `src/lib/toc-rail/toc-rail.client.ts` (inject + toggle)
Export an `initTocRail()`. Guard: `if (!document.querySelector('.right-sidebar')) return;` and idempotency: bail if the toggle id already exists. Inject ONE `<button type="button" id="dk-toc-toggle">` (mounted as a sibling of `.right-sidebar-panel` or on `<body>` — NOT inside the panel that will be `display:none`). Clicking toggles `document.documentElement` `data-toc-collapsed` and persists via WP01 `setCollapsed`. Reflect state: `aria-expanded` = String(!collapsed), `title`/`aria-label` "Hide the table of contents"/"Show the table of contents".

### T006 — a11y + placement + inert rebind
Native `<button>` gives Enter/Space free. Placement per C-3: `position:fixed; top:50%; transform:translateY(-50%)`; horizontal anchor via CSS class hooks (T007). Chevron icon flips (inward=collapse/outward=expand). Register a **module-top-level** (once) `astro:page-load` listener that calls `initTocRail()` — label it inert (no ClientRouter today); do NOT register it inside `initTocRail`. Also call `initTocRail()` on module load.

### T007 — `src/styles/toc-rail.css` (the corrected CSS)
All layout rules inside `@media (min-width: 72rem)`, keyed on `html[data-toc-collapsed]`:
- `html[data-toc-collapsed] .right-sidebar-container { width: 1px; background: var(--sl-color-hairline) }` — the 1px hairline column (NOT 0).
- `html[data-toc-collapsed] .right-sidebar-panel { display: none }` — hide the outline (so axe skips off-screen links).
- **Recenter (must be ≥ (0,3,0))**: `html[data-toc-collapsed][data-has-sidebar][data-has-toc] .main-pane { width: 100%; --sl-content-margin-inline: auto }`. A weaker `html[data-toc-collapsed] .main-pane` (0,2,1) LOSES to Starlight's (0,3,0) and leaves dead right space — verified against compiled :where()-scoped CSS.
- Toggle button styling (any viewport, but hidden below 72rem): circular ~2rem, `border: 1px solid var(--sl-color-hairline)`, `box-shadow: var(--dk-shadow-sm)`, `background: var(--sl-color-bg-sidebar)`, soft icon color brightening on hover/focus, `:focus-visible` accent ring (`var(--dk-shadow-focus)`/accent). Horizontal anchor: `right` = a calc of the rail column width when expanded → `right: 0` when `html[data-toc-collapsed]`. `pointer-events: auto` on the button; the collapsed rail may be `pointer-events: none`.
- Below 72rem: the toggle is `display: none` (desktop-only). WebKit scrollbar hide: `.right-sidebar::-webkit-scrollbar { display: none }` (Starlight already sets scrollbar-width:none). NO `overflow: visible` on the expanded rail.

### T008 — tokens-only verify
Grep the sheet for hard-coded hex/rgb — must be ZERO (NFR-002); every colour/spacing via `--sl-*`/`--dk-*` (both light + dark inherit via the bridge in src/styles/theme.css).

## Definition of Done
- Toggle injects once (idempotent), accessible (aria-expanded, sr-only, Enter/Space, focus ring), fixed + vertically centered, stays clickable when collapsed.
- Collapsed: outline hidden, 1px hairline visible, main-pane full-width + recentered (the ≥(0,3,0) selector), no dead right space.
- Zero hard-coded hex; no `overflow:visible`; no Starlight component override.
- (Full visual verification happens after WP03 wires it into the build.)

## Reviewer guidance
Confirm the recenter selector specificity ≥ (0,3,0) (else recenter silently fails). Confirm the button is NOT inside the display:none panel. Grep for hard-coded hex. Confirm idempotency guard.

## Branch Strategy
Planning + merge target: `feat/collapsible-toc-rail`. Depends on WP01. Worktrees per lanes.json. Implement with `spec-kitty agent action implement WP02 --agent claude`.
