---
okf_version: "0.2"
title: Doc Kitty Example
description: Master entry point for the example docsite built with the Common Docs — Kitty Variation.
status: active
updated: 2026-08-21
authors:
  - stijn@sddevelopment.be
---

# Doc Kitty Example

A minimal, deployable docsite that renders a **Common Docs — Kitty Variation**
`docs/` tree with [`@commondocs-kitty/toolkit`](https://github.com/OWNER/doc-kitty).
It exists to show the convention in practice and to prove the generated
artifacts:

- [`/sitemap-index.xml`](/sitemap-index.xml) — search-engine discovery
- [`/rss.xml`](/rss.xml) — subscribe to documentation changes
- [`/llms.txt`](/llms.txt) — the agent-facing index
- [`/api/index.json`](/api/index.json) — the machine-readable corpus map

## Sections

Ordered for progressive disclosure (context → operations):

- [Context](/context/) — why this exists and its domain vocabulary.
- [Architecture](/architecture/) — current system design.
- [Decision Records](/adr/) — the immutable ADR log.
- [Guides](/guides/) — how-to for humans and agents.
- [Changelog](/changelog/) — release history.

> Only a subset of the twelve Common Docs sections is populated here; the rest
> (`plans`, `api`, `configuration`, `integrations`, `security`, `operations`,
> `migrations`) are scaffolded the same way with `scaffold.mjs`.

## Quick reference

- Run locally: `pnpm --filter example dev`
- Build: `pnpm --filter example build`
- See also: the repo [`README.md`](https://github.com/OWNER/doc-kitty) and its
  `AGENTS.md`.
