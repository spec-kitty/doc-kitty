---
title: "ADR-0015: M2 slot resolution, the pass-through surface, and the components-map seam"
description: Where each dk slot resolves, how the pass-through surface reaches Starlight, and why the components map stays the four carriers in M2.
doc_status: active
updated: 2026-08-23
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0013-m1-chrome-substrate-single-layer
  - architecture/theming
---

# ADR-0015: M2 slot resolution, the pass-through surface, and the components-map seam

## Status

Accepted. Refines [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md)
(the slot surface) and holds the seam-3 invariant of
[ADR-0013](./0013-m1-chrome-substrate-single-layer.md). The design intent of both
stands; this record sequences the pass-through surface and pins where each slot
resolves, so Mission M2 can build the theme layer without a silent seam change.

## Context

Building M2 to the settled design surfaced a tension between three settled
statements that a post-spec review made concrete:

- **ADR-0011 §"The slot surface"** enumerates eleven *pass-through* `dk:` slots
  "mapped 1:1 onto a Starlight override" — including `dk:site-header` → Starlight
  `Header`, `dk:site-title` → `SiteTitle`, `dk:announcement` → `Banner`,
  `dk:social-links` → `SocialIcons`, `dk:toc` → `TableOfContents`,
  `dk:pagination` → `Pagination`, `dk:last-updated` → `LastUpdated`,
  `dk:edit-link` → `EditLink`. `Header`, `SiteTitle`, `Banner`, and the rest are
  **not** among doc-kitty's four carriers (`Head`, `PageTitle`, `MarkdownContent`,
  `Footer`).
- **ADR-0011 decision 1 and theming.md §"Wiring"** state the opposite bound:
  "Starlight's `components` map is always doc-kitty's; all theme choice flows
  through the manifest." A theme addresses `dk:` slot names, never the Starlight
  `components` map.
- **ADR-0013 seam 3 (locked)** requires M2 to "leave the `components` map as the
  four carriers."

Delivering a pass-through override the literal ADR-0011 way — registering a theme's
component onto Starlight's `Header`/`SiteTitle`/`Banner` overrides — would expand
the `components` map beyond the four carriers and break seam 3. The Spec Kitty brand
also makes this concrete: its logo-in-nav site header is "the brand's
non-negotiable," so M2 must render a branded header without violating seam 3.

A second, related question the review raised: theming.md's own-chrome `dk:` slots
live in **different** carriers (`dk:head` in `Head`; `dk:page-hero` and
`dk:metadata-band` in `PageTitle`; `dk:audience`/`dk:related`/`dk:external-references`
in `MarkdownContent`; `dk:site-footer` in `Footer`). So "the carriers read the
manifest at the single `MarkdownContent` import site" (a paraphrase in the M2 spec
draft) conflates *layout* resolution (genuinely one site) with *slot* resolution
(distributed across the four carriers).

## Decision

1. **The single import site is for LAYOUTS only.** The ADR-0013 seam-1 "single
   import site" in the `MarkdownContent` carrier resolves `kind → layout` and
   nothing else. M2 replaces the static `kind-layouts` module with the merged
   manifest **at that one site**, preserving the exact synchronous
   `resolveLayout(kind): LayoutComponent` signature so the layout-resolution call
   site is unchanged.

2. **Slots resolve per-carrier, from the same merged manifest.** Each of the four
   carriers reads the merged manifest for the `dk:` slots it hosts and renders the
   theme's component (or doc-kitty's default) at those slots. There is no new
   layout-style single resolution site for slots; each carrier owns its own slot
   host points. This is not a seam-1 change — seam 1 is layouts.

3. **The Starlight `components` map stays exactly the four carriers (seam 3 held
   literally).** A theme never registers a Starlight component override directly;
   all theme choice flows through the manifest the carriers read. The map holds
   only doc-kitty's own components.

4. **Pass-through slots that target non-carrier Starlight overrides are sequenced,
   not delivered as map entries in M2.** Registering a theme component onto
   Starlight's `Header`/`SiteTitle`/`Banner`/`SocialIcons`/`TableOfContents`/
   `Pagination`/`LastUpdated`/`EditLink` would expand the map past four and break
   seam 3, so M2 does not do it. When the pass-through override surface is built
   in a later mission, it will register **doc-kitty-owned pass-through wrapper
   components** onto those Starlight slots — wrappers that read the manifest and
   render the theme's component — so the map still holds only doc-kitty components
   and the theme still never writes the map. That later step is where seam 3's
   count grows from four to "four carriers plus doc-kitty pass-through wrappers,"
   and it takes its own record then.

5. **The Spec Kitty brand header ships in M2 via Starlight-native config.** The
   brand's logo-in-nav header rides Starlight's native `logo` and `title` (fed from
   the theme's `assets`, forwarded by `defineDocKittyIntegrations`) plus brand CSS
   for the display-font wordmark and the active-nav accent. The brand footer rides
   the existing `Footer` carrier and its `dk:site-footer` slot. Neither expands the
   `components` map, so the brand renders end-to-end in M2 with seam 3 intact.

## Consequences

### Positive

- Seam 3 holds literally in M2: the map is the four carriers, and the brand still
  renders, so M2 stays purely additive over the M1 substrate.
- The layout-vs-slot resolution split is explicit, so an implementer does not
  scatter manifest reads into the wrong carrier or mistake slot resolution for a
  second layout site.
- The pass-through surface is sequenced with its seam-3 invariant preserved
  (doc-kitty wrappers, never theme components in the map), so the later mission
  extends rather than rewrites.

### Negative

- Part of the ADR-0011 slot surface (the non-carrier pass-through overrides) is not
  available to themes in M2. A theme that needs to replace, say, the table of
  contents wholesale waits for the later pass-through mission.

### Risks

- An implementer could still register a `Header` override to satisfy the brand
  header and silently break seam 3. Mitigation: the brand header is specified to
  ride native `logo`/`title` config, and a build assertion holds the `components`
  map to the four carriers.

## Alternatives considered

### Deliver the pass-through overrides now, expanding the components map

Rejected for M2. It breaks the locked ADR-0013 seam 3 in the very mission meant to
extend the seams cleanly, and the brand does not need it — native `logo`/`title`
config renders the required header.

### Resolve all slots at the single MarkdownContent site

Rejected. The own-chrome slots live in three different carriers; forcing them
through one site would move `Head` and `PageTitle` chrome into `MarkdownContent`,
a larger rewrite than the M1 substrate's per-carrier host points.

## References

- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0013](./0013-m1-chrome-substrate-single-layer.md).
- [Theming and chrome](../architecture/theming.md).
