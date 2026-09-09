---
work_package_id: WP01
title: Preference core + pre-paint (foundation)
dependencies: []
requirement_refs:
- FR-005
- NFR-001
planning_base_branch: feat/collapsible-toc-rail
merge_target_branch: feat/collapsible-toc-rail
branch_strategy: Planning artifacts for this mission were generated on feat/collapsible-toc-rail. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/collapsible-toc-rail unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-collapsible-toc-rail-01M23HNA
base_commit: 6c6e6ba5cddff757936952bcee24128e83b9b9b6
created_at: '2026-09-09T17:31:08.833367+00:00'
subtasks:
- T001
- T002
- T003
- T004
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/toc-rail/
create_intent:
- src/lib/toc-rail/preference.ts
- src/lib/toc-rail/pre-paint.ts
- src/tests/toc-rail-preference.test.ts
- src/tests/toc-rail-prepaint.test.ts
execution_mode: code_change
owned_files:
- src/lib/toc-rail/preference.ts
- src/lib/toc-rail/pre-paint.ts
- src/tests/toc-rail-preference.test.ts
- src/tests/toc-rail-prepaint.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_001 (pure, testable logic), DIRECTIVE_010 (spec fidelity), DIRECTIVE_051 (no new dependency).

## Objective

Own the collapse preference as pure, blocked-storage-safe logic, and the pre-paint no-flash
script as a testable string. Foundation for WP02 (client) and WP03 (wiring).

Read first: `../spec.md`, `../contracts/toc-rail-contract.md` (**C-1**), `../research.md` (D3/D4), `../plan.md` (IC-01), `../data-model.md` (E-01). Reference (do NOT copy its bare typeof guard): Starlight `ThemeProvider.astro`.

## Subtasks

### T001 — `src/lib/toc-rail/preference.ts`
Pure module: `export const TOC_BREAKPOINT = '72rem'` (and a px const 1152 for tests); `isCollapsed(): boolean` and `setCollapsed(v: boolean): void` reading/writing `localStorage['dk-toc-collapsed']` ('1'/'0'). **Wrap BOTH read and write in try/catch** — private mode has `localStorage` that THROWS on get/set (C-1); on failure fall back to in-session state, never throw. No DOM side effects here (the attribute is set by the client/pre-paint).

### T002 — `src/lib/toc-rail/pre-paint.ts`
`export const PRE_PAINT_SCRIPT: string` — the inline script SOURCE (a classic script body, NOT `type=module`/`defer`/`async`). It reads `localStorage['dk-toc-collapsed']` inside try/catch and, if collapsed, sets `document.documentElement.setAttribute('data-toc-collapsed','')` before paint. Keep it tiny + dependency-free. Export the string so WP03 embeds it in the Starlight `head[]` and tests execute it.

### T003 — vitest node (`src/tests/toc-rail-prepaint.test.ts`, node project)
Assert `TOC_BREAKPOINT` value and that `PRE_PAINT_SCRIPT` is a string containing NO `type="module"`/`defer`/`async` tokens (guards the no-flash contract).

### T004 — vitest jsdom (`src/tests/toc-rail-preference.test.ts`, build/jsdom project)
Execute `PRE_PAINT_SCRIPT` against a jsdom document: sets `data-toc-collapsed` when the stored value is collapsed, no-op otherwise. Test `isCollapsed`/`setCollapsed` round-trip AND a **throwing-storage stub** (getItem/setItem throw) → no exception, in-session fallback (C-1). Use the vitest env that provides a DOM (see src/vitest.workspace.ts for the jsdom/build project).

## Definition of Done
- preference.ts + pre-paint.ts exist; no new dependency.
- Both read and write are try/catch; throwing-storage stub proves no exception (FR-005).
- PRE_PAINT_SCRIPT is a classic (non-async) string; node + jsdom tests pass under `pnpm test`.

## Reviewer guidance
Confirm the try/catch covers the THROW case (not just absent storage), and that the pre-paint string carries no defer/async/module. Confirm no DOM/global writes at import time.

## Branch Strategy
Planning + merge target: `feat/collapsible-toc-rail`. Worktrees per lanes.json. Implement with `spec-kitty agent action implement WP01 --agent claude`.
