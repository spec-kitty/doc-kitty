---
title: Reveal-deck remediation — rendering fixes + slide-aware diagrams
description: Fixes the shipped reveal.js decks on the docsite (#12) and makes deck diagrams render on every slide, not just the first (#15).
doc_status: active
updated: 2026-08-29
type: Changelog
kind: Changelog
tags: [decks, reveal, diagrams, mermaid, accessibility, slide-aware]
related:
  - architecture/slide-decks
  - architecture/diagrams
---

# 2026-08-29 — Reveal-deck remediation (#12, #15)

The slide-deck feature (M6) shipped a working out-of-frame reveal.js route, but the
deployed example decks had visible rendering defects, and any diagram authored past the
first slide mis-rendered. Both open issues are fixed on one branch. The deck
architecture is unchanged: client-side Mermaid stays the engine, reveal.js stays pinned
at 6.0.1 (core + Notes), and the out-of-frame route seam (ADR-0021/0022) is untouched.

## #12 — Decks render properly on the docsite

- **Deck theme look-rules filled.** `dk-reveal-theme.css` was under-developed, not
  mis-wired — the `--dk-*` catalog already resolves on the out-of-frame route
  (`theme.css` is linked on the deck document). Added the missing presentation rules:
  a hero-image height cap so title imagery fits inside the reveal stage, slide padding,
  list/code/blockquote styling, and a brand footer band. Every new selector is scoped
  under `.reveal` / `.dk-deck-*` / `:root` — the BA-4 route-isolation sentinel
  (`--r-background-color: var(--dk-color-bg)`) is intact, so nothing leaks onto doc
  pages.
- **Footer/bottom banner added.** `DeckLayout` shipped only the nav buttons; a
  `<footer class="dk-deck-footer">` carrying the deck title now renders as a sibling of
  `main.reveal` (outside `.slides`, so it is neither swept into the slide DOM nor
  indexed), positioned at the frame bottom and clear of the nav controls.
- **Front-matter `description` is metadata only.** The deck-split transform
  (`titleChildren`) was synthesizing the `description` as a visible paragraph on the
  title slide; it is now emitted solely as page `<meta>`, so the title slide shows only
  its intended content.
- **Presentations-hub how-to.** The hub gains a purpose banner and a "How to use"
  section — vertical-slide navigation, reveal hotkeys (`Esc` overview, `S` speaker
  notes, `F` fullscreen, arrows/space), and PDF export via the browser print dialog
  (including enabling **Background graphics**).

## #15 — Diagrams render on every slide, not just the first

Client-side Mermaid rendered every `pre.mermaid` in the document once at deck-ready. On
a deck, slides 2+ are `display:none` at load, so a diagram authored there was laid out
into a zero-box container and mis-rendered.

- **A `DeckController` facade.** `reveal-init.client` — the toolkit's sole reveal
  importer — now returns a narrow controller (`onSlideChange` / `isPrintView` /
  `currentSlide`) instead of keeping the instance private, and is the single owner of
  the print-view predicate. `DeckLayout` stays a pure wire: it threads the controller
  into the diagram render owner and holds no slide state.
- **Slide-aware rendering.** The single Mermaid render owner is parameterized to
  `render(scope)`: it renders the initially-active leaf at ready (hash-deep-link safe,
  not hard-coded to slide 1), renders each slide's diagrams the first time it becomes
  active via `slidechanged`, and renders every node in one pass under `?print-pdf`. The
  single `mermaid.run` call site, the whole-document footprint guard (a diagram-free
  deck ships no Mermaid chunk), and exactly-one-`<svg>`-per-node are all preserved. The
  `[data-theme]` re-render is scoped to the **visited** set, so a theme toggle never
  re-runs Mermaid over a hidden, unvisited slide (which would re-open the defect).
- **Layout-settle gate.** reveal flips a slide active a beat before its transform/scale
  flushes; each scoped render waits (a bounded `requestAnimationFrame` poll) for the
  diagram node's own box to be non-zero before running Mermaid, so a newly-shown slide
  is never measured at width 0.

## Verification

Behaviour is locked by the Playwright a11y lane — no visual snapshot baselines (a
deliberate constraint). Assertions cover: the description absent from slide text, the
footer visible/titled/positioned and stable across nav, a slide-2 and an inner-stack
(vertical) diagram rendering after navigation and in print-pdf, exactly one `<svg>`
across away-and-back and theme toggles, the diagram-free deck shipping zero Mermaid
requests, and the deck's computed colours resolving to the brand tokens. Example
fixtures add a non-first-slide and an inner-stack diagram plus a diagram-free published
deck.

A new WCAG fix rode along: a scrollable deck code `<pre>` (the theme gives it
`overflow:auto`, and reveal's fixed stage can make it scroll) is now keyboard-focusable
(`tabindex`), clearing an axe `scrollable-region-focusable` violation.

## Scope

- **#13 (build-time SVG pre-render for Mermaid + PlantUML) is out of scope** — it
  remains a separate future mission; client-side Mermaid is unchanged here.
- **The #15 proof is non-fakeable — structurally.** The slide-two and
  toggle-while-unvisited tests reproduce #15 the way it occurs: load with the diagram's
  slide hidden, assert it is **unrendered while hidden**, then navigate and assert it
  renders. The pre-fix build renders every diagram at load (one whole-document pass), so
  the diagram would already carry an `<svg>` while hidden and fail the "unrendered while
  hidden" step — the test fails on the broken build even though an outer-`<svg>`-box
  check alone would not. A strict *internal-node* geometry assertion is deferred to
  [#31](https://github.com/spec-kitty/doc-kitty/issues/31): both `getBoundingClientRect`
  and `getBBox` read 0 for a correctly-rendered deck diagram in the headless a11y lane
  (confirmed in CI), so no internal measurement is viable there yet. #31 also tracks a
  live deck theme-toggle + dark-luminance gate.

Refs #12, #15
