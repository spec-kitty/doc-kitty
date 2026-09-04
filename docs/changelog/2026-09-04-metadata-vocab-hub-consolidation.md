---
title: Metadata / vocabulary / Hub consolidation — one source of truth, durable status, ADR-ordered hub
description: "Closes #49/#39/#50 — section vocabulary + type-derivation live in one pure-ESM core (no more mjs↔ts twin), doc_status gains durable, and the ADR Hub card orders by number with a lifecycle badge."
doc_status: active
updated: 2026-09-04
type: Changelog
kind: Changelog
tags: [vocabulary, metadata, refactor, doc_status, adr, hub, single-source]
related:
  - adr/0035-vocabulary-core-consolidation
  - adr/0005-frontmatter-doc-status-and-divio-type
  - adr/0032-adr-index-generation
  - context/convention
  - architecture/loader-and-schema
---

# 2026-09-04 — Metadata / vocabulary / Hub consolidation

Three deferred adoption enablers surfaced by the spec-kitty proving-ground study
land together, each turning a latent maintenance hazard into a structural
guarantee. Base behaviour is unchanged on today's corpus — the full toolkit test
suite (769 tests) and every doc-sanity / build-artifact gate stay green.

## What changed

- **One source of truth for section vocabulary + type-derivation (#49).** The
  canonical `type`/`kind`/`doc_status` sets, the `SECTION_TYPE` fallback,
  `expectedDocType`, the vocabulary resolver, and the index-basename helpers now
  live in a single two-layer pure-ESM core — a fs-free
  [`vocabulary-core.mjs`](../architecture/loader-and-schema.md) that both the
  Astro toolkit and `schema.ts` import, plus a thin `vocabulary-loader.mjs`
  fs layer for the bare-Node gate. The ~700-line hand-mirrored twin in
  `validate-frontmatter.mjs` (and two further copies in the scaffolders) is
  **deleted**; divergence between the gate and the site is now impossible by
  construction, enforced by a committed single-source gate rather than by a
  parity test. See [ADR-0035](../adr/0035-vocabulary-core-consolidation.md).

- **`durable` document status (#39).** `doc_status` gains `durable` — a
  never-retire throughline for foundational docs an adopter expects to stay
  current indefinitely. It is a published status (like `active`), added in one
  place (the single-sourced enum) and flowing into the schema, the gate, and the
  derived TS unions with no second edit. See
  [convention](../context/convention.md) and
  [ADR-0005](../adr/0005-frontmatter-doc-status-and-divio-type.md).

- **ADR-number-ordered, status-aware Hub card (#50).** A Hub rendered over an ADR
  tree now lists entries in ADR-number order with a lifecycle status badge
  (Proposed / Accepted / Superseded / Deprecated) and date, matching the
  generated own-tree table 1:1 over the published, numbered set. The card reuses
  the ADR-index generator's `extractAdrMeta` — number, status, and date all come
  from one extractor, so the rendered hub and the generated table cannot drift
  (see [ADR-0032](../adr/0032-adr-index-generation.md)). Number-less pages and
  ADR templates are excluded on both sides; non-ADR hubs and the single-ADR demo
  are unchanged.

## Why it matters

Each change removes a class of silent breakage rather than one instance:
duplicated vocabulary that could drift, a strict enum that hard-failed a
legitimate lifecycle state, and a rendered ADR index that could disagree with the
generated one. Net ~410 lines of duplication removed; no dependency added,
upgraded, or removed.
