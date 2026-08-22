---
title: Features
description: "The doc-kitty feature pages, grouped by MoSCoW priority as set in the roadmap."
status: draft
updated: 2026-08-22
type: Feature
agent:
  priority: 0.7
---

# Features

One page per feature in the [roadmap](../roadmap.md), grouped by MoSCoW priority.
Each page is a thin wrapper: it carries the priority and rationale in frontmatter
and links the existing design, rather than re-documenting it. The MVP/extended
split and the MoSCoW levels are set in the roadmap; this index reflects them.

## Must

- [Common Docs rendering](./common-docs-rendering.md) (Must) — render the docs tree
  with README-as-index.
- [CI/CD pipeline](./ci-cd-pipeline.md) (Must) — the path-scoped delivery harness.
- [Metadata model + chrome](./metadata-model-and-chrome.md) (Must) — the frontmatter
  contract and the chrome driven by it.
- [Generators: RSS + llms.txt](./generators-rss-llms.md) (Must) — the discovery
  basics.
- [Component system + swappable theme](./component-system-and-theme.md) (Must) —
  per-kind layouts and a rebrandable theme.
- [Audience + related + external references](./audience-related-external-references.md)
  (Must) — audience targeting and rendered relationships.
- [Slide decks (reveal.js)](./slide-decks.md) (Must) — presentations as a first-class
  output surface.

## Should

- [Markua syntax support](./markua-syntax-support.md) (Should) — a subset of Markua
  for Leanpub compatibility.
- [Diagrams (Mermaid + PlantUML)](./diagrams.md) (Should) — build-time, self-contained
  diagrams.
- [Doctrine variation](./doctrine-variation.md) (Should) — recast the convention as
  charter and doctrine.
- [Glossary + Contextive](./glossary-and-contextive.md) (Should) — auto-linked
  glossary with Contextive.
- [Generated sitemap + HATEOAS read API](./generated-sitemap-and-read-api.md)
  (Should) — SEO sitemap and a richer `_links` read API.

## Could

- [Example content from ars-rethorica](./example-content-ars-rethorica.md) (Could) —
  a realistic Markua showcase.
- [Mission status portal](./mission-status-portal.md) (Could) — spec-kitty mission
  status in the docsite.
- [QA portal](./qa-portal.md) (Could) — CI test artifacts and quality signals.
- [Ticketing report](./ticketing-report.md) (Could) — a report over issue trackers.

## Won't

- [Selective/redacted publishing](./selective-redacted-publishing.md) (Won't) — the
  projection pipeline; out of this cycle.
- [Book / manuscript content type](./book-manuscript-content-type.md) (Won't) —
  competes with Leanpub; out of this cycle.
