---
title: Plans
description: Forward-looking design and roadmap for doc-kitty — future work, not present state.
status: draft
updated: 2026-08-21
type: Plan
agent:
  priority: 0.8
---

# Plans

Future work for doc-kitty: the roadmap and mission sequencing. Present-state and
component design lives in [architecture](../architecture/), and settled decisions
in [adr](../adr/).

- [Roadmap](./roadmap.md) — the phased plan (missions M0–M8) and the cross-cutting
  CI/CD priority.
- [Design readiness](./design-readiness.md) — which features are ready to spec, and
  the underdesigned aspects that need an ADR or design pass first.

Component and pipeline designs (the CI/CD pipeline, the metadata model) live in
[architecture](../architecture/). Product-feature specs, when we write them, go in
`plans/features/`.

> **Schema note.** These docs use the current frontmatter (`status`, `type`). The
> confirmed `status`→`doc_status` rename and the added `kind` axis land as part of
> M1; until then the repo stays on the current schema for consistency.
