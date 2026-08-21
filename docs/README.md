---
okf_version: "0.2"
title: Doc Kitty — Toolkit Documentation
description: Master entry point for the documentation of the Doc Kitty toolkit itself.
status: active
updated: 2026-08-21
authors:
  - stijn@sddevelopment.be
---

# Doc Kitty — Toolkit Documentation

Documentation **about the toolkit itself** — what it is, the convention it
implements, how it works, and how to adopt it. This `docs/` tree is written in
the very convention it describes (**Common Docs — Kitty Variation**), so it is
also a worked example. The deliverable docsite lives, separately, in
[`../example`](../example).

## Sections

- [Context](./context/) — what Doc Kitty is, the convention spec, and the
  glossary. **Start with [the convention](./context/convention.md).**
- [Architecture](./architecture/) — how the toolkit turns a `docs/` tree into a
  site plus feeds and an agent-API.
- [Decision Records](./adr/) — why Starlight, README-as-index, root `docs/`,
  and the `agent` extension.
- [Plans](./plans/) — forward design during the iteration phase: the roadmap and
  per-feature specs (starting with the **CI/CD pipeline**).
- [Guides](./guides/) — authoring a page, and adopting the toolkit.

## Quick reference

- Toolkit source: [`../src`](../src)
- Runnable example: [`../example`](../example)
- Agent skills: [`../agents`](../agents)
- Repo overview: [`../README.md`](../README.md) and [`../AGENTS.md`](../AGENTS.md)
