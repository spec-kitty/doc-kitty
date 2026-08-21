---
title: Metadata model
description: The framework-agnostic metadata model and helpers — publication gating, section ordering, and agent-record shaping.
status: draft
updated: 2026-08-21
type: Architecture
tags: [metadata, model]
related:
  - architecture/overview
  - architecture/generators
---

# Metadata model

`lib/metadata.ts` is the framework-agnostic core: a plain model of a page's
metadata plus the helpers every generator shares. Keeping it independent of
Astro lets it be unit-tested in isolation and reused by each output surface.
This page expands the model the [overview](./overview.md) lists as a component.

<!-- Outline — to be fleshed out. -->

- **Why a framework-agnostic model** — one source of truth for page metadata;
  no Astro types leaking into the generators; testable without a build.
- **The page record** — the normalized shape a loaded page becomes (id, section,
  slug, required fields, optional families, `agent` block).
- **Publication gating** — `draft` pages are excluded from `sitemap.xml`,
  `rss.xml`, and the agent-API; `active` / `deprecated` / `superseded` are
  published. Where the gate is applied.
- **Section ordering** — the canonical twelve-section order used by navigation,
  `llms.txt`, and the agent index.
- **Agent-record shaping** — how the `agent` block (`discoverable`, `priority`,
  `keywords`) maps into the agent-API and `llms.txt` entries, with defaults.
- **Testing seam** — this module is the unit-test surface; note what is covered
  in `src/tests/`.
