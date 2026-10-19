# Contract: Specification layout and draft notice

## Layout resolution

`BASE_KIND_LAYOUTS` gains `Specification` beside `Hub`. A theme's manifest
`layouts.Specification` overrides it, which is the opt-out: map it to
`Default.astro`. No new site option exists.

## Card markup

The card is rendered before the content slot. Each part is present only when it
has content; with no parts there is no card.

```html
<section class="dk-spec-card" aria-labelledby="dk-spec-card-h">
  <h2 id="dk-spec-card-h" class="sr-only">Specification details</h2>
  <ul class="dk-spec-card__tags" aria-label="Tags"><li>FR-003</li>…</ul>
  <p class="dk-spec-card__source">Source: <a href="…">features/shipping/book-consignment.feature</a></p>
</section>
```

The card never repeats the ADR-0055 results summary, which stays in the body.
The card is not a `nav` and carries no `aria-current`. The "On this page" TOC
stays the only scenario navigation. The card heading is visually hidden and
sits outside the TOC. Starlight's TOC draws on content headings only, so it
does not list it.

## Draft notice markup

The notice renders for every kind, in the `PageTitle` carrier, when
`doc_status === 'draft'`:

```html
<p class="dk-draft-notice"><span class="sr-only">Document status: </span>Draft. This page is work in progress and may change.</p>
```

It has no landmark role and no `role="alert"`. It does not render for `active`
or `deprecated` pages, or when drafts are not built.

## Styling

`.dk-spec-card*` and `.dk-draft-notice` use only `var(--dk-*)` for colour,
spacing, radius and type. A unit test fails on any hex, `rgb(`, `hsl(` or bare
length literal in these rules (NFR-005).
