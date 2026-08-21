---
title: Roadmap
description: Phased plan for doc-kitty features and the cross-cutting CI/CD priority.
status: draft
updated: 2026-08-21
type: Plan
authors:
  - stijn@sddevelopment.be
related:
  - plans/features/ci-cd-pipeline
---

# Roadmap

Design-iteration phase — order and scope are provisional. Derived from the
[feature discovery synthesis](../../research/2026-08-21-astro-feature-discovery/SYNTHESIS.md).

## Cross-cutting priority — CI/CD

**Regardless of feature design, a working, well-thought-out CI/CD pipeline is the
primary concern**: unit + integration tests, doc sanity checks, and example-site
deployment, run **path-efficiently** (no code checks on a doc-only change, and
vice versa). See [CI/CD Pipeline](./features/ci-cd-pipeline.md). This shapes the
repo layout and every mission's "done" definition.

## Confirmed decisions (2026-08-21)

- `status` → **`doc_status`** (enum unchanged), lands in M1.
- Add **`divio_type`** (Tutorial|How-To|Reference|Explanation) alongside OKF
  `type`, lands in M1.
- **Direct render** is the foundation; the projection/redaction pipeline is
  optional and deferred to M8.

## Phased missions

| Mission | Scope |
|---|---|
| **M0 — CI/CD foundation** | The pipeline below, stood up against the current scaffold so every later mission lands green. |
| **M1 — Metadata & chrome foundation** | Schema (`doc_status`, `divio_type`, `audience`, `related {ref,note}`, `external_references`), `MarkdownContent`/`Head` overrides. |
| **M2 — Component system & theme** | Atomic-design layering, token theme, frontend/a11y doctrine. |
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
