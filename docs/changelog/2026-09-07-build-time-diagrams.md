---
title: Build-time diagram render (Mermaid + PlantUML)
description: Diagrams pre-render to static, themed, accessible SVG at build, dual-mode with a client fallback, and PlantUML support arrives.
doc_status: active
updated: 2026-09-07
type: Changelog
kind: Changelog
authors:
  - stijn@sddevelopment.be
tags: [diagrams, mermaid, plantuml, build-time, accessibility]
related:
  - adr/0040-build-time-diagram-render-dual-mode
  - architecture/diagrams
---

# Build-time diagram render (Mermaid + PlantUML)

Issue #13. Diagrams now render to **static, themed, accessible SVG at build time**
for **both Mermaid and PlantUML**, with **no diagram runtime shipped** to readers
in build mode.

- **Dual-mode.** Build-render when a headless browser is available at build; fall
  back to the existing client Mermaid render otherwise (`pnpm build` never fails
  for lack of a browser). Client-mode Mermaid output is byte-identical to before.
- **PlantUML support (new).** ```plantuml renders via a **self-hosted** PlantUML
  server — never `plantuml.com` — with a `'`-comment metadata block matching the
  Mermaid `%%` design.
- **Theme without JavaScript.** Static SVGs reference `var(--dk-diagram-*)`, so the
  light/dark toggle stays pure CSS. The six-token contract is unchanged.
- **CI/deploy** build-render both engines with a diagram cache. See
  [ADR-0040](../adr/0040-build-time-diagram-render-dual-mode.md) and the
  [diagrams architecture](../architecture/diagrams.md).
