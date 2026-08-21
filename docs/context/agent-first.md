---
title: Agent-first documentation
description: Why an AI-focused company treats AI agents as first-class documentation readers, not an afterthought.
status: draft
updated: 2026-08-21
type: Context
tags: [agents, motivation]
---

# Agent-first documentation

Doc Kitty comes from Spec Kitty Inc, an AI-focused company. When AI agents read,
write, and act on your docs every day, generating an agent-friendly
documentation site is a no-brainer. Agents are first-class readers here, treated
on par with humans, not bolted on afterward.

<!-- Outline — to be fleshed out. -->

- **The premise** — at an AI-first company, agents are constant consumers of
  documentation; the docsite has two audiences from day one.
- **Human-first, agent-supported** — humans still come first; agent support is
  added without compromising the human reading experience.
- **What agents need that humans do not**
  - A single discovery entry point they can crawl (`llms.txt`).
  - Structured, per-page metadata and clean raw Markdown (the JSON agent-API).
  - Predictable structure and stable routes to reason over.
- **Discovery, not retrieval** — Doc Kitty ships a browsable map, not an
  embedding index; adopters keep control of any RAG layer.
- **Metadata as the contract** — the `agent` frontmatter block tunes
  discoverability, priority, and retrieval keywords per page.
- **Why this is a competitive default, not a feature request** — the cost is low
  because the metadata already exists; the payoff compounds as agent use grows.
- **See also** — [what we solve for](./what-we-solve-for.md) and the agent-API
  details in the [convention](./convention.md).
