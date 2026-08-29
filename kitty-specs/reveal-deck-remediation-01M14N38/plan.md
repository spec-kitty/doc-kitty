# Implementation Plan: Reveal-deck remediation

**Branch**: `fix/reveal-deck-remediation` | **Date**: 2026-08-28 | **Spec**: `kitty-specs/reveal-deck-remediation-01M14N38/spec.md`
**Input**: Feature specification from `/kitty-specs/reveal-deck-remediation-01M14N38/spec.md`

## Summary

Remediate the shipped slide-deck feature (M6, `slide-decks-01M0T72Y`) so hosted
example decks are presentable and multi-slide decks with diagrams work. Three
defect clusters, all confined to the existing out-of-frame deck seam — the deck
architecture (client-side Mermaid, reveal.js 6.0.1 pinned, out-of-frame route)
is preserved unchanged:

- **#12 rendering defects (US1, FR-001/FR-002/FR-003)** — the deck theme is
  underdeveloped, the front-matter `description` is dumped onto the title slide,
  and there is no footer/bottom banner element at all. The description leak is a
  *transform* defect (the title-slide synthesizer emits a `description`
  paragraph), not a DeckLayout defect; the footer is a *missing element*; the CSS
  is remediated by filling gaps in the existing `--dk-* → --r-*` token sheet
  (link order is already correct).
- **#15 slide-scoped diagrams (US2, FR-004/FR-005)** — the single Mermaid render
  owner runs once over every `pre.mermaid` at deck-ready, so slides 2+ (hidden,
  `display:none`, zero-box) mis-render. The fix makes the render *scope*
  per-slide (a reveal `slidechanged` hook feeding the same single `mermaid.run`
  call site) while keeping the whole-document footprint guard and the
  one-`<svg>`-per-node invariant.
- **#12 QOL (US3, FR-006/FR-007)** — add a concise instructional banner to the
  presentations hub covering vertical navigation, reveal hotkeys, and PDF export.

Verification is behaviour/DOM assertions in the Playwright deck interaction suite
only (C-001) — no new or regenerated visual/a11y snapshot baselines. No
dependency is added, upgraded, or removed.

## Technical Context

**Language/Version**: TypeScript ^5.9.3 (ES modules) on Node 22+; Astro ^5.2.0 SSG
**Primary Dependencies**: Astro ^5.2.0 + @astrojs/starlight ^0.32.6; reveal.js 6.0.1 (core + Notes plugin only, dynamic-imported browser-side); Mermaid 11.17.1 (client-side, dynamic-imported inside the footprint guard); remark chain (remark-gfm, the in-repo `deckSplit` remark plugin)
**Storage**: N/A — static SSG; no runtime datastore. Decks are Markdown collection entries prerendered to static HTML.
**Testing**: Vitest unit tests (`src/tests/**`, incl. `deck-split.test.ts`) + Playwright a11y/interaction lane (`tests/a11y/**`) run in the `mcr.microsoft.com/playwright:v1.62.1-noble` container, `@playwright/test` 1.62.1 + `@axe-core/playwright` 4.13.0; example build artifact asserts (`assert:artifacts`)
**Target Platform**: Static site (GitHub Pages) rendered in modern evergreen browsers; no-JS SSR fallback is a first-class requirement
**Project Type**: single (web SSG toolkit + worked `example/` workspace)
**Performance Goals**: A diagram-free deck route resolves 0 Mermaid runtime chunks (NFR-002, inherited NFR-006/FP-1); every diagram renders to a bounding box with width and height > 0 once its slide is active (NFR-001)
**Constraints**: Exactly one `mermaid.run` code path drives all deck diagrams (NFR-002/NFR-007); reveal/deck stylesheets stay route-scoped — 0 reveal core-CSS rules leak onto non-deck pages (NFR-003); a11y stays green with 0 new axe violations (NFR-004); reveal pinned at 6.0.1 core + Notes, no version bump or new plugins (C-004); client-side Mermaid unchanged, no build-time/headless render (C-003); no new dependencies
**Scale/Scope**: The out-of-frame deck route (`presentations/[...slug]`), the shared `DeckLayout`, the single diagram render owner, the reveal initializer, the deck theme sheet, the deck-split transform's title synthesizer, the presentations hub, and the example decks — a bounded remediation, not a redesign

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Charter present at `.kittify/charter/charter.md` / `.kittify/charter/charter.yaml`.
Relevant gates and how this mission satisfies them:

- **Path-scoped CI, single `ci-ok` aggregate (ADR-0007)** — this is a code + a
  small example-content change; the code checks (typecheck, eslint, Vitest,
  example build + artifact asserts) and the Playwright a11y lane must stay green.
  No change to the CI topology. PASS.
- **Tests: Vitest unit + example build asserts + Playwright a11y** — extended,
  not restructured; new coverage is behaviour/DOM assertions in the existing deck
  interaction spec (C-001). The `deckSplit` change is covered by updating the
  existing `deck-split.test.ts` unit tests. PASS.
- **Accessibility WCAG 2.2 AA (axe lane)** — the new footer, banner, and
  per-slide diagram rendering must not introduce a new violation (NFR-004); the
  design keeps accessible slide names and the accTitle/accDescr race guard
  intact. PASS (verified by the existing axe lane; no baseline regeneration).
- **Atomic-design paradigm** — the hub banner is added inside the existing Hub
  layer as inline chrome consistent with the M1 inlined-card precedent
  (DIRECTIVE_024); no new shared primitive is introduced. PASS.
- **Living documentation** — the presentations hub copy (FR-006/FR-007) is the
  behaviour-change-updates-docs discharge for the QOL gap. PASS.
- **ADR immutability** — no accepted ADR is edited. The description-suppression
  decision reinterprets, but does not contradict, ADR-0012's FR-003 ("always emit
  a titled slide"): the title slide is still synthesized and still titled; only
  the redundant description paragraph is dropped. Recording a short ADR/decision
  note is advisable but not gate-required.

No charter gate is violated. **Complexity Tracking is therefore omitted** (see
below).

## Project Structure

### Documentation (this mission)

```
kitty-specs/reveal-deck-remediation-01M14N38/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions/rationale/alternatives
├── data-model.md        # Phase 1 output — deck render-surface entity + state model
├── quickstart.md        # Phase 1 output — maintainer verification walkthrough
├── contracts/
│   ├── slide-aware-diagram-render.md   # #15 behavioural contract (FR-004/FR-005)
│   └── deck-chrome-and-metadata.md     # #12 behavioural contract (FR-001/FR-002/FR-003)
└── tasks.md             # Phase 2 — created by /spec-kitty.tasks, NOT here
```

### Source Code (repository root)

The real surfaces this mission touches (single-project toolkit + `example/`
workspace):

```
src/
├── layouts/
│   ├── DeckLayout.astro          # out-of-frame reveal shell: head link order,
│   │                             #   footer element (NEW), diagram-render wiring
│   └── Hub.astro                 # presentations hub layout host (banner lands here
│                                 #   or in the hub README body — see IC-05)
├── lib/
│   ├── deck/
│   │   └── reveal-init.client.ts # the ONLY reveal.js importer; expose the deck
│   │                             #   instance / slidechanged hook for the renderer
│   ├── diagram/
│   │   └── diagram-render.client.ts  # the SINGLE Mermaid render owner: add a
│   │                                 #   per-slide render SCOPE, one mermaid.run
│   └── remark/
│       ├── deck-split.ts          # remark wrapper (guard) — unchanged shape
│       └── deck-split.internal.ts # titleChildren(): stop emitting the
│                                  #   description paragraph (FR-002 root cause)
└── styles/
    └── dk-reveal-theme.css        # deck theme sheet: fill look-rule gaps +
                                   #   footer styling (#12a/#12c)

src/tests/
└── deck-split.test.ts             # update title-synthesis assertions (FR-002)

tests/a11y/
├── deck.interaction.spec.ts       # extend with FR-002/003/004/005 behaviour asserts
└── routes.ts                      # deck route + slides-root selectors (reuse)

example/
├── docs/presentations/
│   ├── showcase-deck.md           # add a diagram on a NON-first slide (FR-004 target)
│   └── README.md                  # presentations hub body (banner copy if body-authored)
└── src/pages/presentations/[...slug].astro   # deck route (no change expected)
```

**Structure Decision**: Single project. All fixes live in the existing toolkit
(`src/`) plus a minimal example-content addition (`example/docs/presentations/`).
No new modules, no new packages, no directory restructuring. The out-of-frame
route seam and the single-render-owner seam are reused, not replaced.

## Implementation Concern Map

> **Note**: Implementation concerns are NOT work packages and are NOT executable
> units. `/spec-kitty.tasks` translates these into executable WPs — one concern
> may become multiple WPs; multiple small concerns may merge into one WP.

### IC-01 — Deck theme CSS remediation (#12a)

- **Purpose**: Make a published deck look branded and finished rather than
  half-styled, using the existing `--dk-* → --r-*` token approach (no visual
  redesign — spec assumption).
- **Relevant requirements**: FR-001, NFR-003, SC-001; C-001 (verify by DOM/behaviour, not snapshot).
- **Affected surfaces**: `src/styles/dk-reveal-theme.css` (fill under-developed
  look rules: hero-image max-block-size so it does not overflow the stage, slide
  padding/measure, list/code/blockquote presentation, footer band styling from
  IC-03); `src/layouts/DeckLayout.astro` head (confirm — do not reorder — the
  load-bearing link order reset → core → base `theme.css` → brand `tokenCss` →
  `dk-reveal-theme.css`). Verify the `--dk-*→--r-*` map covers every `--r-*`
  reveal reads for the shipped slides.
- **Sequencing/depends-on**: none (foundational); IC-03 layers its footer rules
  onto this sheet.
- **Risks**: NFR-003 non-leak — deck look-rules go ONLY in `dk-reveal-theme.css`
  (route-only `?url` import, BA-4-guarded by `assert-chrome-artifacts.mjs`), NEVER
  in `theme.css` (finding E1: `theme.css` is the GLOBALLY-injected token catalog
  that is ALSO linked on the deck — a look rule added there is the real leak vector
  onto every doc page). Every rule must stay under
  `.reveal`/`.reveal-viewport`/`:root` scope; a stray global selector would leak
  reveal styling onto doc pages. "Underdeveloped" gaps are confirmed against the
  *built* deck, not asserted blind — and R4's "underdeveloped look rules"
  diagnosis is empirically re-confirmed first (the interaction spec still comments
  the deck is "currently unthemed / transparent viewport"; if that holds with the
  sheet linked the root cause is token-map non-resolution, not thin rules — see
  contract C3 caveat).

### IC-02 — Title-slide metadata suppression (#12b)

- **Purpose**: Stop the front-matter `description` from appearing as visible slide
  body text while keeping it as page metadata.
- **Relevant requirements**: FR-002, SC-002; discharged behaviourally under FR-008.
- **Affected surfaces**: `src/lib/remark/deck-split.internal.ts`
  (`titleChildren()` lines ~176-178 — remove the `description` paragraph synthesis;
  keep the `title` `<h1>` and the `hero_image`); `src/layouts/DeckLayout.astro`
  keeps `description` as `<meta name="description">` (correct usage — unchanged);
  `src/tests/deck-split.test.ts` — TWO edits (finding D1): (1) update/remove the
  assertion that currently expects the description paragraph, and (2) fix the
  POSITIONAL hero-index in the FR-003 hero test (`deck-split.test.ts:59-60`):
  removing the description paragraph shifts the hero image from `title.children[2]`
  to `title.children[1]`, so that hero test breaks even though it is about the hero,
  not the description. (Unaffected: the no-`##` test ~:113-127 and the B-05 test
  ~:277-287.)
- **Sequencing/depends-on**: none.
- **Risks**: The transform is registered globally and unit-tested; both the
  description assertion AND the positional hero index in `deck-split.test.ts` WILL
  break and must be updated in the same change (parity risk). ADR-0012 FR-003
  ("always emit a titled slide") stays satisfied — the title slide is still
  synthesized and titled.

### IC-03 — Deck footer / bottom-banner chrome (#12c)

- **Purpose**: Add the currently-missing deck footer/bottom banner so deck chrome
  is complete and consistent on every slide.
- **Relevant requirements**: FR-003, SC-001; discharged behaviourally under FR-008.
- **Affected surfaces**: `src/layouts/DeckLayout.astro` (add a `<footer
  class="dk-deck-footer">` as a sibling of `main.reveal`, fixed to the frame
  bottom so it shows over every slide, carrying e.g. the deck title — a single
  `contentinfo` landmark, not a per-slide element); `src/styles/dk-reveal-theme.css`
  (position/style `.dk-deck-footer`, brand-token surface, `@media print`
  visibility decision).
- **Sequencing/depends-on**: IC-01 (shares the theme sheet).
- **Risks**: a11y — must not add a duplicate/unnamed landmark or an axe violation
  (NFR-004), and must not overlap the fixed `.dk-deck-controls` (bottom-right) or
  the slide content measure. The footer text must not be swept into the
  accessible slide-name logic the interaction spec asserts.

### IC-04 — Slide-aware diagram rendering (#15)

- **Purpose**: Render a diagram on slide 2+ correctly when its slide first becomes
  active, exactly once, without introducing a second Mermaid render loop.
- **Relevant requirements**: FR-004, FR-005, NFR-001, NFR-002; SC-003; edge cases
  (vertical/nested slide, rapid navigation, print-pdf all-slides, theme toggle,
  diagram-free deck).
- **Seam shape (pinned — squad finding A)**: `initDeck()` returns a NARROW
  `DeckController` facade, NOT the raw `Reveal` object (reveal-init stays the sole
  reveal importer; the existing `DeckInstance` type is already an anti-corruption
  facade). Target surface:
  `{ onSlideChange(cb: (currentSlide: Element) => void): void; isPrintView: boolean; currentSlide(): Element | null }`.
  reveal-init is the SINGLE owner of print state — it computes `isPrintView` once
  (`/print-pdf/gi.test(location.search)`) and the renderer READS `controller.isPrintView`,
  never recomputes the regex (kills a whack-a-field drift hazard, DIRECTIVE_044).
  DeckLayout stays a PURE WIRE: `initDeck() → controller → initDiagrams(controller)`,
  with zero slide-tracking state; the initial render still gates on `.reveal.ready`,
  only subsequent renders ride `onSlideChange`.
- **Affected surfaces**: `src/lib/diagram/diagram-render.client.ts` (keep the
  whole-document footprint guard `if(!nodes.length) return` before
  `import('mermaid')`; accept the `DeckController` in deck mode; parameterize the
  render *scope* so the single `render(scope)` closure / single `mermaid.run` call
  site can run over the active slide's unprocessed nodes, the full set in print-pdf
  (`controller.isPrintView`), or the rendered/visited set on a theme toggle;
  preserve the in-flight coalescing guard and the per-node source cache);
  `src/lib/deck/reveal-init.client.ts` (build and return the `DeckController`
  facade wrapping the private reveal instance + the `slidechanged` subscription +
  the single-owned `isPrintView` flag; UPDATE the "private by design / only reveal
  importer" header comment in the same change — finding A5 / DIRECTIVE_037);
  `src/layouts/DeckLayout.astro` (pure wire — thread the controller into
  `initDiagrams`, preserving the accTitle/accDescr ordering guard, no slide state);
  `example/docs/presentations/showcase-deck.md` (add a diagram on a non-first
  slide AND a diagram on an inner stack slide, each with a distinguishable identity,
  as the FR-004 / vertical-nested test targets — findings C2/D5).
- **Render-scope invariant (finding B — strongest convergence)**: `render(scope)`
  restores source + clears `data-processed` + runs `mermaid.run` over EXACTLY
  `scope` — never the whole cached set. The `[data-theme]` observer passes the
  RENDERED/VISITED set, never `allCachedNodes`: re-running over hidden
  (`display:none`, zero-box) unvisited slides would re-open the exact #15
  mis-render. "Cache all sources up front" and "run only the active scope" are two
  distinct sets and must not be conflated in one variable.
- **Edge cases (must be handled)**: (a) **hash deep-link initial slide** — `hash:true`
  means a deep-link (`…/#/2`) makes the initially-active slide NOT slide 1 and
  `slidechanged` does not fire for it, so the ready-render must target
  `controller.currentSlide()` (the `.present` leaf / `getCurrentSlide()`), never
  assume slide 1 (finding D4); (b) **vertical / nested-stack diagram** — a diagram
  on an inner stack slide renders when that nested leaf first becomes active
  (`currentSlide` is the inner `<section>`); (c) **print-pdf** — all slides visible
  at once, render every node in one pass driven by `controller.isPrintView`;
  (d) **theme toggle while a slide-2 diagram is unvisited** — must not render it
  into a zero-box (invariant B), and it must render correctly when later navigated
  to; (e) **rapid navigation** — the in-flight coalescing guard keeps exactly one
  `<svg>` per node.
- **Sequencing/depends-on**: none for the render logic; the FR-008 tests (IC-06)
  depend on this and on the example-deck diagrams (non-first + inner-stack) being
  in place.
- **Risks**: Highest-complexity concern. Must not create a second `mermaid.run`
  path (NFR-002/NFR-007). The footprint guard must query the WHOLE document
  (`pre.mermaid` anywhere in the deck), not the active slide, or a deck whose
  slide 1 is diagram-free would skip the import and never render later slides —
  while a genuinely diagram-free deck still resolves 0 chunks. The
  reveal-instance-private → `DeckController` change is the coordination point three
  files must agree on; keep it a narrow facade so DeckLayout gains no reveal
  knowledge.

### IC-05 — Presentations-hub instructional banner + how-to (#12 QOL)

- **Purpose**: Give first-time readers on-page guidance to operate and export the
  web-hosted decks.
- **Relevant requirements**: FR-006, FR-007, SC-004; assumption (guidance lives on
  the hub only, not inside each deck).
- **Affected surfaces**: The presentations hub — either `src/layouts/Hub.astro`
  (a reusable banner rendered for `kind: Hub` under the presentations section) or
  the hub body copy in `example/docs/presentations/README.md`. Prefer authoring
  the guidance as hub body content (living documentation, no layout coupling)
  unless the banner must appear for every consumer's presentations hub, in which
  case add it in `Hub.astro` scoped to the presentations section. Content: purpose
  sentence + a "How to use" section covering vertical-slide navigation, reveal
  hotkeys (`Esc` overview, `S` speaker notes, `F` fullscreen, arrows/space), and
  PDF export via the browser print dialog including the "Background graphics"
  setting.
- **Sequencing/depends-on**: none.
- **Risks**: Keep the copy aligned to what the shipped reveal 6.0.1 core + Notes
  build actually supports (hotkey list may be trimmed — assumption). Must not
  regress the hub's Pagefind indexing (the Hub layout deliberately avoids the
  `<nav>` tag; any banner must not carry `data-pagefind-ignore` in a way that
  drops indexed text) or its axe cleanliness.

### IC-06 — Behaviour-assertion test coverage (FR-008, now including FR-001)

- **Purpose**: Lock the #12/#15 fixes with DOM/behaviour assertions so they cannot
  silently regress, using the Playwright deck suite only — with NON-fakeable
  definitions-of-done (squad finding C).
- **Relevant requirements**: FR-008, and **FR-001 promoted into the FR-008 locked
  set** (finding C6 — the P1 "first thing an adopter sees" defect must not stay
  manual-only); FR-002/FR-003/FR-004/FR-005; NFR-001/NFR-002; SC-001/SC-005;
  C-001 (behaviour/DOM only — no visual/a11y snapshot baselines).
- **Affected surfaces**: BOTH `tests/a11y/deck.interaction.spec.ts` AND the
  existing `tests/a11y/diagram.spec.ts` (finding D3 — `diagram.spec.ts` already
  owns the deck-diagram / theme-toggle / footprint idioms: `gotoDeckInMode`, the
  deck first-slide `toHaveCount(1)` at ~:115, footprint helpers at ~:190-222; reuse
  them rather than duplicating, and do NOT copy its weak per-page theme-toggle
  assertion at ~:135). Plus `src/tests/deck-split.test.ts` (FR-002 unit level).
  Mandatory assertions:
  - **FR-002** — the front-matter `description` string is present in `<head>`
    `meta[name="description"]` and ABSENT from `.slides` text.
  - **FR-003** — `.dk-deck-footer` `toBeVisible()`, non-empty `textContent`
    containing `entry.data.title`, top edge near the frame bottom, stable across
    navigation (finding C5).
  - **FR-004** — after navigating to the DISTINGUISHABLE non-first diagram node
    (not "some svg" — finding C2), its `<svg>` has box>0 AND a sane aspect ratio /
    non-zero internal `<g>`/`<text>` geometry (box>0 alone is fakeable — finding
    C1); the test MUST be proven RED against the pre-fix build.
  - **FR-004 vertical-nested** — navigating into the stack renders the inner-stack
    diagram node (finding D5).
  - **FR-004 print-pdf completeness** — load the deck with `?print-pdf`, wait for
    layout, assert EVERY `pre.mermaid` (title + non-first + inner-stack) has an
    `<svg>` box>0 in one pass (finding C3 — currently zero assertions).
  - **FR-005** — navigate away and back → exactly one `<svg>` per node; theme
    toggle → still one `<svg>` AND a palette-bearing attribute actually changed to
    the other mode's `--dk-diagram-*` value (no-op toggle must FAIL — finding C4);
    theme-toggle-while-unvisited then navigate renders correctly (finding B3).
  - **FR-001 (promoted)** — non-visual computed-style assertions (no screenshots):
    viewport `backgroundColor` equals the resolved `--dk-color-bg` read from
    `:root` in the same evaluate; active-slide heading `color` equals the resolved
    text-strong token; `.reveal` `font-family` contains the brand sans;
    `.dk-deck-footer` background resolves to a brand surface token; title-slide
    `img` height ≤ reveal stage height (finding C6).
  - **NFR-002 (MANDATORY, not optional)** — a network assertion on a NEW
    diagram-free PUBLISHED deck fixture (after IC-04 the showcase gains diagrams and
    `draft-preview.md` is a draft = different treatment, so no diagram-free
    published deck exists — one must be provisioned): assert 0 request URLs match
    `/mermaid/i` on that route (finding C7).
- **Fixtures / collision notes**:
  - Provision a diagram-free PUBLISHED deck fixture under
    `example/docs/presentations/` for the NFR-002 network test (finding C7).
  - `tests/a11y/routes.ts` deck `renderCount` MUST STAY 1 (finding D2): a slide-2
    diagram is `display:none` at load and renders only on `slidechanged`, so it does
    NOT add to the load-time render count; a naive bump to 2 hangs the axe gate
    forever.
  - The IX-3a hardcoded ordered `slideSentinels` array
    (`deck.interaction.spec.ts:186-192`) may need updating when the new slides are
    added (finding D6).
- **Sequencing/depends-on**: IC-01 (FR-001 computed-style), IC-02, IC-03, IC-04
  (asserts their behaviour); the FR-004 cases depend on the example-deck diagrams
  (non-first + inner-stack) and the diagram-free fixture added around IC-04.
- **Risks**: Live reveal timing — reuse the existing `.reveal.ready` +
  `${LEAF_SLIDE}.present` wait helpers; diagram render on slidechanged is async, so
  assertions must wait for the `<svg>` rather than read synchronously. No snapshot
  assertions (C-001). INV-SINGLE-OWNER (one `mermaid.run`) is unobservable from the
  DOM — enforced by code review plus the now-mandatory NFR-002 footprint assertion
  (finding E4).

### IC-07 — Decision record for the DeckController seam (#15 seam)

- **Purpose**: Record the `DeckController` facade decision so the new
  layout↔reveal↔renderer boundary is not silently introduced (finding A5 /
  DIRECTIVE_003).
- **Relevant requirements**: FR-004/FR-005, NFR-002/NFR-007 (the seam that keeps
  the single render owner and single print-state owner).
- **Affected surfaces**: a short decision/ADR note capturing the
  `DeckController { onSlideChange, isPrintView, currentSlide }` surface and WHY it
  is a narrow facade (reveal-init stays the sole reveal importer; print state has a
  single owner); the `src/lib/deck/reveal-init.client.ts` header comment
  ("private by design / only reveal importer") is updated IN THE SAME CHANGE that
  makes the controller public (DIRECTIVE_037), so the comment never lies about the
  module's public shape.
- **Sequencing/depends-on**: co-delivered with IC-04.
- **Risks**: Keep it a lightweight decision note — no new accepted ADR is required
  by a charter gate; the point is that the boundary change is documented where the
  next reader looks (the module header) rather than discovered.
