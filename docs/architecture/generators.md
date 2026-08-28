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
  `@astrojs/sitemap` preset. Inclusion composes the per-page `doc_status` gate with
  the section-level `feeds` filter (a section that omits `feeds` feeds all four
  surfaces; an absent registry filters nothing).
- **`rss.xml`** — published, non-deck pages newest `updated` first whose section
  feeds `rss`; the `rssRoute` handler and its item shape. The `feeds` filter
  composes with the publication state / `kind` gating.
- **`llms.txt`** — discoverable pages whose section feeds `llms`, grouped by section
  in registry `order` with the section `label` as the group heading; the
  `llmsTxtRoute` handler; how the `agent` block filters and orders entries within a
  group. Each section group also emits a **blurb line** = the section `README`
  description **??** the registry `purpose` (README wins; a section with neither
  emits no blurb line).
- **The agent-API** — `agentIndexRoute` and `agentPageRoute`:
  - `/api/index.json` — a browsable, structured map of the corpus, sections in
    registry order.
  - `/api/pages/<id>.json` — one page's metadata plus its raw Markdown.
  - Discovery, not RAG: an agent finds the whole corpus from one file and fetches
    clean source for exactly what it needs.
- **What every surface shares** — publication gating from the
  [metadata model](./metadata-model.md), section order from the
  [section registry](./section-registry.md)'s `order`, and the registry's `feeds`
  per-surface filter (composed on top of the per-page gating; absent = all four).
  No surface hardcodes the section list.
- **How a site mounts them** — two-line endpoint files plus the `<head>` links
  from `defineDocKittyIntegrations`.
