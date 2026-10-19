---
title: Overview
description: Components and data flow of the DocKitty toolkit.
doc_status: active
updated: 2026-08-21T00:00:00Z
type: Architecture
kind: Explanation
tags: [astro, starlight, okf]
related:
  - context/convention
  - adr/0001-build-on-astro-starlight
---

# Overview

The toolkit is a library; a docs repo is a small Astro app that wires it in.

```mermaid
flowchart LR
  D["docs/**  README-as-index + frontmatter"] --> L[docKittyDocsLoader]
  L --> SC[docKittyDocsSchema  zod validation]
  SC --> ST[Starlight  nav / search / theme]
  L --> SM[sitemap-index.xml  @astrojs/sitemap]
  L --> RS[rss.xml  rssRoute]
  L --> LT[llms.txt  llmsTxtRoute]
  L --> AI["/api/index.json  agentIndexRoute"]
  L --> AP["/api/pages/*.json  agentPageRoute"]
```

## Components

- **`defineDocKittyIntegrations()`** — Starlight + sitemap preset with the feed
  and agent-API `<head>` links.
- **`docKittyDocsSchema()` / `docKittyDocsLoader()`** — the frontmatter schema
  and the loader that reads repo-root `docs/` and rewrites `README.md` → section
  slug.
- **Route handlers** — `rssRoute`, `llmsTxtRoute`, `agentIndexRoute`,
  `agentPageRoute`; a site mounts them as two-line endpoint files.
- **`lib/metadata.ts`** — framework-agnostic model + helpers (publication
  gating, section ordering, agent-record shaping); unit-tested in isolation.
- **Single-h1 pass** (`lib/rehype/single-h1.ts`) — an always-on rehype pass that
  keeps the page title the only `<h1>` (#191). Starlight renders the frontmatter
  `title` as `<h1 id="_top">`, so the pass drops the first body `# Title` that
  repeats it, wherever it sits, and leaves an empty `<span id>` with the id the
  heading would have had, so links to it still work. Any other body `<h1>`
  becomes an `<h2>`. A `kind: Presentation` deck is skipped. It is a rehype pass
  because it works on the rendered heading tree, which covers `.md` and `.mdx`
  alike, and it runs before Astro's `rehypeHeadingIds`, so a dropped heading never
  reaches the table of contents and a demoted one enters it as an `<h2>`.
- **Builder scripts** — `scaffold.mjs` (emit the tree), `new-doc.mjs` (one
  page), `validate-frontmatter.mjs` (CI gate).

## The agent-API

Discovery, not RAG: `llms.txt` is a browsable table of contents grouped by
section; `/api/index.json` is the same as structured JSON; `/api/pages/<id>.json`
returns one page's metadata plus its raw Markdown. An agent discovers the whole
corpus from one file and fetches clean source for exactly what it needs.

## Version-sensitive spots

Two spots depend on the pinned Starlight/Astro versions and are verified when the
build toolchain is wired up: the exact loader API for README-as-index, and
pointing the `docs` collection at repo-root `docs/`. See
[ADR-0002](../adr/0002-readme-as-index.md).
