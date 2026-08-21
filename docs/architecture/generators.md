---
title: Generators
description: The four generated surfaces — sitemap.xml, rss.xml, llms.txt, and the JSON agent-API — and their route handlers.
status: draft
updated: 2026-08-21
type: Architecture
tags: [generators, sitemap, rss, llms-txt, agent-api]
related:
  - architecture/overview
  - architecture/metadata-model
---

# Generators

Beyond rendering pages, the toolkit generates four discovery surfaces from page
metadata. Three serve standard clients (search engines, feed readers); the
fourth is the agent-API. Each is a route handler a consuming site mounts as a
short endpoint file. This page expands the surfaces the
[overview](./overview.md) summarizes.

<!-- Outline — to be fleshed out. One short section per surface. -->

- **`sitemap.xml`** — every published page, via the `@astrojs/sitemap` preset.
- **`rss.xml`** — published pages, newest `updated` first; the `rssRoute`
  handler and its item shape.
- **`llms.txt`** — discoverable pages grouped by section in canonical order; the
  `llmsTxtRoute` handler; how the `agent` block filters and orders entries.
- **The agent-API** — `agentIndexRoute` and `agentPageRoute`:
  - `/api/index.json` — a browsable, structured map of the corpus.
  - `/api/pages/<id>.json` — one page's metadata plus its raw Markdown.
  - Discovery, not RAG: an agent finds the whole corpus from one file and fetches
    clean source for exactly what it needs.
- **What every surface shares** — publication gating and section ordering from
  the [metadata model](./metadata-model.md); no surface re-implements them.
- **How a site mounts them** — two-line endpoint files plus the `<head>` links
  from `defineDocKittyIntegrations`.
