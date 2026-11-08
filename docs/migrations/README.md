---
okf_version: "0.2"
title: Migrations
description: Version-to-version migration guides for adopters of the DocKitty toolkit.
doc_status: active
updated: 2026-11-08T00:00:00Z
type: Migration
kind: Hub
agent:
  priority: 0.7
---

# Migrations

One guide per toolkit release that asks adopters to change something. Each
lists the steps in order; the [changelog](../../CHANGELOG.md) has the full
before and after for every entry.

- [Page chrome defaults](./page-chrome-defaults.md): the sidebar and metadata
  blocks start closed, hubs show cards first, and the footer and build gain
  machine-readable links. Two settings restore the old sidebar and blocks.
- [Keeping .html URLs when moving from DocFX](./legacy-html-urls.md): map
  every old `.html` URL to its new directory URL with `legacyHtmlRedirects`,
  and gate it in CI.
- [0.6.0 to 0.7.0](./0.6-to-0.7.md): fix the PlantUML service setups the
  include check now fails, and the OpenAPI changes — dotted labels refused,
  unreleased versions leave the sitemap and search, new agent entries and
  opt-in keys.
- [0.4.0 to 0.5.0](./0.4-to-0.5.md): add `kind` to every page, or relax it
  in the charter.
- [0.3 to 0.4](./0.3-to-0.4.md): move to Astro 7, Starlight 0.42 and Node
  22.22, regenerate generated pages, and update scenarios API clients.
