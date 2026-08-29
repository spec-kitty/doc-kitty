---
work_package_id: WP02
title: Deck chrome + wiring + theme CSS
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-003
- NFR-003
- NFR-004
planning_base_branch: fix/reveal-deck-remediation
merge_target_branch: fix/reveal-deck-remediation
branch_strategy: Planning artifacts for this mission were generated on fix/reveal-deck-remediation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/reveal-deck-remediation unless the human explicitly redirects the landing branch.
subtasks:
- T006
- T007
- T008
- T009
history:
- '2026-08-28: authored by /spec-kitty.tasks (planner-priti)'
agent_profile: frontend-freddy
authoritative_surface: src/layouts/
create_intent: []
execution_mode: code_change
owned_files:
- src/layouts/DeckLayout.astro
- src/styles/dk-reveal-theme.css
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Run `/ad-hoc-profile-load frontend-freddy` (role: implementer) BEFORE anything else.
Apply its initialization, boundaries, directives, and tactics. Then read this WP in
full, plus:
- [../spec.md](../spec.md) — FR-001, FR-003, NFR-003, NFR-004; US1 acceptance scenarios.
- [../plan.md](../plan.md) — **IC-01** (theme CSS remediation), **IC-03** (footer chrome),
  and IC-04's DeckLayout "pure wire" note.
- [../contracts/deck-chrome-and-metadata.md](../contracts/deck-chrome-and-metadata.md)
  — **C2** (footer) and **C3** (theme applied), incl. the R4 re-confirmation caveat.
- [../reviews/post-plan-squad.md](../reviews/post-plan-squad.md) — findings **A4** (pure
  wire), **C5** (footer non-fakeable), **C6/R4** (theme root cause), **E1** (leak vector).

## Objective

Fix the #12 chrome and CSS defects. Three things are wrong on the shipped deck: there is
no footer/bottom-banner element at all; the theme is underdeveloped (or the viewport is
transparent — you must confirm which); and the controller must be threaded into the
render owner so #15's per-slide rendering is actually driven.

You own exactly two files:
- `src/layouts/DeckLayout.astro` — add the footer element and change the client wiring to
  a PURE wire that threads WP01's `DeckController` into `initDiagrams`.
- `src/styles/dk-reveal-theme.css` — fill the look-rule gaps and style the footer band.

**Depends on WP01**: you consume its `DeckController` and the `initDiagrams(controller)`
signature. Do not begin the wiring subtask (T008) until WP01's public shape exists.

## Subtasks

### T006 — EMPIRICALLY confirm the CSS root cause BEFORE writing any look rules
This is the first thing you do, and it decides what T009 even is. The interaction spec
comments at `tests/a11y/deck.interaction.spec.ts:237-239` that the deck is "currently
unthemed (transparent viewport, UA-default text)". The theme sheet
`src/styles/dk-reveal-theme.css` already maps `--r-* → var(--dk-*)` and links on the deck
(`DeckLayout.astro:92-96`). So there are two rival root causes (finding C6 / contract C3
caveat):
1. **Underdeveloped look rules** — the map resolves, the deck is branded, but the rules
   are thin (hero overflows, spacing weak). Fix = add look rules (T009 as written).
2. **Token-map NON-resolution** — the `--dk-*` VALUES are not in scope on the viewport
   element, so every `var(--dk-*)` falls back and the viewport is transparent /
   UA-default. Fix = make the `--dk-*` catalog resolve on the viewport (a different fix).

**Run + record T006 against the BUILT deck FIRST — before writing any look rule.** `pnpm
build` the example (or the toolkit's build), open
`dist/.../presentations/showcase-deck/index.html`, and read the computed
`background-color` of the reveal viewport and the `color` of an active heading. Record the
resolved values in one or two sentences at the top of your PR/commit message — this record
is a HARD input to WP05 T023 (which asserts equality against your recorded values and
cannot finalize its targets until you report). Note the scope subtlety already documented
in the sheet header (`dk-reveal-theme.css:9-26`): reveal 6 consumes `--r-background-color`
on the *viewport* (`document.body` when no `.reveal-viewport` ancestor), an ANCESTOR of
`.reveal`, which is why the `--r-*` map lives at `:root`. If the base `--dk-*` catalog
(`theme.css`, linked at `DeckLayout.astro:92`) is not resolving at `:root`, that is cause #2.

**ESCALATION CLAUSE (finding F3/E1) — do not skip.** If your fix for either cause would
require EDITING `theme.css`, **STOP and escalate to the coordinator**. `theme.css` is out
of every WP's `owned_files` and is the globally-injected token catalog — editing it is
mission-forbidden (it is the real NFR-003 leak vector). Your ownership is
`dk-reveal-theme.css` (look rules) and `DeckLayout.astro` (wiring) only. The shipped wiring
suggests cause #1 is the likely reality — the stale `deck.interaction.spec.ts:237-239`
"unthemed" comment predates the base-catalog link, and `theme.css` `:root` tokens already
cascade to the deck viewport — but the escalation clause guards the fork so you never
silently reach outside your ownership to "fix" cause #2.

### T007 — Add the deck footer / bottom-banner (`<footer class="dk-deck-footer">`)
Add a `<footer class="dk-deck-footer">` as a **sibling of `main.reveal`** (NOT inside
`.slides` — it must not enter reveal's slide DOM or be re-rendered per slide). It is a
single `contentinfo` landmark carrying the deck title (`entry.data.title`, already in
scope as `title` at `DeckLayout.astro:74`). Place it after the `<main class="reveal">`
block and before or after the `nav.dk-deck-controls` — but it must NOT overlap the fixed
bottom-right `.dk-deck-controls`.

- It is outside `.slides`, so it is NOT swept into the accessible slide-name logic the
  axe spec asserts (IX-3b), and it is outside the `data-pagefind-body` region so its title
  text is not indexed (no BA-5 interference).
- Keep it a single landmark — do not add a second unnamed `contentinfo`. a11y must stay
  green (NFR-004): no duplicate/unnamed landmark, no new axe violation.

### T008 — Wire `initDeck()→controller→initDiagrams(controller)` as a PURE wire
Today the client script (`DeckLayout.astro:135-170`) imports `initDeck()` (returns void)
and separately calls `renderDeckDiagrams` via `whenRevealReady`. Rewire so the controller
threads through (finding A4 — DeckLayout stays a **pure wire**, zero slide-tracking state).
**Pin the wiring shape (F5)** so a `initDeck()` rejection cannot leave `controller` in the
temporal dead zone:

```ts
let controller: DeckController | undefined;
try {
  controller = await initDeck();
} catch (err) {
  console.warn('[doc-kitty] deck enhancement failed:', err);
}
await whenRevealReady();
await initDiagrams(controller); // controller may be undefined → degraded whole-doc render
```

- Preserve the **accTitle/accDescr ordering guard** (INV-A11Y-ORDERING): diagrams render
  only after `.reveal.ready` — keep the existing `whenRevealReady()` gate and its
  `requestAnimationFrame` beat. Do NOT move diagram rendering earlier.
- Keep the reveal-failure fallback (the existing `.finally`/`whenRevealReady` path) so the
  diagram still renders if reveal itself failed — the shared owner works standalone and the
  SSR `<figure>`/`<pre>` stays the no-JS fallback (INV-FALLBACK, NFR-003). **This degraded
  path deliberately calls `initDiagrams(undefined)`, which renders the WHOLE document once
  (no per-slide scope) — that is the intended degraded-case behaviour when there is no
  controller, NOT a #15 regression (F5)**: #15 only concerns the enhanced deck where the
  controller exists and per-slide scoping applies. WP01 made the initial render gate on
  `currentSlide()`, so the ready-render still happens after reveal readies.
- DeckLayout gains NO reveal knowledge and NO slide state — it only passes the controller
  through. If you find yourself reading `slidechanged` or `getCurrentSlide()` in the
  layout, stop: that belongs in WP01's files.

### T009 — Fill the theme look rules ONLY in `dk-reveal-theme.css` (never `theme.css`)
Based on T006's finding, remediate so the example deck is presentable. Put deck look
rules ONLY in `src/styles/dk-reveal-theme.css` — NEVER in `theme.css` (finding E1:
`theme.css` is the globally-injected token catalog that is ALSO linked on the deck, so a
look rule added there leaks onto every doc page — that is the real NFR-003 leak vector,
not this route-only sheet). Cover the gaps:
- **Hero-image height constraint** (the R4 "hero overflow" gap): constrain the title-slide
  `img` to the reveal stage (e.g. `max-block-size` so it does not overflow the stage).
  WP05 asserts `title-slide img height ≤ reveal stage height` — this rule is what makes
  that pass.
- **Slide content**: padding/measure, list, code, blockquote presentation so slides are
  spaced and legible. So this is OBJECTIVELY checkable (not a subjective "legible"), WP05
  may add one structural assertion — computed `padding` (or `max-inline-size`) on
  `.reveal .slides section` is non-zero — so author these rules such that that holds (F5).
- **Footer band**: position `.dk-deck-footer` at the bottom of the frame, visible on every
  slide, with a brand surface token background (WP05 asserts its background resolves to a
  brand surface token, e.g. `--dk-color-surface-1`). Decide `@media print` visibility
  consistent with the controls (which hide in print).
- Keep EVERY rule scoped under `.reveal` / `.reveal-viewport` / `:root` — a stray global
  selector leaks reveal styling onto doc pages (NFR-003).
- **PRESERVE the BA-4 sentinel** (chrome-artifacts `REVEAL_TOKENMAP_SENTINEL`,
  `src/scripts/assert-chrome-artifacts.mjs:257`): the literal
  `--r-background-color: var(--dk-color-bg)` at `dk-reveal-theme.css:32` must stay
  byte-present (it is the unique marker proving this sheet is emitted). Do not reword,
  reorder-away, or split that assignment.

If T006 found cause #2 (token-map non-resolution), the fix is instead to make the base
`--dk-*` catalog resolve on the viewport — coordinate the finding in your PR note so WP05
writes the correct computed-style targets. Do not silently paper cause #2 with thicker
rules.

## Validation

- `pnpm typecheck` / `npx tsc --noEmit` — the `DeckLayout.astro` client script types
  against WP01's `DeckController`.
- `pnpm lint` on the two changed files.
- `pnpm build` (example) + `node src/scripts/assert-chrome-artifacts.mjs` — the BA-4
  sentinels stay green (esp. `REVEAL_TOKENMAP_SENTINEL`), and the non-leak sample passes.
- Manual: open `dist/.../presentations/showcase-deck/index.html`, confirm the footer shows
  the deck title at the frame bottom on every slide, the hero image is inside the stage,
  and the viewport carries the brand background (record the T006 finding either way).
- The a11y lane stays green (`deck` shell axe scan, no new serious/critical violation).

## Branch Strategy

Planning base and final merge target: `fix/reveal-deck-remediation`. This WP branches
from WP01 (its dependency) in the worktree allocated to its lane in `lanes.json`; changes
merge back into the mission branch. Runs in Wave 2, after WP01.

## Definition of Done

- The deck `<head>` link order is UNCHANGED (reset → core → base `theme.css` → brand
  `tokenCss` → `dk-reveal-theme.css`) — you confirm it, you do not reorder it (IC-01).
- A `<footer class="dk-deck-footer">` renders as a sibling of `main.reveal`, carries the
  deck title, is positioned at the frame bottom on every slide, and does not overlap the
  controls (FR-003, C2). a11y stays green — one `contentinfo` landmark, no new violation
  (NFR-004).
- DeckLayout is a pure wire in the pinned shape (`let controller … try { controller =
  await initDeck() } catch {} … await initDiagrams(controller)`) after `.reveal.ready`,
  with the reveal-failure fallback and zero slide state (IC-04/A4).
- **OBJECTIVE theme checks (not "presentable/legible" — F5)**: the title-slide hero image
  is constrained to the stage (height ≤ stage), the viewport background and heading colour
  resolve to their `--dk-*` tokens, and the footer band background resolves to a brand
  surface token (FR-001, C3) — these are the checkable criteria WP05 asserts. Do NOT list
  "the deck looks presentable/legible" as a checkable DoD item; it is the objective, judged
  by manual review + the token/hero checks, not a gate. All look rules are in
  `dk-reveal-theme.css`, scoped under `.reveal`/`.reveal-viewport`/`:root`; NONE in
  `theme.css` (NFR-003, E1). The `--r-background-color: var(--dk-color-bg)` BA-4 sentinel
  is intact.
- The T006 root-cause finding (thin-rules vs non-resolution) is recorded in the PR/commit
  note for WP05 and the reviewer.
- `ci-ok` green (typecheck, eslint, vitest, example build + artifact asserts, a11y lane).

## Risks

- **Do not begin T008 before WP01's `DeckController` exists** — the signature is the
  coordination point. If WP01 is not yet merged into your base, coordinate.
- The footer must stay OUT of `.slides` — inside it, reveal treats it as slide content and
  the accessible-slide-name logic + Pagefind body would sweep it in.
- If you touch `theme.css` at all for a look rule, you have created the exact NFR-003 leak
  the mission is trying to avoid. Stop.
- Removing/rewording the BA-4 sentinel line reds `assert-chrome-artifacts.mjs` — keep it
  literal.

## Reviewer guidance

- Diff `dk-reveal-theme.css` and confirm every new selector is under
  `.reveal`/`.reveal-viewport`/`:root`; grep the diff for any bare global selector.
- Confirm `theme.css` is NOT in the diff.
- Confirm `DeckLayout.astro` carries no `slidechanged`/`getCurrentSlide`/print-regex — the
  layout is a pure wire.
- Confirm the footer is a sibling of `main.reveal`, not a child of `.slides`.
- Confirm the `--r-background-color: var(--dk-color-bg)` literal is still present.
