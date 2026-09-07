---
title: PlantUML demonstrator
description: A PlantUML diagram rendered to a static, themed, accessible SVG at build time — the build-only twin of the Mermaid demonstrator, named by a leading '-comment block.
doc_status: active
updated: 2026-09-07
type: Architecture
kind: Explanation
tags: [architecture, diagrams, plantuml, demonstrator, fixture]
related:
  - architecture/diagram-demonstrator
# Short same-level headings would render an over-tight on-this-page list below the
# WCAG 2.2 target-size minimum — the same theme-chrome quirk the Mermaid
# demonstrator suppresses. This page is short and self-evident, so its table of
# contents is suppressed too.
tableOfContents: false
---

# PlantUML demonstrator

A ` ```plantuml ` fenced code block is rendered to a **static SVG at build time**
against a self-hosted PlantUML server — never `plantuml.com`. Like a Mermaid
diagram it becomes a themed, accessible `<figure>`; a small comment block at the
top gives it a caption, a credit line, and the accessible name and description a
screen reader announces.

## What the metadata fields do

PlantUML comments start with a single quote (`'`), so the metadata block uses
`'` where Mermaid uses `%%` — the same plain-language keys, all optional:

- **`title`** becomes the diagram's accessible **name**. When you omit it, the
  **`description`** is used as the name instead.
- **`description`** becomes the figure's **caption** and the diagram's accessible
  **description**. Always provide at least this one.
- **`attribution`** becomes a credit line; when **`source`** is present, the credit
  links there.

The six `--dk-diagram-*` theme tokens are injected as PlantUML `skinparam` colours
before the diagram is rendered, so the static SVG re-themes on a `[data-theme]`
toggle with **no JavaScript** — exactly like the Mermaid figure.

```plantuml
' title: Build-time PlantUML render
' description: Markdown is parsed, the loader hands the themed source to a self-hosted PlantUML server, which renders the static SVG the reader is served with no client JavaScript.
' attribution: Doc Kitty build-render seam (ADR-0023)
' source: https://example.com/adr-0023-diagram-render-seam
package "Build pipeline" {
  rectangle "Markdown\n(docs tree)" as MD
  rectangle "Toolkit loader" as LD
  rectangle "PlantUML server\n(self-hosted)" as PS
}
rectangle "Static SVG" as SVG
rectangle "Reader" as R
MD --> LD : parsed
LD --> PS : themed source
PS --> SVG : renders
SVG --> R : served, no JS
```

## Build-only, by design

There is no client-side PlantUML renderer, so PlantUML is **build-only**: with
build-render off (an adopter with no Chromium and no PlantUML server), a
` ```plantuml ` block stays a plain code fence — no figure, no broken markup. The
Mermaid demonstrator, by contrast, keeps a client fallback because Mermaid ships a
browser renderer.
