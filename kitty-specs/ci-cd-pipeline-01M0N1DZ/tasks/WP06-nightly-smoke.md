---
work_package_id: WP06
title: Nightly smoke (gated, reporting)
dependencies:
- WP05
requirement_refs:
- C-007
- C-009
- FR-016
- FR-017
- FR-018
- FR-019
- FR-020
- FR-021
- NFR-005
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
- T033
- T034
- T035
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: implementer-ivan
authoritative_surface: .github/workflows/nightly.yml
create_intent:
- .github/workflows/nightly.yml
- lychee.toml
- lighthouserc.json
execution_mode: code_change
owned_files:
- .github/workflows/nightly.yml
- lychee.toml
- lighthouserc.json
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

Add `.github/workflows/nightly.yml`: a scheduled + manually-dispatchable smoke flow
that runs **only when the live site has redeployed since the last run**, checks the
live URL with lychee + Lighthouse CI, reports via issue only on failure, and never
gates a merge. Bind `contracts/nightly-smoke.contract.md`.

## Context

- Playwright / deep a11y / visual regression are deferred to M2 (C-009). M0 =
  lychee + Lighthouse only. Perf/CWV is NOT an M0 gate.
- Marker: a durable git ref (`smoke/last-run`) recording the last-smoked deployment
  SHA (C-007). Cache eviction is not a concern because we use a git ref.

## Subtasks

### T030 — Triggers + deploy-change gate
- `on: schedule` (nightly cron) + `workflow_dispatch`.
- Read the live deployment SHA from the GitHub Deployments API
  (`gh api repos/:owner/:repo/deployments?environment=github-pages` → newest
  **successful/active** → `sha`). Compare to the `smoke/last-run` ref. If equal →
  exit early (no checks). Missing marker ⇒ treat as changed (run once).

### T031 — Broken links (lychee)
- Add `lychee.toml`; run `lycheeverse/lychee-action` (SHA-pinned) against the live
  URL — internal + external links; 0 dead links is the pass bar.

### T032 — Lighthouse CI
- Add `lighthouserc.json` with per-category minimum scores for SEO, an accessibility
  subset, and best-practices (console errors / failed requests = rendering
  integrity). Run `treosh/lighthouse-ci-action` (SHA-pinned). Do not gate on perf/CWV.

### T033 — Marker update
- After a successful run, set `smoke/last-run` to the deployed SHA using
  `contents: write`. The write must not retrigger workflows (it is a ref update, not
  a push to a workflow-triggering branch).

### T034 — Reporting (non-blocking)
- Always write a Step Summary and upload artifacts (Lighthouse HTML, link report).
- Open or update a single tracking GitHub issue **only** when a check fails its
  threshold. The workflow never fails the run in a way that could gate a merge (it
  is not a required check).

### T035 — Verify
- Confirm the gate no-ops when the deployment SHA is unchanged (two dispatches, no
  deploy between → second does nothing), and runs on first-run/changed-SHA.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree per
lane from `lanes.json`.

## Definition of Done

- `nightly.yml` + `lychee.toml` + `lighthouserc.json` exist; the deploy-change gate
  reads the newest successful github-pages deployment and compares to the git-ref
  marker; lychee + Lighthouse run with thresholds; marker updates; issue only on
  failure; never gates.

## Risks

- Marker write retriggering workflows — use a ref update that does not trigger CI.
- Lighthouse threshold noise — set conservative minimums; tune in follow-up.
- Deployments API returning a pending deploy — filter to successful/active.

## Reviewer guidance

- Confirm the gate filters to a successful deployment and no-ops on unchanged SHA;
  confirm issue-only-on-failure and that the run cannot gate a merge; confirm
  SHA-pinned actions and `contents: write` scoped to this workflow.
