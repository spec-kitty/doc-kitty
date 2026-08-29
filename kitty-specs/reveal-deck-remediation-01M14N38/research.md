# Phase 0 Research: Reveal-deck remediation

All findings below are grounded in the actual shipped code (files read: `src/layouts/DeckLayout.astro`, `src/styles/dk-reveal-theme.css`, `src/lib/deck/reveal-init.client.ts`, `src/lib/diagram/diagram-render.client.ts`, `src/lib/remark/deck-split.ts` + `deck-split.internal.ts`, `tests/a11y/deck.interaction.spec.ts`, `example/docs/presentations/showcase-deck.md`, `example/docs/presentations/README.md`, `src/layouts/Hub.astro`). Version facts: Astro ^5.2.0, @astrojs/starlight ^0.32.6, reveal.js 6.0.1 (core + Notes), Mermaid 11.17.1, TypeScript ^5.9.3, Playwright 1.62.1 (`mcr.microsoft.com/playwright:v1.62.1-noble`), Node 22+.

---

## R1 — How the front-matter `description` reaches the title slide, and how to stop it (FR-002)

**Decision**: Remove the `description` paragraph from the title-slide synthesizer
`titleChildren()` in `src/lib/remark/deck-split.internal.ts`. Keep the `title`
`<h1>` and the `hero_image`. Leave `DeckLayout.astro`'s `<meta name="description">`
usage untouched — that is correct metadata usage, not the leak.

**Rationale**: The leak is a *transform* defect, not a DeckLayout defect. In
`deck-split.internal.ts`, `titleChildren(fm)` (lines ~170–201) explicitly does:

```
if (typeof fm.description === 'string' && fm.description.length > 0) {
  kids.push({ type: 'paragraph', children: [{ type: 'text', value: fm.description }] });
}
```

That synthesized paragraph becomes the first title-slide `<section>` body — so the
`description` renders as visible slide content. Separately and correctly,
`DeckLayout.astro` (line 84) uses the same value as `<meta name="description">` in
`<head>`. The showcase deck confirms the surface: its front-matter `description`
("A published reveal.js deck exercising the full out-of-frame pipeline…") is a
long sentence that has no business on the title slide. Dropping the paragraph in
`titleChildren()` is the single-point, root-cause fix; the description survives as
page metadata via the head tag. Authored body content before the first `##` still
appends to the title slide (the showcase deck's opening paragraph) — that is
intended and unaffected.

**Alternatives considered**:
- *Strip the description in DeckLayout / post-render CSS-hide it* — rejected: it
  would hide a symptom, leave the transform emitting dead DOM (still indexed by
  Pagefind, still in the no-JS fallback text order the interaction spec asserts),
  and split the title-slide contract across two files.
- *Make description suppression opt-in via a new front-matter flag* — rejected:
  no requirement for per-deck opt-in; adds surface. Spec is unconditional (SC-002:
  "0 stray metadata lines").
- *Keep the paragraph but move it into the speaker-note aside* — rejected: the
  description is page metadata, not speaker content; conflating them is wrong
  domain modelling.

**Parity consequence (must be handled in the same change)**: `src/tests/deck-split.test.ts`
currently asserts the description paragraph is synthesized; those assertions must
be updated to assert its ABSENCE. ADR-0012 FR-003 ("always emit a titled slide")
stays satisfied — the title slide is still synthesized and still carries its
`<h1>` title.

---

## R2 — Correct reveal 6.0.1 API for slide-aware diagram rendering (FR-004)

**Decision**: Drive per-slide rendering from reveal's `slidechanged` event on the
deck instance, plus an explicit render of the initially-active slide on ready, plus
an all-slides render path when reveal is in print view. `event.currentSlide` scopes
the query to `currentSlide.querySelectorAll('pre.mermaid')`.

**Rationale** (from the shipped `reveal-init.client.ts` + reveal 6.0.1 behaviour):
- The root cause (confirmed in `diagram-render.client.ts`): `initDiagrams()` selects
  ALL `pre.mermaid` and calls `mermaid.run({ nodes })` once at deck-ready. Non-active
  slides are `display:none` (zero-box), so Mermaid lays them out into a zero-size
  container → blank / mis-rendered SVG on slides 2+. Only the visible first slide
  renders correctly.
- Reveal 6 emits `slidechanged` with `{ indexh, indexv, currentSlide, previousSlide }`
  whenever the active slide changes — including vertical/nested index changes — so a
  single `slidechanged` subscription covers both horizontal navigation and
  vertical-stack descent (edge case: "diagram on a vertical (nested) slide"). By the
  time `slidechanged` fires, `currentSlide` is displayed and laid out (non-zero box),
  which is exactly the condition Mermaid needs.
- `slidechanged` does NOT fire for the initial slide (no navigation has occurred), so
  the initially-active slide's diagrams must be rendered explicitly once, at ready.
- **Print/PDF view**: `reveal-init.client.ts` already sets `view: 'print'` when
  `/print-pdf/gi.test(window.location.search)` (reveal 6 folded the print stylesheet
  into core and lays ALL slides out visibly at once). In that mode `slidechanged` is
  not a reliable per-slide trigger — so the renderer detects the same `print-pdf`
  predicate and renders ALL `pre.mermaid` in one pass at ready (they are all
  non-zero-box in print layout). This satisfies the "print / PDF view" edge case:
  every slide's diagram is in the exported PDF.

**Guarding against re-rendering already-processed nodes**: reuse Mermaid's
`data-processed` marker plus a renderer-owned set of nodes already rendered. On
`slidechanged`, render only the active slide's `pre.mermaid` that are not yet in the
rendered set. A node navigated back to is already processed → skipped (FR-005: no
duplicate render, still exactly one `<svg>`). Vertical/nested slides are handled the
same way because `currentSlide` is the innermost active leaf section.

**Alternatives considered**:
- *`slidetransitionend` instead of `slidechanged`* — rejected: it does not fire when
  transitions are disabled (reduced-motion sets `transition: 'none'`; the deck also
  runs instant transitions in tests), so diagrams could never render for those users.
  `slidechanged` fires regardless of transition.
- *IntersectionObserver on each `pre.mermaid`* — rejected: reveal keeps off-screen
  slides in the DOM with transforms/visibility that fool intersection ratios; and it
  would be a second, parallel trigger competing with the render owner (NFR-002 risk).
- *Render everything once at ready but force each hidden slide visible/measured first*
  — rejected: fighting reveal's layout, brittle, and still one big up-front cost on
  diagram-heavy decks.

---

## R3 — Reusing `initDiagrams`'s single owner for a per-slide scope (NFR-002/NFR-007)

**Decision**: Keep `diagram-render.client.ts` as the ONE module with the ONE
`mermaid.run` call site. Parameterize the render *scope* (which nodes a given
`render()` pass targets), not the render *path*. Expose a small controller so
`DeckLayout` can drive per-slide scopes; the existing doc-page `initDiagrams()`
entry (whole-page render + theme observer) stays behaviourally identical.

**Rationale**: The current module already isolates a single `render()` closure that:
caches each node's original source (`sources` Map), restores source + clears
`data-processed`, calls `mermaid.run({ nodes })` exactly once per pass, and coalesces
overlapping runs via the `isRendering`/`rerenderPending` in-flight guard (DR-4). The
minimal, invariant-preserving change is to let the node set that `render()` operates
on be a *scope* rather than always the full page:

- **Footprint guard stays whole-document**: `document.querySelectorAll('pre.mermaid')`
  — `if (!nodes.length) return;` BEFORE `import('mermaid')`. This is the load-bearing
  detail for #15: the guard must ask "does this DECK have any diagram at all?", NOT
  "does the active slide have one?". A deck whose slide 1 is diagram-free but whose
  slide 3 has a diagram must still import Mermaid and wire the per-slide renderer;
  a genuinely diagram-free deck still resolves 0 chunks (NFR-002 preserved). Scoping
  the guard to the active slide would silently break exactly the case #15 is about.
- **One `mermaid.run` call site**: the initial-active-slide render, each
  `slidechanged` render, the print-pdf all-slides render, and the `[data-theme]`
  re-render all funnel through the same `render(scope)` closure. There is never a
  second `mermaid.run`.
- **Per-node source cache stays global to the deck**: cache every deck node's source
  up front (so a later-visible slide's node can be restored/re-rendered on a theme
  toggle), even though it is only *run* when its slide activates.
- **Theme toggle re-render**: the `[data-theme]` observer re-renders the set of
  nodes already rendered (across all visited slides) — restore source, clear
  `data-processed`, one `mermaid.run` — keeping exactly one `<svg>` per node in the
  new palette (FR-005 / DX-4 preserved). Newly-visited slides after a toggle render
  in the current palette via `slidechanged`.
- **In-flight coalescing preserved**: the DR-4 guard still prevents two overlapping
  runs from producing a double `<svg>` under rapid navigation (edge case "rapid
  navigation").

**Shape**: `initDiagrams(options?)` — no-arg (doc pages) keeps today's behaviour;
deck mode receives the reveal instance / a `slidechanged` subscription + print flag
and renders per active slide. The whole-document footprint guard runs first in both
modes. Exact controller signature is an implementation detail for `/spec-kitty.tasks`;
the invariant is: one module, one `mermaid.run`, whole-document footprint guard,
per-slide scope.

**Alternatives considered**:
- *A separate `initDeckDiagrams()` module* — rejected outright: two render loops =
  direct NFR-002/NFR-007 violation, and the F5-spike history in the module header
  exists precisely to avoid a second loop.
- *DeckLayout loops slides itself and calls a low-level render helper per slide* —
  rejected: pushes render orchestration into the layout and risks a second call
  path; the render owner must stay the owner.

---

## R4 — Deck CSS remediation approach (#12a, FR-001/NFR-003)

**Decision**: Keep the `--dk-* → --r-*` token-map architecture and the existing head
link order; remediate by filling the under-developed *look* rules in
`dk-reveal-theme.css` (and adding the footer band from IC-03). Do not reorder the
head links, do not fork a reveal SCSS theme, do not introduce a global stylesheet.

**Rationale**: The head link order in `DeckLayout.astro` is already correct and
load-bearing: `reset.css` → `reveal.css` (core) → base `theme.css` (`--dk-*`) →
brand `tokenCss[]` → `dk-reveal-theme.css` (the `--dk-*→--r-*` map, which reads the
tokens layered before it). Each sheet is emitted with Vite's `?url` suffix and linked
ONLY from the deck document, so reveal's viewport-hijacking core CSS cannot leak onto
doc pages (ADR-0022 D5 / NFR-003). The mapping sheet correctly lives at `:root`
(reveal consumes `--r-background-color` on `document.body`, an ancestor of `.reveal`,
so a `.reveal`-scoped map would never reach it) with the look rules scoped under
`.reveal`/`.reveal-viewport` as belt-and-suspenders. So "CSS not loading" is not a
link/order failure — it is that the *look rules are underdeveloped* (spec's own
wording, and the assumption: remediate to "presentable", not a redesign).

**Concrete gaps to close** (confirmed by reading the sheet; each verified against the
built deck during implementation, not asserted blind):
- **Hero image overflow**: the title slide can carry a `hero_image`; the sheet has no
  `max-block-size`/`object-fit` on `.reveal .slides img`, so a large hero can blow past
  the 960px stage. Add a constrained image rule.
- **Footer band**: `.dk-deck-footer` styling does not exist (the element itself is
  missing — IC-03). Add fixed-bottom positioning, brand-token surface, and a print
  visibility decision, coordinated with the existing `.dk-deck-controls` (bottom-right)
  so they do not collide.
- **Slide content presentation**: verify list markers, blockquote, code-block, and
  spacing rules are present enough to look finished (reveal core is minimal); add the
  small set the shipped example slides exercise.
- **`--r-*` coverage**: confirm the map defines every `--r-*` custom property the
  shipped slides actually read (background, main/heading colours, fonts, sizes,
  block-margin are present); add any the example deck needs and reveal core leaves at
  its hardcoded `#000/#fff` default.

**Alternatives considered**:
- *Fork a reveal SCSS theme (ADR-0022 Option B)* — rejected by the existing ADR and
  re-rejected here: it would duplicate the brand tokens and add a build step; the
  token-map keeps one source of truth.
- *Reorder/duplicate the head links* — rejected: the order is already correct and
  load-bearing; changing it risks the token map resolving before its inputs.
- *A global deck stylesheet* — rejected: violates the route-scoped non-leak contract
  (NFR-003).

---

## R5 — Footer / bottom-banner element (#12c, FR-003)

**Decision**: Add a `<footer class="dk-deck-footer">` as a sibling of `main.reveal`
in `DeckLayout.astro`, fixed to the bottom of the frame so it is visible over every
slide, carrying the deck title (a single `contentinfo` landmark). Style it in
`dk-reveal-theme.css`.

**Rationale**: The footer defect is not a broken footer — there is NO footer element
in the shipped `DeckLayout.astro` (only the `nav.dk-deck-controls` prev/next
cluster). A fixed-position element outside `.slides` renders once and shows on every
slide without per-slide duplication, and does not enter reveal's slide DOM (so it
cannot disturb the accessible slide-name logic or the transform's output the axe spec
asserts). Placed as a sibling of the single `<main>`, it is one `contentinfo`
landmark — clean for axe.

**Alternatives considered**:
- *A per-slide footer injected by the transform* — rejected: duplicates chrome into
  every `<section>`, bloats the DOM/Pagefind body, and risks the accessible-name and
  no-JS-order assertions in the interaction spec.
- *Reuse reveal's slide-number / built-in footer plugin* — rejected: C-004 forbids new
  plugins, and reveal's slide-number is not a branded footer band.

---

## R6 — Presentations-hub instructional banner (FR-006/FR-007)

**Decision**: Author the purpose sentence + "How to use" guidance as presentations-hub
content (prefer the hub body in `example/docs/presentations/README.md`, which is
`kind: Hub`; use `Hub.astro` only if the banner must render for every consumer's
presentations hub). Cover vertical-slide navigation, reveal hotkeys (`Esc` overview,
`S` speaker notes, `F` fullscreen, arrow/space), and PDF export via the browser print
dialog including the "Background graphics" setting.

**Rationale**: The hub already renders its body via `<slot />` before the described-
link list, so body-authored guidance is living documentation with no layout coupling.
The Hub layout deliberately avoids the `<nav>` tag so Pagefind indexes the child link
text; any banner must not carry `data-pagefind-ignore` in a way that drops indexed
text, and must not add an axe violation (NFR-004). The hotkey list is trimmed to what
the shipped reveal 6.0.1 core + Notes build supports (assumption in the spec). PDF
guidance targets reveal 6's `?print-pdf` view — the hub already emits a `?print-pdf`
export link per deck, so the copy tells the reader to use it and enable background
graphics in the print dialog.

**Alternatives considered**:
- *An in-deck help overlay* — rejected by the spec assumption (guidance lives on the
  hub only; no in-deck help affordance required).
- *A shared banner component/primitive* — rejected for now: the M1 precedent
  (DIRECTIVE_024) inlines hub chrome; a shared primitive is out of scope.

---

## R7 — FR-008 verification strategy (C-001)

**Decision**: Add behaviour/DOM assertions to `tests/a11y/deck.interaction.spec.ts`
(live reveal-enhanced deck) plus the FR-002 unit assertion in
`src/tests/deck-split.test.ts`. No visual or a11y snapshot baselines are added or
regenerated.

**Rationale**: C-001 mandates behaviour-only verification. The interaction spec
already drives a live, reveal-ready deck with robust waits (`.reveal.ready`,
`${LEAF_SLIDE}.present`) and per-slide tagging — the right harness to assert:
FR-002 (description absent from slide body, present in `<meta>`), FR-003 (footer
present + non-zero box at frame bottom across navigation), FR-004 (slide 2+ diagram
`<svg>` has width and height > 0), FR-005 (exactly one `<svg>` after away-and-back
and after theme toggle). Diagram render on `slidechanged` is async, so assertions
wait for the `<svg>` rather than reading synchronously. NFR-002's diagram-free
footprint is covered by the existing build-artifact/footprint guard (optionally a
network assertion that no Mermaid chunk loads on a diagram-free deck).

**Alternatives considered**: visual snapshot of the styled deck — rejected by C-001
(no new/regenerated baselines).

---

## Supply-chain security: N/A

This mission adds, upgrades, and removes **no** dependency. reveal.js stays pinned at
6.0.1 (core + Notes; C-004), Mermaid stays 11.17.1 client-side (C-003), no new
plugins, no new packages. There is no `package.json`/lockfile change to audit, so the
Supply-Chain Security planning section is **Not Applicable**.
