---
title: Product
description: What the Doc Kitty toolkit is and who it serves.
status: active
updated: 2026-08-21
type: Context
tags: [product]
---

# Product

## Problem

The Common Docs convention gives a repo a well-structured `docs/` tree, but no
polished, agent-aware way to publish it — and no generators for the discovery
surfaces agents need.

## Users

- **Maintainers** adopting Common Docs who want a docsite with zero theme work.
- **Agents** that need to discover and read a project's docs reliably.

## What it is

A library (`@commondocs-kitty/toolkit`) plus builder scripts. Point it at a
Common Docs — Kitty `docs/` tree; get a Starlight site with `sitemap.xml`,
`rss.xml`, `llms.txt`, and a JSON agent-API.

## Out of scope

- Authoring documentation content.
- Hosting a retrieval/embedding index.
