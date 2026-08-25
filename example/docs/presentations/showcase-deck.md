---
title: Showcase Deck
description: A published reveal.js deck exercising the full out-of-frame pipeline — a title slide, horizontal slides, a vertical stack, a fragment, and speaker notes.
doc_status: active
updated: 2026-08-24
type: Presentation
kind: Presentation
hero_image:
  src: ./assets/showcase-hero.png
  alt: Layered diagram illustrating the doc-kitty slide-deck pipeline
sidebar:
  hidden: true
authors:
  - stijn@sddevelopment.be
---

This opening paragraph appends to the synthesized title slide, and carries the
indexed slide sentinel **quokka showcase sentinel** that Pagefind must resolve to
this deck's own URL.

```mermaid
%% title: Out-of-frame deck pipeline
%% description: The Markdown deck feeds the slide transform, DeckLayout renders the out-of-frame reveal shell, and the shared render owner draws this diagram on the active first slide with the --dk-diagram-* tokens.
flowchart LR
  MD[showcase-deck.md] --> T[slide transform]
  T --> DL[DeckLayout out-of-frame shell]
  DL --> R[shared render owner]
  R --> SVG[themed diagram on first slide]
```

## Horizontal slide with directives

The first `##` opens a fresh horizontal slide. A slide directive paints its
background so the built `<section>` carries the applied attribute.

<!-- .slide: data-background-color="#101828" -->

- Slides are pre-rendered at build; reveal only enhances them.
- This list is revealed as a fragment.

<!-- .element: class="fragment" -->

## Slide that becomes a vertical stack

This paragraph is the first inner slide of the stack.

### Inner stack slide

A `###` heading converts the parent `##` slide into a vertical stack: the
accumulated content becomes inner section one, and this heading opens inner
section two.

---

A thematic break opens this headingless slide, so the transform emits a
`<section>` with an `aria-label` for its accessible name.

Note: armadillo backstage secret — speaker-only content in the notes aside that
must never surface as a Pagefind search result.
