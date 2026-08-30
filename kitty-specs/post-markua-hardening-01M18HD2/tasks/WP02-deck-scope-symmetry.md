---
work_package_id: WP02
title: deck-scope symmetry (one predicate + registration-site wrap)
dependencies: []
requirement_refs:
- FR-005
- FR-006
- NFR-002
planning_base_branch: feat/post-markua-hardening
merge_target_branch: feat/post-markua-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/post-markua-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/post-markua-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
- T010
- T011
history:
- created by /spec-kitty.tasks 2026-08-30
agent_profile: implementer-ivan
authoritative_surface: src/lib/markua/
create_intent:
- src/lib/deck/is-presentation.ts
- src/lib/markua/deck-guard.ts
- src/tests/deck-guard.test.ts
execution_mode: code_change
model: claude-opus-4-8
owned_files:
- src/lib/deck/is-presentation.ts
- src/lib/markua/deck-guard.ts
- src/lib/config.ts
- src/lib/rehype/markua-figure.ts
- src/lib/remark/glossary-autolink.ts
- src/lib/metadata.ts
- src/tests/deck-guard.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer) before anything else.

## Objective

Make **all five** Markua passes no-op on Presentation (deck) pages as a property of **registration-array membership** — closing the N-1 guard asymmetry (only `markua-figure` is deck-aware today) permanently. Owner decision is **(a) decks Markua-agnostic**; (b) is deferred. Every change must be **byte-identical** on today's corpus (decks contain zero Markua).

Read `../contracts/invariant-contracts.md` §C36a/C36b/C36c/C36f and `../research.md` §D-03, plus `../data-model.md` S-01/S-02 first.

## Context (grounded anchors, main @ b56f307)

- `config.ts:604` `remarkPlugins: [markuaNormalise, markuaAttributes, markuaCallouts]` and `:606` `rehypePlugins: [markuaFigure, markuaTocDemote]` — both inside `markuaIntegration.updateConfig`. These are the wrap sites.
- `deckSplitIntegration` (def :350, registered :746) is a **separate** integration — the deck processor — **never wrap it**.
- `remarkDirective` (:567) is also unwrapped and **out of scope**: it parses native `:::` before deckSplit. Do NOT widen `guardDeck` to cover explicit `:::` (scope creep) — that is a pre-existing directive/deck interaction.
- Existing runtime deck checks (baseline = **4**): `markua-figure.ts:237` and `glossary-autolink.ts:70` (shape `file.data.astro.frontmatter.kind`), `deck-split.ts:46` (the processor — leave), `metadata.ts:428` (shape `entry.data.kind`).
- The guard **does** fire at remark time — proven by `deck-split.ts` and `glossary-autolink.ts` shipping. Use the defensive optional-chain or it throws on non-Astro VFiles.

## Subtasks

### T006 — `src/lib/deck/is-presentation.ts` (existing dir, new file)
- `export function isPresentationFile(file): boolean` → `file?.data?.astro?.frontmatter?.kind === 'Presentation'` (defensive optional-chain).
- `export function isPresentationEntry(entry): boolean` → `entry?.data?.kind === 'Presentation'`.

### T007 — `src/lib/markua/deck-guard.ts`
- `export function guardDeck(plugin)` → returns a unified plugin that, when `isPresentationFile(file)`, returns the tree untouched; else delegates to `plugin`.
- Preserve the wrapped plugin's `name`/display identity; expose `wrapped.__inner === plugin` (WP03's parity guard sees through this — C-006).

### T008 — Wire `config.ts`
- Wrap the remark array (:604) and rehype array (:606): `[...].map(guardDeck)`.
- Trim the markuaIntegration **FORWARD RULE** docstring breadcrumb to point at the new parity guard (WP03) instead of prose parity instructions.

### T009 — Fold existing copies onto the predicate (behaviour-preserving)
- `markua-figure.ts:237` → use `isPresentationFile(file)` (its existing guard stays correct; now sourced from the predicate).
- `glossary-autolink.ts:70` → `isPresentationFile(file)`.
- `metadata.ts:428` (RSS) → `!isPresentationEntry(entry)` (fold-if-safe: it is `entry.data.kind !== 'Presentation'`; if the shape differs subtly, leave it with a one-line breadcrumb pointing at the predicate rather than risk behaviour change).
- Do NOT fold `deck-split.ts:46` (the processor).

### T010 — `src/tests/deck-guard.test.ts`
- All five passes are no-ops on a Presentation file (feed a deck-shaped VFile; assert tree unchanged).
- **C36f**: every member of the built `:604`/`:606` arrays exposes `__inner` (catches a 6th plugin added outside `.map(guardDeck)`).
- **C36b (automated, post-tasks)**: add a cheap grep/AST guard-count assertion — the runtime `kind === 'Presentation'`/`!== 'Presentation'` count stays ≤ the baseline of 4 and each deck-aware site (except `deck-split`) routes through the predicate. Do not leave C36b review-only.
- **Deck-Markua inertness (C36a)**: feed a deck body containing `{…}`, `W>`, `{aside}` through the guarded remark chain + `deckSplit`; assert the **slide/section structure** equals the marker-free deck (structure-adversarial fixture where unwrapping WOULD change the slide count). Assert structure, not bytes. Scope to Markua-syntax inputs; do not test explicit `:::` (out of scope).

### T011 — Byte-identity check (NFR-002)
- Build baseline (`git stash`) and feat, `diff -r` the built corpus focusing on the deck pages under `example/dist` — expect empty diff. Record the command/result in the WP notes.

## Branch Strategy

Planning base: `feat/post-markua-hardening`. Final merge target: `main`. Per-lane worktree from `lanes.json`. WP03 depends on this WP's `guardDeck.__inner`.

## Definition of Done

- C36a/C36b/C36c/C36f satisfied; runtime deck-guard count does not exceed baseline of 4 (drops as copies fold).
- `deckSplit` and `remarkDirective` untouched/unwrapped.
- Byte-identical build (T011). `pnpm lint && pnpm typecheck && pnpm --filter @commondocs-kitty/toolkit test && pnpm build && pnpm assert:markua` green.

## Reviewer guidance

Verify: (1) both arrays wrapped, deckSplit/remarkDirective NOT; (2) `__inner` exposed and name preserved; (3) predicate uses the defensive optional-chain; (4) folds are behaviour-preserving (no shape mismatch on the RSS fold); (5) the inertness test asserts structure and is structure-adversarial; (6) diff -r is clean.
