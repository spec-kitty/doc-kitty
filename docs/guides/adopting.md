---
title: Adopting the toolkit
description: Bring DocKitty into another repository, from an existing Common Docs tree or from scratch, and see what a build gives you.
doc_status: active
updated: 2026-10-19T00:00:00Z
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
   frontmatter (`title`, `description`, `doc_status`, `updated`, `type`, `kind`). `docs/index.md` →
   `docs/README.md`, keeping `okf_version: "0.2"`.
2. Add the toolkit: `pnpm add -D @spec-kitty/doc-toolkit`.
3. Copy the example's `astro.config.mjs`, `src/content.config.ts`, and
   `src/pages/**` wrappers; set `site`/`base`.
4. `pnpm dev` to preview, `pnpm build` to produce the site + feeds + agent-API.

## Starting from scratch

Run the scaffolder to emit the empty tree, then fill it in:

```sh
node src/scripts/scaffold.mjs docs
```

## What you get

After `pnpm build`, `dist/` contains the site plus `sitemap-index.xml`, `rss.xml`,
`llms.txt`, and `/api/*.json`. Deploy `dist/` to GitHub Pages with the provided
[`deploy.yml`](../../.github/workflows/deploy.yml).

The page frame is capped at 120rem (1920px) by default, so on wider screens the
sidebar, text and rail stay together in the middle. To keep it full width, or
to set another cap, see
[Cap the page width](./consumer-setup.md#cap-the-page-width).
