---
title: Adopting the toolkit
description: Bring Doc Kitty into another repository.
doc_status: active
updated: 2026-08-21
type: Guide
kind: How-To
tags: [adoption, setup]
related:
  - adr/0003-root-docs-and-agent-extension
---

# Adopting the toolkit

Assumes Node ≥ 20 and pnpm (`corepack enable`).

## If you already have a Common Docs `docs/` tree

1. Rename each section's `index.md` → `README.md` and add the required
   frontmatter (title/description/status/updated/type). `docs/index.md` →
   `docs/README.md`, keeping `okf_version: "0.2"`.
2. Add the toolkit: `pnpm add -D @commondocs-kitty/toolkit`.
3. Copy the example's `astro.config.mjs`, `src/content.config.ts`, and
   `src/pages/**` wrappers; set `site`/`base`.
4. `pnpm dev` to preview, `pnpm build` to produce the site + feeds + agent-API.

## Starting from scratch

Run the scaffolder to emit the empty tree, then fill it in:

```sh
node src/scripts/scaffold.mjs docs
```

## What you get

After `pnpm build`, `dist/` contains the site plus `sitemap.xml`, `rss.xml`,
`llms.txt`, and `/api/*.json`. Deploy `dist/` to GitHub Pages with the provided
[`deploy.yml`](../../.github/workflows/deploy.yml).
