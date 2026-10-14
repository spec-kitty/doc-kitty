---
work_package_id: WP01
title: Acceptance spec and wide-table fixture (red first)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- NFR-001
- NFR-002
- SC-001
- SC-002
- SC-003
planning_base_branch: issue-154-reading-width
merge_target_branch: issue-154-reading-width
branch_strategy: Planning artifacts for this mission were generated on issue-154-reading-width. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-154-reading-width unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- timestamp: '2026-10-14T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: tests/a11y/reading-width.spec.ts
create_intent:
- tests/a11y/reading-width.spec.ts
execution_mode: code_change
owned_files:
- tests/a11y/reading-width.spec.ts
- tests/a11y/routes.ts
- example/docs/architecture/overview.md
role: implementer
tags: []
tracker_refs: []
---
# WP01 — Acceptance spec and wide-table fixture (red first)

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Write the acceptance test for issue #154 before any CSS changes: a Playwright
layout spec that measures the reading column and a real wide table at the
widths the spec names, and fails on today's layout where the mission changes
behaviour. Commit it red (the ATDD doctrine of this mission). The cases that
pin unchanged behaviour (narrow tables, small screens, no horizontal scroll)
pass today and are the positive controls.

## Why it fails today

`--dk-width-content` is 45rem, so the column is 720px at 1440px and 1920px.
Starlight renders `.sl-markdown-content table` as `display: block; overflow:
auto` inside the column, so a table with prose cells is exactly as wide as the
column and its cells wrap into narrow strips.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/reading-width-01M4X4XG/spec.md`, `plan.md` (Implementation Concern Map), `research.md` (R1-R4), `research/code-grounding.md` (files, invariants, gates, measurements), `data-model.md`, `contracts/layout-contract.md`, `quickstart.md`. Decisions: `decisions/DM-*.md` (52rem default; tables only, capped).
- **Stack**: Node 22, pnpm via corepack, TypeScript 5, Astro 5.18.2, Starlight 0.32.6, Playwright 1.62.1. Do not add, upgrade or remove a dependency.
- **Sibling dispatches**: do not touch `src/lib/gherkin/**`, `src/tests/gherkin-*`, `docs/guides/consumer-setup.md`, the `src/lib/config.ts` doc comment, or anything in `src/lib/theme.ts` beyond the width lines in `DEFAULT_TOKENS`.
- **Gates are never loosened** (C-005). A ratchet moves only with recorded evidence. No new size or length ratchet gate.
- **Playwright locally**: build first (`pnpm build:a11y`), then `pnpm exec playwright test <spec> --project=light`. If the pinned headless shell is missing, point Playwright at `/opt/pw-browsers` (a symlink to the preinstalled build is enough); never run `playwright install`.
- **Terminology**: "Mission" for the Spec Kitty work object. Docs convention on any `docs/` page touched: `title`, `description`, `doc_status`, `updated` (bump it).
- **Commits**: Conventional Commits subjects; every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifiers.

## Subtasks

### T001 — Wide-table fixture in the example overview page

**Purpose**: a realistic table, in the example site, that is wider than the column at the default width and wraps (does not scroll) when it has no room.

**Steps**:
1. In `example/docs/architecture/overview.md`, add a section `## Generated surfaces` after "Key properties": one sentence of lead-in, then a five-column Markdown table (Surface, Path, Built from, Read by, When it changes) with one row each for the static site, `sitemap.xml`, `rss.xml`, `llms.txt`, the agent API. Cells are short prose (6-14 words), so the natural width is well over 832px and the table wraps instead of scrolling.
2. Bump `updated` to `2026-10-14`. Keep every other frontmatter field.
3. Content must be true to the example (paths under the site base, the build reads the `docs/` tree). No inline HTML.

**Validation**: `pnpm validate:example`; the page builds; the table is a direct child of `.sl-markdown-content` in `example/dist/architecture/overview/index.html`.

### T002 — Route constant

**Steps**: add `overview: \`${BASE}/architecture/overview/\`` to `ROUTES` in `tests/a11y/routes.ts` with a comment that it carries the wide-table fixture of this Mission. Do not add it to `AXE_PAGES` (axe coverage is unchanged; the table has no scroll region).

### T003 — Column width cases (FR-001, SC-001)

**Steps**: new file `tests/a11y/reading-width.spec.ts`, `light` project only (geometry is mode-independent, as in `layout-geometry.spec.ts`). Reuse `measure`, `settle`, `inline` from `tests/a11y/helpers/geometry.ts` and `TOC_RAIL_ROUTE` / `TOC_RAIL_TOGGLE` from `routes.ts`. Tolerance 1px (NFR-001).

Cases on the home route (sidebar and rail, expanded):
- 1440px: column width = reading-pane content width (pane width minus its two inline paddings; read the paddings from `.content-panel` computed style). Today 720 vs 816.
- 1920px: column width = 832px and the column is centred in the pane content box. Today 720.
- 1920px with `:root { --dk-width-content: 45rem }` injected: column = 720px (the documented restore line, SC-004).

Note: `measure().column` is `.sl-markdown-content`'s closest `.sl-container`. Do not use `document.querySelector('.sl-container')`: the rail also renders one.

### T004 — Wide-table cases (FR-002, FR-003, FR-004, SC-002)

**Steps**: a helper that loads `ROUTES.overview` at a width (optionally collapsed via the `dk-toc-collapsed` localStorage key, optional injected CSS, optional RTL), settles, and returns: the wide table's inline box, the column's, the pane content box (from the `.content-panel` that contains the table), the rail container, document `scrollWidth` vs `clientWidth`.

Right-to-left: set `dir="rtl"` on `<html>` **and** `<main>`. Starlight renders `<main dir="ltr">` from the page language, so setting it on `<html>` alone leaves the article left-to-right (research R2).

Cases:
- 1920 expanded LTR, 1920 collapsed LTR, 1920 expanded RTL, 1920 expanded under `--dk-width-frame: 90rem`: table width ≥ column width + 100 (SC-002); |table centre − column centre| ≤ 1; table start ≥ pane start − 1 and end ≤ pane end + 1; collapsed: table end ≤ rail hairline start + 1; scroll width = viewport.
- 2560 collapsed: table width ≤ the resolved `--dk-width-wide` length + 1 (resolve the token with a probe element, like `measure()` does; if the token does not exist yet the probe gives 0 and the case fails, which is the intended red).
- Opt-out: 1920 expanded with `:root { --dk-width-wide: 0 }`: table box = column box.

### T005 — Unchanged cases (FR-005, FR-006, SC-003, NFR-002)

**Steps**:
- 390, 768, 1024px: table box = column box (width and start within 1px); scroll width = viewport.
- Narrow table: inject a two-cell table into `.sl-markdown-content` (with `page.evaluate`, before settle) at 1920px; its start = column start and its width = column width.

### T006 — Red evidence

**Steps**: `pnpm build:a11y`, then run the spec. Record per test pass/fail in the hand-off: the T003 and T004 growth cases and the 2560 cap must be red with the measured numbers; T005 and the opt-out must be green. Commit with subject `test(a11y): reading width and wide tables, red before the fix`.

## Test strategy

This work package is the test. Each failing assertion message carries measured and expected pixels, as `layout-geometry.spec.ts` does. No screenshots.

## Definition of Done

- Fixture page validates and builds; the table wraps and is a direct child of the page body.
- Spec loads and type-checks under Playwright's TypeScript loader; `pnpm lint` stays green.
- Red/green split recorded exactly as T006 says, committed.

## Risks

- A fixture that scrolls would add an axe `scrollable-region-focusable` finding if ever scanned; keep cells as prose.
- Do not assert exact pane numbers from the research; derive them from the page so a padding change elsewhere does not break the spec for the wrong reason.

## Reviewer guidance

Check that every growth assertion is red on the commit that adds the spec, and that the unchanged cases are green on it. Check the RTL setup touches `<main>`.

## Branch Strategy

Planning base branch and merge target: `issue-154-reading-width`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP01 --agent <name> --mission reading-width-01M4X4XG
```
