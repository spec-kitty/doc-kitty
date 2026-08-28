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

- **`sitemap.xml`** — every published page, via the `@astrojs/sitemap` preset.
  (Section-level `feeds` filtering is deferred; inclusion is gated by `doc_status`
  today, not by the registry.)
- **`rss.xml`** — published pages newest `updated` first; the `rssRoute` handler and
  its item shape. (Section-level `feeds` filtering is deferred; inclusion is by
  publication state / `kind` today.)
- **`llms.txt`** — discoverable pages grouped by section in registry `order` with the
  section `label` as the group heading; the `llmsTxtRoute` handler; how the `agent`
  block filters and orders entries within a group. (A per-section blurb from the
  section `README` or the registry `purpose` is deferred — no blurb line is emitted
  today.)
- **The agent-API** — `agentIndexRoute` and `agentPageRoute`:
  - `/api/index.json` — a browsable, structured map of the corpus, sections in
    registry order.
  - `/api/pages/<id>.json` — one page's metadata plus its raw Markdown.
  - Discovery, not RAG: an agent finds the whole corpus from one file and fetches
    clean source for exactly what it needs.
- **What every surface shares** — publication gating from the
  [metadata model](./metadata-model.md), and section order from the
  [section registry](./section-registry.md)'s `order`. No surface hardcodes the
  section list. (Per-surface inclusion via the registry's `feeds` is deferred — no
  surface consults `feeds` yet; gating is publication-based today.)
- **How a site mounts them** — two-line endpoint files plus the `<head>` links
  from `defineDocKittyIntegrations`.
