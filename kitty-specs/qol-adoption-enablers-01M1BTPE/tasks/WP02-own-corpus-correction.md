---
work_package_id: WP02
title: Targeted own-corpus Feature correction (#40 dogfood)
dependencies:
- WP01
requirement_refs:
- FR-006
planning_base_branch: feat/qol-adoption-enablers
merge_target_branch: feat/qol-adoption-enablers
branch_strategy: Planning artifacts for this mission were generated on feat/qol-adoption-enablers. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/qol-adoption-enablers unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
history:
- created by /spec-kitty.tasks
- reframed post-tasks squad (fakeable-metric BLOCKER)
agent_profile: curator-carla
authoritative_surface: docs/plans/features/
create_intent: []
execution_mode: code_change
owned_files:
- docs/plans/features/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load your profile via `/ad-hoc-profile-load curator-carla` (role: implementer) and the charter context (`spec-kitty charter context --action implement --json`). State what you applied. You are a knowledge-base curator making careful, minimal, semantically-correct edits — not a bulk find/replace.

## Objective

Produce a **reviewable classification** of all 19 `docs/plans/features/` pages and apply the corrections that are **safe and in-scope**: fix a semantically-wrong `kind` in place; leave `type: Feature` (it is path-derived from the folder and cannot change without creating a mismatch warning); and **file** any page whose *content* genuinely belongs in another section as a relocation follow-up (it cannot be relocated in-scope — see the boundary note). Read `../spec.md` (FR-006, US2, SC-005), `../research.md` (Decision 6), `../decisions/post-spec-squad.md`, and `../decisions/post-tasks-squad.md` (the fakeable-metric BLOCKER that reframed this WP).

## Critical context (post-tasks squad — READ THIS)

- **The naive metric is a trap.** All 19 pages are ALREADY `type: Feature`, and `plans/features/* → Feature` is the hardcoded derivation (`metadata.ts:234`, mjs twin). So authored == derived == `Feature` and the corpus emits **zero** path-mismatch warnings **today, before any work**. "Zero warnings" is therefore a **guard against introducing a bad correction**, NOT proof of completion. Do not treat a green warning count as "done".
- **`type` is effectively frozen here.** Re-typing a page to (say) `Mission` while it stays under `plans/features/` would *create* a path-mismatch warning (authored ≠ derived). And relocating it out of `docs/plans/features/` breaches this WP's owned scope AND needs the deferred `plans/features/ → plans/missions/` rename (C-006a). So genuinely type-misplaced pages are **filed as follow-ups**, not fixed here.
- **`kind` is the in-scope lever.** `kind` is NOT path-derived — correcting a semantically-wrong `kind` (e.g. a portal/report page carrying `kind: Feature` that should be `kind: Explanation`/`Reference` per the divio model) is a legitimate in-place fix that introduces **no** warning.
- Known content-vs-type suspects (verify, don't assume): `mission-status-portal.md`, `qa-portal.md`, `ticketing-report.md` (portal/report content typed `Feature`). Inbound links: only `docs/plans/features/README.md` (WP-owned) links these by filename; other mentions are prose, not links.
- `Feature` REMAINS a valid doc-kitty type. Do NOT change the `plans/features → Feature` derivation rule. Do NOT use the bulk-edit flow (C-002).

## Subtasks

### T008 — Classification (required reviewable deliverable)
- Enumerate all 19 `docs/plans/features/*.md`. Produce a committed classification table (in the commit body and/or a short note appended to `docs/plans/features/README.md`): for each page — path · current `type`/`kind` · content one-liner · verdict ∈ {correct-feature (leave) | kind-wrong (fix kind in place) | type-misplaced (file relocation follow-up)}. This table is the primary reviewable artifact — a reviewer signs off on it, not on a warning count.

### T009 — In-place corrections (kind only)
- For `kind-wrong` pages: correct `kind` to the accurate divio kind; keep `type: Feature`. For `correct-feature` pages: leave untouched. Do NOT re-type; do NOT relocate; do NOT touch the derivation rule. Introduce zero new path-mismatch warnings.

### T010 — File follow-ups + verify + isolated commit
- For each `type-misplaced` page: file (or list for the operator to file) a relocation follow-up, explicitly bundled with the deferred C-006a `plans/features → plans/missions` rename — do NOT relocate here. Run `node src/scripts/validate-frontmatter.mjs docs`: confirm **no new** path-mismatch warnings anywhere (guard). Commit as ONE isolated commit: the classification record + kind corrections + the follow-up list.

## Branch strategy
Planning/base `feat/qol-adoption-enablers`; merge target `feat/qol-adoption-enablers` (PR to `main` later). Lane/worktree from `finalize-tasks`. Depends on WP01 (effective-type semantics settled).

## Definition of Done
- A reviewable classification of all 19 pages exists and is committed (the completion artifact — NOT the warning count).
- Every `kind-wrong` page has its `kind` corrected in place; `type` unchanged; `Feature` still valid; correctly-typed pages untouched.
- Every `type-misplaced` page is filed as a relocation follow-up (bundled with C-006a); none relocated in-scope.
- Zero NEW path-mismatch warnings introduced (guard). One isolated commit.
- If the honest finding is "all 19 are legitimate features", that determination is RECORDED in the classification and reviewed — never silently satisfied by the warning count.

## Reviewer guidance
Do NOT accept a bare "validator shows zero warnings" — that is green before any work. Require the classification table and check each verdict against the page content. Verify `kind` corrections are semantically right, `type` stayed `Feature`, no page was relocated in-scope, no new warnings were introduced, and type-misplaced pages were filed as follow-ups (not silently left mistyped or silently "fixed" into a warning).
