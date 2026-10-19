---
title: Starlight integration
description: How defineDocKittyIntegrations wires Starlight, the sitemap preset, the feed and agent-API head links, and theming.
doc_status: draft
updated: 2026-10-19T00:00:00Z
type: Architecture
kind: Reference
tags: [starlight, astro, integration]
related:
  - architecture/overview
  - adr/0001-build-on-astro-starlight
  - adr/0044-header-carrier
  - adr/0063-sidebar-carrier
  - architecture/collapsible-toc-rail
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
- **The carriers** — the toolkit replaces exactly six Starlight components:
  `Head`, `PageTitle`, `MarkdownContent`, `Footer`, `Header` and `Sidebar`. The map
  is applied after a consumer's `starlight.components`, so it is the same on every
  site ([ADR-0044](../adr/0044-header-carrier.md),
  [ADR-0063](../adr/0063-sidebar-carrier.md)).
- **The sitemap preset** — how `@astrojs/sitemap` is configured and gated to
  published pages.
- **`<head>` links** — the feed (`rss.xml`) and agent-API discovery links
  injected on every page.
- **The sidebar reveal** — the script that scrolls the sidebar to the current
  entry ships from the `Sidebar` carrier, right after Starlight's sidebar markup,
  not from `<head>`. It runs after Starlight's own scroll restore and before the
  sidebar is first painted (#203). See
  [Collapsible TOC rail](./collapsible-toc-rail.md).
- **Deterministic output** — two drafts-off builds of the same tree give
  byte-identical machine surfaces (sitemaps, `rss.xml`, `llms.txt`, `api/**`,
  `okf/**`, `pagefind/**`). `src/tests/draft-publication-build.test.ts` compares
  them over one declared manifest and fails if a glob in it matches nothing
  (#201).
- **Theming** — the token-based theme layer and where a consumer overrides it.
- **Why one entry point** — keeps consumer sites to a thin config; the toolkit
  owns the wiring. See [ADR-0001](../adr/0001-build-on-astro-starlight.md).
