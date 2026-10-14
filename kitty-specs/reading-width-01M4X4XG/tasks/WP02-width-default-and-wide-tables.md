---
work_package_id: WP02
title: Width default and wide-table rule
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- NFR-002
- NFR-003
- NFR-004
- C-001
- C-002
- C-003
- C-004
planning_base_branch: issue-154-reading-width
merge_target_branch: issue-154-reading-width
branch_strategy: Planning artifacts for this mission were generated on issue-154-reading-width. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-154-reading-width unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
history:
- timestamp: '2026-10-14T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/styles/
create_intent: []
execution_mode: code_change
owned_files:
- src/styles/theme.css
- src/styles/dk-components.css
- src/lib/theme.ts
- src/scripts/assert-chrome-artifacts.mjs
- src/tests/layout-css-contract.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP02 — Width default and wide-table rule

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Make WP01's acceptance spec pass: default `--dk-width-content` 52rem, a new
`--dk-width-wide` token (80rem), and a CSS rule that lets direct-child tables
grow past the column into the reading pane from 72rem up.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/reading-width-01M4X4XG/spec.md`, `plan.md` (Implementation Concern Map), `research.md` (R1-R4), `research/code-grounding.md` (files, invariants, gates, measurements), `data-model.md`, `contracts/layout-contract.md`, `quickstart.md`. Decisions: `decisions/DM-*.md` (52rem default; tables only, capped).
- **Stack**: Node 22, pnpm via corepack, TypeScript 5, Astro 5.18.2, Starlight 0.32.6, Playwright 1.62.1. Do not add, upgrade or remove a dependency.
- **Sibling dispatches**: do not touch `src/lib/gherkin/**`, `src/tests/gherkin-*`, `docs/guides/consumer-setup.md`, the `src/lib/config.ts` doc comment, or anything in `src/lib/theme.ts` beyond the width lines in `DEFAULT_TOKENS`.
- **Gates are never loosened** (C-005). A ratchet moves only with recorded evidence. No new size or length ratchet gate.
- **Playwright locally**: build first (`pnpm build:a11y`), then `pnpm exec playwright test <spec> --project=light`. If the pinned headless shell is missing, point Playwright at `/opt/pw-browsers` (a symlink to the preinstalled build is enough); never run `playwright install`.
- **Terminology**: "Mission" for the Spec Kitty work object. Docs convention on any `docs/` page touched: `title`, `description`, `doc_status`, `updated` (bump it).
- **Commits**: Conventional Commits subjects; every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifiers.

## Subtasks

### T007 — Token sheet

**Steps**: in `src/styles/theme.css` `:root`, Layout widths block: `--dk-width-content: 52rem;` and a new `--dk-width-wide: 80rem;` with a one-line comment (caps how wide a table may grow past the reading column; at or below the column width, tables stay in the column). Do not move the `--sl-content-width` bridge.

### T008 — Theme catalog

**Steps**: in `src/lib/theme.ts` `DEFAULT_TOKENS`, the same two values (`'--dk-width-content': '52rem'`, `'--dk-width-wide': '80rem'` after it, with a short comment). Touch nothing else in the file (C-004; #114 owns `resolveTheme`). If `resolveTheme` lists tokens elsewhere (bridges), the wide token needs no `--sl-*` bridge.

### T009 — Wide-table rule

**Steps**: in `src/styles/dk-components.css`, after the frame/rail geometry block, a new commented section "Wide tables" inside `@media (min-width: 72rem)`:

```css
.content-panel {
  container-type: inline-size;
}

.sl-markdown-content > table:not(:where(.not-content *)) {
  width: max-content;
  min-width: 100%;
  max-width: min(100cqi, var(--dk-width-wide));
  position: relative;
  inset-inline-start: 50%;
  translate: -50%;
}

.sl-markdown-content > table:not(:where(.not-content *)):dir(rtl) {
  translate: 50%;
}
```

The comment must explain (research R2/R3): `100cqi` is the panel's content box, i.e. the pane without the rail; `min-width: 100%` keeps a narrow table where it was and lets the token switch growth off (min beats max); the offset and translate centre the box on the column, which is centred in the pane from 72rem; `translate` is physical, so right-to-left needs `:dir(rtl)` (not `html[dir]`, because Starlight puts `dir` on `<main>`); the container adds layout containment, harmless here (positioned descendants in the panel are visually-hidden spans; the glossary popover lives on `<body>`). Starlight sets neither `width` nor `max-width` on tables, so nothing competes; its `display: block` and `overflow: auto` stay in force, so a table that is wider than the cap still scrolls inside it.

Logical properties only, except `translate`, which has no logical form (C-002); the contract test's physical-property sweep does not cover these selectors, so state it in the comment.

### T010 — Token presence check

**Steps**: add `'--dk-width-wide'` after `'--dk-width-frame'` in the token list of `src/scripts/assert-chrome-artifacts.mjs`. Run it against a fresh build.

### T011 — Contract test

**Steps**: in `src/tests/layout-css-contract.test.ts`, extend the "theme.css and the Default catalog agree" describe with the same check for `--dk-width-content` (`52rem`) and `--dk-width-wide` (`80rem`): `theme.css :root` declares it and `resolveTheme(undefined).tokens` agrees. Also assert the wide-table rule lives in `dk-components.css` and not in `theme.css` (C-001). Do not touch the "finds all eight geometry rules" count unless your rules match its selector filter (they should not).

### T012 — Green

**Steps**: `pnpm build:a11y`; WP01's spec all green; `layout-geometry.spec.ts` green except the `EXPANDED_MEASURE` ratchet rows (1600/1920/2560 now 832, WP03 moves them; record the exact red rows); `axe`, `toc-rail.interaction`, `gherkin`, `markua` specs green; `pnpm test`, `pnpm lint`, `pnpm typecheck`, `node src/scripts/assert-chrome-artifacts.mjs example/dist`. Revert T009 locally and show WP01's growth cases red again; restore.

## Definition of Done

- WP01 spec green; only the known ratchet rows and visual baselines red, recorded.
- Both declarations agree; the contract test covers it.
- Axe and no-scroll specs green.

## Risks

- `container-type` changes the containing block for positioned descendants in `.content-panel`. Grep the rendered example for positioned elements inside it; report anything beyond visually-hidden spans.
- Gherkin Examples tables are direct children on feature pages: check a narrow one renders unchanged (`gherkin.spec.ts`).

## Reviewer guidance

Check the rule is inside the 72rem media query, uses `:dir(rtl)`, and that nothing selects `.main-pane`. Check `theme.ts` diff is two lines.

## Branch Strategy

Planning base branch and merge target: `issue-154-reading-width`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP02 --agent <name> --mission reading-width-01M4X4XG
```
