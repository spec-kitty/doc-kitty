---
title: Roadmap
description: Phased plan for doc-kitty features and the cross-cutting CI/CD priority.
status: draft
updated: 2026-08-21
type: Plan
authors:
  - stijn@sddevelopment.be
related:
  - architecture/ci-cd-pipeline
---

# Roadmap

Design-iteration phase — order and scope are provisional. Derived from the
[feature discovery synthesis](../../research/2026-08-21-astro-feature-discovery/SYNTHESIS.md).

## Cross-cutting priority — CI/CD

**Regardless of feature design, a working, well-thought-out CI/CD pipeline is the
primary concern**: unit + integration tests, doc sanity checks, and example-site
deployment, run **path-efficiently** (no code checks on a doc-only change, and
vice versa). See [CI/CD Pipeline](../architecture/ci-cd-pipeline.md). This shapes
the repo layout and every mission's "done" definition.

## Decisions

The decisions behind this plan are recorded as ADRs, not here:

- [ADR-0004](../adr/0004-amend-common-docs-as-extensible-variation.md) — amend
  Common Docs; add `presentations/` and the `_meta/` registry.
- [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md) — `doc_status`
  and `kind` (renamed from `divio_type`; both land in M1).
- [ADR-0006](../adr/0006-direct-render-default-projection-deferred.md) — direct
  render by default; projection deferred to M8.
- [ADR-0007](../adr/0007-ci-cd-path-scoped-lanes.md) — the CI/CD strategy.
- [ADR-0008](../adr/0008-swappable-theme-layer.md) — theme and chrome are a
  swappable, layered concern.
- [ADR-0009](../adr/0009-finalize-metadata-contract.md) — the finalized metadata
  contract (supersedes ADR-0005's `divio_type`).

## Phased missions

| Mission | Scope |
|---|---|
| **M0 — CI/CD foundation** | The pipeline below, stood up against the current scaffold so every later mission lands green. |
| **M1 — Metadata & chrome foundation** | Schema (`doc_status`, `kind`, `audience`, `related`, `external_references`, `banner`/`social_thumb`), `MarkdownContent`/`Head` overrides. |
| **M2 — Component system & theme** | Atomic-design layering; the swappable theme layer (default + Spec Kitty brand) per [ADR-0008](../adr/0008-swappable-theme-layer.md); per-kind layouts; frontend/a11y doctrine. |
| **M3 — Audience + Related + External refs** | The three metadata-rendered relationship features + bibliography/tools catalogs. |
| **M4 — Glossary & terminology** | `.contextive` source, glossary pages, remark auto-linking, search. |
| **M5 — Diagrams** | Build-time mermaid + plantuml + lightbox. |
| **M6 — Slide decks** | Reveal.js Markdown→remark-split→static pipeline. |
| **M7 — Doctrine variation** | Adopt/mint doctrine, wire validator/CI gates. |
| **M8 — Selective/redacted publishing** (optional) | Opt-in projection pipeline. |

> CI/CD is listed as **M0** because it is the stated primary concern and the
> harness every other mission relies on. Its scope grows with each feature (new
> test suites, new sanity checks), but the pipeline architecture is designed once,
> up front, here.
