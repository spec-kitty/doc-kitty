---
work_package_id: WP05
title: Pages deploy (path-gated, shared build)
dependencies:
- WP03
- WP04
requirement_refs:
- C-003
- FR-013
- FR-014
- FR-015
- FR-020
- NFR-007
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: implementer-ivan
authoritative_surface: .github/workflows/deploy.yml
create_intent: []
execution_mode: code_change
owned_files:
- .github/workflows/deploy.yml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load implementer-ivan
```

Apply its identity, boundaries, directives, and tactics; state which you applied.

## Objective

Reshape `.github/workflows/deploy.yml` so Pages deploys from mainline **only**,
path-gated to deployment-relevant changes, and builds through the **same composite
build action** as the CI build lane (FR-015). Serialize publishes.

## Context

- The current `deploy.yml` fires on every push to `main` with no path gate and
  builds independently — this WP fixes both.
- WP03 provides `.github/actions/build-example` (the shared build definition).
- Deploy runs in a push context (base = previous mainline commit), whose diff base
  differs from a PR's — keep the path detection consistent with the change-surface
  map.

## Subtasks

### T026 — Path gate
- Gate the deploy so it only proceeds when the push touched `code`,
  `example_content`, or `workflows` (reuse a `dorny/paths-filter` step with the same
  filters as detect-changes, or an equivalent push path-filter). A `repo_docs`-only
  push must **not** redeploy.
- Reuse the single `.github/filters.yml` (owned by WP04) — do not re-author globs.
  Pin `dorny/paths-filter` to the **same commit SHA** used in `ci.yml`.

### T027 — Reuse the shared build
- Build via `./.github/actions/build-example` (do not author a second `astro build`).
  Include `actions/checkout` before the composite (composites do not self-checkout).
  Do **not** run `assert:artifacts` here (that is a PR-gate step; see the composite
  contract). Then upload `example/dist/` as the Pages artifact.

### T028 — Serialization + permissions
- Keep `concurrency: { group: pages, cancel-in-progress: false }` (never cancel an
  in-flight publish). Keep least-privilege Pages permissions (`contents: read`,
  `pages: write`, `id-token: write`). Deploy is base-repo-only by its `push` trigger.

### T029 — Verify
- Confirm (reason/dry-run, then in E2E) that a `repo_docs`-only mainline change does
  not redeploy, and a `code`/`example_content` change does; confirm the build comes
  from the shared action.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree per
lane from `lanes.json`.

## Definition of Done

- `deploy.yml` is path-gated to deployable groups, reuses the composite build,
  serializes publishes, and uses least-privilege permissions; repo_docs-only pushes
  do not redeploy.

## Risks

- Path detection in the push context diverging from PR classification — reuse the
  same filter spec.
- Re-introducing an independent build path (divergence from FR-015 → would need an ADR).

## Reviewer guidance

- Confirm the shared action is used (grep for a second `astro build` → should be
  none); confirm the path gate and the `cancel-in-progress: false`; confirm no
  `repo_docs`-only redeploy; confirm third-party actions are SHA-pinned and
  `.github/filters.yml` is reused (no duplicated globs).
