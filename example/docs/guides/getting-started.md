---
title: Getting started
description: Where to start, whether you build your own docsite with DocKitty or work on this example site.
doc_status: active
updated: 2026-10-19T00:00:00Z
type: Guide
kind: Tutorial
tags: [setup, getting-started]
social_thumb:
  src: ./assets/getting-started-share.png
  alt: The Getting started guide share card
related:
  - guides/install
  - architecture/overview
external_references:
  - type: biblio
    id: divio-2017
---

# Getting started

## Build your own docsite

To use DocKitty in your own project, install the published toolkit from GitHub
Packages: **[Install the toolkit](/guides/install/)** walks through the Node
floor, the Astro 7 and Starlight 0.42 peers, the registry setup and a first
build. Upgrading from 0.3? That guide links the migration guide.

## Work on this example site

This site is the worked example in the
[doc-kitty repository](https://github.com/spec-kitty/doc-kitty). To run it from
a clone, at the repository root:

1. Use Node 22.22 or later, enable pnpm and install:

   ```sh
   corepack enable
   pnpm install
   ```

2. Run the dev server:

   ```sh
   pnpm dev
   ```

   You are looking at `example/docs/README.md`.

3. Add a page with correct frontmatter:

   ```sh
   node src/scripts/new-doc.mjs guides/my-recipe --title "My recipe" --base example/docs
   ```

4. Visit `/rss.xml`, `/llms.txt`, and `/api/index.json` — the new page appears
   in each, driven by its metadata.
