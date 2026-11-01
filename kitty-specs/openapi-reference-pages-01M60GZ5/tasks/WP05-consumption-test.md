---
work_package_id: WP05
title: 'Consumption test: without and with the renderer'
dependencies:
- WP04
requirement_refs:
- FR-010
- FR-007
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: e2a2edf955ba0d4b99f75ed0242f127477bd208a
created_at: '2026-10-31T14:48:48.904010+00:00'
subtasks:
- T014
- T015
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: tests/consumption/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- tests/consumption/**
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Prove FR-010 and SC-004 on the packed tarball. The existing clean-room consumer, which does not set the option and does not install the peers, must still install with `--frozen-lockfile` and build. A new arm installs the peers, configures one spec and builds.

## Subtasks

**T014: Arm without the renderer.**
- Assert the existing fixture's install tree contains neither `starlight-openapi` nor `@astrojs/markdown-satteri`.
- Assert its build output does not change because of this mission: compare the consumer `dist` BYTES against a build of the merge-base tarball, apart from the toolkit version stamps (list them). A URL list is not enough (SC-004).
- If the toolkit's new optional peers change the fixture lockfile, update it through the documented bootstrap path in `run-consumption-test.mjs`. Never hand-edit integrity hashes; `pin-toolkit-integrity.mjs` handles the tarball.

**T015: Arm with the renderer.**
- Add a minimal second consumer configuration, or a variant of the run script, that installs the pinned peers and configures one spec.
- Assert the build emits the API page, `openapi.yaml` and its `.sha256`.
- Assert that setting the option without `renderer` fails with the `[dk-openapi]` renderer message (DM plan.architecture.renderer-loading: the adopter imports the renderer, so a missing package fails at the adopter's own import).
- Keep it offline-capable, the same way the existing arms are.

Do not edit any docs; WP06 owns them. Report install notes for WP06.

## Definition of Done

- Both arms pass locally (or the environmental blocker is named) and in CI.
- The lockfile changes were made through bootstrap.

## Reviewer guidance

- Check that the without-peers arm truly installs no peer.
- Check that no integrity hash was hand-edited.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP05 --agent claude --mission openapi-reference-pages-01M60GZ5`

## Environment

- In a fresh worktree, run `corepack pnpm install --frozen-lockfile` first; it takes about 1 s from the store.
- Unit tests: `cd src && ./node_modules/.bin/vitest run --project fast <files>`.
- Lint: `./node_modules/.bin/eslint <files>` from the worktree root.
- Typecheck: `corepack pnpm typecheck`.
- PlantUML is not available locally (the local config points at `127.0.0.1:8091`; CI runs a `plantuml` service). Build-suite reds caused only by that `ECONNREFUSED` are environmental; say so and do not "fix" them.
- Lane worktrees have no installed deps. Run the frozen install in EVERY lane worktree before any test.
- `--project fast` does not run the build-project tests. Run the integrated build suite once, and never in parallel with another vitest run, because they share `dist`.
- New branches and helpers get tests in the same commit. Cyclomatic complexity stays ≤15.
- Read `kitty-specs/openapi-reference-pages-01M60GZ5/{spec,plan,research,data-model}.md` and `contracts/openapi-option.md` before coding. Use the MAIN-checkout copy of this prompt if the worktree copy looks stale.
