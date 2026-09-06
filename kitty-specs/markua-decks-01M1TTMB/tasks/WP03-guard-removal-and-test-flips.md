---
work_package_id: WP03
title: Guard removal, wiring & parity/inertness test flips (#47)
dependencies:
- WP01
- WP02
requirement_refs:
- FR-003
- FR-006
- FR-009
- NFR-002
- NFR-003
planning_base_branch: feat/markua-decks
merge_target_branch: feat/markua-decks
branch_strategy: Planning artifacts for this mission were generated on feat/markua-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-decks unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
- T010
- T011
- T012
history:
- created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/markua/
create_intent: []
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/lib/config.ts
- src/lib/markua/deck-guard.ts
- src/tests/deck-guard.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer), or `spec-kitty agent profile show implementer-ivan` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_010 (specification fidelity — the ordering/inertness assertions ARE the contract), DIRECTIVE_025 (bring touched tests into agreement with shipped behaviour).

## Objective

Unwrap the four now-deck-capable content passes (keep `markuaTocDemote` guarded) and flip the `deck-guard.test.ts` expectations to the new posture. **Depends on WP01 + WP02** — do not start until those passes are deck-safe. Read `../spec.md` (FR-003/006/009), `../plan.md` (IC-04, IC-06), `../research.md` (D6, D7), `../contracts/deck-markua-composition.md` (C-COMPOSE-01, C-COMPOSE-06).

## Critical context (verify current line refs before editing)

- `src/lib/config.ts` — `:683 remarkPlugins: [markuaNormalise, markuaAttributes, markuaCallouts].map(guardDeck)` and `:685 rehypePlugins: [markuaFigure, markuaTocDemote].map(guardDeck)`. Registration ORDER stays as-is (Markua before `deckSplit` at `:836`); only the `.map(guardDeck)` wrapping changes.
- `src/lib/markua/deck-guard.ts` — the `guardDeck` mechanism is unchanged; only its usage narrows. Keep the module and its `__inner`/name-preservation intact (the parity enumerator resolves identity through `.__inner ?? raw`).
- `src/tests/deck-guard.test.ts` — the tests asserting deck-inertness. Key blocks (verify line refs): membership `:199-220`, per-pass no-op matrix `:143-160` (the `FIVE_PASSES` loop `:143-150`), C36a inertness block `:289-343` (esp. `:331-336` "guarded chain == deckSplit on marker-free deck" and `:338-342` "unguarded changes slide count"), and the markua-figure guard-string checks `:260`/`:266-267`.
- **No change needed** to `src/tests/glossary-substrate-parity.test.ts` (identity-keyed `CONSCIOUS_EXCLUSIONS`, docs-page re-derive fixture has no Markua) or `src/tests/helpers/remark-stack.ts` (`unwrapEntry` tolerates bare entries) — do not edit them; if they go red, something in WP01/WP02 regressed the off-deck path, escalate rather than editing these.

## Subtasks

### T008 — Unwrap the four content passes; keep `markuaTocDemote` guarded
**Steps**:
1. `config.ts:683`: register the three remark passes **bare**: `remarkPlugins: [markuaNormalise, markuaAttributes, markuaCallouts]` (no `.map(guardDeck)`).
2. `config.ts:685`: register `markuaFigure` **bare** and keep `markuaTocDemote` guarded: `rehypePlugins: [markuaFigure, guardDeck(markuaTocDemote)]`.
3. Update the surrounding code comments (the `:681-685` "makes EVERY member a deck no-op" note) to state the new posture: the four content passes are intentionally deck-capable; only `markuaTocDemote` stays guarded (a deck has no on-page ToC). Keep the "never wrap `deckSplit`/`remarkDirective`" note.
**Files**: `config.ts`.
**Validation**: `pnpm build` wires without error; decks now run the four passes.

### T009 — Membership assertions (`deck-guard.test.ts:199-220`)
**Steps**: Rewrite the "wrapped members are exactly the five Markua passes" / "every member exposes `__inner`" assertions to the new truth: the remark array members are bare (`markuaNormalise`/`markuaAttributes`/`markuaCallouts`, no `__inner`); the rehype array is `[markuaFigure (bare), guardDeck(markuaTocDemote)]` — only `markuaTocDemote` exposes `__inner`.
**Files**: `deck-guard.test.ts`.

### T010 — Per-pass no-op matrix (`:143-160`)
**Steps**: The `guardDeck(plugin)`-in-isolation tests still pass mechanically, but they assert stale intent for the four content passes. Retarget: assert `guardDeck` no-ops on a deck for `markuaTocDemote` only; add/adjust assertions that the four content passes, when run bare on a deck VFile, DO act (delegating the actual behaviour proof to their own unit tests + WP04's gate — here just assert they are not deck-guarded at the config site).
**Files**: `deck-guard.test.ts`.

### T011 — C36a inertness block (`:289-343`)
**Steps**: This block currently asserts "guarded chain on a marker deck == deckSplit on the marker-free deck" and "UNGUARDED, the markers change the slide count". Both premises invert. Rewrite to the FR-003 contract (C-COMPOSE-02/03):
- For a deck whose markers do NOT straddle a boundary: full Markua chain + `deckSplit` yields the SAME `deckSection` count/structure as the marker-free deck, AND callouts render as `dk-callout`.
- For a wrapper that DOES straddle a `##`/`###`/`---`: the wrapper closes at the boundary (the boundary survives, slide count preserved) and a warning is recorded (the WP01 behaviour). Keep the structure-adversarial fixture but retarget its assertion to prove the boundary is NOT swallowed.
**Files**: `deck-guard.test.ts`.

### T012 — markua-figure guard-string check (`:260`/`:266-267`)
**Steps**: WP02 removed the blanket `isPresentationFile(file)` self-guard from `markua-figure.ts`. Update the `:266-267` string assertion (and the `:260` runtime-guard-count expectation if affected) to the new hero-skip predicate (e.g. assert the file references `data-deck-hero` rather than the old blanket guard). If WP02 left `isPresentationFile` imported/unused, coordinate — the assertion should reflect the actual shipped guard mechanism.
**Files**: `deck-guard.test.ts`.

## Branch Strategy

Planning/base branch: `feat/markua-decks`. Final merge target: `feat/markua-decks` (then a manual PR → `main`). Execution worktrees are allocated per computed lane from `lanes.json`; if no lane worktree is allocated, work directly on `feat/markua-decks`.

## Definition of Done

- `config.ts` wires four bare content passes + guarded `markuaTocDemote`.
- `deck-guard.test.ts` green with the flipped assertions; `glossary-substrate-parity.test.ts` and `helpers/remark-stack.ts` UNCHANGED and green.
- `pnpm test` (serial) green overall for the touched suites.

## Risks & reviewer guidance

- **N-1 guard-hole framing**: the original design guarded the whole array so a 6th pass is auto-guarded. Now four are intentionally unguarded — reviewer confirms the code comment documents this intent so a future maintainer doesn't "restore" the wrap. `markuaTocDemote` staying guarded is the retained-predicate proof (FR-006).
- **Parity guard must stay green untouched** — if it reds, the off-deck path regressed; do not paper over it by editing the parity test.
- Depends on WP01/WP02 being merged/available in the lane base.
