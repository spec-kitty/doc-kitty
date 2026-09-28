# Tasks: Regen workflow PlantUML service

**Mission**: a11y-baseline-plantuml-service-01M3M00V
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md)
**Planning/merge branch**: `fix/a11y-baseline-plantuml-service` → later PR into `main`

Single-file behavioral scope (issue #106): the fix lives entirely in
`.github/workflows/update-a11y-baselines.yml`, guarded by one text-based Vitest test
and recorded in the changelog. IC-01 (the fix) and IC-02 (guard + changelog) are one
work package because the guard must land in the same commit as the surface it guards
(new-code gate; red-first).

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Guard test (RED first): assert render setup in update-a11y-baselines.yml | WP01 | |
| T002 | Add `services.plantuml` + job `env` (DK_DIAGRAM_BUILD_RENDER, DK_PLANTUML_SERVER_URL by-name, DK_BEOE_CACHE_DIR) to the `regenerate` job | WP01 | |
| T003 | Add wait-for-server step before "Build example site" | WP01 | |
| T004 | Add `@beoe` render-cache restore step (pinned actions/cache SHA) | WP01 | |
| T005 | Add `[Unreleased]` CHANGELOG entry | WP01 | |

## Work Packages

### WP01 — Regenerate-job render setup + guard + changelog

- **Goal**: The `regenerate` job in `update-a11y-baselines.yml` renders PlantUML at
  build time via a container-networked service, so the job stops aborting for
  PlantUML-bearing branches (#106); a text guard locks the setup; the change is
  recorded in the changelog.
- **Priority**: P1 (User Story 1) + P2 (User Story 2, guard).
- **Independent test**: `pnpm --filter @spec-kitty/doc-toolkit test` runs the new
  guard — RED against the pre-fix workflow, GREEN after; offline, the fix is proven
  by reproducing the regen build in the pinned container with a networked
  `plantuml/plantuml-server:jetty` (as done while landing #105).
- **Included subtasks**: T001, T002, T003, T004, T005.
- **Implementation sketch**:
  1. T001 first (red-first, ADR 2026-07-17-1): write `src/tests/regen-workflow-render-setup.test.ts`
     asserting, against the raw text of `.github/workflows/update-a11y-baselines.yml`,
     that the `regenerate` job declares a `plantuml` service, sets
     `DK_DIAGRAM_BUILD_RENDER: 'on'`, sets `DK_PLANTUML_SERVER_URL` to a **by-name**
     URL (`http://plantuml:8080/svg/`) and **not** a `localhost` form, and has a
     wait-for-server step before the build. Confirm it is RED now.
  2. T002–T004: edit the `regenerate` job to mirror `ci.yml`'s `build-example`
     render setup, translated for the container (service by name on 8080, no host
     `ports:` mapping): job `env` block, `services.plantuml`, `@beoe` cache restore,
     and the wait step. Confirm the guard is now GREEN.
  3. T005: add a `[Unreleased]` entry to `docs/changelog/CHANGELOG.md`.
- **Dependencies**: none.
- **Risks**: container-vs-host networking (must be `plantuml:8080`); jetty startup
  race (wait step); `curl` presence in the pinned image (fall back to a Node `fetch`
  probe); keeping the guard non-vacuous (assert the by-name invariant, fail on
  `localhost`).
- **Estimated prompt size**: ~180 lines (5 subtasks, small surface).

**Prompt**: [tasks/WP01-regen-render-setup.md](./tasks/WP01-regen-render-setup.md)
