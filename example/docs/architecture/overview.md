---
title: Overview
description: How the example turns a Common Docs tree into a site plus feeds and an agent-API.
doc_status: active
updated: 2026-08-21
type: Architecture
kind: Explanation
tags: [astro, starlight, build]
related:
  - guides/getting-started
---

# Overview

The site is a static Astro + Starlight build driven entirely by the `docs/`
tree.

```mermaid
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
