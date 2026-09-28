# Implementation Plan: Regen workflow PlantUML service

**Branch**: `fix/a11y-baseline-plantuml-service` | **Date**: 2026-09-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `kitty-specs/a11y-baseline-plantuml-service-01M3M00V/spec.md`

## Summary

Make the on-demand **Update a11y baselines** workflow able to regenerate visual
baselines for branches whose example site includes the PlantUML demonstrator
(issue #106). Root cause: the `regenerate` job runs inside the pinned Playwright
container and builds the example with an auto-detected BUILD render mode, but has no
PlantUML render server, so the build-mode PlantUML assertion fails and the job aborts
before producing baselines. Fix: mirror `ci.yml`'s `build-example` render setup into
the `regenerate` job — adapted for **container-to-service** networking (reach the
service by name, `http://plantuml:8080/svg/`, not a `localhost` host port) — with
full parity including the `@beoe` Mermaid render cache. Add a regression guard that
asserts the render setup and a `[Unreleased]` changelog entry.

## Technical Context

**Language/Version**: GitHub Actions workflow YAML (`.github/workflows/*.yml`); guard test in TypeScript on Vitest (Node 22+, pnpm), matching the repo's existing test stack.
**Primary Dependencies**: `plantuml/plantuml-server:jetty` (service container — already used by `ci.yml` `build-example`), `actions/cache` pinned to the SHA `ci.yml` already uses (`5a3ec84eff668545956fd18022155c47e93e2684`, v4.2.3), the pinned `mcr.microsoft.com/playwright:v1.62.1-noble` job container (unchanged). No package.json dependency is added, upgraded, or removed.
**Storage**: N/A (CI configuration + a static guard test).
**Testing**: A Vitest guard test parses `.github/workflows/update-a11y-baselines.yml` and asserts the render setup (service present, `DK_DIAGRAM_BUILD_RENDER=on`, `DK_PLANTUML_SERVER_URL` by-name, wait step) — RED against the pre-fix file, GREEN after, and RED on a `localhost`-form URL. End-to-end proof is the workflow dispatch itself (out of unit-CI scope) plus the offline pinned-container reproduction already used while landing #105.
**Target Platform**: GitHub-hosted `ubuntu-latest` runner executing a job inside the pinned Playwright container, with a service container attached on the same Docker network.
**Project Type**: single (toolkit repo; CI-config change + one guard test).
**Performance Goals**: N/A — correctness/reliability change. The `@beoe` cache restore preserves the "unchanged diagram skips a Chromium relaunch" property from `build-example`.
**Constraints**: Self-hosted PlantUML only, never `plantuml.com` (C-001). Behavioral change confined to one workflow file (NFR-003). Newly-referenced actions pinned by SHA (NFR-004). New scripted steps that use bashisms run under `shell: bash` (C-003).
**Scale/Scope**: One workflow file edited; one guard test added; one changelog entry. ~1 work package.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Path-scoped CI (ADR-0007), single `ci-ok` aggregate**: This change touches CI
  workflow config and adds a test; it does not alter the `ci-ok` gate contract or
  `REQUIRED_LANES`. PASS.
- **Diagram build-render doctrine (ADR-0040) / C-001 "never plantuml.com"**: The fix
  reuses the self-hosted `plantuml/plantuml-server:jetty` service exactly as
  `build-example` does. PASS.
- **Deny-by-default lifecycle / supply-chain pinning (DIRECTIVE_051, NFR-004)**: No
  new npm dependency. The only newly-referenced action (`actions/cache`) is pinned to
  the same SHA `ci.yml` already trusts; the service image tag matches `ci.yml`. PASS.
- **Living documentation**: A `[Unreleased]` changelog entry accompanies the
  user-facing (operator-facing) behavior change. PASS.
- **No implementation detail in spec**: The spec stays at the config surface; wiring
  lives here. PASS.

No violations → Complexity Tracking not required.

## Project Structure

### Documentation (this mission)

```
kitty-specs/a11y-baseline-plantuml-service-01M3M00V/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── spec.md              # Mission spec
├── issue-matrix.json    # #106 claim + verdict slot
├── checklists/          # requirements.md
└── tasks/               # WP files (created by /spec-kitty.tasks)
```

### Source Code (repository root)

```
.github/workflows/
└── update-a11y-baselines.yml     # EDIT: add plantuml service + render env + wait step + @beoe cache to the `regenerate` job

tests/                             # (repo test root; exact home decided at brownfield time)
└── <guard>.test.ts                # ADD: static guard asserting the workflow's render setup

CHANGELOG.md                       # EDIT: entry under the existing [Unreleased] heading (this repo's canonical Keep-a-Changelog file is repo-root CHANGELOG.md; docs/changelog/ holds separate per-milestone narrative files, out of scope)
```

**Structure Decision**: Single-project toolkit. The only behavioral surface is
`.github/workflows/update-a11y-baselines.yml`. The guard test's exact location and
harness follow the repo's existing convention for asserting on workflow/config files
(confirmed at brownfield time — see research.md Open Items); it is added in the SAME
commit as the workflow edit so no intermediate commit is red on the new-code gate.

## Implementation Concern Map

> Concerns are not work packages. `/spec-kitty.tasks` translates these into WPs.

### IC-01 — Regenerate-job render setup (the fix)

- **Purpose**: Give the containerized `regenerate` job a PlantUML render server and
  deterministic BUILD render, reached by service name, so the inline build renders
  PlantUML and the job stops aborting (#106).
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004; NFR-001, NFR-002, NFR-004; C-001, C-002, C-003.
- **Affected surfaces**: `.github/workflows/update-a11y-baselines.yml` (`regenerate` job: add `services.plantuml`, job `env` block with `DK_DIAGRAM_BUILD_RENDER`/`DK_PLANTUML_SERVER_URL`/`DK_BEOE_CACHE_DIR`, a `@beoe` cache restore step, and a wait-for-server step before "Build example site").
- **Sequencing/depends-on**: none.
- **Risks**: container-vs-host networking (must be `plantuml:8080`, not `localhost`);
  jetty startup race (wait step); `curl` availability in the pinned image for the
  health check (resolve at brownfield — fall back to a Node `fetch` probe if absent);
  `actions/cache` behavior inside a container.

### IC-02 — Regression guard + changelog

- **Purpose**: Lock the render setup with a test that is RED against the pre-fix file,
  and record the operator-facing change.
- **Relevant requirements**: FR-005; NFR-003; SC-002.
- **Affected surfaces**: a Vitest guard test (location per repo convention); `docs/changelog/CHANGELOG.md` `[Unreleased]`.
- **Sequencing/depends-on**: pairs with IC-01 (same commit, so the new-code gate sees the guard alongside the surface it guards).
- **Risks**: making the guard non-vacuous — it must assert the by-name URL invariant (fail on a `localhost` form), not merely that some `plantuml` string is present.
