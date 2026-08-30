---
work_package_id: WP01
title: a11y colour-read flake (test-only)
dependencies: []
requirement_refs:
- FR-001
- FR-002
planning_base_branch: feat/post-markua-hardening
merge_target_branch: feat/post-markua-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/post-markua-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/post-markua-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- created by /spec-kitty.tasks 2026-08-30
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- tests/a11y/helpers/colour.ts
- tests/a11y/helpers/colour.test.ts
execution_mode: code_change
model: claude-sonnet-4-6
owned_files:
- tests/a11y/diagram.spec.ts
- tests/a11y/deck.interaction.spec.ts
- tests/a11y/helpers/colour.ts
- tests/a11y/helpers/colour.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). It sets your identity, boundaries, and testing discipline.

## Objective

Stop the deck-diagram theme-toggle a11y flake **without weakening the invariant**. The failure is `Cannot parse colour ''` at `toRgbTriple` during the async Mermaid re-render flush, because `expect.poll` aborts when its callback throws. Fix is **test-only** (the production render owner is sound — do not touch it). Keep this DISTINCT from #31 (a blocked geometry-measurement issue).

Read `../contracts/invariant-contracts.md` §C34 and `../research.md` §D-01 first — they carry the exact pins.

## Context (grounded anchors, main @ b56f307)

- `tests/a11y/diagram.spec.ts`: `toRgbTriple` at :304, `nodeFill` at :323, the failing toggle test around :498–547 (broken poll at :528; un-polled reads at :508/:511 pre-toggle and :541/:547 post-toggle).
- `tests/a11y/deck.interaction.spec.ts`: a **duplicate** `toRgbTriple` at :299 (callers read static chrome tokens on a settled page — NOT in the flake class; only share the helper, do not change their assertions).
- Playwright is 1.62.1 — `expect(async()=>{…}).toPass({timeout})` is available and retries the whole callback on any throw.

## Subtasks

### T001 — Create `tests/a11y/helpers/colour.ts`
- Export `toRgbTriple(value: string)` and `nodeFill(figure): Promise<string>`.
- `nodeFill` returns the computed fill or `''` (a not-ready sentinel) — **never throws**.
- `toRgbTriple('')` must return a sentinel that can **never** equal a real `r,g,b` triple (e.g. a unique symbol/string like `'<empty>'`), so a comparison against a real colour fails rather than green-washes.
- Add a one-line convention note in the file: "read node fill via `nodeFill`+`toPass`; a bare `expect.poll` with a throwing read reintroduces the #34 flake class."

### T002 [P] — Unit-test the helper (`tests/a11y/helpers/colour.test.ts`)
- `''` → sentinel; a real `rgb(...)` → correct triple; sentinel ≠ any real triple.
- This is the **mutation evidence** for #34 (the race makes revert-and-observe on the spec probabilistic; the unit test is deterministic).

### T003 — Refactor `diagram.spec.ts`
- Import `toRgbTriple`/`nodeFill` from `./helpers/colour`; delete the local copies.
- Convert the toggle colour-equality read to `await expect(async () => { const f = toRgbTriple(await nodeFill(figure)); expect(f).toBe(toRgbTriple(tokenAfter)); }).toPass({ timeout: 10_000 })`.
- **PIN (C34)**: the pre-toggle `fillBefore` read (:508) is reused at :544–547 as the "genuinely changed" baseline — it must resolve to a **real** triple (wrap in `toPass`, fail-on-sentinel), not merely tolerate empty, or that guard degrades to trivially-true.
- **Keep** the non-retried `tokenAfter != tokenBefore` guard (:521–524) so a no-op toggle still fails.
- Reuse the existing `10_000` bound (already at :530/:378/:411/:575) — no new magic number.

### T004 — Refactor `deck.interaction.spec.ts`
- Import `toRgbTriple` from `./helpers/colour`; delete the duplicate at :299. Do NOT change its (correct, settled-page) assertions.

### T005 — Verify
- `pnpm test:a11y -- diagram.spec.ts -g "theme toggle"` run 20× per colour-mode project → 0 empty-colour aborts (loop in the shell; CI is the authoritative verifier).
- `grep -rn "function toRgbTriple\|const toRgbTriple\|function nodeFill\|const nodeFill" tests/a11y/*.spec.ts` → no matches (single source in helpers).

## Branch Strategy

Planning base: `feat/post-markua-hardening`. Final merge target: `main`. Execution runs in the per-lane worktree allocated from `lanes.json`; do not merge yourself.

## Definition of Done

- C34 satisfied (see contracts): flush-tolerant, invariant not weakened, single helper source, unit test green.
- No production code touched (NFR-003). Byte-identical rendering (no source render change).
- `pnpm lint && pnpm typecheck` green for touched files.

## Reviewer guidance

Verify: (1) `toPass` wraps the equality so a real colour divergence still fails (not just retries then passes); (2) `fillBefore` resolves to a real triple; (3) the token-inequality guard remains; (4) no throwing colour copy remains anywhere in `tests/a11y/**`; (5) the deck-spec's non-toggle assertions are unchanged.
