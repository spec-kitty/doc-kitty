---
title: Product
description: The problem this example solves and who it is for.
doc_status: active
updated: 2026-08-21
type: Context
kind: Explanation
tags: [product, vision]
---

# Product

## Problem statement

Teams that adopt the Common Docs convention have a well-structured `docs/` tree
but no polished, agent-aware way to publish it.

## Target users

- **Maintainers** who want a docsite without hand-rolling an Astro theme.
- **Agents** that need to discover and read documentation reliably.

## Value proposition

Point the toolkit at a Common Docs — Kitty `docs/` tree and get a Starlight
site plus `sitemap.xml`, `rss.xml`, and an agent-API, with no bespoke wiring.

## Out of scope

- Authoring the documentation content itself.
- Hosting a retrieval/embedding index (the agent-API is a map, not a RAG).
