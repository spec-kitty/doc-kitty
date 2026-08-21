---
title: Domain
description: Glossary and terms of art for the toolkit and convention.
status: active
updated: 2026-08-21
type: Context
tags: [glossary]
---

# Domain

## Glossary

- **Bundle** — a `docs/` tree conforming to OKF v0.2 (one repo, one bundle).
- **Section** — a top-level directory under `docs/`.
- **Section index** — the `README.md` at a section root (Kitty twist).
- **Type** — the OKF-required frontmatter field naming a page's section/category
  (for example `Context` or `ADR`). Distinct from `kind`, which names how to read
  the page.
- **Agent-API** — the generated `llms.txt` + `/api/*.json` discovery surface.
- **Toolkit** — the `@commondocs-kitty/toolkit` library in [`../../src`](../../src).
- **Charter / doctrine** — Spec Kitty governance artifacts this convention will
  later be recast into.

## Distinctions

- **Plan vs ADR vs Architecture** — future vs past-decision vs present.
- **Discovery vs Retrieval** — a browsable map vs a vector index. Doc Kitty does
  discovery.
- **`AGENTS.md` vs `agents/`** — the root pointer file vs the directory of agent
  skills. Different things; both exist here.
