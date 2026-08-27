---
title: Decision Records
description: The immutable log of architectural decisions for the toolkit.
doc_status: active
updated: 2026-08-21
type: ADR
kind: Hub
---

# Decision Records

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0001](./0001-build-on-astro-starlight.md) | Build on Astro + Starlight | accepted | 2026-08-21 |
| [0002](./0002-readme-as-index.md) | README-as-index (with frontmatter) | accepted | 2026-08-21 |
| [0003](./0003-root-docs-and-agent-extension.md) | Render root `docs/`; add an `agent` extension | accepted | 2026-08-21 |
| [0004](./0004-amend-common-docs-as-extensible-variation.md) | Amend Common Docs as an extensible variation (+ `presentations/`, `_meta/` registry) | accepted | 2026-08-21 |
| [0005](./0005-frontmatter-doc-status-and-divio-type.md) | Rename `status` to `doc_status`; add `divio_type` | accepted | 2026-08-21 |
| [0006](./0006-direct-render-default-projection-deferred.md) | Direct render by default; projection deferred | accepted | 2026-08-21 |
| [0007](./0007-ci-cd-path-scoped-lanes.md) | Path-scoped CI/CD lanes | accepted | 2026-08-21 |
| [0008](./0008-swappable-theme-layer.md) | Theme and chrome are a swappable, layered concern | accepted | 2026-08-21 |
| [0009](./0009-finalize-metadata-contract.md) | Finalize the metadata contract (supersedes 0005's `divio_type`) | accepted | 2026-08-21 |
| [0010](./0010-planning-kinds-and-moscow.md) | Planning page kinds (`Planning`/`Feature`/`User-Journey`) and a `moscow` field | accepted | 2026-08-22 |
| [0011](./0011-theme-slot-surface-and-per-kind-layouts.md) | Theme slot surface + per-kind layouts (+ `banner`→`hero_image`) | accepted | 2026-08-22 |
| [0012](./0012-slide-decks-static-reveal-from-markdown.md) | Slide decks: static reveal.js built from Markdown | accepted | 2026-08-22 |
| [0013](./0013-m1-chrome-substrate-single-layer.md) | M1 chrome substrate: single-layer manifest + static token delivery | accepted | 2026-08-23 |
| [0014](./0014-upgrade-starlight-for-route-data-api.md) | Upgrade Starlight to 0.32 for the route-data API | accepted | 2026-08-23 |
| [0015](./0015-m2-slot-resolution-and-components-map-seam.md) | M2 slot resolution, pass-through surface, and the components-map seam | accepted | 2026-08-23 |
| [0016](./0016-accent-text-bridge-correction.md) | Bridge `--sl-color-text-accent` from `--dk-color-text-accent` | accepted | 2026-08-23 |
| [0017](./0017-m3-content-block-rendering-seam.md) | M3 content-block rendering seam (carrier-body, token-styled) | accepted | 2026-08-24 |
| [0018](./0018-citation-catalog-collections.md) | Citation catalog collections (bibliography + tools) | accepted | 2026-08-24 |
| [0019](./0019-persona-attribute-fields.md) | Persona attribute fields (role, goals, responsibilities) | accepted | 2026-08-24 |
| [0020](./0020-persona-location-reconciliation.md) | Persona location reconciliation (`context/audience/`) | accepted | 2026-08-24 |
| [0021](./0021-deck-routing-seam-out-of-frame-override.md) | Deck routing seam: out-of-frame route override | accepted | 2026-08-24 |
| [0022](./0022-reveal-integration-and-token-theme.md) | Reveal integration and token theme | accepted | 2026-08-24 |
| [0023](./0023-diagram-render-and-metadata-seam.md) | Client-side diagram rendering, one render owner, `%%`-metadata → accessible figure | accepted | 2026-08-25 |
| [0024](./0024-diagram-token-promotion-and-brand-wiring.md) | Diagram token promotion and brand wiring | accepted | 2026-08-25 |
| [0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md) | Glossary "On this page" block + the remark→render data channel (ADR-0017 companion) | accepted | 2026-08-26 |
| [0026](./0026-glossary-source-and-generation-seam.md) | Glossary source, validation, and codegen-into-collection generation seam | accepted | 2026-08-26 |
| [0027](./0027-auto-link-resolution-scoping-and-term-directive.md) | Auto-link resolution, per-page scoping, and the `:term` directive | accepted | 2026-08-26 |
| [0028](./0028-glossary-frontmatter-fields.md) | The `glossary_context` and `glossary_autolink` frontmatter fields | accepted | 2026-08-26 |

New ADRs copy [`template.md`](./template.md).
