# Contract: Slide-aware diagram render (#15)

Behavioural contract for the single Mermaid render owner when it drives a deck.
These are the assertion targets for the FR-008 behaviour tests in
`tests/a11y/deck.interaction.spec.ts`. Covers FR-004, FR-005, NFR-001, NFR-002,
NFR-007.

Owner module: `src/lib/diagram/diagram-render.client.ts` (the ONE module that
calls `mermaid.run`). Deck wiring: `src/lib/deck/reveal-init.client.ts` (exposes
the reveal instance / `slidechanged` + print-view flag) and
`src/layouts/DeckLayout.astro` (invokes the owner after `.reveal.ready`).

---

## Inputs (triggers)

| Trigger | Source |
|---|---|
| Deck ready | `DeckLayout` after reveal `initialize()` settles and `.reveal.ready` is set (preserves the accTitle/accDescr ordering guard) |
| Active-slide change | reveal 6.0.1 `slidechanged` event (`event.currentSlide`), fired on horizontal AND vertical index changes |
| Print view | `/print-pdf/gi.test(window.location.search)` (same predicate `reveal-init` uses to set `view: 'print'`) |
| Theme toggle | `[data-theme]` attribute mutation on `document.documentElement` |

## Outputs (guaranteed behaviour)

1. **Render on activation (FR-004 / NFR-001)**: when a slide with a `pre.mermaid`
   node becomes active, that node is rendered to an `<svg>` whose bounding box has
   width > 0 AND height > 0.
   - The initially-active slide is rendered at ready (no `slidechanged` fires for
     it).
   - Later slides render on their first `slidechanged`.
   - Vertical/nested slides render when the nested leaf first becomes active
     (`event.currentSlide` is the inner `<section>`).
2. **Render-once (FR-005)**: navigating away from and back to a slide leaves
   exactly one `<svg>` for each of its diagram nodes — no duplicate, no blank
   re-render. Already-`data-processed` nodes are skipped on re-activation.
3. **Print completeness**: in `print-pdf` view every slide is visible at once and
   every `pre.mermaid` in the document is rendered in a single pass, so the
   exported PDF contains every diagram.
4. **Theme re-render (FR-005 / DX-4)**: a `[data-theme]` toggle re-renders every
   already-rendered node into the new palette, still exactly one `<svg>` per node
   (restore cached source + clear `data-processed` + one `mermaid.run`).

## Invariants (must hold across all triggers)

- **INV-SINGLE-OWNER / one `mermaid.run` (NFR-002 / NFR-007)**: there is exactly
  one `mermaid.run` call site. Every trigger above funnels through the same
  `render(scope)` closure; the scope (which nodes) varies, the path does not. No
  second render loop is introduced.
- **INV-FOOTPRINT (NFR-002)**: the footprint guard queries the WHOLE document
  (`document.querySelectorAll('pre.mermaid')`) and returns BEFORE
  `import('mermaid')` when the count is 0. A diagram-free deck route resolves 0
  Mermaid runtime chunks. A deck with any diagram imports Mermaid and wires the
  per-slide renderer even when slide 1 is diagram-free.
- **INV-ONE-SVG (NFR-007)**: exactly one `<svg>` per diagram node at all times
  after first render.
- **INV-SCOPE (FR-005 / #15 re-open guard)**: `render(scope)` restores source +
  clears `data-processed` + runs `mermaid.run` over EXACTLY `scope`. The
  `[data-theme]` theme observer passes the RENDERED/VISITED set only — never the
  full cached set — so it never re-runs Mermaid over hidden (`display:none`,
  zero-box) unvisited slides (which would re-open the exact #15 mis-render).
  "Cache all sources up front" and "run only the active scope" are distinct sets
  and must not be conflated.
- **INV-PRINT-OWNER (NFR-002 seam)**: print state has a single owner — reveal-init
  computes `isPrintView` once and exposes it on the `DeckController`; the renderer
  READS `controller.isPrintView` and never recomputes `/print-pdf/gi`.
- **INV-COALESCE (DR-4)**: the in-flight `isRendering` / `rerenderPending` guard is
  preserved; overlapping runs never touch the same nodes at once, so rapid
  navigation cannot produce a double `<svg>` or a thrown run.
- **INV-A11Y-ORDERING (NFR-001)**: diagrams render only after `.reveal.ready`, so
  Mermaid's injected `<title>`/`<desc>` (accessible name) is not stripped mid-init.
- **INV-FALLBACK (NFR-003)**: the server-rendered `<figure>`/`<pre>` remains the
  no-JS fallback; the render owner still runs standalone if reveal itself failed
  (`.finally`, not `.then`, in DeckLayout).

## Assertion mapping (Playwright, behaviour-only — C-001)

All rows below are MANDATORY (squad findings B/C). Box>0 alone is a fakeable proxy
(Mermaid can emit `width="100%"`+viewBox → non-zero on both buggy and fixed builds),
so the FR-004 rows strengthen beyond box>0 and the FR-004 test MUST be proven RED
against the pre-fix build.

| # | Assertion | Requirement |
|---|---|---|
| C1 | Navigate to the DISTINGUISHABLE non-first diagram; its `<svg>` has box>0 AND **MEASURED** internal-node geometry: `getBoundingClientRect()`/`getBBox()` on an internal `<g>`/`<text>` node (via `page.evaluate`) is non-zero, OR the title-slide-box comparison. A **viewBox-derived** "aspect ratio" is FORBIDDEN as the proof (intrinsic to the SVG, non-zero on both buggy and fixed builds — the exact defect); "aspect ratio" is allowed ONLY as a rendered/measured value. Prove the test RED against the pre-fix build. | FR-004 / NFR-001 |
| C2 | Node disambiguation: select the SPECIFIC non-first node by its distinguishable identity after navigating to it — never "some svg on the page" (the already-working title diagram must not let it pass vacuously). | FR-004 |
| C3 | Print-pdf completeness: load the deck with `?print-pdf`, wait for layout, assert EVERY `pre.mermaid` (title + non-first + inner-stack) has an `<svg>` box>0 in ONE pass. | FR-004 / print edge case |
| — | Vertical/nested: navigate into the stack; the inner-stack diagram node renders (box>0 AND measured internal-node geometry non-zero, per C1 — never viewBox-derived). | FR-004 / nested edge case |
| C4 | Theme toggle: the node still has exactly one `<svg>` AND a palette-bearing attribute inside the `<svg>` changed to the other mode's `--dk-diagram-*` value (a no-op toggle must FAIL). Do NOT copy `diagram.spec.ts:135`'s weak assertion. | FR-005 / NFR-007 |
| — | Away-and-back: exactly one `<svg>` per node (no duplicate, no blank re-render). | FR-005 |
| B3 | Toggle theme while a slide-2 diagram is UNVISITED, then navigate to it and assert a correct (non-zero, sane) render. | FR-005 / INV-SCOPE |
| C7 | Diagram-free PUBLISHED deck fixture: 0 request URLs match `/mermaid/i` on that route (Network). | NFR-002 |

No visual/a11y snapshot baseline is added or regenerated.
