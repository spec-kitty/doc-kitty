---
work_package_id: WP02
title: Editorial press consumer theme + distinctness verifier
dependencies:
- WP01
requirement_refs:
- FR-002
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/consumption/
create_intent:
- tests/consumption/consumer-fixture/src/theme/index.ts
- tests/consumption/consumer-fixture/src/theme/press.css
- tests/consumption/scripts/assert-consumer-theme.mjs
execution_mode: code_change
owned_files:
- tests/consumption/consumer-fixture/src/theme/**
- tests/consumption/scripts/assert-consumer-theme.mjs
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (separation — the theme is a declarative consumer layer, no logic), DIRECTIVE_010 (spec fidelity).

## Objective

Add a genuinely distinct **editorial/press** consumer theme that extends the
`spec-kitty` brand through the `default → brand → consumer` merge, proving reuse at
N=2, plus an **automated verifier** that the consumer layer actually won.

Read first: `../contracts/consumption-test-contract.md` (C-6), `../research.md` (D4),
`../plan.md` (IC-02), and `src/lib/theme.ts` (the merge: `flattenChain`, `mergeLayers`,
`emitTokenSheet`) + `src/themes/spec-kitty/index.ts` (the brand shape to extend).

## Subtasks

### T008 — `src/theme/index.ts`
`export const pressTheme: DocKittyTheme = { name:'press', extends: specKittyTheme,
tokens: { /* --dk-* only */ }, customCss: ['./src/theme/press.css'] }`, importing the
brand from `@commondocs-kitty/toolkit/themes/spec-kitty/index.ts`. Use the **object**
`tokens` form (a string css-path is `@import`ed at the top of the generated sheet and
would be overridden — inverting precedence). Override ≥5 mode-invariant `--dk-*` tokens
(e.g. `--dk-font-display`, `--dk-color-accent`, a heading colour, a surface, a radius).
**Never** set a `--sl-*` key (it throws).

### T009 — `src/theme/press.css`
Any **mode-varying** colour MUST be declared here under BOTH `:root` and
`:root[data-theme='dark']` — `emitTokenSheet` re-emits mode-varying keys under a
`:root[data-theme='dark']` block (specificity 0,2,0) that out-ranks a bare `:root`
(0,1,0) regardless of load order. Do not drop the dark block. `customCss` layers after
the brand, so mode-invariant overrides win by source order at plain specificity.

### T010 — Wire the theme (documented out-of-map edit)
Add `theme: pressTheme` (and its import) to `astro.config.mjs` (owned by WP01). This is
a **one-line, justified out-of-map edit**; record the rationale in the WP history. Keep
it to the theme wiring only.

### T011 — `tests/consumption/scripts/assert-consumer-theme.mjs` (contract C-6)
Corpus-agnostic. Against the fixture's emitted `:root` token sheet in `dist/`: for each
of the ≥5 named `--dk-*` tokens the press theme sets, assert the emitted value **equals
the press value** AND **differs from the toolkit default** (`press === default` is a
FAIL — it wouldn't prove the override). For any mode-varying token, assert both `:root`
and `:root[data-theme='dark']` carry the press value. Exit non-zero with a per-token
message. This is auto-discovered and run by WP01's orchestrator (`assert-consumer-*.mjs`).

## Definition of Done
- The fixture builds with `pressTheme`; ≥5 `--dk-*` tokens render press values in `dist/`.
- `assert-consumer-theme.mjs` passes and would FAIL if a press token equalled the default.
- No `--sl-*` token set; mode-varying colours carry both `:root` and dark blocks.

## Reviewer guidance
Confirm the verifier is non-fakeable: temporarily set one press token to the default
value and check the verifier goes red. Confirm dark-mode override survives (0,2,0).

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP02 --agent claude`.
