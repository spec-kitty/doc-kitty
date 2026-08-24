---
title: "ADR-0017: M3 content-block rendering seam (carrier-body, token-styled)"
description: The audience/related/external-references blocks render in the carrier body from resolved data and are theme-styled by tokens, not by a props-carrying slot override.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0015-m2-slot-resolution-and-components-map-seam
  - architecture/theming
---

# ADR-0017: M3 content-block rendering seam (carrier-body, token-styled)

## Status

Accepted. Refines [ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md)
for the three data-driven content blocks. Holds ADR-0013 seam 3 and the ADR-0015
synchronous-resolution invariant.

## Context

M1/M2 host three `dk:` content slots in the `MarkdownContent` carrier —
`dk:audience` (before content), `dk:related` and `dk:external-references` (after)
— but left them **unwired** to `entry.data` (M2 scope guard C-010). Today each is
rendered two ways at once in the carrier: a theme passthrough
(`{AudienceSlot && <AudienceSlot />}`, invoked with **no props** per ADR-0015) and
a named `<slot name="dk:audience" />` for authored MDX injection.

M3 must render these blocks from resolved page data. A post-spec architecture review
found the obvious "pass data through `slotComponents`" path is **ADR-0015-incompatible**:
slot components are typed as bare, prop-less factories and `resolveLayout` stays
synchronous — passing `entry.data`-derived props through the manifest slot-call would
silently change the theme-facing transport ADR-0015 pins. It also flagged a
**double-render** risk: a new data render *plus* the existing no-props passthrough.

## Decision

1. **The three content blocks are doc-kitty-owned, carrier-body renders that
   self-resolve.** The `MarkdownContent` carrier renders a doc-kitty default block
   body (`src/components/slots/{Audience,Related,ExternalReferences}.astro`) inline.
   Because slot bodies take **no props** (ADR-0015), each body **self-resolves**: it
   reads `Astro.locals.starlightRoute` for the page's `entry.data` and
   `await getCollection('docs' | 'bibliography' | 'tools')` for the index/catalog,
   then applies the IC-01 pure resolvers and renders. Nothing crosses the slot
   boundary as a prop; the bodies stay thin (self-resolve, then render).

2. **Theme influence over these three slots is by tokens/CSS, not component
   replacement.** The Spec Kitty brand already ships the tint panels
   (`.dk-panel--audience|--related|--external-references`) and molecules
   (`RelatedCard`, `ReferenceItem`) as CSS + presentational components. Theming these
   three blocks means styling those classes/tokens — not registering a slot override.

3. **The no-props component-override passthrough is retired for exactly these three
   slots.** The `{Slot && <Slot />}` passthrough is removed for `dk:audience`,
   `dk:related`, and `dk:external-references` (it cannot carry data and would
   double-render). The **named `<slot>`** stays for authored MDX injection. All other
   `dk:` slots are unaffected.

4. **No transport change, no map change.** `resolveLayout` stays synchronous; the
   `slotComponents` type is unchanged; the Starlight `components` map stays the four
   carriers (ADR-0013 seam 3). Async catalog reads live in the route/build, not in
   `resolveLayout`.

## Consequences

### Positive

- ADR-0015 holds literally — no props on slot bodies, synchronous resolution, map
  unchanged. M3 is additive.
- No double-render: exactly one default body per block, plus the MDX named slot.
- Theming stays on the `--dk-*` token surface (C-007), consistent with the AA-by-
  construction discipline.

### Negative

- A theme cannot wholesale *replace* the audience/related/external-references block
  component in M3; it restyles them. Component-level override for these slots, if ever
  needed, is a later pass-through-wrapper mission (the ADR-0015 §4 sequencing).

### Risks

- An implementer could reinstate a props-carrying slot override to "let the theme
  own the block." Mitigation: this ADR forbids it; the build assertion holds the
  `components` map to the four carriers.

## Alternatives considered

### Pass resolved data through `slotComponents` props

Rejected: ADR-0015 types slot bodies as prop-less and keeps resolution synchronous;
threading props changes the theme-facing transport — a silent seam change C-001
forbids.

### Keep the no-props passthrough and add the data render beside it

Rejected: double-renders each block (passthrough render + data render).

## References

- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0013](./0013-m1-chrome-substrate-single-layer.md),
  [ADR-0015](./0015-m2-slot-resolution-and-components-map-seam.md).
- [Theming and chrome](../architecture/theming.md).
