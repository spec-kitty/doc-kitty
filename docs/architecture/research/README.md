---
title: Architecture research
description: Investigations that inform architecture decisions but are not themselves the present-state design.
status: active
updated: 2026-08-22
type: Architecture
agent:
  priority: 0.5
---

# Architecture research

Notes that feed architecture and ADR decisions. They record what an option is and
how it works, so a decision can cite them. They are not the present-state design
(that lives in the sibling architecture pages) and not decisions (those are ADRs).

- [Astro Markdown extensions](./astro-markdown-extensions.md) — how Astro and
  Starlight support custom Markdown syntax: callouts, rich images, and components.
- [Supporting Markua syntax](./markua-syntax-support.md) — how a curated subset of
  Markua (images, ids, asides, blurbs, icons) could render through remark, rehype,
  and Starlight components.
- [Example content from ars-rethorica](./ars-rethorica-book-example.md) — convert
  an open-license Markua book into realistic docsite example content; docsite-only,
  with the book pipeline out of scope.
- [Mission status portal for kittified repos](./mission-status-portal.md) —
  generate a mission overview from a repo's Spec Kitty artifacts so the docsite
  doubles as a status portal.
- [QA portal (tests as documentation)](./qa-portal.md) — render test and BDD
  results so the docsite also serves as a QA portal.
