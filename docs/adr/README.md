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
| [0001](./0001-build-on-astro-starlight.md) | ADR-0001: Build on Astro + Starlight | Accepted | 2026-08-21 |
| [0002](./0002-readme-as-index.md) | ADR-0002: README-as-index (with frontmatter) | Accepted | 2026-08-21 |
| [0003](./0003-root-docs-and-agent-extension.md) | ADR-0003: Render root docs/; add an agent extension | Accepted | 2026-08-21 |
| [0004](./0004-amend-common-docs-as-extensible-variation.md) | ADR-0004: Amend Common Docs as an extensible variation | Accepted | 2026-08-21 |
| [0005](./0005-frontmatter-doc-status-and-divio-type.md) | ADR-0005: Rename status to doc_status and add divio_type | Accepted | 2026-08-21 |
| [0006](./0006-direct-render-default-projection-deferred.md) | ADR-0006: Direct render by default; projection deferred | Accepted | 2026-08-21 |
| [0007](./0007-ci-cd-path-scoped-lanes.md) | ADR-0007: Path-scoped CI/CD lanes | Accepted | 2026-08-21 |
| [0008](./0008-swappable-theme-layer.md) | ADR-0008: Theme and chrome are a swappable, layered concern | Accepted | 2026-08-21 |
| [0009](./0009-finalize-metadata-contract.md) | ADR-0009: Finalize the metadata contract | Accepted | 2026-08-21 |
| [0010](./0010-planning-kinds-and-moscow.md) | ADR-0010: Planning page kinds and a MoSCoW field | Accepted | 2026-08-22 |
| [0011](./0011-theme-slot-surface-and-per-kind-layouts.md) | ADR-0011: Theme slot surface and per-kind layouts | Accepted | 2026-08-22 |
| [0012](./0012-slide-decks-static-reveal-from-markdown.md) | ADR-0012: Slide decks are static reveal.js built from Markdown | Accepted | 2026-08-24 |
| [0013](./0013-m1-chrome-substrate-single-layer.md) | ADR-0013: M1 chrome substrate — single-layer manifest and static token delivery | Accepted | 2026-08-23 |
| [0014](./0014-upgrade-starlight-for-route-data-api.md) | ADR-0014: Upgrade Starlight to 0.32 for the route-data API | Accepted | 2026-08-23 |
| [0015](./0015-m2-slot-resolution-and-components-map-seam.md) | ADR-0015: M2 slot resolution, the pass-through surface, and the components-map seam | Accepted | 2026-08-23 |
| [0016](./0016-accent-text-bridge-correction.md) | ADR-0016: Bridge --sl-color-text-accent from --dk-color-text-accent | Accepted | 2026-08-23 |
| [0017](./0017-m3-content-block-rendering-seam.md) | ADR-0017: M3 content-block rendering seam (carrier-body, token-styled) | Accepted | 2026-08-24 |
| [0018](./0018-citation-catalog-collections.md) | ADR-0018: Citation catalog collections (bibliography + tools) | Accepted | 2026-08-24 |
| [0019](./0019-persona-attribute-fields.md) | ADR-0019: Persona attribute fields (role, goals, responsibilities) | Accepted | 2026-08-24 |
| [0020](./0020-persona-location-reconciliation.md) | ADR-0020: Persona location reconciliation (context/audience/) | Accepted | 2026-08-24 |
| [0021](./0021-deck-routing-seam-out-of-frame-override.md) | ADR-0021: Decks render out-of-frame by a path-scoped Astro route override | Accepted | 2026-08-24 |
| [0022](./0022-reveal-integration-and-token-theme.md) | ADR-0022: reveal.js integration — pinned 6.0.1, core+Notes, browser-only init, --dk-* token theme | Accepted | 2026-08-24 |
| [0023](./0023-diagram-render-and-metadata-seam.md) | ADR-0023: Client-side diagram rendering, one render owner, and the %%-metadata → accessible-figure seam | Accepted | 2026-08-25 |
| [0024](./0024-diagram-token-promotion-and-brand-wiring.md) | ADR-0024: Promote --dk-diagram-* to the Default catalog and the brand layer, retire the orphan | Accepted | 2026-08-25 |
| [0025](./0025-glossary-on-this-page-block-and-remark-render-channel.md) | ADR-0025: The "On this page" block and the remark→render data channel (ADR-0017 companion) | Accepted | 2026-08-30 |
| [0026](./0026-glossary-source-and-generation-seam.md) | ADR-0026: Glossary source, validation, and the codegen-into-collection generation seam | Accepted | 2026-08-26 |
| [0027](./0027-auto-link-resolution-scoping-and-term-directive.md) | ADR-0027: Auto-link resolution, per-page scoping, and the :term directive | Accepted | 2026-08-26 |
| [0028](./0028-glossary-frontmatter-fields.md) | ADR-0028: The glossary_context and glossary_autolink frontmatter fields | Accepted | 2026-08-26 |
| [0029](./0029-sidebar-autogenerate-content-root-coupling.md) | ADR-0029: The registry sidebar prefixes autogenerate directories with docsDir | Accepted | 2026-08-28 |
| [0030](./0030-markua-preprocess-to-directive.md) | ADR-0030: Render Markua by preprocessing to remark-directive | Accepted | 2026-08-30 |
| [0031](./0031-vocabulary-override.md) | ADR-0031: Consumer-overridable type/kind vocabulary | Accepted | 2026-08-31 |
| [0032](./0032-adr-index-generation.md) | ADR-0032: Generate the ADR index; two-tree mechanism with a lockfile sync-check | Accepted | 2026-08-31 |
| [0033](./0033-flexible-section-identity.md) | ADR-0033: Flexible section identity — configurable index basename and first-class section rename | Accepted | 2026-09-03 |
| [0034](./0034-redirect-coverage-gate.md) | ADR-0034: Redirect-coverage primitive — committed baseline, native redirects, target-aware bare-Node gate | Accepted | 2026-09-03 |

New ADRs copy [`template.md`](./template.md).
