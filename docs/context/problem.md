---
title: Why docs next to code rot
description: The recurring failure of docs-next-to-code — structure too rigid to grow, contents too hard to browse.
status: draft
updated: 2026-08-21
type: Context
tags: [problem, motivation]
---

# Why docs next to code rot

Keeping docs in the repo, next to the code, is the right instinct. It usually
fails anyway — not because the idea is wrong, but because the setup is too rigid
to grow and the contents are too hard to browse. This page names that failure so
the rest of the section can answer it.

<!-- Outline — to be fleshed out. -->

- **The promise of docs-next-to-code** — one source of truth, reviewed with the
  code, versioned with the code.
- **Where it breaks down**
  - Structure that cannot bend: a flat folder or a fixed template that new
    content does not fit, so it lands in the wrong place or nowhere.
  - Contents that are hard to browse: a pile of Markdown with no predictable
    shape, no landing pages, no navigation.
  - Rot: docs drift from the code because nothing makes the cost of staleness
    visible.
  - Invisible to machines: no map an agent or a search engine can crawl.
- **The two root causes** — not flexible enough, and hard to browse. Everything
  else follows from these.
- **Why "just add a wiki" does not fix it** — moves the docs away from the code,
  reintroduces drift, and still lacks an agent-readable surface.
- **What a fix must preserve** — docs stay next to the code; adoption stays
  low-friction; structure adapts without a rewrite.
- **Bridge** — how Doc Kitty answers each cause; see
  [what we solve for](./what-we-solve-for.md).
