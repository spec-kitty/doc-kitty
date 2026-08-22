---
work_package_id: WP07
title: 'Ops docs: branch-protection activation'
dependencies:
- WP02
- WP04
requirement_refs:
- FR-022
- NFR-003
planning_base_branch: feat/ci-cd-pipeline
merge_target_branch: feat/ci-cd-pipeline
branch_strategy: Planning artifacts for this mission were generated on feat/ci-cd-pipeline. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ci-cd-pipeline unless the human explicitly redirects the landing branch.
subtasks:
- T036
- T037
- T038
history:
- event: created
  by: spec-kitty.tasks
  at: '2026-08-22'
agent_profile: curator-carla
authoritative_surface: docs/ops/
create_intent:
- docs/ops/ci-cd.md
execution_mode: code_change
owned_files:
- docs/ops/ci-cd.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

```
/ad-hoc-profile-load curator-carla
```

Apply its identity, boundaries, directives, and tactics; state which you applied.

## Objective

Document the out-of-band repo-admin step that makes the pipeline a real gate:
mainline branch protection requiring exactly the `ci-ok` status check, plus enabling
GitHub Pages. The whole design hinges on this setting, and it cannot be committed as
a workflow file (FR-022). Also capture the operating notes.

## Context

- Audience (DIRECTIVE_047): a repo maintainer/admin activating and operating the
  pipeline. Keep it task-oriented and short.
- This is a repo doc under `docs/` → it must itself pass the WP02 doc-sanity checks
  (frontmatter contract per ADR-0005). Grep an existing `docs/**` page for the
  frontmatter shape and match it.

## Subtasks

### T036 — Activation note
- Write `docs/ops/ci-cd.md` with the activation steps: Settings → Branches → require
  status checks → select **only** `ci-ok`; Settings → Pages → Source = GitHub
  Actions. State clearly that until this is done, skipped lanes do not gate and the
  pipeline is advisory.
- The required-check string is exactly the job id `ci-ok` (WP04 pins it); document
  that exact string so branch protection references a check that actually reports.

### T037 — Operating notes
- Add: the lane matrix (what runs for which change), how the nightly gate + marker
  work, how to read a red `ci-ok`, and the fork-PR/secret posture. Link the design
  doc and ADR-0007 rather than duplicating them.

### T038 — Pass doc-sanity
- Give the page correct frontmatter (title, description, `doc_status`, `kind`,
  `type`-by-path per the contract) so it passes the extended `validate-frontmatter`
  and markdownlint/Vale. Verify locally with the WP02 validators.

## Branch Strategy

Planning/base `feat/ci-cd-pipeline`; merge target `feat/ci-cd-pipeline`. Worktree per
lane from `lanes.json`.

## Definition of Done

- `docs/ops/ci-cd.md` documents branch-protection activation + Pages enablement +
  operating notes, has correct frontmatter, and passes the doc-sanity validators.

## Risks

- Frontmatter drift → the page fails its own doc-sanity lane; match an existing
  `docs/**` page exactly.

## Reviewer guidance

- Confirm the activation steps are correct and unambiguous (require only `ci-ok`);
  confirm the page passes doc-sanity; confirm it links rather than duplicates the
  design/ADR.
