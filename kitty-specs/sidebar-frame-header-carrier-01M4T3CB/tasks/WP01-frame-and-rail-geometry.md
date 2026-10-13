---
work_package_id: WP01
title: Frame, sidebar, header and rail geometry
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-012
- NFR-002
- C-001
- C-002
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history: []
agent_profile: frontend-freddy
authoritative_surface: src/styles/
create_intent:
- src/tests/layout-css-contract.test.ts
execution_mode: code_change
owned_files:
- src/styles/dk-components.css
- src/styles/theme.css
- src/lib/theme.ts
- src/tests/layout-css-contract.test.ts
- src/scripts/assert-chrome-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

# WP01 — Frame, sidebar, header and rail geometry

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`frontend-freddy`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Make the page frame full-width by default, give consumers one public token to cap it, and keep the left sidebar, the header content and the "On this page" rail attached to the frame at every desktop width.

Requirements: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-012, NFR-002, C-001, C-002. Research: R1, R2, R3.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## Why this is broken today

`src/styles/dk-components.css` ends with:

```css
@media (min-width: 100rem) {
  .main-frame { max-width: 90rem; margin-inline: auto; }
}
```

Measured on the published site:

| Viewport | Frame width | Reading column | Gap between sidebar and content |
|---|---|---|---|
| 1599px | full | 720px | 0 |
| 1600px | 1056px (intended 1440px) | 552px | 272px |
| 1920px | 1056px | 552px | 432px |
| 2560px | 1056px | 552px | 752px |

Two mechanisms:

1. `.page` is a column flex container. `margin-inline: auto` on a flex item suppresses the default stretch, so `.main-frame` shrink-wraps instead of filling its cap.
2. The left sidebar (`#starlight__sidebar` inside `.sidebar-pane`) and `header.header` are `position: fixed; inset-inline-start: 0`. They stay at the viewport edge while the frame centres.

A third mechanism feeds WP02: Starlight 0.32 sizes the rail column as `sidebar + (100% - content - sidebar) / 2`, so the rail's inner edge is at the sidebar-width offset from the viewport edge at exactly one viewport width.

## Subtask T001 — Add `--dk-width-frame` to `theme.css` and `DEFAULT_BASE`

**Purpose**: introduce the public token with its default.

**Steps**:
1. In `src/styles/theme.css`, next to the existing `--dk-width-*` tokens, add `--dk-width-frame: 100%;` with a comment saying it caps the page frame and that the default is full-width.
2. In `src/lib/theme.ts`, add the same token and value to `DEFAULT_BASE`, in the same position relative to its neighbours as in `theme.css`.
3. Read the existing theme tests (`src/tests/theme-merge.test.ts`) to see how parity between the sheet and `DEFAULT_BASE` is asserted; if a test enumerates tokens, it must keep passing with the new one.

**Files**: `src/styles/theme.css`, `src/lib/theme.ts`.

**Validation**: `pnpm test` — theme tests green.

## Subtask T002 — Register the token and replace the frame rule

**Purpose**: fix the shrink-wrap and make an invalid value harmless.

**Steps**:
1. In `src/styles/dk-components.css` (the sheet that survives a brand swap), add at top level:
   ```css
   @property --dk-width-frame {
     syntax: '<length-percentage>';
     inherits: true;
     initial-value: 100%;
   }
   ```
   A registered property with an invalid value computes to its initial value instead of making the declaration that uses it invalid. That is FR-003.
2. Replace the `@media (min-width: 100rem)` block with a rule at the desktop breakpoint Starlight uses for the sidebar (`50rem`; confirm against Starlight's `TwoColumnContent`/`Page` styles in `node_modules`):
   ```css
   .main-frame {
     width: 100%;
     max-width: var(--dk-width-frame);
     margin-inline: auto;
   }
   ```
3. Rewrite the long comment above the old block. The parts about "byte-unchanged below 100rem" and "header investigated, NOT capped" are no longer true; say what the rule does now, that the earlier constraint is withdrawn (FR-030, recorded in ADR-0045 by WP07), and why `width: 100%` is needed.

**Edge cases**: `--dk-width-frame: 0` is a valid length and would collapse the frame; that is the consumer's choice and needs no guard. `--dk-width-frame: banana` must behave as 100%.

## Subtask T003 — Frame gutter; sidebar and header follow the frame

**Purpose**: when a consumer caps the frame, the fixed elements move with it. With the default nothing moves.

**Steps**:
1. Define on `:root`, inside the same desktop media query:
   ```css
   --dk-frame-gutter: max(0px, (100vw - var(--dk-width-frame)) / 2);
   ```
   Verify the three value kinds a consumer can supply: `100%` must give 0 (a percentage inside this `calc` resolves against the containing block of whatever uses the property, so check what the browser actually computes; if `100%` does not yield 0 reliably, compute the gutter where the percentage base is the viewport, or derive it from a wrapper's width instead of `100vw`). Record what you found in the comment.
2. Offset the left sidebar: `#starlight__sidebar` (check the exact fixed element and its selector in Starlight 0.32's `Page.astro` / `Sidebar` styles) gets `inset-inline-start: var(--dk-frame-gutter)`.
3. Keep the header bar full-bleed (background and border across the viewport) and inset its content:
   ```css
   html[data-has-sidebar] header.header {
     padding-inline: calc(var(--sl-nav-pad-x) + var(--dk-frame-gutter));
   }
   ```
   Plain `header.header` is (0,1,1) and loses to Starlight's `[data-has-sidebar] .header` (0,2,0) on the end side; the selector above is (0,2,2). Also cover pages without a left sidebar (`html:not([data-has-sidebar]) header.header`).
4. Scrollbar width: `100vw` includes the scrollbar. Check at a capped width that the sidebar edge and the frame edge agree to within 1px with a visible scrollbar; if not, switch the base to `100%` of a full-width ancestor.

**Files**: `src/styles/dk-components.css`.

## Subtask T004 — Pin the rail column to a definite width

**Purpose**: give the rail a width that does not depend on the viewport, so the reading column and the toggle have a stable edge.

**Steps**:
1. At the breakpoint where Starlight shows the right sidebar (`72rem`), set the rail container and the fixed rail to the sidebar-width token:
   ```css
   html[data-has-toc] .right-sidebar-container,
   html[data-has-toc] .right-sidebar {
     width: var(--sl-sidebar-width);
   }
   ```
2. Size the main pane as the remainder and centre its content, with a selector that beats Starlight's `[data-has-sidebar][data-has-toc] .main-pane` (0,3,0):
   ```css
   html[data-has-sidebar][data-has-toc] .main-pane {
     width: calc(100% - var(--sl-sidebar-width));
     --sl-content-margin-inline: auto;
   }
   ```
   This is (0,3,1). Add the equivalent for a TOC page without a left sidebar.
3. The collapsed-state rules in `src/styles/toc-rail.css` (owned by WP02) use a (0,4,1) selector and must still win. Do not edit that file; confirm by inspection that your selectors stay below (0,4,1).
4. Offset the fixed rail from the frame's end edge by the gutter: `inset-inline-end: var(--dk-frame-gutter)` on `.right-sidebar`.
5. Check FR-006 by reasoning and by measurement: with the frame at 100%, reading column width = viewport − sidebar − rail, capped by Starlight's content width. It must not decrease from 1280 to 2560.

**Files**: `src/styles/dk-components.css`.

## Subtask T005 — CSS-contract unit test

**Purpose**: a fast guard that does not need a browser.

**Steps**: create `src/tests/layout-css-contract.test.ts` (Vitest; follow the style of `src/tests/toc-rail-build-html.test.ts` and the theme tests). Read the two sheets as text and assert:
1. `dk-components.css` contains an `@property --dk-width-frame` registration with `initial-value: 100%`.
2. The `.main-frame` rule has `width: 100%`, `max-width: var(--dk-width-frame)` and `margin-inline: auto`, and sits inside a `min-width` media query.
3. No `max-width: 90rem` and no `min-width: 100rem` query remain in the sheet.
4. The rail-pin rules and the gutter rules live in `dk-components.css`, not in a theme sheet (they must survive a brand swap).
5. `theme.css` and `DEFAULT_BASE` agree on the token's name and default.
6. No physical `left`/`right`/`margin-left`/`padding-right` properties appear in the rules this work package adds (right-to-left parity, FR-012).

Each assertion must fail if the rule it checks is removed; verify that by temporarily deleting the rule.

## Subtask T006 — Align the chrome-artifact gate and comments

**Purpose**: `src/scripts/assert-chrome-artifacts.mjs` mentions `--dk-width` tokens. Read it; if it enumerates expected tokens or expected CSS in the built output, add the new token so the gate keeps describing reality. If it needs no change, say so in your hand-off and leave the file alone.

## Verification for the whole package

1. `pnpm test`, `pnpm lint`, `pnpm typecheck`.
2. `pnpm clean && pnpm build`, then serve `example/dist` and measure with a short throwaway Playwright or browser-console script at 1152, 1280, 1600, 1920 and 2560: frame width equals viewport; sidebar left edge 0; rail right edge equals viewport width; reading column at least 720px at 1600 and up.
3. Repeat with `:root { --dk-width-frame: 90rem }` injected: frame 1440px and centred at 1920; sidebar left edge equals frame left edge; header content inset by the same amount.
4. Repeat with `--dk-width-frame: banana`: identical to the default.
5. Put the measurements in your hand-off. WP03 turns them into a permanent guard.

Expect `tests/a11y` visual baselines to differ. Do not regenerate them here; WP03 owns that.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP01 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- The four CSS changes are in `dk-components.css`; the token is in `theme.css` and `DEFAULT_BASE`.
- `src/tests/layout-css-contract.test.ts` exists, passes, and each assertion was shown to fail when its rule is removed.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` pass.
- Hand-off lists measured frame, sidebar, rail and reading-column geometry at the five widths for default, capped and invalid values.
- No dependency changed; no file outside `owned_files` edited without a recorded reason.

## Risks

- **Specificity**: a rule that ties with Starlight's wins only by load order. Prefer a strictly higher specificity and say which Starlight rule you are beating.
- **Percent inside the gutter calc**: see T003 step 1. This is the most likely place for a subtle error.
- **Scrollbar width** in `100vw`.
- **Persona and other layouts** (`src/layouts/Persona.astro`) use `--dk-width-*` tokens; check one persona page still renders correctly.

## Reviewer Guidance

- Confirm the old `100rem` block and its stale comment are gone.
- Confirm no physical directional properties were added.
- Ask for the measurement table; spot-check 1920 default and 1920 capped in a browser.
- Confirm the contract test fails when a rule is removed (mutation check), not only that it passes.
