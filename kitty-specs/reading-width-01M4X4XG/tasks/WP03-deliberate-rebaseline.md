---
work_package_id: WP03
title: Deliberate rebaseline
dependencies:
- WP02
requirement_refs:
- FR-007
- C-005
- C-006
- NFR-001
planning_base_branch: issue-154-reading-width
merge_target_branch: issue-154-reading-width
branch_strategy: Planning artifacts for this mission were generated on issue-154-reading-width. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-154-reading-width unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
history:
- timestamp: '2026-10-14T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: tests/a11y/layout-geometry.spec.ts
create_intent: []
execution_mode: code_change
owned_files:
- tests/a11y/layout-geometry.spec.ts
- tests/a11y/__screenshots__/visual.spec.ts/**
role: implementer
tags: []
tracker_refs: []
---
# WP03 — Deliberate rebaseline

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Move the existing guards to the new layout on purpose: the reading-column
ratchet in `layout-geometry.spec.ts` and the two visual baselines. Nothing is
loosened (C-005); the 1px tolerance stays.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/reading-width-01M4X4XG/spec.md`, `plan.md` (Implementation Concern Map), `research.md` (R1-R4), `research/code-grounding.md` (files, invariants, gates, measurements), `data-model.md`, `contracts/layout-contract.md`, `quickstart.md`. Decisions: `decisions/DM-*.md` (52rem default; tables only, capped).
- **Stack**: Node 22, pnpm via corepack, TypeScript 5, Astro 5.18.2, Starlight 0.32.6, Playwright 1.62.1. Do not add, upgrade or remove a dependency.
- **Sibling dispatches**: do not touch `src/lib/gherkin/**`, `src/tests/gherkin-*`, `docs/guides/consumer-setup.md`, the `src/lib/config.ts` doc comment, or anything in `src/lib/theme.ts` beyond the width lines in `DEFAULT_TOKENS`.
- **Gates are never loosened** (C-005). A ratchet moves only with recorded evidence. No new size or length ratchet gate.
- **Playwright locally**: build first (`pnpm build:a11y`), then `pnpm exec playwright test <spec> --project=light`. If the pinned headless shell is missing, point Playwright at `/opt/pw-browsers` (a symlink to the preinstalled build is enough); never run `playwright install`.
- **Terminology**: "Mission" for the Spec Kitty work object. Docs convention on any `docs/` page touched: `title`, `description`, `doc_status`, `updated` (bump it).
- **Commits**: Conventional Commits subjects; every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifiers.

## Subtasks

### T013 — Column ratchet

**Steps**:
1. With WP02 built, run `layout-geometry.spec.ts` and record the column at 1152, 1280, 1600, 1920, 2560 (expected 528, 656, 832, 832, 832: below 84rem the pane limits it; from 1600px the token does).
2. Update `EXPANDED_MEASURE` and its doc comment: the column is now `--dk-width-content`, 52rem, 832px, from 1600px; name this Mission and issue 154 as the reason it moved.
3. A6 (`COLUMN_FLOOR = 720` from 1600px) stays as is: it is a floor, still met. Do not raise it into a new ratchet (C-005: no new size gate).
4. Add one line to the header evidence block noting that the measure moved with this Mission and the spec that guards the new behaviour (`reading-width.spec.ts`).

### T014 — Visual baselines

**Steps**: the `home` and `chrome-1920` baselines are taken on the home route; the column there changes from 1440px up and the header search box aligns to `--sl-content-width`. Regenerate them only in the pinned container (C-006): dispatch the `Update a11y baselines` workflow (`.github/workflows/update-a11y-baselines.yml`) with `target_branch` = this branch after it is pushed, then merge the branch it pushes (`ci/a11y-baselines-...`) into this branch. Do not commit locally rendered PNGs. If a sibling dispatch lands a baseline change on `main` first, merge `main` in and regenerate once; say so in the PR.

### T015 — Green

**Steps**: `layout-geometry.spec.ts` fully green locally; `visual.spec.ts` green in CI after the regenerated baselines merge. Record the counts.

## Definition of Done

- Ratchet values and their comment moved, with the reason; tolerance unchanged.
- Visual baselines regenerated in the pinned container and merged; a11y lane green.

## Risks

- Local screenshots differ from CI by fonts; never commit them.

## Reviewer guidance

Diff of `layout-geometry.spec.ts` should touch only the measure table, its comment and the evidence note. Image diff: column wider, nothing else moved except the header search alignment.

## Branch Strategy

Planning base branch and merge target: `issue-154-reading-width`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP03 --agent <name> --mission reading-width-01M4X4XG
```
