---
title: Agent-first documentation
description: "Why an AI-focused company treats agents as first-class documentation readers, not an afterthought."
status: active
updated: 2026-08-21
type: Context
tags: [agents, rationale]
---

# Agent-first documentation

Doc Kitty is built by Spec Kitty Inc, where AI agents do real work against project
documentation. An agent that reads the docs to plan a change, answer a question,
or check a decision is a reader with real needs. This page explains why Doc Kitty
treats that reader as first-class.

## Human-first, agent-supported

The content is written for people. Agents read the same pages; they do not get a
separate, lower-quality copy. What agents need on top of clear prose is structure
they can rely on: a predictable tree, consistent metadata, and stable links.

## Discovery, not retrieval

Doc Kitty gives agents a map, not a search index. From the same frontmatter that
drives navigation, it generates:

- `sitemap.xml` for crawlers,
- `rss.xml` for changes,
- `llms.txt` as a compact index for language models,
- a JSON agent-API (`/api/index.json` and per-page records) carrying each page's
  metadata and a link to its raw Markdown.

An agent can list the whole corpus from one file and fetch the exact page it
needs. There is no embedding server to run and no chunking to tune, and it works
for any crawler.

## Why this is worth doing

The metadata that makes docs browsable for people is most of what an agent needs.
Emitting the discovery surfaces from that metadata costs little. For a company
whose tools are agents, generating an agent-friendly site is the obvious move, not
an add-on.
