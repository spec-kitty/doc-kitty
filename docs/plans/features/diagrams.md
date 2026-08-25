---
title: Diagrams (Mermaid + PlantUML)
description: "Author Mermaid diagrams in Markdown; v1 renders them client-side, themed, accessible, and self-contained. PlantUML and the build-time render are deferred to issue #13."
doc_status: draft
updated: 2026-08-25
type: Feature
kind: Feature
moscow:
  level: Should
  rationale: High value for technical docs; the client-side, accessible, themed first slice ships self-contained, with no CDN and no build-time browser.
tags: [diagrams, mermaid, plantuml]
related:
  - architecture/diagrams
  - adr/0023-diagram-render-and-metadata-seam
  - adr/0024-diagram-token-promotion-and-brand-wiring
---

# Diagrams (Mermaid + PlantUML)

Mission M5. Author diagrams as `` ```mermaid `` fences in Markdown and read
them back rendered, themed, and accessible — on documentation pages and inside
the M6 slide decks.

Scope: Extended.

## What shipped in v1

- **Client-side Mermaid render.** `mermaid` and `astro-mermaid` are bundled into
  the site (no CDN, no external service). `astro-mermaid` is used for its
  build-time fence transform only; a single client render owner draws each
  diagram in the browser. There is no build-time headless browser, so the
  example build stays browser-free.
- **Opt-in preset.** A site turns diagrams on through the toolkit preset; a site
  that authors no diagrams carries none of the runtime.
- **`%%` metadata, four non-technical fields.** A leading `%% key: value`
  metadata block carries `title`, `description`, `attribution`, and `source`.
  The build-time transform lifts these into an accessible `<figure>` with a
  caption and the Mermaid accessibility statements. The field set is closed;
  unknown keys stay Mermaid comments.
- **`--dk-diagram-*` theming.** Diagram colours come from the `--dk-diagram-*`
  token subset, so a diagram matches the site's theme in both light and dark
  modes and follows a brand without per-diagram styling.
- **Decks included.** The same render owner draws diagrams inside the out-of-frame
  reveal.js decks, closing the diagrams-in-slides gap M6 left open.

## Deferred to issue #13

Two capabilities are tracked in issue **#13 "Enhanced diagram support"** and are
**not** built in this mission:

- **Build-time render (both engines).** Drawing a static SVG at build for
  zero-runtime-JS, full no-JS output — via a Playwright/Chromium render.
- **PlantUML.** PlantUML has no JavaScript renderer, so it needs a self-hosted
  CI pre-render workflow.

See issue #13 for the follow-up design; it is not restated here.

## Design

The surface and its seams: [diagrams architecture](../../architecture/diagrams.md),
grounded in [ADR-0023](../../adr/0023-diagram-render-and-metadata-seam.md)
(render ownership and the `%%` → accessible-figure seam) and
[ADR-0024](../../adr/0024-diagram-token-promotion-and-brand-wiring.md)
(`--dk-diagram-*` promotion and brand wiring).
