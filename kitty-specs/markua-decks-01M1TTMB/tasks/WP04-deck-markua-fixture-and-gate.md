---
work_package_id: WP04
title: Deck-Markua fixture + a11y/behaviour gate on the out-of-frame deck route (#47)
dependencies:
- WP03
requirement_refs:
- FR-007
- FR-008
- NFR-001
- NFR-004
planning_base_branch: feat/markua-decks
merge_target_branch: feat/markua-decks
branch_strategy: Planning artifacts for this mission were generated on feat/markua-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-decks unless the human explicitly redirects the landing branch.
subtasks:
- T013
- T014
- T015
- T016
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- example/docs/presentations/markua-deck.md
- tests/a11y/deck-markua.spec.ts
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- example/docs/presentations/markua-deck.md
- tests/a11y/routes.ts
- tests/a11y/deck-markua.spec.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load frontend-freddy` (role: implementer), or `spec-kitty agent profile show frontend-freddy` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: a11y-first (this WP is the proof surface), deterministic CI-serial gates.

## Objective

Ship a published Markua deck fixture and a Playwright+axe gate proving each construct renders on a slide with correct a11y and no boundary swallowed, in both colour schemes. **Depends on WP03** (capability must be live). Read `../spec.md` (FR-007/008, US1-US3, SC-001..003), `../plan.md` (IC-05), `../contracts/deck-markua-gate.md`.

## Critical context (verify before editing)

- Published decks live in `example/docs/presentations/` (`showcase-deck.md`, `roadmap-deck.md`, `feature-tour.md`, `draft-preview.md`). A `kind: Presentation` page under `presentations/` routes out-of-frame to `DeckLayout.astro`.
- `tests/a11y/routes.ts` — `BASE = '/doc-kitty'`; `ROUTES` holds deck routes (e.g. `ROUTES.deck = ${BASE}/presentations/showcase-deck/`, `ROUTES.deckNoDiagram`); `AXE_PAGES` enumerates axe-scanned pages by shell (`'deck'` shell for out-of-frame decks). Note existing `ROUTES.markuaShowcase`/`markuaMalformed` are IN-frame — your new route must be the out-of-frame deck shell.
- `tests/a11y/deck.interaction.spec.ts` — the pattern to mirror: `@axe-core/playwright`, SSR pre-enhancement scan + live reveal-enhanced scan (IX-3b `:322-387`), no-JS fallback, both light/dark.
- Harness: `playwright.config.ts` — preview at `http://localhost:4321/doc-kitty/`, chromium at `/usr/bin/chromium`, sandbox-disabling flags. Pass `--output=<scratchpad>` (test-results/ is root-owned). Rebuild `example/dist` before artifact/link asserts.

## Subtasks

### T013 — Author the fixture `example/docs/presentations/markua-deck.md`
**Steps**: `kind: Presentation`, filed under `presentations/`, with:
- frontmatter `hero_image` (exercises hero-exclusion),
- a mid-deck slide with a `W>` line-prefix aside,
- a slide with an `{aside}…{/aside}` wrapper fully within the slide,
- a `{…}` attribute-list line (e.g. `{.dk-…}`) on a paragraph adjacent to a `###`,
- a body Markua figure `![caption](./resources/…){…}` on a non-title slide (add the referenced image under `example/docs/presentations/resources/` or reuse an existing asset).
Keep it a small, real, presentable deck (it is published — it appears in the example build). Add a short heading/intro so it reads as a genuine showcase, consistent with the other decks.
**Files**: `example/docs/presentations/markua-deck.md` (+ image asset if needed — if you add one outside `owned_files`, record the one-line rationale).
**Validation**: builds; routes at `${BASE}/presentations/markua-deck/`.

### T014 — Register the route
**Steps**: In `tests/a11y/routes.ts`, add `ROUTES.markuaDeck = ${BASE}/presentations/markua-deck/` and an `AXE_PAGES` entry using the `'deck'` shell.
**Files**: `tests/a11y/routes.ts`.
**Validation**: the enumerated axe lane now covers the fixture.

### T015 — The gate `tests/a11y/deck-markua.spec.ts`
**Steps**: New Playwright+axe spec mirroring `deck.interaction.spec.ts`. Assertions (C-COMPOSE / gate contract G1-G5):
- **G1**: the `W>`/`{aside}` slide shows a `.dk-callout` styled aside on the correct slide `<section>`.
- **G2**: the body-figure slide contains `figure.dk-figure > img[alt] + figcaption`; the title slide hero `<img>` has non-empty `alt` and NO `<figcaption>`.
- **G3**: the `{…}`-targeted element carries its class/id; no literal `{…}` text present.
- **G4**: the deck's slide `<section>` count matches the authored slide count (no boundary swallowed / no slide dropped).
- **G5**: zero axe violations (roles, accessible names, `image-alt`) in BOTH colour schemes, pre- and post-enhancement.
**Files**: `tests/a11y/deck-markua.spec.ts`.
**Validation**: `pnpm test:a11y` green including this spec, both schemes.

### T016 — CI-serial + dist hygiene
**Steps**: Confirm the new spec runs under the repo's CI-serial a11y invocation (no parallel-only assumptions). Document the run recipe (preview + `--output=<scratchpad>`), and that `example/dist` must be rebuilt before artifact/link asserts (a killed run can leave a partial dist / exit-144).
**Files**: (spec/comments only.)
**Validation**: repeatable green run.

## Branch Strategy

Planning/base branch: `feat/markua-decks`. Final merge target: `feat/markua-decks` (then a manual PR → `main`). Execution worktrees are allocated per computed lane from `lanes.json`; if no lane worktree is allocated, work directly on `feat/markua-decks`.

## Definition of Done

- Fixture published and routed out-of-frame; gate green (G1-G5) in light + dark.
- SC-001..003 demonstrably met (constructs render; zero a11y violations; boundary preserved).
- Gate is deterministic under CI-serial.

## Risks & reviewer guidance

- **In-frame vs out-of-frame**: reviewer confirms the fixture hits `DeckLayout` (out-of-frame), not the in-frame Markua showcase route.
- **Hero vs body figure**: reviewer confirms G2 actually distinguishes the two (a passing G2 that never renders a body figure is a false pass).
- **Flake**: the existing deck a11y specs use `toPass`/retry patterns for reveal enhancement — reuse them; do not introduce fixed sleeps.
- Depends on WP03 (the capability must be wired live).
