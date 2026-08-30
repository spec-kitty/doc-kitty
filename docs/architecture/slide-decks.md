---
title: Slide decks
description: "How a Markdown-authored deck becomes a static reveal.js presentation: the splitting convention, the build pipeline, and the fallback."
doc_status: active
updated: 2026-08-30
type: Architecture
kind: Explanation
authors:
  - stijn@sddevelopment.be
tags: [presentations, reveal-js, slide-decks, markua]
related:
  - adr/0012-slide-decks-static-reveal-from-markdown
  - adr/0021-deck-routing-seam-out-of-frame-override
  - adr/0022-reveal-integration-and-token-theme
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0030-markua-preprocess-to-directive
  - architecture/theming
  - architecture/markua
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

A deck is a page with `kind: Presentation` filed under `presentations/`. The
`presentations/` section (`type: Presentation`) is its home, and the **switch is
path + kind**: a `Presentation` page **under `presentations/`** routes out-of-frame
to the deck renderer, while a `kind: Presentation` page filed elsewhere is a hard
build error rather than a silent in-frame render
([ADR-0021](../adr/0021-deck-routing-seam-out-of-frame-override.md), which narrows
ADR-0012's earlier "anywhere" to path + kind). A deck's frontmatter is the normal
metadata contract;
`title`, `description`, and `hero_image` feed the title slide and the social card,
and `doc_status: draft` gates the deck from sitemap and feeds like any other page.

**Decks are currently Markua-agnostic.** The [Markua subset](./markua.md) is
scoped to docsite pages only: all five Markua passes no-op on a `kind:
Presentation` page through the shared `isPresentationFile()`/`guardDeck()` guard
at the plugin registration site, so a Markua marker written inside deck content
is left untouched rather than partially interpreted — a `{…}` line is never
spliced and a `{aside}` wrapper never swallows a `###` slide boundary. This is a
deliberate scope decision ([ADR-0030](../adr/0030-markua-preprocess-to-directive.md)
Consequences), not an accident of ordering; deck-Markua support is tracked as a
follow-up.

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

## Resolved questions

The M6 deck-renderer spec settled the questions this page previously deferred:

- **Vertical slides (`###`) ship in v1** — a `##` with `###` children forms a
  vertical stack (the container). Down-navigation is part of the first renderer,
  not deferred; the heading-driven convention above is the shipped behaviour.
- **The `--dk-*` → reveal-variable mapping is defined; the per-file override is
  deferred.** The doc-kitty reveal theme maps `--dk-*` onto reveal 6's `--r-*`
  custom properties, scoped under `.reveal`
  ([ADR-0022](../adr/0022-reveal-integration-and-token-theme.md)). A per-file
  `deck:` frontmatter theme override stays **deferred**.
- **reveal.js is pinned at `6.0.1` with a smoke-check upgrade cadence.** The version
  is a self-hosted, pinned dependency; every upgrade runs a smoke check of the deck
  route, the token mapping, and the a11y and print paths before the pin moves
  ([ADR-0022](../adr/0022-reveal-integration-and-token-theme.md)).
- **Pagefind coverage of the out-of-frame deck route is a build-time assertion.**
  The build asserts the deck's slide text is indexable: the slide body carries
  `data-pagefind-body` and non-content chrome carries `data-pagefind-ignore`, so the
  out-of-frame route still contributes to search.

## References

- [ADR-0012](../adr/0012-slide-decks-static-reveal-from-markdown.md), the deck
  authoring and pipeline decision.
- [ADR-0021](../adr/0021-deck-routing-seam-out-of-frame-override.md), the
  out-of-frame deck route and the path + kind switch.
- [ADR-0022](../adr/0022-reveal-integration-and-token-theme.md), the reveal.js
  integration, version pin, and `--dk-*` token theme.
- [ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md), the
  `Presentation` route and the mandatory fallback.
- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md), the
  `presentations/` section.
- [Theming and chrome](./theming.md).
