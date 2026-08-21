---
title: Starlight integration
description: How defineDocKittyIntegrations wires Starlight, the sitemap preset, the feed and agent-API head links, and theming.
status: draft
updated: 2026-08-21
type: Architecture
tags: [starlight, astro, integration]
related:
  - architecture/overview
  - adr/0001-build-on-astro-starlight
---

# Starlight integration

`defineDocKittyIntegrations()` is the one call a consuming site makes to wire the
toolkit into Astro. It composes Starlight and the sitemap preset and adds the
feed and agent-API links to the page `<head>`. This page expands the integration
the [overview](./overview.md) names as a component.

<!-- Outline — to be fleshed out. -->

- **What the call returns** — the Astro integrations array a site spreads into
  its config; the single wiring point for consumers.
- **Starlight configuration** — navigation from the section order, search, and
  the theme; how the loader's collection feeds the sidebar.
- **The sitemap preset** — how `@astrojs/sitemap` is configured and gated to
  published pages.
- **`<head>` links** — the feed (`rss.xml`) and agent-API discovery links
  injected on every page.
- **Theming** — the token-based theme layer and where a consumer overrides it.
- **Why one entry point** — keeps consumer sites to a thin config; the toolkit
  owns the wiring. See [ADR-0001](../adr/0001-build-on-astro-starlight.md).
