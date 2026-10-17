---
title: Agent-first documentation
description: "Why an AI-focused company treats agents as first-class documentation readers, not an afterthought."
doc_status: active
updated: 2026-08-21
type: Context
kind: Explanation
tags: [agents, rationale]
---

# Agent-first documentation

DocKitty is built by Spec Kitty Inc, where AI agents do real work against project
documentation. An agent that reads the docs to plan a change, answer a question,
or check a decision is a reader with real needs. This page explains why DocKitty
treats that reader as first-class.

## Human-first, agent-supported

The content is written for people. Agents read the same pages; they do not get a
separate, lower-quality copy. What agents need on top of clear prose is structure
they can rely on: a predictable tree, consistent metadata, and stable links.

## Discovery, not retrieval

DocKitty gives agents a map, not a search index. From the same frontmatter that
drives navigation, it generates:

- `sitemap-index.xml` for crawlers,
- `rss.xml` for changes,
- `llms.txt` as a compact index for language models,
- a JSON agent-API (`/api/index.json` and per-page records) carrying each page's
  metadata and a link to its raw Markdown.

Each record carries `_links`, so an agent can follow links instead of building
URLs. The index links to itself, `llms.txt`, the sitemap and the feeds you
mount. A page record links to itself, back up to the index, to its HTML page and
to the pages it relates to. [ADR-0058](../adr/0058-build-state-owner-and-config-split.md#5-the-agent-api-gains-_links)
lists the relations.

An agent can list the whole corpus from one file and fetch the exact page it
needs. There is no embedding server to run and no chunking to tune, and it works
for any crawler.

## Why this is worth doing

The metadata that makes docs browsable for people is most of what an agent needs.
Emitting the discovery surfaces from that metadata costs little. For a company
whose tools are agents, generating an agent-friendly site is the obvious move, not
an add-on.

See the [convention](./convention.md) for the metadata that drives these surfaces,
and [what DocKitty solves for](./what-we-solve-for.md) for the four outcomes.
