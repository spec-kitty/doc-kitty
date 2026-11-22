---
title: Domain
description: Glossary and terms of art for the toolkit and convention.
doc_status: active
updated: 2026-11-22T00:00:00Z
type: Context
kind: Explanation
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
- **Toolkit** — the `@spec-kitty/doc-toolkit` library in [`../../src`](../../src).
- **Charter / doctrine** — Spec Kitty governance artifacts this convention will
  later be recast into.
- **Measure** — one technical, organisational, legal or physical safeguard,
  identified by a stable id in the measures catalog: `docs/_meta/measures.yaml`,
  or the default the toolkit ships. See
  [ADR-0080](../adr/0080-tom-classification-field-and-measures-catalog.md).
- **TOM classification** — the optional `tom_classification` page field. It lists
  the measures a page provides evidence for. It marks evidence; it does not make
  a description of technical and organisational measures (TOMs) complete.

## Distinctions

- **Plan vs ADR vs Architecture** — future vs past-decision vs present.
- **Discovery vs Retrieval** — a browsable map vs a vector index. DocKitty does
  discovery.
- **`AGENTS.md` vs `agents/`** — the root pointer file vs the directory of agent
  skills. Different things; both exist here.
