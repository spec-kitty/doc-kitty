---
title: "ADR-0077: One disclosure control over a native details baseline"
description: The TOC rail, metadata blocks and sidebar groups share one toggle, which enhances a native details element and leaves state to an adapter the caller supplies.
doc_status: active
updated: 2026-11-06T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0017-m3-content-block-rendering-seam
  - adr/0025-glossary-on-this-page-block-and-remark-render-channel
  - architecture/collapsible-toc-rail
---

# ADR-0077: One disclosure control over a native details baseline

## Status

Accepted (2026-11-05)

## Context

[#290](https://github.com/spec-kitty/doc-kitty/issues/290) collapses a page's metadata
blocks, and the title-as-index sidebar gives each group a chevron of its own. The TOC
rail already has a collapse toggle with the ARIA state these need, but it is private to
`toc-rail.client.ts`. A block's content and a sidebar group have a requirement the rail
does not: they must stay reachable with scripts off, and the browser's in-page find and
Starlight's sidebar persister must keep working on them.

This is a new seam next to [ADR-0017](./0017-m3-content-block-rendering-seam.md) and
[ADR-0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md), which decide how
those blocks are rendered and fed, not how they open and close.

## Decision

There is **one disclosure toggle**, for the rail, metadata blocks and sidebar groups, in
`src/lib/disclosure/`.

- `toggle.ts` owns the button, its chevron and its ARIA state. It holds no state: the
  caller passes an adapter, `isCollapsed` and `setCollapsed`. It touches no storage.
- The rail passes an adapter over its existing preference. Its `<html>` attribute, its
  stored key and its pre-paint script do not change.
- Blocks and groups render a **native `<details>` baseline**, complete with scripts off.
  `upgrade-details.ts` then inserts the button directly before `details`, and hides the
  summary. `details.open` remains the only state, so nothing is stored for a block.
- A wrapper with `data-dk-toggle-via="summary"` toggles through `summary.click()`, because
  Starlight's persister records a toggle only when a click lands in a `summary`.
- The button and the summary share one box in the global `disclosure.css`, because scoped
  CSS does not reach a script-created element and an upgrade must not move the page.
- `disclosure.client.ts` imports that sheet, and a component that renders a disclosure
  imports `disclosure.client.ts` from a `<script>`. Astro attaches a script-imported sheet
  by the route's module graph, not by what renders. The metadata blocks are imported from
  `MarkdownContent.astro`, which every docs page loads, so the sheet is inline in the
  `<head>` of every docs page, with or without a disclosure; only the script runs per
  page, on pages that render a wrapper. The sheet applies before first paint and with
  scripts off. It is deliberately not one of `GLOBAL_COMPONENT_SHEETS`, for three
  reasons: the deck route, which does not load the carrier, stays free of it; it is
  inlined rather than emitted as a `.css` file, because it is under Astro's inline
  limit; and the `css.txt` golden, which `emittedCss()` builds from `.css` files only,
  does not change. It does appear in the `page.html` golden once a component imports it
  from the carrier, so WP04 should expect that diff.
- Inside `.sl-markdown-content` the sheet resets Starlight's `details` border and padding
  and its masked summary chevron, so an upgrade moves nothing there either.

## Consequences

### Positive

- The three surfaces look and work alike, from one implementation.
- Persisting is a decision the caller has to make, so a block cannot store its state by
  accident.
- A wrapper short of the baseline (no labels, no `details` id) is left native and working.

### Negative

- Every docs page gains the sheet's CSS inline, whether or not it has a disclosure. Pages
  with a disclosure also gain the client script.
- The hidden summary is a pattern every caller depends on. The upgrade has to move focus
  to the button if the summary had it, listen for `toggle` so a change from find or from
  the persister reaches the button, and mark the wrapper only once the button is in place,
  so a failure leaves the summary visible.

### Risks

- The script swaps a native control for a scripted one, so its behaviour is only proved in
  a real browser. jsdom is forbidden here, so that proof lives in the Playwright suite.

## Alternatives considered

### Native only, with a shared look

Style `<summary>` to match the rail and ship no script. It works with scripts off and adds
no code, but it does not deliver `aria-controls` or one shared component, and the
maintainer declined it (decision 01M6PDCSJA3PEZRH4NCZYVN9BB).

### Registering the sheet in `GLOBAL_COMPONENT_SHEETS`

This is how `toc-rail.css` loads. It would put the control's rules on every page of every
site, the deck route included, as an emitted `.css` file that changes the CSS golden.
Importing from the client also reaches every docs page (see Decision), so what it saves
is the deck route, the extra file and the golden diff, not the sheet on pages that have
no disclosure.

## References

- [#290](https://github.com/spec-kitty/doc-kitty/issues/290)
- [Collapsible TOC rail](../architecture/collapsible-toc-rail.md)
