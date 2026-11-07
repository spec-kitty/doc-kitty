---
title: "ADR-0076: Place a hub's metadata blocks after its layout"
description: The MarkdownContent carrier renders a hub's related and external-reference blocks after the layout, so child cards come before them, and no layout gains a contract.
doc_status: active
updated: 2026-11-05T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0013-m1-chrome-substrate-single-layer
  - adr/0017-m3-content-block-rendering-seam
  - adr/0072-parallel-landing-without-shared-files
---

# ADR-0076: Place a hub's metadata blocks after its layout

## Status

Accepted (2026-11-05)

## Context

On a hub page the `MarkdownContent` carrier put the `dk:related` and
`dk:external-references` blocks, and the glossary panel, inside the layout, after the
page body. `Hub.astro` renders its child cards after the default slot, and the
blocks share that slot, so every hub showed audience, body, metadata blocks and only
then the child cards. The cards are what a reader came to a hub for.

Themes can register layouts through the manifest, so a hub layout need not be
`Hub.astro`. Starlight passes only the default slot to the carrier's layout.

## Decision

For `kind: Hub` the carrier places the after-content blocks directly after the
layout: audience, body, child cards, then the metadata blocks. Every other kind keeps
its blocks inside the layout, as before.

The carrier does it by rebinding which component sits in each of four positions
(inside and outside the layout, for related and for external references). The
outside positions are written adjacent to `</Layout>` with no whitespace, because
Astro emits literal spaces for bare positions on separate lines, which would change
the bytes of every non-hub page. The named `dk:*` slots stay inside the layout.

This relates to [ADR-0017](0017-m3-content-block-rendering-seam.md), which made these blocks
carrier-body renders, and does not supersede it.

## Alternatives considered

- **A named slot in every layout.** A layout would have to place the blocks itself.
  A third-party layout could silently drop them, and every layout would gain a
  contract. Rejected.
- **Reorder inside `Hub.astro`.** The blocks come from the carrier, not the layout, so
  the hub would need them passed in. A theme's own hub layout would not get the
  change. Rejected.

## Consequences

- The blocks sit outside a hub layout's DOM wrapper. `Hub.astro` has none today, but
  a theme's hub layout that wraps its content would see the blocks outside that
  wrapper.
- A hub layout that places nothing still shows the blocks.
- Non-hub pages are byte-identical to before, which the chrome fixture's golden
  proves.
