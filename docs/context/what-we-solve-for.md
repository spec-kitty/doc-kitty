---
title: What Doc Kitty solves for
description: The four outcomes Doc Kitty is built to deliver — structure, maintainability, agent interoperability, and flexibility.
status: draft
updated: 2026-08-21
type: Context
tags: [motivation, goals]
---

# What Doc Kitty solves for

Doc Kitty exists to make docs-next-to-code work. It solves for four outcomes:
structure, maintainability, agent interoperability, and flexibility. Each one
answers a way that docs-next-to-code otherwise fails.

<!-- Outline — to be fleshed out. One short section per outcome. -->

- **Structure** — documentation with a predictable, browsable shape.
  - A fixed, ordered section tree; readers always know where a thing lives.
  - Section landing pages that teach, then link — never a bare list of files.
  - Progressive disclosure: context first, operations last.
- **Maintainability** — docs that stay correct next to the code without rotting.
  - Docs live in the repo, reviewed and versioned with the code.
  - Metadata makes staleness visible (`status`, `updated`, freshness signals).
  - Curated, not a wiki: stale pages are updated or removed.
- **Agent interoperability** — a site AI agents can discover and browse.
  - Generated discovery surfaces: sitemap, RSS, `llms.txt`, and the JSON
    agent-API.
  - Discovery, not retrieval: a crawlable map, not a vector index.
  - Metadata tunes what agents see and how it is ranked.
- **Flexibility** — adaptable structure plus easy browsing.
  - The recurring reason docs-next-to-code fails is that it is not flexible
    enough or too hard to browse; this outcome targets both directly.
  - Structure adapts without a rewrite; point the toolkit at an existing tree.
  - Metadata-first design lets new page kinds and surfaces slot in.
- **How the four reinforce each other** — structure makes browsing easy,
  metadata makes both maintenance and agent discovery possible, flexibility
  keeps all three from ossifying.
- **See also** — [why docs rot](./problem.md), the
  [convention](./convention.md) that encodes these outcomes, and
  [agent-first documentation](./agent-first.md).
