---
work_package_id: WP02
title: Remove CI vitest parallel-build flake (#54)
dependencies: []
requirement_refs:
- FR-003
- NFR-001
- NFR-003
planning_base_branch: feat/test-guard-hardening
merge_target_branch: feat/test-guard-hardening
branch_strategy: Planning artifacts were generated on feat/test-guard-hardening. This WP may branch from a lane base during /spec-kitty.implement; completed changes merge back into feat/test-guard-hardening unless the human redirects the landing branch.
subtasks:
- T005
- T006
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/
create_intent: []
execution_mode: code_change
owned_files:
- src/vitest.config.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Guiding directive: DIRECTIVE_030 (a reliable test/typecheck gate).

## Objective

Close #54: `src/tests/example-adopter.test.ts` and `src/tests/glossary-build-warning.test.ts` each spawn a full `astro build`; under vitest's default file-parallelism they race on build resources and intermittently fail (observed ~3/769 red locally; green when serialized). Adjust `src/vitest.config.ts` to remove the race with the narrowest effective change. Read `../spec.md` (FR-003, NFR-003), `../plan.md` (IC-02), `../research.md` (D2).

## Critical context

- `src/vitest.config.ts` currently sets no `fileParallelism`/`poolOptions`/`sequence` controls. vitest is **2.1.9** — confirm the chosen mechanism exists in that version before using it.
- Two suites are the offenders (both run a real `astro build`); everything else is fast and parallel-safe.
- Keep CI wall-clock bounded (NFR-003): prefer isolating ONLY the two build-spawning suites over serializing the whole suite, if vitest 2.1.9 supports a clean per-suite mechanism (e.g. a separate `test.projects`/`poolMatchGlobs` lane, or `test.sequence`/`isolate` scoping, or marking those two files to run in a single fork). If no clean per-suite isolation is available, `fileParallelism: false` (or `poolOptions.forks.singleFork: true`) for the whole suite is the accepted fallback (the suite is ~10–27s).

## Subtasks

### T005 — Configure vitest to stop the build-suite race
Edit `src/vitest.config.ts` with the narrowest supported mechanism (per above) so the two `astro build` suites do not execute concurrently with each other. Add a one-line comment citing #54 and why. Confirm the option is valid for vitest 2.1.9 (check the installed vitest's config types / a quick `pnpm -C src exec vitest --version`).

### T006 — Verify determinism + bounded runtime
`pnpm install --offline` in the lane worktree. Run the FULL suite at least twice consecutively (`pnpm -C src test`), confirming `example-adopter` + `glossary-build-warning` pass both times and no build race appears. Record the wall-clock of a full run and confirm it's within budget (NFR-003, ≤ ~1.5× the pre-change ~10–27s). Confirm `pnpm typecheck` + `pnpm lint` still green (NFR-001). State local-vs-CI.

## Definition of Done
- `src/vitest.config.ts` prevents the two build-spawning suites from racing (mechanism valid for vitest 2.1.9).
- Full vitest suite passes deterministically across ≥2 consecutive runs; runtime within budget.
- typecheck + lint green (or CI-verified with a note).
- `spec-kitty agent tasks mark-status T005 T006 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm the change is the narrowest effective one and doesn't materially inflate CI time; confirm the mechanism is real in vitest 2.1.9 (not a newer-version option).
- Config-only change; no test logic altered. Env: `pnpm install --offline` works in a lane worktree.
