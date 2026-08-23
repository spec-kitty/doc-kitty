---
title: Architecture design pass
description: Portals research, planning + MoSCoW, the theme layer and brand, slide decks, and the section registry.
doc_status: active
updated: 2026-08-22
type: Changelog
kind: Changelog
tags: [architecture, theme, presentations, planning, sections]
related:
  - adr/0010-planning-kinds-and-moscow
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - adr/0012-slide-decks-static-reveal-from-markdown
  - architecture/theming
---

# 2026-08-22 — Architecture design pass

A single architecting pass landed the presentation-layer and planning design that
the design-readiness review flagged as MVP-blocking.

- **Portals research** — mission-status, QA, and ticketing report pages as a
  repository-portal family (build-time cache+link, opt-in, GitHub-first), under
  [`architecture/research/`](../architecture/research/).
- **Planning + MoSCoW** ([ADR-0010](../adr/0010-planning-kinds-and-moscow.md)) — the
  `Planning` / `Feature` / `User-Journey` page kinds and the `moscow` field, with a
  roadmap, feature pages, journeys hub, and a [design-readiness](../plans/design-readiness.md)
  assessment under [`plans/`](../plans/).
- **Theme layer + brand** ([ADR-0011](../adr/0011-theme-slot-surface-and-per-kind-layouts.md))
  — the curated slot surface, per-kind layout resolution (in-frame registry that
  keeps the sidebar; `Presentation` → reveal.js; unknown → Default), the `--dk-*`
  token catalog, the `banner` → `hero_image` rename, and the self-contained, derived
  [Spec Kitty brand theme](../architecture/theming-spec-kitty-brand.md). See
  [theming.md](../architecture/theming.md).
- **Slide decks** ([ADR-0012](../adr/0012-slide-decks-static-reveal-from-markdown.md))
  — author decks in Markdown, split by headings at build time, rendered as a
  self-hosted static reveal.js deck with a mandatory no-JS / reduced-motion fallback.
  See [slide-decks.md](../architecture/slide-decks.md).
- **Section registry** — the `docs/_meta/sections.yaml` schema (label, order, type,
  purpose, feeds), `type`→section derivation, and `feeds` semantics; the loader and
  generators now read it instead of a hardcoded section order. See
  [section-registry.md](../architecture/section-registry.md).

Deferred: the catalog collections (`bibliography` / `tools`) design pass.
