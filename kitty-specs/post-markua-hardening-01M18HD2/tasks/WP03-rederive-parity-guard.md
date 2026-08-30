---
work_package_id: WP03
title: re-derive parity drift guard
dependencies:
- WP02
requirement_refs:
- FR-003
- FR-004
planning_base_branch: feat/post-markua-hardening
merge_target_branch: feat/post-markua-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/post-markua-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/post-markua-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T012
- T013
- T014
- T015
- T016
- T017
history:
- created by /spec-kitty.tasks 2026-08-30
agent_profile: implementer-ivan
authoritative_surface: src/tests/
create_intent:
- src/tests/helpers/remark-stack.ts
- src/tests/glossary-substrate-parity.test.ts
execution_mode: code_change
model: claude-opus-4-8
owned_files:
- src/lib/glossary/page-processor.ts
- src/tests/helpers/remark-stack.ts
- src/tests/glossary-substrate-parity.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer) before anything else.

## Objective

Convert the by-convention re-derive parity (`page-processor.ts` mirroring the build remark stack) into a **structural guard** that closes the #16/#20 class: fail the suite when a build remark stage is neither mirrored nor a keyed conscious exclusion, and catch a **wrong** exclusion behaviourally. Depends on WP02 (`guardDeck.__inner`).

Read `../contracts/invariant-contracts.md` §C35, `../research.md` §D-02, and `../data-model.md` S-03/S-04 first.

## Context (grounded anchors, main @ b56f307)

- `page-processor.ts`: the re-derive factory mirrors gfm + smartypants + directive; Markua NOT mirrored (breadcrumb :45–54); gfm/smartypants pinned by comment at :39.
- `markua-attributes.test.ts:334` has a `combinedRemark(integrations, integrationNames)` enumerator that iterates a **hardcoded** name list and `continue`s past unknowns — copy its idea into the new helper but derive names by prefix.
- `config.ts:717–742`: the Markua array is opt-gated — the stack must be built with `markua:true, diagrams:true` + glossary active or it enumerates nothing.
- WP02 wraps the config arrays in `guardDeck`; the enumerator must look through `__inner`.

## Subtasks

### T012 — `src/tests/helpers/remark-stack.ts`
- Enumerate the build's remark stages from the built integrations, selecting integrations by the **`doc-kitty:` name prefix** (not a literal list) so a new `doc-kitty:*` integration cannot slip through.
- See through `guardDeck.__inner` when reading plugin identity.
- **O-1 (ownership)**: `runSetup`/`SetupHook` currently live in `markua-attributes.test.ts` (WP04-owned) — **copy** them into `remark-stack.ts` and loosen the copy. Treat `markua-attributes.test.ts` as **READ-ONLY** for this WP; do not edit it.

### T013 — `src/tests/glossary-substrate-parity.test.ts` (+ page-processor export)
- **D-1 (feasibility)**: `page-processor.ts` today exports only `PageProcessorOptions` + `createPageProcessor` with inline `.use()` chains — there is **no plugin list to derive from**. So first **add an exported `REDERIVE_REMARK_PLUGINS` array** to `page-processor.ts` (WP03 owns that file) as the single source the factory consumes, and derive `MIRRORED` from that export — do NOT hand-list it (hand-listing is the exact false-parity C35 prevents).
- Build the stack with `markua:true, diagrams:true` + glossary active.
- `CONSCIOUS_EXCLUSIONS`: a keyed record with a justification per entry (e.g. `deckSplit`: deck-only; `markuaNormalise/Attributes/Callouts`: opt-in Markua, inert for re-derive today).
- Assert every enumerated remark stage is `MIRRORED` or in `CONSCIOUS_EXCLUSIONS`; **red-on-unclassified** naming the stage.
- **Stage-count floor** + each selected integration registers ≥1 plugin (guards vacuous/SetupHook false-green).

### T014 — Behavioural golden-tree
- Render a small fixture through the build substrate and the re-derive substrate; assert the mdast for the mirrored set is identical. This catches a **wrong** `CONSCIOUS_EXCLUSIONS` entry (excluding a should-be-mirrored stage) — the honesty gap name-classification alone cannot close.

### T015 — Version-parity (close the COP-OUT)
- Assert the resolved `remark-gfm` / `remark-smartypants` versions the substrate imports equal Astro's (or centralise one pin). If genuinely infeasible in test, file a tracked follow-up issue and reference it — **do not** leave a comment-only pin.

### T016 — Trim the in-code breadcrumb
- `page-processor.ts:45–54`: trim the MARKUA/FORWARD-RULE prose to point at this parity guard. The new `REDERIVE_REMARK_PLUGINS` export (T013) is the durable single source the breadcrumb now references.

### T017 — Verify
- Negative: temporarily add a dummy `doc-kitty` remark stage without mirroring/excluding → the parity test reds naming it; revert.

## Branch Strategy

Planning base: `feat/post-markua-hardening`. Final merge target: `main`. Per-lane worktree from `lanes.json`. This WP depends on WP02 — start from a base that includes WP02's `guardDeck`.

## Definition of Done

- C35 satisfied (see contracts): silent-drift closed by construction, wrong-exclusion caught by golden-tree, version axis closed (assertion or tracked issue).
- `pnpm --filter @commondocs-kitty/toolkit test glossary-substrate-parity` green; negative check reds as expected.
- `pnpm lint && pnpm typecheck` green.

## Reviewer guidance

Verify: (1) names derived by prefix, not literal; (2) stage-count floor + ≥1-plugin assertion present (no vacuous green); (3) MIRRORED derived from real plugins; (4) golden-tree actually diffs mdast and would red on a wrong exclusion; (5) version-parity is a real check or a filed issue, not a comment; (6) sees through `__inner`.
