---
work_package_id: WP01
title: Deck-capable remark transforms — wrapper safety + forced callouts (#47)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-005
- NFR-001
planning_base_branch: feat/markua-decks
merge_target_branch: feat/markua-decks
branch_strategy: Planning artifacts for this mission were generated on feat/markua-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-decks unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
history:
- created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/
create_intent: []
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/lib/remark/markua-normalise.ts
- src/lib/remark/markua-normalise.internal.ts
- src/lib/remark/markua-callouts.ts
- src/lib/remark/markua-callouts.internal.ts
- src/tests/markua-normalise.test.ts
- src/tests/markua-callouts.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer), or `spec-kitty agent profile show implementer-ivan` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_001 (deck knowledge enters a Markua pass ONLY by delegation through `src/lib/deck/is-presentation.ts` — never import deck-splitting concepts into a transformer body), DIRECTIVE_024 (locality), a11y-first.

## Objective

Make two Markua **remark** passes act correctly on `kind: Presentation` slide content (issue #47, option b). Read `../spec.md` (FR-001/002/005), `../plan.md` (IC-01, IC-02), `../research.md` (D1, D3, D5), and `../contracts/deck-markua-composition.md` (C-COMPOSE-03, C-COMPOSE-04). The ordering decision is settled: **Markua runs before `deckSplit`** (do NOT reorder `config.ts` — that is WP03's file anyway). Your job is the two behavioural changes that make running-before safe and useful.

## Critical context (verify current line refs before editing)

- `src/lib/remark/markua-normalise.internal.ts` — `consumeWrapper` (~`:306-361`) scans the flattened line stream until it finds the matching `{/aside}`/`{/blurb}` close, pushing **every** intervening line — including opaque placeholder lines for headings/`thematicBreak`s (`markua-normalise.ts:261-275` inserts them, with a blank line between nodes) — into the wrapper body. A heading placeholder that falls inside a wrapper is therefore re-parented into the `containerDirective` and **disappears from `root.children`**, so `deckSplit` never sees it as a slide boundary. This is the ONE way a boundary gets swallowed (D3). Line-prefix runs (`consumeLinePrefixRun` ~`:279-284`) already break on any non-prefix line, so they are safe — do not touch them.
- `src/lib/deck/is-presentation.ts` — `isPresentationFile(file)` reads `data.astro.frontmatter.kind === 'Presentation'`. This is the ONLY seam you may use to detect a deck. The VFile passed to a remark transformer carries `file.data.astro.frontmatter`.
- `deckSplit` boundary predicate (reference only, do NOT edit): `deck-split.internal.ts` matches `node.type==='heading' && depth===2|3` and `node.type==='thematicBreak'`.
- `src/lib/remark/markua-callouts.internal.ts` — `decideEmission(...)` (~`:180`) returns `mode:'native'` for a bare mapped class (tip/note/caution/danger) so Starlight's `remarkAsides` rebuilds it as `<aside class="starlight-aside…">`; otherwise it returns the theme (`dk-callout`) hast. `markua-callouts.ts` (~`:89-135`) builds the self-contained `dk-callout` markup.
- **Why force theme on decks (D5)**: `remarkAsides` DOES run on the deck route, but `DeckLayout.astro` links only reveal core + `theme.css` + brand tokens + `dk-components.css` + `dk-reveal-theme.css` — **no `starlight-aside` CSS**. A native aside on a slide is unstyled. The `dk-callout` markup is self-contained and styled by `dk-components.css`, which the deck loads.

## Subtasks

### T001 — `markuaNormalise`: wrapper terminates at a slide boundary on decks
**Purpose**: Guarantee an `{aside}`/`{blurb}` wrapper never swallows a `##`/`###`/`---` boundary (C-COMPOSE-03, INV-1).
**Steps**:
1. In `markua-normalise.internal.ts`, thread deck-awareness into `consumeWrapper` (e.g. pass an `isDeck` boolean derived by the `.ts` wrapper from `isPresentationFile(file)`, or a predicate that recognises a boundary placeholder). Keep the pure/internal module free of Astro imports — pass the flag/predicate in, do not import `is-presentation` into `.internal.ts` if that breaks the unit-test purity boundary; the `.ts` transformer (`markua-normalise.ts`) is where `isPresentationFile(file)` is read.
2. To recognise a boundary placeholder inside the wrapper scan: a placeholder line resolves (via the existing placeholder map) to a node whose `type==='heading' && depth<=3` or `type==='thematicBreak'`. When `isDeck` and the next line to be consumed is such a boundary, **stop the wrapper before it**: close the container with the body accumulated so far, do NOT consume the boundary line, and record a warning.
3. Emit the warning through the same channel the plugin already uses for messages (the `.ts` wrapper re-emits via `file.message(...)`; mirror `deckSplit`'s warning pattern). Message text: `Markua {aside}/{blurb} cannot span a slide boundary; closed at the boundary.`
**Files**: `markua-normalise.internal.ts`, `markua-normalise.ts`.
**Validation**: a deck body `{aside}\n### Slide\n{/aside}` yields a `containerDirective` containing only the pre-heading body, the `### Slide` heading remains a top-level `heading` node, and a warning is recorded. Off a deck, behaviour is byte-identical to today.

### T002 — `markuaCallouts`: force the `dk-callout` theme path on decks
**Purpose**: Deck callouts render styled, self-contained `dk-callout` asides (C-COMPOSE-04, D5).
**Steps**:
1. In `markua-callouts.ts`, read `isPresentationFile(file)` in the transformer and pass a `forceTheme` flag down to `decideEmission` (via `markua-callouts.internal.ts`).
2. In `decideEmission`, when `forceTheme` is set, never return `mode:'native'` — always return the theme (`dk-callout`) emission, for every variant including bare `tip`/`note`/`caution`/`danger`.
3. Keep the non-deck path byte-identical (native for bare mapped classes, theme for attribute-bearing ones).
**Files**: `markua-callouts.ts`, `markua-callouts.internal.ts`.
**Validation**: a `T>`/`W>`/`{aside}`-mapped callout on a deck emits `<aside class="dk-callout dk-callout--…">`, never a native-aside directive; off a deck, unchanged.

### T003 — `dk-callout` accessible name/role
**Purpose**: The forced deck callout must be axe-clean for name/role (NFR-001).
**Steps**:
1. Inspect the `dk-callout` hast in `markua-callouts.ts` (~`:89-135`). A bare `<aside>` nested in a slide `<section>` is not a top-level landmark, so it is unlikely to trip axe — but confirm it has a discernible accessible name where one is expected (e.g. the `dk-callout__title` provides visible text; if a variant renders with no title and only an icon, ensure the icon is not the sole accessible content or add an `aria-label` naming the variant).
2. Prefer the minimal change: only add `aria-label`/`role` if the WP04 gate would otherwise flag it. Document your reasoning in the WP notes so the reviewer can check against the gate.
**Files**: `markua-callouts.ts` (+ `.internal.ts` if the a11y attributes are built there).
**Validation**: covered end-to-end by WP04's axe scan; unit-assert the attribute is present on the built hast if you add one.

### T004 — Unit tests
**Purpose**: Lock T001-T003 at the unit level (tests are in scope for this mission).
**Steps**:
1. `src/tests/markua-normalise.test.ts`: add cases for the wrapper-boundary termination (deck vs non-deck), asserting the heading stays top-level and the warning fires; assert line-prefix runs are unaffected.
2. `src/tests/markua-callouts.test.ts`: add cases asserting forced-theme emission on a deck file and unchanged native emission off a deck; assert any a11y attribute added in T003.
**Files**: the two test files.
**Validation**: `pnpm test` (serial) green for these files.

## Branch Strategy

Planning/base branch: `feat/markua-decks`. Final merge target: `feat/markua-decks` (then a manual PR → `main`). Execution worktrees are allocated per computed lane from `lanes.json`; if no lane worktree is allocated, work directly on `feat/markua-decks`.

## Definition of Done

- T001-T004 complete; `pnpm test` green for the two touched test files.
- No Astro import leaks into the `.internal.ts` pure modules (delegation only).
- Off-deck behaviour byte-identical (no change to non-`Presentation` rendering).
- WP03 can unwrap these passes and rely on them being deck-safe.

## Risks & reviewer guidance

- **Boundary detection correctness**: verify the placeholder→node resolution used to spot a boundary matches how `markua-normalise` already maps placeholders; an off-by-one in the scan could either fail to stop or drop a body line. Reviewer: check nested/fenced wrappers and a wrapper with no close (must still degrade to literal, never throw).
- **Native path regression**: reviewer confirms off-deck callout emission is untouched (the re-derive parity guard and WP10-style `T>`→`starlight-aside--tip` assertions must stay green).
- Do NOT edit `config.ts`, `deck-split.internal.ts`, or `markua-figure.ts` — other WPs own them.
