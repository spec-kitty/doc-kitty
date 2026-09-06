---
work_package_id: WP02
title: Figure hero-exclusion — wrap body slide images, never the deck hero (#47)
dependencies: []
requirement_refs:
- FR-004
- NFR-001
planning_base_branch: feat/markua-decks
merge_target_branch: feat/markua-decks
branch_strategy: Planning artifacts for this mission were generated on feat/markua-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-decks unless the human explicitly redirects the landing branch.
subtasks:
- T005
- T006
- T007
history:
- created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/rehype/
create_intent: []
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- src/lib/rehype/markua-figure.ts
- src/lib/remark/deck-split.internal.ts
- src/tests/markua-figure.test.ts
- src/tests/deck-split.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load implementer-ivan` (role: implementer), or `spec-kitty agent profile show implementer-ivan` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_001 (locality; the hero tag is emitted by `deck-split`, consumed by `markua-figure` — a clean producer/consumer seam), a11y-first (this WP exists to PREVENT an `image-alt` regression).

## Objective

Re-solve the PR #33 hero-image conflict (issue #47) so `markuaFigure` wraps deck **body** images as accessible figures while the synthesized **title-slide hero** keeps its populated `<img alt>` and gains no caption. Read `../spec.md` (FR-004, US2), `../plan.md` (IC-03), `../research.md` (D4), and `../contracts/deck-markua-composition.md` (C-COMPOSE-05, INV-2).

## Critical context (verify current line refs before editing)

- `src/lib/rehype/markua-figure.ts` — `markuaFigure()` (~`:236-258`) currently **self-guards the whole deck route**: `:238 if (isPresentationFile(file)) return;`. The header comment (`:224-234`) explains why a blanket wrap breaks the hero: `buildReplacement` (~`:161,173,210-214`) relocates the image `alt` into a `<figcaption>` and empties `<img alt>`, causing an `image-alt` violation + an unwanted caption on the title slide. `loneImageParagraph`/`isImg` (~`:122-143`) match by structure only — a hero and a plain body `![cap](src)` are structurally identical, so "lacks Markua attributes" cannot distinguish them (D4).
- `src/lib/remark/deck-split.internal.ts` — `titleChildren` (~`:170-201`) synthesizes the hero as `{ type:'paragraph', children:[{ type:'image', url, alt }] }` inside the title-slide section, with **no** distinguishing class/data today.
- mdast→hast: an mdast image node's `data.hProperties` become hast element `properties`. So a `data.hProperties['data-deck-hero']` on the mdast image surfaces as `properties['data-deck-hero']` on the hast `<img>`.

## Subtasks

### T005 — Tag the synthesized hero image
**Purpose**: Give `markuaFigure` a reliable discriminator (D4).
**Steps**:
1. In `deck-split.internal.ts` `titleChildren`, set `data: { hProperties: { 'data-deck-hero': '' } }` on the synthesized hero `image` node (merge, don't clobber, if it ever has other data).
2. Keep everything else about the hero node identical (url, alt).
**Files**: `deck-split.internal.ts`.
**Validation**: unit-assert (in `deck-split.test.ts`) the title slide's hero image node carries `data.hProperties['data-deck-hero']`.

### T006 — `markuaFigure`: process decks, skip only the hero
**Purpose**: Wrap body images; never the hero (C-COMPOSE-05).
**Steps**:
1. Remove the blanket `:238 if (isPresentationFile(file)) return;` early-return so the pass runs on decks.
2. In the walk, before wrapping, skip any `<img>` whose `properties['data-deck-hero']` is set (truthy or empty-string present). Also skip the enclosing lone-image `<p>` for that hero image (don't replace it).
3. Everything else (body lone-image paragraphs and inline imgs) wraps as `dk-figure` exactly as today.
4. Decide whether to keep `isPresentationFile` imported at all: it is no longer needed for the blanket guard. If nothing else uses it, remove the now-dead import (WP03's `deck-guard.test.ts` `:266-267` currently asserts the string `isPresentationFile(file)` exists in this file — coordinate: WP03 owns that test and will adjust it; note in your handoff that you removed the self-guard so WP03 updates the assertion).
**Files**: `markua-figure.ts`.
**Validation**: on a deck, a body `![cap](src)` becomes `figure.dk-figure > img[alt] + figcaption`; the hero `<img>` is untouched (non-empty `alt`, no `<figcaption>`).

### T007 — Unit tests
**Purpose**: Lock the discriminator behaviour.
**Steps**:
1. `src/tests/markua-figure.test.ts`: add deck cases — hero-tagged image skipped (alt intact, no figcaption), body image wrapped. Keep existing docs-page cases green.
2. `src/tests/deck-split.test.ts`: assert the hero tag from T005.
**Files**: the two test files.
**Validation**: `pnpm test` green for both.

## Branch Strategy

Planning/base branch: `feat/markua-decks`. Final merge target: `feat/markua-decks` (then a manual PR → `main`). Execution worktrees are allocated per computed lane from `lanes.json`; if no lane worktree is allocated, work directly on `feat/markua-decks`.

## Definition of Done

- T005-T007 complete; `pnpm test` green for the two touched test files.
- Hero `<img alt>` non-empty and un-captioned after the full pipeline (INV-2); body images wrap.
- Producer/consumer seam clean: `deck-split` tags, `markua-figure` consumes.
- Handoff note to WP03 records that the `markua-figure` self-guard string was removed (so `deck-guard.test.ts:266-267` is updated there).

## Risks & reviewer guidance

- **Tag survival**: reviewer confirms `data.hProperties['data-deck-hero']` reaches the hast `<img>` as `properties['data-deck-hero']` (verify against a real build or the hast in a unit test), not lost by the image optimisation pipeline.
- **Body-image false-negative**: a body image that happens to be alone on the first (title) slide must still wrap — the discriminator is the explicit tag, not "is on the title slide". Reviewer checks a fixture where a body image sits on slide 1.
- Do NOT edit `config.ts`, `markua-normalise*`, or `markua-callouts*` — other WPs own them.
