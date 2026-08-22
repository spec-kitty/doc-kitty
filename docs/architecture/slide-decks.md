---
title: Slide decks
description: "How a Markdown-authored deck becomes a static reveal.js presentation: the splitting convention, the build pipeline, and the fallback."
status: draft
updated: 2026-08-22
type: Architecture
kind: Explanation
authors:
  - stijn@sddevelopment.be
tags: [presentations, reveal-js, slide-decks, markua]
related:
  - adr/0012-slide-decks-static-reveal-from-markdown
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0004-amend-common-docs-as-extensible-variation
  - architecture/theming
---

# Slide decks

Presentations are a first-class output pillar alongside the docsite. A deck is
authored as **plain Markdown** — the same authoring surface as every other page —
and rendered as a static [reveal.js](https://revealjs.com) deck outside the docs
frame. The source stays readable as a document; the build enhances it into slides.
This is the human-first, agent-supported posture applied to presentations: no
hand-authored slide HTML, no separate deck DSL.

[ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md) already decided
that a `Presentation` renders through a dedicated reveal.js route with a mandatory
no-JS / reduced-motion fallback; [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md)
added the `presentations/` section. This page and
[ADR-0012](../adr/0012-slide-decks-static-reveal-from-markdown.md) specify the
authoring convention and the build pipeline that sit under those decisions.

Audience: contributors building the deck renderer, and authors writing decks.

## What a deck is

A deck is a page with `kind: Presentation`. The `presentations/` section
(`type: Presentation`) is its home, but the **switch is `kind`**: a `Presentation`
page anywhere routes to the deck renderer, matching the per-kind resolution in
[theming.md](./theming.md). A deck's frontmatter is the normal metadata contract;
`title`, `description`, and `hero_image` feed the title slide and the social card,
and `doc_status: draft` gates the deck from sitemap and feeds like any other page.

## The slide-splitting convention

Splitting is **heading-driven** so the source reads as a normal outline and every
slide carries a heading (the accessibility requirement from ADR-0011):

- A level-2 heading (`##`) starts a new **horizontal** slide.
- A level-3 heading (`###`) starts a **vertical** slide stacked under the current
  horizontal one (down-navigation).
- Content before the first `##` is the **title slide**, built from the page's
  `title`, `description`, and `hero_image`.

For a slide that genuinely has no heading — an image-only slide, a pull quote, a
section divider — a thematic break (`---`) forces a new horizontal slide. That is
the **only** special meaning `---` carries on a `Presentation` page; on every other
kind it stays an ordinary rule.

Splitting happens **at build time** in a remark transform that groups the parsed
Markdown tree into slide `<section>`s. Nothing is split in the browser. This is the
Hugo-style static approach, deliberately not reveal's client-side Markdown plugin
(which fetches raw Markdown and builds slides at runtime — see the alternatives in
ADR-0012).

## Per-slide and per-element controls

Deck-only features are opt-in through **HTML-comment directives**, so a deck still
reads as clean Markdown and, unused, is indistinguishable from prose — the same
superset-not-noticed philosophy the toolkit takes with Markua:

```markdown
## A slide with a dark background
<!-- .slide: data-background-color="#0D0E11" -->

A bullet that appears on click
<!-- .element: class="fragment" -->

Note: speaker note, shown only in the presenter view.
```

- `<!-- .slide: ... -->` sets attributes on the enclosing slide `<section>`
  (background, transition, id).
- `<!-- .element: ... -->` attaches classes or attributes to the **preceding**
  block, which is how reveal fragments (stepped reveals) are declared.
- A `Note:` line (reveal's own convention) becomes an `<aside class="notes">` for
  the presenter view.

The remark transform reads these into real attributes on the static HTML. An
unknown directive **warns rather than fails**, consistent with the toolkit's
open-vocabulary posture.

## The render pipeline

The deck is static and self-contained:

1. **Parse and split.** The remark transform turns one Markdown file into an ordered
   tree of horizontal and vertical slide sections, resolving the directives above.
2. **Emit reveal's DOM.** A dedicated Astro deck route server-renders the sections
   into reveal's structure (`.reveal > .slides > section`), at build (static SSG).
   The full slide DOM exists in the built HTML before any JavaScript runs.
3. **Enhance.** reveal.js — a **self-hosted dependency bundled by Vite, never a
   CDN** — initialises on load and turns the server-rendered sections into an
   interactive deck. reveal enhances existing DOM; it never produces the slides.
4. **Theme.** The deck uses doc-kitty's `--dk-*` tokens through a doc-kitty reveal
   theme that maps the tokens onto reveal's variables, so a deck matches the active
   brand (for example the Spec Kitty dark theme). Decks are the one surface where the
   brand mascot may appear (brand policy C-101); it stays out of all in-frame chrome.

Self-hosting keeps the build CSP-clean and the deck usable offline, consistent with
the toolkit's static posture.

## Accessibility and graceful degradation

The fallback is mandatory, not a nicety (ADR-0011):

- **No-JS / reduced-motion linear form.** Because the slide `<section>`s are emitted
  in document order, a deck with JavaScript disabled renders as a single, readable,
  vertically-scrollable document. reveal only enhances when JS runs, so content is
  never gated behind the deck interaction.
- **Reduced motion.** `prefers-reduced-motion` disables slide transitions.
- **Controls and structure.** Navigation controls are real `<button>`s with
  accessible labels; keyboard navigation works; every slide has a heading (the
  `##`/`###` that created it, or an `aria-label` for a headingless `---` slide).
- **Print / PDF.** The linear fallback is the printable form; reveal's `?print-pdf`
  mode is available for a paginated export.

## Search and SEO

Because decks render **outside** the Starlight frame, their content is not indexed
by virtue of the docs layout. The static slide DOM (the same nodes the linear
fallback shows) must stay in the crawlable page so Pagefind and search engines index
the deck text. This coupling is called out as a build-time check in
[theming.md](./theming.md)'s risk notes and re-stated here.

## Images and assets

Slide images use Astro's optimized image pipeline, like `hero_image`: they are
resized and served in a modern format. A slide background references an optimized
asset through the `.slide` directive, and `hero_image` can drive the title-slide
background.

## Open questions

Deferred, to resolve when the deck renderer is specced (M6), not now:

- The exact `--dk-*` → reveal-variable mapping surface, and whether a deck may
  override the theme per file via a small `deck:` frontmatter block.
- Whether vertical stacks (`###`) ship in v1 or are deferred to keep the first
  renderer flat.
- The reveal.js version pin and its upgrade cadence.
- Verifying Pagefind coverage of the out-of-frame deck route at build.

## References

- [ADR-0012](../adr/0012-slide-decks-static-reveal-from-markdown.md), the deck
  authoring and pipeline decision.
- [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md), the
  `Presentation` route and the mandatory fallback.
- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md), the
  `presentations/` section.
- [Theming and chrome](./theming.md).
