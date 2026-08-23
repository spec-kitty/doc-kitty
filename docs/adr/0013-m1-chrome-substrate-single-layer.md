---
title: "ADR-0013: M1 chrome substrate — single-layer manifest and static token delivery"
description: How the M1 metadata chrome ships the ADR-0011 slot surface in a degenerate single-layer form that M2 extends without rework.
status: active
updated: 2026-08-23
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0008-swappable-theme-layer
  - architecture/theming
---

# ADR-0013: M1 chrome substrate — single-layer manifest and static token delivery

## Status

Accepted. Implements a subset of
[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md) and
[ADR-0008](./0008-swappable-theme-layer.md); does not supersede either.

## Context

[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md) and
[theming.md](../architecture/theming.md) describe the theme layer in its
*complete* form: carriers read `slots` and `layouts` through a **merged virtual
manifest**, and `defineDocKittyIntegrations({ theme })` merges
`default → brand → consumer`. That complete form is Mission M2's headline.

Mission M1 renders metadata chrome now — the page hero, the metadata band, the
share metadata, and one bespoke `Hub` layout — on the ADR-0011 slot surface, and
ships the neutral Default `--dk-*` token catalog. It does this **before** M2
exists. So M1 must implement a deliberately degenerate version of the theming
mechanism: one layer, no theme parameter, no merge. The charter requires any
deviation from the settled design to be recorded as a new ADR rather than made
silently ([charter](../../.kittify/charter/charter.md), amendment policy). This
ADR records the degenerate M1 shape and, more importantly, the contract M2 must
preserve when it grows the mechanism to its ADR-0011 form.

## Decision

1. **Static `kind → layout` module, not a virtual manifest.** In M1 the
   `MarkdownContent` carrier resolves `entry.data.kind` through a plain
   toolkit-internal module (a static `kind → layout` map with a `Default`
   fallback). The Astro-5 virtual-module transport that ADR-0011 names is **not**
   built in M1; it arrives in M2 when a second (brand) layer first needs merging.
2. **Static default-token stylesheet, complete and cascade-positioned.** M1 ships
   the *complete* neutral Default `--dk-*` catalog as a static base stylesheet
   that also carries the `--dk-* → --sl-*` bridge assignments. It is loaded so its
   cascade position is **tokens-before-overrides** (per theming.md version notes),
   which is the extension point M2 layers brand and consumer CSS after by array
   order. M1 ships no brand or consumer layer.
3. **`defineDocKittyIntegrations` keeps its `(options)` signature in M1.** It gains
   `{ theme }` and the three-layer merge in M2. M1 adds the Starlight `components`
   map (the four carriers) to what it already returns; that map is **already
   complete** at M1 and does not change in M2 (a theme targets `dk:` slot names, not
   the Starlight `components` map — ADR-0011 decision 1).
4. **Carriers ship from the toolkit as a new component export.** doc-kitty becomes
   a component-shipping package for the first time: the four `.astro` carriers live
   in the toolkit and are exposed through a `./components/*` export so the example's
   `astro.config.mjs` resolves them from the `workspace:*` dependency. Carriers read
   `Astro.locals.starlightRoute` (Starlight ≥0.30), never `Astro.props`.

### Extension points M2 must preserve

M2 grows this substrate to the ADR-0011 form without rewriting M1's render sites:

- the carrier's **single** `kind → layout` import site (M2 swaps the static module
  for the merged manifest read at that one site);
- the token stylesheet's **cascade position** (M2 appends brand/consumer layers
  after it, not before);
- the `components` map (unchanged — always doc-kitty's four carriers).

## Consequences

### Positive

- M1 renders real metadata chrome without pulling M2's merge machinery forward
  (locality of change), and M2 extends three named seams rather than refactoring
  the carriers.
- The complete Default token layer means an unthemed site is fully styled now, so
  M2 is purely additive.

### Negative

- The static `kind → layout` module and the merged manifest are two shapes of the
  same idea; M2 replaces the former at one import site (a small, bounded edit).

### Risks

- If M1 hard-codes layout resolution somewhere other than the single carrier import
  site, M2 inherits scattered edits. Mitigation: resolution lives only in the
  `MarkdownContent` carrier.
- If the token stylesheet is loaded after Starlight's own overrides, M2 brand
  layering will not win by cascade. Mitigation: assert tokens-before-overrides order
  at build.

## Alternatives considered

### Build the virtual manifest and merge in M1

Rejected. Building the M2 merge mechanism for a single static layer is premature
infrastructure for no M1 benefit, and it blurs the M1/M2 boundary the roadmap
draws.

### Skip the token catalog; hand-write chrome CSS in M1

Rejected. It would leave M2 to retrofit every chrome rule onto tokens. Shipping the
complete Default `--dk-*` catalog now is the clean seam (theming.md: the Default
layer is the one layer that must be complete).

## References

- [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md),
  [ADR-0008](./0008-swappable-theme-layer.md).
- [Theming and chrome](../architecture/theming.md).
