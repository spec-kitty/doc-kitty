---
work_package_id: WP04
title: Markua minor edges (stacked attrs + vacuous test)
dependencies: []
requirement_refs:
- FR-007
- FR-008
planning_base_branch: feat/post-markua-hardening
merge_target_branch: feat/post-markua-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/post-markua-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/post-markua-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T018
- T019
- T020
history:
- created by /spec-kitty.tasks 2026-08-30
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/markua-attributes.ts
create_intent: []
execution_mode: code_change
model: claude-sonnet-4-6
owned_files:
- src/lib/remark/markua-attributes.ts
- src/tests/markua-attributes.test.ts
- src/tests/markua-callouts.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer) before anything else.

## Objective

Close the two minor Markua edges surfaced in #36 items 2 & 3 (Boy-Scout, domain-matched): the stacked attribute-list paragraph loss, and the vacuous three-form-equivalence test. Behaviour-preserving otherwise.

Read `../contracts/invariant-contracts.md` §C36d/C36e and `../research.md` §D-04 first.

## Context (grounded anchors, main @ b56f307)

- `markua-attributes.ts` `applyBlockFormsToChildren` (~:168–186): greedy one-step attach — with two `{…}` attribute paragraphs stacked directly above one target, the outer attaches to the inner (then spliced out) → the outer attribute list is lost.
- `markua-callouts.test.ts` three-form-equivalence: forms 1 and 3 are built from the identical `run(directive('caution'))` input → vacuous. The authoritative fold lives in `markua-normalise` and the WP10 live-render gate (`tests/a11y/markua.spec.ts`).

## Subtasks

### T018 — Fix `applyBlockFormsToChildren`
- Coalesce consecutive lone `{…}` attribute paragraphs above one target; merge their `entries` and hoisted-`id` channels with **nearest-wins** precedence; attach the merged list to the first non-attribute block; advance the child index past the whole coalesced run (avoid re-processing spliced nodes).

### T019 — Regression test (`markua-attributes.test.ts`)
- `{width:"50%"}` then `{alt:"x"}` stacked above one image → assert **both** attributes land on the image (merged, nearest-wins). This test must fail against the pre-fix code.

### T020 — De-vacuum the callouts three-form test (`markua-callouts.test.ts`)
- Make the three forms exercise genuinely distinct pre-normalisation inputs, OR relocate the equivalence assertion to the `markua-normalise` layer where the fold happens.
- Mutation evidence: verify the test reds when the normalise fold is broken (revert-and-observe is meaningless here since both vacuous and fixed pass today).

## Branch Strategy

Planning base: `feat/post-markua-hardening`. Final merge target: `main`. Per-lane worktree from `lanes.json`. Independent — parallelisable with WP01/WP02.

## Definition of Done

- C36d/C36e satisfied; both new/updated tests are non-vacuous and fail against the respective defect.
- `pnpm --filter @commondocs-kitty/toolkit test markua-attributes markua-callouts` green.
- **Byte-identity (NFR-002)**: this WP edits production `markua-attributes.ts`; no shipped fixture stacks attribute paragraphs, so output is unchanged — confirm via `pnpm build && pnpm assert:markua` green (the corpus check for this WP; the full `diff -r` runs at consolidation).
- `pnpm lint && pnpm typecheck` green.

## Reviewer guidance

Verify: (1) the coalesce advances the index correctly (no double-processing); (2) nearest-wins merge is correct for both `entries` and `id`; (3) the stacked-attr test fails pre-fix; (4) the callouts forms are genuinely distinct (or moved to normalise) and red when the fold breaks.
