---
work_package_id: WP03
title: Multi-width geometry guard and baselines
dependencies:
- WP01
- WP02
requirement_refs:
- FR-028
- NFR-001
- NFR-003
- C-005
- SC-001
- SC-002
- SC-003
- SC-007
planning_base_branch: fix/sidebar-frame-header-carrier
merge_target_branch: fix/sidebar-frame-header-carrier
branch_strategy: Planning artifacts for this mission were generated on fix/sidebar-frame-header-carrier. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/sidebar-frame-header-carrier unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-sidebar-frame-header-carrier-01M4T3CB
base_commit: 722ef9631afb810fd2247679ebcc36da9b080ee7
created_at: '2026-10-13T08:29:25.257288+00:00'
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
history: []
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/layout-geometry.spec.ts
- tests/a11y/helpers/geometry.ts
execution_mode: code_change
owned_files:
- tests/a11y/layout-geometry.spec.ts
- tests/a11y/helpers/geometry.ts
- playwright.config.ts
- tests/a11y/__screenshots__/**
- tests/a11y/visual.spec.ts
role: implementer
tags: []
tracker_refs: []
---

# WP03 — Multi-width geometry guard and baselines

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`frontend-freddy`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Add numeric layout assertions at 1152, 1280, 1600, 1920 and 2560px that fail on the pre-mission layout and pass on the delivered one, then regenerate the baselines that moved.

Requirements: FR-028, NFR-001, NFR-003, C-005; supports SC-001, SC-002, SC-003, SC-007. Research: R10.

## Shared context

- **Mission documents** (read before coding): `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Astro ^5.2, @astrojs/starlight ^0.32.6. Do not upgrade either, and do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Starlight 0.32 has no cascade layers.** An override wins only on specificity or load order. doc-kitty sheets load after Starlight's.
- **Vocabulary**: tokens use the `--dk-*` namespace. Quote measurements from this repository's builds and tests.
- **Commands** (repository root): `pnpm test` (Vitest), `pnpm build` (example site), `pnpm test:a11y` (Playwright), `pnpm lint`, `pnpm typecheck`, `pnpm validate`. If a stale build cache gives odd results, run `pnpm clean` first.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only when this prompt names it; record it in your hand-off with one line of rationale.
- **Comments**: match the surrounding files, which explain *why* a rule exists and which requirement it serves.

## Why

The existing guard (`tests/a11y/toc-rail.interaction.spec.ts`, `playwright.config.ts`) runs at 1280px only, where the toggle error was about 8px. Every defect this mission fixes was invisible to it.

Read `playwright.config.ts`, `tests/a11y/routes.ts`, `tests/a11y/mode.ts` and `tests/a11y/toc-rail.interaction.spec.ts` first, and follow their conventions (base URL handling, light/dark projects, how the built site is served by `serve-dist.mjs`).

## Subtask T012 — Geometry measurement helper

Create `tests/a11y/helpers/geometry.ts` exporting a function that, given a Playwright `Page`, returns bounding boxes (x, width, right edge) for: viewport, `.main-frame`, the left sidebar's fixed element, the reading column (the article content box, e.g. `.sl-markdown-content` or `main .content-panel`'s inner container — pick the element whose width is the text measure and document the choice), the rail (`.right-sidebar`), the rail container, the toggle (`.dk-toc-toggle`), the header's first and last content items, and `document.documentElement.scrollWidth`.

Use one `page.evaluate` so all numbers come from the same frame. Return plain numbers rounded to 0.01.

## Subtask T013 — Five-width assertions, expanded and collapsed

Create `tests/a11y/layout-geometry.spec.ts`. Use `test.describe` with a loop over `[1152, 1280, 1600, 1920, 2560]`, setting the viewport per test (`page.setViewportSize({ width, height: 900 })`). Pick one route that has both a left sidebar and a rail with several entries (a long reference or guide page from `routes.ts`).

For each width, expanded (tolerance 1px, NFR-001):
1. frame width = viewport width;
2. sidebar start edge = frame start edge;
3. rail end edge = frame end edge;
4. rail width = the sidebar-width token in pixels (read it with `getComputedStyle`);
5. toggle edge = rail inner edge; the toggle's box does not intersect the reading column's box;
6. reading column width ≥ 720 at 1600, 1920, 2560 (NFR-002);
7. header: first content item starts at frame start + nav padding; last ends at frame end − nav padding.

Across widths: reading column width is non-decreasing from 1280 to 2560 (FR-006). Collect widths in one test and compare.

Collapsed (click the toggle, wait for the attribute):
8. rail container width = 1px and its position = frame end edge;
9. toggle edge = that same position;
10. reading column is centred in the space between sidebar and frame end (left and right gaps equal within 1px).

Run only in one colour-scheme project if geometry is identical in both (say so in a comment), to keep the suite fast.

## Subtask T014 — Capped, invalid-token and right-to-left variants

Inject styles with `page.addStyleTag` before measuring:

- **Capped** `:root { --dk-width-frame: 90rem }` at 1920 and 2560: frame width = 1440; frame centred; assertions 2, 3, 5, 7, 8, 9 hold relative to the frame, not the viewport. Also `80%` to cover a percentage cap.
- **Invalid** `:root { --dk-width-frame: banana }` at 1920: every number equals the default run at 1920 (compare objects).
- **Right-to-left**: set `dir="rtl"` on `<html>` (or use a right-to-left fixture route if the example has one) at 1280 and 1920: sidebar at the right, rail at the left, toggle on the rail's inner edge; mirror of the left-to-right numbers within 1px.

## Subtask T015 — No-horizontal-scroll check at eight widths

For 390, 768, 1024, 1152, 1280, 1600, 1920, 2560 and four or five varied routes (landing, hub, long page, glossary, persona): `scrollWidth === clientWidth` (NFR-003). Below the desktop breakpoint also assert the toggle is not visible.

## Subtask T016 — Fail-first evidence against the pre-mission layout

SC-007 requires proof that the guard is not vacuous.

**Steps**:
1. Build the example from the commit this mission branched from (`git worktree add <scratch> origin/main`, build there with a separate output directory, or check out only `src/styles` and `src/lib/toc-rail` from `origin/main` into a scratch copy). Do not disturb the lane worktree.
2. Point the new spec at that build (the spec's base URL comes from the config; serve the old `dist` on the same port or pass the URL by environment variable).
3. Record which assertions fail and with what numbers. Expected: 1, 2, 5, 6 at 1600 and up; 5 at 1152 and 1280; tab-order checks belong to WP02's spec.
4. Put the failing output summary in your hand-off and in a comment block at the top of the spec ("verified red against <sha> on <date>: …"). Any assertion that passes on the old layout is not earning its place: tighten it or delete it, except the ones documented as ratchets.

## Subtask T017 — Regenerate moved baselines deliberately

**Steps**:
1. Run the whole Playwright suite and list every screenshot and pinned a11y baseline that differs.
2. For each, state why it moved (frame width, rail position, toggle position, TOC re-enabled on the demonstrator, header inset). An unexplained difference is a bug to chase, not a baseline to update (C-005).
3. Baselines must be generated in the project's pinned container, not on a workstation. Read `.github/workflows/update-a11y-baselines.yml` and the project notes in `tests/a11y` for the supported way; if it can only run in CI, prepare everything, state exactly which workflow run is needed, and leave the regeneration as the one open step in your hand-off.
4. Add a wide-viewport visual baseline in `tests/a11y/visual.spec.ts` (1920, a page with sidebar and rail) cropped to the header and both rails so it discriminates layout rather than content.

## Verification

`pnpm clean && pnpm build && pnpm test:a11y -- layout-geometry` green locally (geometry assertions do not depend on baselines). Full suite status reported honestly, including which baseline diffs await container regeneration.

## Branch Strategy

- Planning branch: `fix/sidebar-frame-header-carrier`. Final merge target for this mission: `fix/sidebar-frame-header-carrier` (a draft pull request to `main` follows; the owner merges).
- Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.
- Start with: `spec-kitty agent action implement WP03 --agent <name> --mission sidebar-frame-header-carrier-01M4T3CB`

## Definition of Done

- `tests/a11y/layout-geometry.spec.ts` and the helper exist and pass on this branch at all five widths, both states, capped, invalid and right-to-left.
- The no-horizontal-scroll check passes at eight widths.
- Fail-first evidence is recorded: which assertions were red against the pre-mission build, with numbers.
- Every moved baseline has a stated cause; regeneration done in the container or the exact remaining step is named.
- A discriminating wide-viewport visual baseline exists.

## Risks

- **Flakiness**: wait for fonts and for the toggle to mount before measuring; use `expect.poll`/`toPass` for the collapsed transition, as the project already does elsewhere.
- **Suite duration**: five widths × states × variants. Keep to one route for the full matrix and a handful for the scroll check.
- **Baselines** generated outside the container will fail in CI.

## Reviewer Guidance

- Read the fail-first evidence: at least assertions 1, 2, 5 and 6 must have been red on the old layout.
- Check tolerances are 1px, not loosened to make something pass.
- Check no baseline was regenerated without a stated cause.
