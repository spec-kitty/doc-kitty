---
title: Generators
description: The four generated surfaces — sitemap.xml, rss.xml, llms.txt, and the JSON agent-API — and their route handlers.
doc_status: draft
updated: 2026-08-21
type: Architecture
kind: Reference
tags: [generators, sitemap, rss, llms-txt, agent-api]
related:
  - architecture/overview
  - architecture/metadata-model
  - architecture/section-registry
---

# Generators

Beyond rendering pages, the toolkit generates four discovery surfaces from page
metadata. Three serve standard clients (search engines, feed readers); the
fourth is the agent-API. Each is a route handler a consuming site mounts as a
short endpoint file. This page expands the surfaces the
[overview](./overview.md) summarizes.

<!-- Outline — to be fleshed out. One short section per surface. -->

- **`sitemap.xml`** — every published page whose section feeds `sitemap`, via the
  `@astrojs/sitemap` preset.
- **`rss.xml`** — published pages whose section feeds `rss`, newest `updated`
  first; the `rssRoute` handler and its item shape.
- **`llms.txt`** — discoverable pages whose section feeds `llms`, grouped by section
  in registry `order` with the section `label` as the group heading and the section
  `README` description (or the registry `purpose`) as its blurb; the `llmsTxtRoute`
  handler; how the `agent` block filters and orders entries within a group.
- **The agent-API** — `agentIndexRoute` and `agentPageRoute`:
  - `/api/index.json` — a browsable, structured map of the corpus, sections in
    registry order.
  - `/api/pages/<id>.json` — one page's metadata plus its raw Markdown.
  - Discovery, not RAG: an agent finds the whole corpus from one file and fetches
    clean source for exactly what it needs.
- **What every surface shares** — publication gating from the
  [metadata model](./metadata-model.md), and section order and per-surface inclusion
  from the [section registry](./section-registry.md)'s `order` and `feeds`. No
  surface hardcodes the section list or re-implements the gating; a section's `feeds`
  is the coarse filter and the per-page fields refine within it.
- **How a site mounts them** — two-line endpoint files plus the `<head>` links
  from `defineDocKittyIntegrations`.
