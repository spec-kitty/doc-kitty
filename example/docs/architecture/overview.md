---
title: Overview
description: How the example turns a Common Docs tree into a site plus feeds and an agent-API.
doc_status: active
updated: 2026-08-21
type: Architecture
kind: Explanation
tags: [astro, starlight, build]
hero_image:
  src: ./assets/overview-hero.png
  alt: A layered diagram of the toolkit turning a docs tree into a site and feeds
related:
  - guides/getting-started
---

# Overview

The site is a static Astro + Starlight build driven entirely by the `docs/`
tree.

```mermaid
%% title: Build pipeline
%% description: The docs/ tree feeds the toolkit loader, which fans out to Starlight, the sitemap, RSS, llms.txt, and the agent-API, then Starlight emits the static site.
flowchart LR
  D[docs/**  README-as-index + frontmatter] --> L[toolkit loader]
  L --> S[Starlight  nav / search / theme]
  L --> M[sitemap.xml]
  L --> R[rss.xml]
  L --> T[llms.txt]
  L --> A["/api/*.json  agent-API"]
  S --> H[dist/  static HTML]
```

## Key properties

- **Static** — no server; everything renders at build time.
- **Metadata-driven** — nav, feeds, and the agent-API all read from frontmatter.
- **Convention-first** — the `docs/` tree is a valid OKF bundle.

See the toolkit's own architecture docs for the internals.
