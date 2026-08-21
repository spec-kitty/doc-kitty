---
title: Domain
description: The ubiquitous language for the Common Docs — Kitty Variation.
status: active
updated: 2026-08-21
type: Context
tags: [glossary, domain]
sources:
  - resource: https://github.com/velvet-tiger/common-docs
    title: Common Docs specification
  - resource: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
    title: Open Knowledge Format (OKF) v0.2
---

# Domain

## Glossary

- **Bundle** — a `docs/` tree conforming to OKF v0.2. One repository, one bundle.
- **Section** — a top-level directory under `docs/` (e.g. `architecture/`).
- **Section index** — the `README.md` at a section root (the Kitty twist; vanilla
  Common Docs uses `index.md`).
- **Type** — the OKF-required frontmatter field identifying the kind of a page.
- **Agent-API** — the generated `llms.txt` + `/api/*.json` discovery surface.

## Terms that sound similar

- **Plan vs ADR vs Architecture** — plans describe the *future*, ADRs record
  *past* decisions, architecture describes the *present*. Never conflate them.
- **Discovery vs Retrieval** — this project does discovery (a browsable map),
  not retrieval (a vector index).
