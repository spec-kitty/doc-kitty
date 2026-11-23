---
work_package_id: WP04
title: Proof on built output
dependencies:
- WP03
requirement_refs:
- NFR-001
- NFR-004
- NFR-005
- SC-001
- SC-002
- SC-003
- SC-004
planning_base_branch: feat/341-sidebar-child-cap
merge_target_branch: feat/341-sidebar-child-cap
branch_strategy: Planning artifacts for this mission were generated on feat/341-sidebar-child-cap. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/341-sidebar-child-cap unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-large-hubs-sidebar-child-cap-01M81KGV
base_commit: 8eefa05b5d000ef4847c8a7998bc0e7fe5ef4dcd
created_at: '2026-11-23T09:04:14.340196+00:00'
subtasks:
- T016
- T017
- T018
- T019
- T020
history:
- timestamp: '2026-11-23T00:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/tests/sidebar-child-cap-build.test.ts
create_intent:
- src/tests/sidebar-child-cap-build.test.ts
- src/tests/fixtures/large-hub/measure.mjs
- src/tests/fixtures/large-hub/site.mjs
- src/tests/fixtures/large-hub/golden/uncapped.json
- example/docs/guides/capped-hub/README.md
- tests/a11y/sidebar-child-cap.spec.ts
execution_mode: code_change
owned_files:
- src/tests/sidebar-child-cap-build.test.ts
- src/tests/fixtures/large-hub/**
- example/docs/guides/capped-hub/**
- tests/a11y/sidebar-child-cap.spec.ts
- .gitignore
role: implementer
tags: []
tracker_refs: []
---
# WP04 — Proof on built output

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Prove the spec on built HTML and in a browser, and measure the cost. Requirements: NFR-001..NFR-005, SC-001..SC-004. Plan: IC-04. Research: R7.

## Shared context

- Mission documents: `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/cap-api.md`, `decisions/`.
- Stack: Node 22+, TypeScript 5 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42. Add, upgrade or remove no dependency.
- Red first: write each test, run it, see it fail for the right reason, then implement.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` clean with no suppressions.
- Branch strategy: planning base and merge target `feat/341-sidebar-child-cap`; the lane worktree comes from `lanes.json`.
- Implement with `spec-kitty agent action implement <WP> --agent claude --mission large-hubs-sidebar-child-cap-01M81KGV`.

## Subtasks

### T016 — Goldens on the base commit

`src/tests/fixtures/large-hub/site.mjs` writes a fixture site (the `exclude-folders-build.test.ts` pattern, under `example/.dk-test-sidebar-cap*`, git-ignored) from parameters: hub size, caps, hidden hint. Build the uncapped variant (one 10-child hub plus a sibling section) with the toolkit at the mission base commit (a temporary `git worktree`), and commit `golden/uncapped.json`: route → sha256 of each built page, with `CAPTURED_ON` the base commit id.

### T017 — Build suite

`src/tests/sidebar-child-cap-build.test.ts`:
- 200-child hub, default cap: on every built page, the hub's sidebar group has exactly 2 links; total sidebar links ≤ cap + 2 inside the group (NFR-001).
- Each child page: the capped entry is the only `aria-current="page"` in the sidebar; the hub page: the index link is.
- prev/next on three children match the hub listing order read from the built hub page.
- Hidden variant (every child `sidebar: { hidden: true }`): each page's sidebar `<nav>` HTML and pagination equal the non-hidden build's.
- Uncapped variant: page hashes equal `golden/uncapped.json`.
- Determinism: two builds of the capped site are byte-identical (hash of all pages).

### T018 — Example hub

`example/docs/guides/capped-hub/`: `README.md` (`kind: Hub`, `sidebar_child_cap: 3`) and five short children explaining the feature. Fix any existing example test that counts guides pages (record the out-of-map edit).

### T019 — Browser proof

`tests/a11y/sidebar-child-cap.spec.ts`: on a capped child, one `aria-current` sidebar entry, it is the capped entry, its group is open, axe passes; on the hub page, the index link is current; keyboard tab reaches the capped entry. Add the routes to `tests/a11y/routes.ts` if the axe sweep lists routes.

### T020 — Measurement

`src/tests/fixtures/large-hub/measure.mjs`: build a 1,000-child site with the default cap and with `childCap: 5000`, three runs each; print median build seconds and median per-page HTML bytes. Hand the numbers to WP05.

## Definition of done

Suite and spec pass locally and in CI; measurement numbers recorded in the WP hand-off.
