---
title: Generated sitemap + HATEOAS read API
description: "An SEO sitemap and a richer machine-readable read API with _links, refining discovery beyond the basics."
status: draft
updated: 2026-08-22
type: Feature
moscow:
  level: Should
  rationale: "SEO sitemap and a richer machine-readable (_links) read API refine discovery beyond the MVP basics."
tags: [generators, sitemap, agent-api, hateoas]
related:
  - architecture/generators
---

# Generated sitemap + HATEOAS read API

Generate `sitemap.xml` for search engines and a richer machine-readable read API
whose records carry `_links` (HATEOAS-style), so agents can traverse the corpus.
This refines the discovery the MVP already provides through `rss.xml` and
`llms.txt`.

Scope: Extended.

Design: [generators](../../architecture/generators.md).
