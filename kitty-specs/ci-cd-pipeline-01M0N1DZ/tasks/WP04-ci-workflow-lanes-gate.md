---
work_package_id: WP04
title: 'CI workflow: detect-changes + lanes + ci-ok'
dependencies:
- WP01
- WP02
- WP03
requirement_refs:
- C-005
- C-006
- FR-005
- FR-006
- FR-007
- FR-010
- FR-012
- FR-020
- NFR-001
- NFR-002
- NFR-003
- NFR-004
- NFR-006
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T019
- T020
- T021
- T022
- T023
- T024
- T025
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: implementer-ivan
authoritative_surface: .github/workflows/ci.yml
create_intent:
- .github/filters.yml
- .github/scripts/derive-change-groups.mjs
- .github/scripts/derive-change-groups.test.mjs
- .github/scripts/ci-ok-decision.mjs
- .github/scripts/ci-ok-decision.test.mjs
execution_mode: code_change
owned_files:
- .github/workflows/ci.yml
- .github/filters.yml
- .github/scripts/**
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

Assemble `.github/workflows/ci.yml`: the `detect-changes` classifier, the three
conditional lanes (wired to the WP01 scripts and WP02/WP03 tooling), and the
always-running `ci-ok` aggregate that is the sole required check. Fork-safe
triggers. This is the headline deliverable — get the gate semantics exactly right.

## Context — bind these contracts
- Change-surface map + first-match precedence: `spec.md` §"Change-surface map".
- `detect-changes` contract: `contracts/detect-changes.contract.md`.
- `ci-ok` contract: `contracts/ci-ok.contract.md`.
- build assertions: `contracts/build-artifacts.contract.md`.
- The existing `ci.yml` is a single non-path-scoped `build-test` job — replace it.
- WP03 provides `.github/actions/build-example` (shared build). WP01 provides
  `typecheck`/`lint`/`test`/`validate:*`/`assert:artifacts` scripts. WP02 provides
  the validators + configs.

## Subtasks

### T019 — detect-changes job (always runs)
- Use `dorny/paths-filter` (pin to a commit SHA) with filters encoding the exact
  globs of every group. Because paths-filter is multi-match, derive **first-match**
  primary-group booleans in the precedence workflows → code → example_content →
  repo_docs → ignored, then emit `run_code_quality`, `run_doc_sanity`,
  `run_build_example` per `data-model.md`. Job outputs must be readable by later jobs.
- Author the filter globs in a single committed `.github/filters.yml` (dorny format),
  consumed here and by deploy (WP05) — one source of truth, no glob duplication.
- Extract the first-match derivation into a committed helper
  `.github/scripts/derive-change-groups.mjs` with a table-driven test
  `.github/scripts/derive-change-groups.test.mjs` (`node --test`) mapping sample
  paths → expected primary group, incl. overlap cases (a `.github/workflows/*.md`;
  `example/astro.config.mjs` → code). The job calls the helper, so first-match
  precedence is offline-provable rather than eyeballed.

### T020 — code-quality lane (`if: needs.detect-changes.outputs.run_code_quality == 'true'`)
- Steps: checkout, corepack, setup-node 22 + pnpm cache, `pnpm install --frozen-lockfile`,
  `pnpm typecheck`, `pnpm lint`, `pnpm test`.

### T021 — doc-sanity lane (`if: run_doc_sanity`) — build-free
- Steps: install, `pnpm validate:docs`, `pnpm validate:example`, `pnpm validate:links`,
  `markdownlint-cli2`, Vale (pinned `errata-ai/vale-action` or CLI). No `astro build`.

### T022 — build-example lane (`if: run_build_example`)
- Steps: `actions/checkout` (required before a local composite resolves) → the shared
  `./.github/actions/build-example` composite → `pnpm assert:artifacts example/dist`.
  Assert always runs here (resolved: the composite is a pure build; see
  `contracts/build-example-action.contract.md`).

### T023 — ci-ok aggregate (the gate)
- `needs: [detect-changes, code-quality, doc-sanity, build-example]`, `if: always()`.
- GREEN iff `needs.detect-changes.result == 'success'` AND none of the three lanes
  is `failure`/`cancelled` (a `skipped` lane passes). RED otherwise. **Must fail on
  a detect-changes failure** (no all-skip false green). Implement with an explicit
  check over the `needs.*.result` values — not a bare `always() + exit 0`.
- The job **id must be exactly `ci-ok`** (no divergent `name:`) — it is the string
  branch protection requires (WP07 documents it).
- Extract the pass/fail decision into a committed `.github/scripts/ci-ok-decision.mjs`
  with a table-driven test `.github/scripts/ci-ok-decision.test.mjs` covering:
  all-pass, one-failure, one-cancelled, all-skip (→pass), detect-changes-failure
  (→fail). The job invokes the helper, so the gate is offline-provably red on failure.

### T024 — triggers, permissions, concurrency
- `on: pull_request` (NEVER `pull_request_target`) + `push: branches: [main]`.
- Top-level least-privilege `permissions:` (contents: read); no secrets needed by
  these lanes → fork PRs pass.
- `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`.

### T025 — verify behavior
- Reason through / dry-run the lane matrix against the change-surface map: doc-only →
  doc-sanity only; code-only → code-quality+build-example+doc-sanity; example_content
  → doc-sanity+build-example; workflows → all; ignored-only → heavy lanes skip,
  detect-changes+ci-ok run, mergeable.
- Run the committed table tests (`node --test .github/scripts/*.test.mjs`) as the
  primary, re-runnable proof of the classifier and gate logic; the live throwaway-PR
  matrix is WP08's acceptance step.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree per
lane from `lanes.json`.

## Definition of Done

- `ci.yml` implements detect-changes + 3 conditional lanes + ci-ok per the
  contracts; triggers are fork-safe; concurrency cancels superseded runs; the ci-ok
  logic is provably red on any lane failure or detect-changes failure and green on
  pass/skip (incl. ignored-only mergeable).

## Risks

- The classic `always()` false-green — the single highest-risk line in the mission.
  Write the result check explicitly and test it.
- paths-filter multi-match: verify overlap cases (a workflow file also matching
  `*.md`; `example/*.mjs` config → code, not example_content).
- Accidentally using `pull_request_target` reintroduces the fork-secret vuln.

## Reviewer guidance

- Trace the ci-ok expression by hand for: all-pass, one-fail, all-skip,
  detect-changes-fail. Confirm no `pull_request_target`; confirm SHA-pinned actions;
  confirm lanes call the WP01/WP02/WP03 surfaces, not reimplemented logic.
