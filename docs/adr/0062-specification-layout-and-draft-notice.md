---
title: "ADR-0062: A Specification layout with a header card, and a draft notice on every draft page"
description: kind Specification gets a base layout with a tags and source card, and every draft page in the docs frame shows a text draft notice.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: ADR
kind: ADR
authors:
  - human:stijn
related:
  - adr/0046-gherkin-feature-pages
  - adr/0055-gherkin-scenario-results
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - adr/0061-gherkin-authoring-aids
  - architecture/research/gherkin-authoring-aids
  - architecture/gherkin-pages
  - architecture/theming
---

# ADR-0062: A Specification layout with a header card, and a draft notice on every draft page

## Status

**Accepted** on 2026-10-19. It was introduced by the gherkin-authoring-aids
mission and settles issue
[#198](https://github.com/spec-kitty/doc-kitty/issues/198). The research and the
operator's decisions D9 to D12 are in
[Gherkin authoring aids (research)](../architecture/research/gherkin-authoring-aids.md).

It amends one statement in [ADR-0046](./0046-gherkin-feature-pages.md) and
leaves that ADR as written:

- **The first positive consequence** says generated pages work "with **no new
  render code**". Decision 1 below adds a layout for `kind: Specification`, so
  feature pages now have render code of their own.

It adds a structural-kind layout under the per-kind layout model of
[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md), registered in
the manifest of [ADR-0013](./0013-m1-chrome-substrate-single-layer.md) and
resolved at the single layout site of
[ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md). The rest of
those ADRs, and [ADR-0055](./0055-gherkin-scenario-results.md), stands.
[ADR-0061](./0061-gherkin-authoring-aids.md) records the authoring half of the
same mission.

## Context

- **Tags and source are invisible to readers.** A generated feature page keeps
  its tags in `tags` and its `.feature` file in `sources`. No component read
  either: only the agent payload and the scenario index carried `sources`.
- **Drafts look active.** `@wip` makes a page `doc_status: draft`, which keeps
  it out of hubs and adds `noindex`. A draft renders no metadata band, so with
  drafts published (the default) it looked exactly like an active page. This is
  true of every draft page, not only feature pages.
- **The table of contents is already a scenario list.** Rules and scenarios are
  headings, and Examples are not, so "On this page" lists exactly the rules and
  scenarios.
- **Only `Hub` was a base kind.** `kind: Specification` fell back to `Default`.
- **#104 is blocked.** Its token migration is unsettled, so "tokens only" can
  only mean today's `--dk-*` tokens.

## Decision

1. **A base-kind `Specification` layout.** `BASE_KIND_LAYOUTS` registers
   `Specification` beside `Hub`, so `kind: Specification` uses it by default.
   The layout wraps the content slot, inside the Starlight frame, and never
   re-renders the body, so the ADR-0055 results overlay still applies.
2. **A header card.** Before the content slot the layout renders
   `<section class="dk-spec-card" aria-labelledby="dk-spec-card-h">` with a
   visually hidden heading, "Specification details". It holds:
   - **Tags:** the frontmatter `tags` as a `<ul aria-label="Tags">` of text
     chips, omitted when empty;
   - **Source:** from `sources[0].resource`. An absolute `http:` or `https:`
     URL renders as a link whose text is the repository path. That happens when
     the site sets `sourceUrlPrefix`. Anything else, a relative path or another
     scheme, renders as plain code text and never as an `href`.

   With neither part there is no card, and the page renders as with `Default`.
   A pure helper, `src/lib/spec-card.ts`, makes both choices.
3. **The table of contents stays the scenario list.** The card is a region, not
   a `nav`, and carries no `aria-current`. Its heading is not a Markdown
   heading, so the TOC does not list it.
4. **The results summary stays in the body.** The card does not repeat the
   ADR-0055 summary, which the results overlay already renders after the
   scenario count. Moving it would need a new data path from the remark overlay
   to the layout and would change ADR-0055 output (operator decision
   `01M59CQM76Q0NJ3F3GM1S8BYAN`, plan phase).
5. **A draft notice on every draft page in the docs frame.** The `PageTitle`
   carrier renders `<DraftNotice />` once, after the metadata band position,
   for every page whose `doc_status` is exactly `draft`, of any kind:

   ```html
   <p class="dk-draft-notice"><span class="sr-only">Document status: </span>Draft. This page is work in progress and may change.</p>
   ```

   - It has no landmark role and no `role="alert"`. It is page metadata.
   - It sits outside the `dk:metadata-band` slot host, so a theme that replaces
     the band cannot drop it. It sits outside the Persona branch, so a Persona
     draft shows it too.
   - The test is the explicit `draft` value, not `isDraftEntry`. That helper
     also counts a missing status and would put the notice on Starlight's 404
     page.
   - It does not render for `active` or `deprecated` pages, or when drafts are
     not built (`DK_PUBLISH_DRAFTS=off`).
   - **Out-of-frame slide decks are excluded.** A deck renders through
     `DeckLayout`, which has no `PageTitle`, so a draft deck shows no notice.
     The mission's success criterion SC-003 holds for draft pages in the docs
     frame.
   - The Specification card does not repeat the notice.
6. **Tokens only.** `.dk-spec-card*` (in `specification.css`) and
   `.dk-draft-notice` (in `dk-components.css`) use only `var(--dk-*)` for
   colour, spacing, radius and type. No new token is added. Unit tests fail on
   a literal colour or length in those rules.
7. **The theme opt-out is the per-kind map.** A theme maps
   `layouts.Specification` to `Default.astro`. No new site option exists.
8. **Feature pages join the test lanes.** The geometry lane gains the active
   and the draft feature page. The axe lane gains the draft feature page, in
   both colour modes, and its guard roots require the card and the notice.

## Consequences

### Positive

- A reader sees a feature's tags and can reach its source in one click, on a
  site that sets `sourceUrlPrefix`.
- A draft is never mistaken for an authoritative page, on any kind.
- One rule for drafts, in one carrier, instead of a notice per layout.
- A non-draft page outside `kind: Specification` is byte-identical to before.

### Negative

- **The HTML of every draft page changes**, by one notice, and every
  Specification page with tags or a source gains the card.
- **#104 gains a fifth layout.** Its migration list was Article, Hub, Persona
  and Presentation. It now includes Specification.
- The card and the notice are English only, like the rest of the chrome
  (#161).
- A draft slide deck still looks like a published one.

### Risks

- **A theme that relies on `Default` for feature pages** changes appearance. It
  can map `Specification` back to `Default.astro`.
- **A long source path at narrow widths.** The card wraps paths anywhere, and
  the geometry lane checks the feature pages at every width.

## Alternatives considered

### Add status and tags to Starlight's table of contents

Rejected (D9). It means changing Starlight's TOC markup, which the rail work
avoids, and below 72rem the TOC becomes a dropdown that would lose them.

### A dedicated scenario rail beside the body

Rejected (D9). It duplicates navigation, breaks the rail geometry assertions,
and conflicts with #104's "no duplicate outline".

### Starlight's `banner` or `draft` frontmatter

Rejected. Starlight's draft notice keys on its own `draft` field, not on
`doc_status`. `banner` is site chrome outside the token bridge, and the
generator would have to write it into frontmatter.

### A `kind` branch in `PageTitle` for the card

It would put tags in the true page header. Rejected: it adds a second `kind`
branch to the carrier, beside the Persona exception, while layouts already
resolve by `kind` in one place.

### A notice in the Specification layout only

Rejected (D10). The draft gap is generic, and one rule avoids two meanings of
"draft" on one site.

## References

- Issues [#198](https://github.com/spec-kitty/doc-kitty/issues/198) and
  [#104](https://github.com/spec-kitty/doc-kitty/issues/104).
- [Gherkin authoring aids (research)](../architecture/research/gherkin-authoring-aids.md),
  decisions D9 to D12.
- [Theming and chrome](../architecture/theming.md) and
  [Gherkin feature pages](../architecture/gherkin-pages.md).
- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0013](./0013-m1-chrome-substrate-single-layer.md),
  [ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md),
  [ADR-0046](./0046-gherkin-feature-pages.md),
  [ADR-0055](./0055-gherkin-scenario-results.md).
