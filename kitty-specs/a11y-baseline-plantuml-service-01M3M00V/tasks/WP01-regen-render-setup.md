---
work_package_id: WP01
title: Regenerate-job render setup + guard + changelog
dependencies: []
requirement_refs:
- C-001
- C-002
- C-003
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- NFR-001
- NFR-002
- NFR-003
- NFR-004
planning_base_branch: fix/a11y-baseline-plantuml-service
merge_target_branch: fix/a11y-baseline-plantuml-service
branch_strategy: Planning artifacts for this mission were generated on fix/a11y-baseline-plantuml-service. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/a11y-baseline-plantuml-service unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-a11y-baseline-plantuml-service-01M3M00V
base_commit: 34325fcf54943dd3f8cf8a00396138291094f1f6
created_at: '2026-09-28T12:57:14.039276+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history: []
agent_profile: implementer-ivan
authoritative_surface: .github/workflows/
create_intent:
- src/tests/regen-workflow-render-setup.test.ts
execution_mode: code_change
owned_files:
- .github/workflows/update-a11y-baselines.yml
- src/tests/regen-workflow-render-setup.test.ts
- CHANGELOG.md
role: implementer
tags: []
tracker_refs:
- '#106'
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load`
(profile `implementer-ivan`, role `implementer`). Follow its identity, boundaries,
and governance for this work package. Then read `../spec.md`, `../plan.md`, and
`../research.md` before editing.

## Objective

Fix issue #106: the `regenerate` job in `.github/workflows/update-a11y-baselines.yml`
runs inside the pinned `mcr.microsoft.com/playwright:v1.62.1-noble` container and
builds the example with an auto-detected BUILD render mode, but has no PlantUML render
server — so the PlantUML build-only assertion in `tests/a11y/diagram.spec.ts` fails
and the job aborts before regenerating baselines. Mirror `ci.yml`'s `build-example`
render setup into the job, **adapted for container-to-service networking** (reach the
service by its network name, never `localhost`), with full parity including the
`@beoe` Mermaid render cache. Guard it with a text-based Vitest test and record a
changelog entry.

**Reference the exact block to mirror**: the `build-example` job in
`.github/workflows/ci.yml` — its `services.plantuml`, job `env`
(`DK_DIAGRAM_BUILD_RENDER`, `DK_PLANTUML_SERVER_URL`, `DK_BEOE_CACHE_DIR`), the
"Restore @beoe diagram render cache" step (pinned `actions/cache@5a3ec84…`, v4.2.3),
and the "Wait for the PlantUML server" step. Translate `localhost:8091` →
`plantuml:8080` and **drop** the host `ports:` mapping (a service is reached by name
from inside the job container, on its own port 8080).

## Red-first discipline (ADR 2026-07-17-1)

T001 lands the #106 regression repro FIRST and must be RED against the current
(serviceless) workflow before any YAML edit. It is a permanent guard (User Story 2),
so it stays as a normal `src/tests` unit test — it is not marked transitional.

## Subtasks

### T001 — Guard test (write FIRST, confirm RED)

**Purpose**: Lock the render setup so this gap cannot silently return, and serve as
the red-first repro for #106.

**Steps**:
1. Add `src/tests/regen-workflow-render-setup.test.ts` (Vitest). Read the raw text of
   `.github/workflows/update-a11y-baselines.yml` (resolve the repo-root path robustly,
   e.g. relative to the test file: the workflow is at `<repo>/.github/workflows/…`).
   Do **not** add a YAML-parser dependency — assert on text/patterns (the repo has no
   `yaml`/`js-yaml` dep and `pnpm install --frozen-lockfile` must stay unchanged).
2. Assert, scoped to the `regenerate` job:
   - a `plantuml` service is declared (image `plantuml/plantuml-server:jetty`);
   - `DK_DIAGRAM_BUILD_RENDER: 'on'` is set;
   - `DK_PLANTUML_SERVER_URL` is a **by-name** URL `http://plantuml:8080/svg/`;
   - the URL does **not** contain `localhost` (the container-networking invariant —
     this is the non-vacuous assertion, FR-005/NFR-002);
   - a wait-for-server step exists **before** the "Build example site" step.
3. Run `pnpm --filter @spec-kitty/doc-toolkit test` and **confirm the new test is RED**
   against the current file. Record that it was RED (red-first proof).

**Files**: `src/tests/regen-workflow-render-setup.test.ts` (new).

**Validation**: RED before T002–T004; GREEN after; and RED if the URL is edited to a
`localhost` form (prove the invariant assertion is real, not string-presence).

### T002 — Service + env on the `regenerate` job

**Steps**:
1. Add a `services.plantuml` block (`image: plantuml/plantuml-server:jetty`) to the
   `regenerate` job. Do **not** add a `ports:` host mapping.
2. Add a job-level `env:` block:
   - `DK_DIAGRAM_BUILD_RENDER: 'on'`
   - `DK_PLANTUML_SERVER_URL: http://plantuml:8080/svg/`  (by name, trailing `/svg/`)
   - `DK_BEOE_CACHE_DIR: ${{ github.workspace }}/.beoe-cache`

**Files**: `.github/workflows/update-a11y-baselines.yml`.

**Validation**: the guard's service/env assertions pass.

### T003 — Wait for the PlantUML server before the build

**Steps**:
1. Add a "Wait for the PlantUML server" step **before** "Build example site",
   polling `http://plantuml:8080/` until ready (mirror `build-example`'s 30×2s loop),
   `shell: bash` (C-003 — the container defaults `run:` to `sh`/dash).
2. **Verify `curl` exists in the pinned image** (`docker run --rm
   mcr.microsoft.com/playwright:v1.62.1-noble which curl`). If present, use
   `curl -sf`; if absent, use a Node probe (Node is guaranteed present), e.g.
   `node -e "fetch('http://plantuml:8080/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.

**Files**: `.github/workflows/update-a11y-baselines.yml`.

**Validation**: step ordered before the build; guard's wait-step assertion passes.

### T004 — @beoe render-cache parity

**Steps**:
1. Add the "Restore @beoe diagram render cache" step (before the build), reusing the
   exact pinned `actions/cache@5a3ec84eff668545956fd18022155c47e93e2684` (v4.2.3) and
   the same `path`/`key`/`restore-keys` as `build-example` (`.beoe-cache`, keyed on
   the example diagram sources + `src/lib/config.ts` + `pnpm-lock.yaml`).

**Files**: `.github/workflows/update-a11y-baselines.yml`.

**Validation**: `actions/cache` referenced by the same SHA `ci.yml` uses (NFR-004);
no unpinned tag introduced.

### T005 — Changelog

**Steps**:
1. Add an entry under the existing `## [Unreleased]` heading in the canonical
   repo-root `CHANGELOG.md` (Keep-a-Changelog format; this repo's root `CHANGELOG.md`
   is the real canonical file — there is no `docs/changelog/CHANGELOG.md`). Use the
   appropriate subsection (e.g. `### 🛠️ Fixed` / `### CI`, matching the file's
   existing subsection style). Impact-first, with `(#106)`: the on-demand **Update
   a11y baselines** workflow can now regenerate baselines for branches whose example
   includes the PlantUML demonstrator; before, the job aborted because its
   containerized build had no PlantUML render server.
2. Do **not** touch the `docs/changelog/` dated-narrative Hub — those are feature
   milestone entries and its index is pre-existingly stale (out of scope here).

**Files**: `CHANGELOG.md` (repo root).

## Definition of Done

- The guard (T001) was RED against the pre-fix workflow and is GREEN after; it fails
  on a `localhost`-form URL.
- The `regenerate` job has the service, the three env vars (by-name URL), the wait
  step (ordered before the build), and the `@beoe` cache restore — mirroring
  `build-example`, no host `ports:` mapping.
- `actions/cache` is pinned to the same SHA as `ci.yml`; the job container image tag
  is unchanged; no npm dependency added (`pnpm-lock.yaml` unchanged).
- `ci.yml` is byte-unchanged (NFR-003); the existing `regenerate` steps
  (trust-workspace, corepack, frozen install, `--update-snapshots`, detect/commit/push,
  github-script PR-open, no-op report, `GITHUB_TOKEN` recursion note) are preserved.
- `[Unreleased]` changelog entry added.
- `pnpm --filter @spec-kitty/doc-toolkit test` green.

## Branch Strategy

Planning branch: `fix/a11y-baseline-plantuml-service`. Final merge target for this
mission's changes: `fix/a11y-baseline-plantuml-service` (then a PR into `main`).
Execution worktrees are allocated per computed lane from `lanes.json`; enter the lane
workspace `spec-kitty implement WP01` prepares.

## Reviewer Guidance

- The single load-bearing correctness fact: the service URL is `http://plantuml:8080/svg/`
  (by name), NOT `localhost` — a `localhost` URL would silently fail to connect from
  inside the job container.
- Confirm the wait step precedes the build and is `shell: bash`.
- Confirm the guard is non-vacuous: it must fail on a `localhost` URL, not merely
  detect the string `plantuml`.
- Confirm `ci.yml` is untouched and no dependency/lockfile change.
