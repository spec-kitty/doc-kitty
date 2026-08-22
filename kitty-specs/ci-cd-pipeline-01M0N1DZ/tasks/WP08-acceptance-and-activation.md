---
work_package_id: WP08
title: Acceptance & activation
dependencies:
- WP04
- WP05
- WP06
- WP07
requirement_refs:
- FR-006
- FR-012
- FR-013
- FR-016
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T039
- T040
- T041
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: reviewer-renata
authoritative_surface: kitty-specs/ci-cd-pipeline-01M0N1DZ/acceptance.md
create_intent:
- kitty-specs/ci-cd-pipeline-01M0N1DZ/acceptance.md
execution_mode: planning_artifact
owned_files:
- kitty-specs/ci-cd-pipeline-01M0N1DZ/acceptance.md
role: reviewer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load reviewer-renata
```

Apply its identity, boundaries, directives, and tactics; state which you applied.

## Objective

Own the end-to-end acceptance of the pipeline so SC-001..SC-010 are provably closed
— separating what is **offline-provable in-mission** (owned and executed here) from
what is **intrinsically live** (throwaway PRs, real deploy, first nightly), which
needs branch protection + a live deployment and is a tracked post-activation
checklist. This WP produces `acceptance.md` recording the evidence.

## Context

The post-tasks squad flagged that no WP owned end-to-end acceptance; the workflow
behaviors can only be fully proven live on GitHub, but the *logic* is offline-provable
via WP04's committed table tests and the local green build.

## Subtasks

### T039 — Run and record the offline-provable acceptance
Execute and capture evidence for everything provable without GitHub:
- Local green: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`,
  `pnpm test`, `pnpm build`, `pnpm assert:artifacts example/dist` — all green (SC-008,
  SC-007, SC-010 build half).
- Committed table tests: `node --test .github/scripts/*.test.mjs` — classifier
  first-match + ci-ok decision (all-pass/one-fail/one-cancelled/all-skip/
  detect-changes-fail) all pass (SC-004, SC-005 logic half).
- Doc-sanity failure demos (WP02) and artifact failure demo (WP03) reproduced.
- Workflow static validation: `actionlint` (or equivalent) over the three workflows;
  confirm no `pull_request_target`, SHA-pinned third-party actions, `ci-ok` job id.

### T040 — Document the live post-activation checklist
In `acceptance.md`, record the steps that must be run once, after a repo admin
activates branch protection (WP07) and Pages, and the first deploy lands:
- The throwaway-PR lane matrix (doc-only, code-only, example_content, workflows,
  ignored-only mergeable) — SC-001..SC-005.
- A red-lane PR → `ci-ok` red (US2.11) and a detect-changes-failure → red (US2.12).
- repo_docs-only mainline push → no redeploy; a deployable change → deploy (SC-006).
- First nightly on a changed deployment SHA; second dispatch with no deploy → no-op
  (SC-009).

### T041 — Map SC-001..SC-010 to evidence
- In `acceptance.md`, tabulate each success criterion → offline-proven (with the
  command/result) or live-pending (with the post-activation step), so the mission's
  acceptance state is explicit and auditable.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. This is a
planning-artifact WP; it produces `acceptance.md` under the mission dir.

## Definition of Done

- `acceptance.md` exists with: the executed offline acceptance evidence (all green),
  the live post-activation checklist, and the SC-001..SC-010 → evidence table.

## Risks

- Over-claiming: do not mark a live-only SC as proven from an offline proxy — label
  it live-pending honestly.

## Reviewer guidance

- Confirm the offline evidence is real (commands + observed results, not assertions);
  confirm the live checklist is complete and each live-only SC is labeled pending,
  not proven.
