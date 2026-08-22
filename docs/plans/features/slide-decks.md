---
title: Slide decks (reveal.js)
description: "Author reveal.js slide decks in Markdown under presentations/ and render them as a distinct presentation surface."
status: draft
updated: 2026-08-22
type: Feature
moscow:
  level: Must
  rationale: Presentations are a first-class output pillar alongside docsites, required at launch.
tags: [presentations, reveal-js]
related:
  - architecture/slide-decks
  - adr/0012-slide-decks-static-reveal-from-markdown
  - adr/0004-amend-common-docs-as-extensible-variation
---

# Slide decks (reveal.js)

Mission M6. Author reveal.js slide decks in Markdown under the `presentations/`
section and render them as a distinct presentation surface.

Scope: MVP.

Design: [slide-decks.md](../../architecture/slide-decks.md) and
[ADR-0012](../../adr/0012-slide-decks-static-reveal-from-markdown.md) (authoring
convention + static reveal.js pipeline), on top of
[ADR-0011](../../adr/0011-theme-slot-surface-and-per-kind-layouts.md) (the
`Presentation` route + fallback) and
[ADR-0004](../../adr/0004-amend-common-docs-as-extensible-variation.md) (the
`presentations/` section).
