---
title: "ADR-0012: Slide decks are static reveal.js built from Markdown"
description: Decks are authored in Markdown, split by headings at build time, and rendered as a self-hosted static reveal.js deck with a linear fallback.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/slide-decks
  - adr/0021-deck-routing-seam-out-of-frame-override
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0004-amend-common-docs-as-extensible-variation
---

# ADR-0012: Slide decks are static reveal.js built from Markdown

## Status

Accepted. Builds on [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md)
(the `Presentation` route and the mandatory fallback) and
[ADR-0004](./0004-amend-common-docs-as-extensible-variation.md) (the
`presentations/` section). The full design is in
[slide-decks.md](../architecture/slide-decks.md).

Decision 1's "anywhere" is amended by
[ADR-0021](./0021-deck-routing-seam-out-of-frame-override.md): the switch is
path + kind — a `Presentation` under `presentations/`.

## Context

Presentations are a Must-level output pillar. ADR-0011 decided a `Presentation`
renders through a dedicated reveal.js route outside the docs frame, with a no-JS /
reduced-motion fallback, but left the authoring model, the slide-splitting
convention, and the reveal integration unspecified. A client repository reviewed
during discovery drove reveal from hand-authored, customised HTML; that approach is
explicitly not to be followed here, because it is not authorable as content and does
not survive the same source rendering as a plain document.

## Decision

1. **Author decks in Markdown (`kind: Presentation`), never hand-authored reveal
   HTML.** A deck uses the same authoring surface as every other page and reads as a
   normal document. `presentations/` is its home section; `kind` is the switch.
2. **Heading-driven splitting.** `##` starts a horizontal slide, `###` a vertical
   slide, and content before the first `##` is the title slide. A thematic break
   `---` forces a headingless horizontal slide; that is its only special meaning on a
   `Presentation` page. Splitting runs in a **build-time remark transform**, not in
   the browser — the Hugo-style static approach, not reveal's client-side Markdown
   plugin.
3. **Deck controls via invisible directives.** Per-slide (`<!-- .slide: ... -->`)
   and per-element (`<!-- .element: ... -->`) attributes and `Note:` speaker notes
   are HTML-comment directives, so an unused deck is indistinguishable from prose
   (the Markua superset-not-noticed philosophy). Unknown directives warn, not fail.
4. **Static, self-contained reveal.js.** reveal is a **self-hosted dependency
   bundled at build**, never a CDN. The Astro deck route server-renders the slide
   `<section>`s; reveal enhances that existing DOM on load and never produces the
   slides.
5. **Mandatory linear fallback and token theme.** The slide sections are emitted in
   document order, so a no-JS / reduced-motion visit is a readable scrollable
   document (restates ADR-0011). Controls are real `<button>`s; the deck is themed
   through `--dk-*` tokens.

## Consequences

### Positive

- Decks are authorable by anyone who writes Markdown, with no new DSL, and the
  source doubles as a readable outline.
- Static output is accessible, indexable, offline-capable, and CSP-clean.
- Decks inherit the active brand through the token catalog.

### Negative

- A doc-kitty reveal theme must map `--dk-*` onto reveal's own variables, and that
  mapping is maintenance surface on a reveal upgrade.

### Risks

- Decks render outside the Starlight frame, so Pagefind/search coverage of the deck
  route must be verified at build (the static DOM must stay crawlable).
- The reveal.js version is a pinned dependency; upgrades need a smoke check of the
  deck route and the token mapping.

## Alternatives considered

### Option A: reveal.js client-side Markdown plugin

Rejected. It fetches raw Markdown and builds slides at runtime, which gives worse
accessibility, SEO, and no-JS behaviour, and less control over the output than a
build-time transform.

### Option B: Hand-authored reveal HTML (the client approach)

Rejected. Not authorable as content, not reviewable as Markdown, and it does not
render as a plain document without JavaScript. This is the approach the discovery
run flagged as not to be followed.

### Option C: MDX slide components

Rejected. Heavier, couples decks to a component API, and breaks the clean-Markdown /
Markua-compatible authoring the toolkit wants.

### Option D: A different deck engine (Marp, Slidev)

Rejected. reveal.js was already chosen in ADR-0011 and aligns with the
`presentations/` section and the existing ecosystem; changing engines is not a live
question here.

## References

- [Slide decks](../architecture/slide-decks.md).
- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md).
