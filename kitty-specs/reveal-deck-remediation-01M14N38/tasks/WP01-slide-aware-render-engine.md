---
work_package_id: WP01
title: Slide-aware diagram render engine
dependencies: []
requirement_refs:
- FR-004
- FR-005
- NFR-001
- NFR-002
planning_base_branch: fix/reveal-deck-remediation
merge_target_branch: fix/reveal-deck-remediation
branch_strategy: Planning artifacts for this mission were generated on fix/reveal-deck-remediation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/reveal-deck-remediation unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- '2026-08-28: authored by /spec-kitty.tasks (planner-priti)'
agent_profile: frontend-freddy
authoritative_surface: src/lib/deck/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/deck/reveal-init.client.ts
- src/lib/diagram/diagram-render.client.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Run `/ad-hoc-profile-load frontend-freddy` (role: implementer) BEFORE anything else.
Apply its initialization, boundaries, directives, and tactics. Then read this WP in
full, plus:
- [../spec.md](../spec.md) — FR-004, FR-005, NFR-001, NFR-002; US2 + the Edge Cases.
- [../plan.md](../plan.md) — **IC-04** (the pinned `DeckController` seam + the
  render-scope invariant) and **IC-07** (the header-comment decision record).
- [../contracts/slide-aware-diagram-render.md](../contracts/slide-aware-diagram-render.md)
  — the invariants and the assertion table this WP must satisfy.
- [../reviews/post-plan-squad.md](../reviews/post-plan-squad.md) — findings **A** (seam
  shape), **B** (render-scope / theme-toggle re-open), **D4** (hash deep-link).

## Objective

Fix #15 at the mechanism level. Today the single Mermaid render owner runs once over
EVERY `pre.mermaid` at deck-ready; slides 2+ are hidden (`display:none`, zero-box) at
that moment, so their diagrams render into a zero-box container and mis-render. Make
the render **scope** per-slide — driven by reveal's `slidechanged` event feeding the
SAME single `mermaid.run` call site — while keeping the whole-document footprint guard
and the one-`<svg>`-per-node invariant.

You own exactly two files:
- `src/lib/deck/reveal-init.client.ts` — the sole reveal.js importer. It gains a narrow
  **`DeckController`** facade and becomes the single owner of print state.
- `src/lib/diagram/diagram-render.client.ts` — the single Mermaid render owner. Its
  `render()` closure is parameterized by **scope**; in deck mode it accepts the
  `DeckController`.

You do NOT touch `DeckLayout.astro` (WP02 wires the two together). Your public surface
is the coordination point — keep it a narrow facade so DeckLayout gains zero reveal
knowledge.

## Subtasks

### T001 — `DeckController` facade in `reveal-init.client.ts`; single print-state owner
Today `initDeck()` returns `void` and keeps the reveal instance private
(`reveal-init.client.ts:53,75-79`). Change its shape to return a **narrow facade**,
NOT the raw `Reveal` object (reveal-init must stay the sole reveal importer; the
existing `DeckInstance` interface at `:39-43` is already an anti-corruption facade —
extend that pattern). Target surface (finding A2):

```ts
export interface DeckController {
  onSlideChange(cb: (currentSlide: Element) => void): void;
  isPrintView: boolean;
  currentSlide(): Element | null;
}
```

- `onSlideChange` subscribes to reveal 6.0.1's `slidechanged` event and invokes `cb`
  with `event.currentSlide` (fires on BOTH horizontal and vertical index changes).
- `isPrintView` is computed ONCE here (`/print-pdf/gi.test(window.location.search)` —
  the predicate already at `:65`) and exposed as a field. reveal-init is the **single
  owner of print state** (finding A3 / INV-PRINT-OWNER): the renderer READS this flag
  and never recomputes the regex — that kills a whack-a-field drift hazard
  (DIRECTIVE_044).
- `currentSlide()` returns reveal's current leaf slide (`deck.getCurrentSlide()`, the
  `.present` leaf). Needed because `hash:true` (`:69`) means a deep-link (`…/#/2`)
  makes the initially-active slide NOT slide 1, and `slidechanged` does NOT fire for it
  (finding D4).

**Extend the hand-declared `DeckInstance` interface (F5)**: the local `DeckInstance`
interface at `reveal-init.client.ts:39-43` currently declares only `initialize`/`prev`/
`next`. Add the two members the controller needs — `on(type: string, cb: (event: {
currentSlide: Element }) => void): void` (reveal 6 exposes `on`/`off`) and
`getCurrentSlide(): Element | null`. The squad (Freddy) confirmed reveal 6.0.1 exposes
`on`/`off`/`getCurrentSlide` and that `slidechanged` carries a top-level
`event.currentSlide`. Keep it a thin, typed subset — do not pull reveal's full types.

Keep `initDeck()` still initializing reveal, wiring the prev/next buttons, and honouring
reduced-motion + print config exactly as today. Return the `DeckController` at the end.
Validate: `pnpm typecheck` (or `npx tsc --noEmit`) and `pnpm lint` on this file.

### T002 — Parameterize `render(scope)` in `diagram-render.client.ts`; ONE `mermaid.run`
Today `render()` (`:94-126`) restores source + clears `data-processed` over the WHOLE
`nodes` set, then runs once. Refactor so the closure takes a **scope** — the exact set
of nodes to restore + clear + run over:

```ts
const render = (scope: ArrayLike<HTMLElement>): void => { … mermaid.run({ nodes: scope }) … }
```

- **INV-SINGLE-OWNER (NFR-002/NFR-007)**: there must remain **exactly one**
  `mermaid.run` call site. The scope varies; the code path does not. Do NOT add a second
  loop or a second entry point.
- **INV-FOOTPRINT (NFR-002)**: keep the guard `const nodes = document.querySelectorAll(
  'pre.mermaid'); if (!nodes.length) return;` BEFORE `import('mermaid')`, querying the
  WHOLE document. A diagram-free deck resolves 0 Mermaid chunks; a deck whose slide 1 is
  diagram-free but slide 2 has a diagram STILL imports Mermaid and wires the per-slide
  renderer (the guard must not query only the active slide).
- Keep the per-node **source cache** (`sources` Map) — cache all sources up front. But
  note the split the squad flagged (finding B2): "cache all sources up front" and "run
  only the active scope" are **two distinct sets**; do NOT conflate them in one variable.
- Preserve the **in-flight coalescing guard** (`isRendering`/`rerenderPending`,
  INV-COALESCE) — but make it scope-aware. When requests with DIFFERENT scopes arrive
  mid-render (e.g. a `slidechanged` and a theme toggle), the coalesced pending scope must
  be the **UNION of the requested node sets (F5)** — a safe superset — so no requested node
  is dropped. Do NOT let a later request overwrite an earlier pending scope; accumulate the
  union (e.g. into a `Set<HTMLElement>`) and run it once the current render settles.

Keep `initDiagrams()` callable with NO argument for the existing doc-page path (it must
stay backward-compatible — `config.ts` injects it page-wide). Add an optional
`controller?: DeckController` parameter for deck mode (T003). Note the degraded case (F5):
when `initDiagrams(undefined)` is called on a DECK (WP02's reveal-failure fallback path
does this), it renders the WHOLE document once with no per-slide scope — that is the
intended degraded behaviour when reveal failed and there is no controller, NOT a #15
regression (per-slide scoping applies only when a controller is present).

### T003 — Deck-mode driver: ready-render of `currentSlide()` + per-slide `onSlideChange`
When `initDiagrams(controller)` is called with a controller (deck mode):

- **Initial render (ready)**: render the nodes inside `controller.currentSlide()` — NOT
  slide 1. If `currentSlide()` is null, fall back to rendering nothing at ready and let
  the first `slidechanged` drive it. This handles the hash deep-link edge case (D4): a
  `…/#/2` load lands on slide 2 with no `slidechanged` firing.
- **Per-slide render**: `controller.onSlideChange((slide) => render(unprocessedIn(slide)))`
  where `unprocessedIn(slide)` selects that slide's `pre.mermaid` nodes that are NOT yet
  `data-processed`. A vertical/nested leaf works automatically because `event.currentSlide`
  is the inner `<section>` (INV — nested edge case).
- **Render-once (FR-005 / INV-ONE-SVG)**: an already-`data-processed` node is skipped on
  re-activation — navigating away and back leaves exactly one `<svg>`. Scope each render
  to unprocessed nodes so a revisit is a no-op.

Reference the DOM shape in `DeckLayout.astro:99-108` (`main.reveal > .slides > section`)
and the leaf-slide definition in `tests/a11y/deck.interaction.spec.ts:28`
(`section:not(:has(section))`) so your per-slide node query matches the real structure.

### T004 — `print-pdf` all-nodes one-pass via `controller.isPrintView`
In `print-pdf` view reveal makes every slide visible at once (no `slidechanged` walk).
When `controller.isPrintView` is true:
- Render EVERY `pre.mermaid` in the document in a **single pass** at ready
  (`render(nodes)` over the whole set), so the exported PDF contains every diagram
  (INV — print edge case; contract row C3).
- Do NOT also subscribe `onSlideChange` in print mode (there is no navigation).
- Read the flag off the controller — never recompute `/print-pdf/gi` here
  (INV-PRINT-OWNER). This is the whole reason reveal-init owns the flag.

Preserve the coalescing guard so a print-mode one-pass cannot overlap a stray observer
fire.

### T005 — Theme observer scoped to VISITED/rendered set (INV-SCOPE); update header comment
This is the strongest-convergence finding (B). The `[data-theme]` MutationObserver
(`:132-135`) currently re-runs the WHOLE `nodes` set. In deck mode that would re-run
Mermaid over hidden (`display:none`, zero-box) UNVISITED slides — re-opening the exact
#15 mis-render. Fix:
- Maintain a **rendered/visited set** (the nodes `render()` has actually processed).
- The theme observer passes **that set only** to `render(scope)` — NEVER
  `allCachedNodes` and never the whole document set (INV-SCOPE). An unvisited slide-2
  diagram is left untouched by a theme toggle and renders correctly (in the new palette)
  only when later navigated to (contract row B3).
- In non-deck (doc-page) mode the visited set is simply "all nodes" (they all render at
  load), so behaviour there is unchanged.

Then discharge **IC-07 / finding A5 / DIRECTIVE_037**: update the `reveal-init.client.ts`
header comment (the "private by design / only reveal importer" note) IN THE SAME CHANGE
that makes the `DeckController` public — so the comment never lies about the module's
public shape. State WHY it is a narrow facade (reveal-init stays the sole reveal
importer; print state has a single owner). A separate ADR is not gate-required; the
module header is where the next reader looks.

## Branch Strategy

Planning base and final merge target: `fix/reveal-deck-remediation`. Work in the
worktree allocated to this WP's lane in `lanes.json`; changes merge back into the
mission branch. This WP has no dependencies and may run in Wave 1 alongside WP03, WP04,
WP06.

## Definition of Done

- `initDeck()` returns a `DeckController { onSlideChange, isPrintView, currentSlide }`;
  reveal-init is still the ONLY `import('reveal.js')` site and the SINGLE owner of the
  `isPrintView` flag (FR-004/FR-005 seam, IC-04, INV-PRINT-OWNER).
- `diagram-render.client.ts` has exactly ONE `mermaid.run` call site (INV-SINGLE-OWNER,
  NFR-002/NFR-007); the whole-document footprint guard is intact (INV-FOOTPRINT).
- A slide-2+ diagram renders on its first `slidechanged`; a hash deep-link renders the
  initially-active slide via `currentSlide()` (FR-004, D4); a nested-stack leaf renders
  when it becomes active.
- Navigating away and back leaves exactly one `<svg>` per node (FR-005, INV-ONE-SVG); a
  `[data-theme]` toggle re-renders only the VISITED set (INV-SCOPE) so an unvisited
  slide-2 diagram is never rendered into a zero-box; the coalescing guard is preserved
  (INV-COALESCE).
- `print-pdf` renders every node in one pass driven by `controller.isPrintView` (C3).
- The `reveal-init.client.ts` header comment is updated to describe the public
  `DeckController` shape and why it is a narrow facade (IC-07, DIRECTIVE_037).
- `typecheck` + `eslint` + `vitest` green on the changed scope; the existing doc-page
  diagram path (`initDiagrams()` no-arg) still works unchanged.
- **Proof-deferral note (F5)**: the three render-BEHAVIOUR items above (slide-2+ renders on
  first `slidechanged`; hash deep-link renders via `currentSlide()`; nested-stack leaf
  renders when active) are NOT discharged by this WP on manual attestation — their live
  proof lives in **WP05 T019/T020**. A Wave-1 reviewer approving WP01 in isolation is
  approving the code shape (single owner, single flag owner, scope discipline, union
  coalescing), and explicitly DEFERRING behavioural proof to WP05; do not mark those three
  items "verified" from a local run (broken node_modules; CI/WP05 is the verifier).

## Risks

- **Highest-complexity concern.** The one trap is conflating "cache all sources" with
  "run only the active scope" — keep them separate variables (finding B2).
- The footprint guard MUST query the whole document, or a deck whose slide 1 is
  diagram-free never imports Mermaid and later slides never render — while a genuinely
  diagram-free deck must still resolve 0 chunks (NFR-002, both directions).
- `slidechanged` fires for horizontal AND vertical index changes; do not assume only
  top-level slides.
- Do not change the accTitle/accDescr ordering guarantee — that lives in DeckLayout
  (WP02); your ready-render must still only run after `.reveal.ready`, which WP02 gates.

## Reviewer guidance

- Grep the two files for `mermaid.run` — there must be exactly one occurrence.
- Confirm `/print-pdf/gi` appears ONLY in `reveal-init.client.ts`, not in the renderer.
- Check that the theme observer's scope argument is the visited set, not the whole
  document / full cache — the single most important line for #15 not re-opening.
- Confirm `initDiagrams()` still has a zero-arg call path for doc pages.
