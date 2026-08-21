---
title: Getting started
description: Install, run, and see the generated feeds and agent-API.
status: active
updated: 2026-08-21
type: Guide
tags: [setup, getting-started]
related:
  - architecture/overview
---

# Getting started

1. Enable pnpm and install:

   ```sh
   corepack enable
   pnpm install
   ```

2. Run the dev server:

   ```sh
   pnpm --filter example dev
   ```

   You are looking at `docs/README.md`.

3. Add a page with correct frontmatter:

   ```sh
   node ../src/scripts/new-doc.mjs guides/my-recipe --title "My recipe"
   ```

4. Visit `/rss.xml`, `/llms.txt`, and `/api/index.json` — the new page appears
   in each, driven by its metadata.
