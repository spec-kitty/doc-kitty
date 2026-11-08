---
work_package_id: WP11
title: ADR, guide, architecture page, migration note, assert gate and changelog
dependencies:
- WP03
- WP04
- WP05
- WP06
- WP07
- WP08
- WP09
- WP10
- WP12
requirement_refs:
- C-002
- C-003
- C-008
- FR-024
- FR-025
- FR-026
- FR-027
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
subtasks:
- T050
- T051
- T052
- T053
- T054
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: curator-carla
authoritative_surface: docs/
create_intent:
- docs/architecture/openapi-pages.md
- docs/changelog/unreleased/257-openapi-agent-entries.md
- docs/changelog/unreleased/258-openapi-llms-operations.md
- docs/changelog/unreleased/259-openapi-version-switcher.md
- docs/changelog/unreleased/260-openapi-inputs.md
- docs/changelog/unreleased/285-openapi-unreleased-unindexed.md
execution_mode: planning_artifact
owned_files:
- docs/adr/*-openapi-surface-matrix.md
- docs/architecture/openapi-pages.md
- docs/guides/openapi-reference.md
- docs/migrations/0.6-to-0.7.md
- docs/changelog/unreleased/257-openapi-agent-entries.md
- docs/changelog/unreleased/258-openapi-llms-operations.md
- docs/changelog/unreleased/259-openapi-version-switcher.md
- docs/changelog/unreleased/260-openapi-inputs.md
- docs/changelog/unreleased/285-openapi-unreleased-unindexed.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP11 - ADR, guide, architecture page, migration note, assert gate and changelog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `curator-carla`, or run `spec-kitty agent profile show curator-carla`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Record decisions (incl. the owner-trusted model) and tell consumers what changed.

Requirements: FR-024, FR-025, FR-026, FR-027, C-002, C-003, C-008. Depends on: WP03, WP04, WP05, WP06, WP07, WP08, WP09, WP10, WP12.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T050: ADR

Pick the next free number at write time (check `main` and open PRs). Supersede ADR-0049 surface matrix and addendum: entry shape, per-surface decisions, input contract, trust model and dispositions (C-008, R14), deviations. ADR-0049 and index untouched.

### T051: Guide and architecture

Options, section 4, bundled-bytes note, offline cache, limits; `docs/architecture/openapi-pages.md`.

### T052: Migration note

Agent entries, unreleased sitemap/search change, opt-in keys.

### T053: Assert gate (sequential shared file)

`src/scripts/assert-openapi-artifacts.mjs` is owned by WP01 and recorded in the plan as a sequential shared file: WP08 keeps the mirror in step, and WP11, which depends on every other WP, extends the assertions last, so no lane races. Extend: entry count, sha256 equality, unreleased absent, llms lines when on.

### T054: Changelog fragments

Five fragments; 285 under Changed.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm validate:docs
pnpm validate:changelog && pnpm validate:adr-ids && pnpm validate:links
pnpm --filter example build && pnpm assert:openapi
```

## Acceptance checks

- [ ] ADR-0049 and index untouched; CHANGELOG.md untouched
- [ ] Gate fails if an entry is removed
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP11 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

ADR number race.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
