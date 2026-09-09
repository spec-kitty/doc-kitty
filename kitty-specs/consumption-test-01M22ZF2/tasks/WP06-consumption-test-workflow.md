---
work_package_id: WP06
title: consumption-test.yml GitHub Actions workflow
dependencies:
- WP01
- WP04
- WP05
requirement_refs:
- FR-003
- FR-004
- FR-005
- FR-006
- NFR-002
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T024
- T025
- T026
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: .github/workflows/
create_intent:
- .github/workflows/consumption-test.yml
execution_mode: code_change
owned_files:
- .github/workflows/consumption-test.yml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_051 (supply-chain — SHA-pin actions), DIRECTIVE_010 (spec fidelity), NFR-002 budget.

## Objective

A dedicated CI workflow that runs the consumption test (orchestrator + self-test) on a
clean runner with **no** PlantUML service and **no** Chromium, within the ≤8-min budget.

Read first: `../contracts/consumption-test-contract.md` (C-5), `../plan.md` (IC-07), and
`.github/workflows/ci.yml` — **copy only** its Node/pnpm setup pattern (corepack →
`actions/setup-node` SHA-pinned, node 22, `cache: pnpm`). Do **NOT** copy its
`build-example` `services: plantuml` block, the `@beoe` cache step, or `playwright install`.

## Subtasks

### T024 — Triggers
`on:` `pull_request` with `paths: ['src/**','tests/consumption/**','.github/workflows/consumption-test.yml']`,
plus `workflow_dispatch`. (Use `paths:` directly — do not edit the shared `.github/filters.yml`.)

### T025 — Job: setup + run orchestrator
`ubuntu-latest`; `corepack enable`; `actions/setup-node@<pinned-sha>` (node 22,
`cache: pnpm`); root `pnpm install --frozen-lockfile`; then
`node tests/consumption/scripts/run-consumption-test.mjs`. All actions SHA-pinned to
match the repo convention.

### T026 — Run the self-test; assert the exclusions
Add a step running the WP05 vitest self-test (`consumption-gap.test.ts`). Confirm the
job declares **no** `services:`, installs **no** Chromium, and pulls **no** PlantUML.
Note the ≤8-min budget in a comment (excluding cache-cold install).

## Definition of Done
- Workflow runs green on a PR touching `src/**` or `tests/consumption/**`, and on manual dispatch.
- No `services:`, no PlantUML, no Chromium, no `@beoe` cache; actions SHA-pinned; node 22.
- Runs both the orchestrator and the self-test.

## Reviewer guidance
Diff against `ci.yml` to confirm the PlantUML `services:` block was NOT carried over.
Confirm actions are SHA-pinned and the trigger `paths:` are correct.

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01, WP04, WP05. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP06 --agent claude`.
