---
title: "ADR-0035: Single-sourced vocabulary/type-derivation core (two-layer pure-ESM)"
description: One two-layer pure-ESM core makes section vocabulary and type-derivation impossible to diverge between the bare-Node gate and the Astro toolkit, retiring a hand-mirrored twin.
doc_status: active
updated: 2026-09-04
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0005-frontmatter-doc-status-and-divio-type
  - adr/0032-adr-index-generation
  - adr/0033-flexible-section-identity
  - context/convention
  - architecture/loader-and-schema
---

# ADR-0035: Single-sourced vocabulary/type-derivation core (two-layer pure-ESM)

## Status

**Accepted** — 2026-09-04. Introduced by the metadata-vocab-hub-consolidation
mission (issues #49, #39, #50). Supersedes the hand-mirrored-twin arrangement
that [ADR-0033](./0033-flexible-section-identity.md) and the loader work left in
place; the parity tests that guarded that arrangement are retargeted, not removed.

## Context

Section vocabulary (the canonical `type`/`kind`/`doc_status` sets, the frozen
`SECTION_TYPE` fallback) and type-derivation (`expectedDocType` plus the
adr/plans/operations sub-path switch and the vocabulary resolver) were defined in
**two** places that had to be kept byte-identical by hand: the Astro-side toolkit
(`src/lib/schema.ts`, `src/lib/metadata.ts`, `src/lib/sections.ts`) and the
bare-Node frontmatter gate (`src/scripts/validate-frontmatter.mjs`), with two
further copies of the type switch in `new-doc.mjs` and `scaffold.mjs`. The twin
existed for a real reason: `schema.ts` imports `astro/loaders` and
`@astrojs/starlight/schema`, so it cannot load in bare Node, and `metadata.ts`
carries a documented **fs-free** purity contract and must never import
`sections.ts`. A resolved-vocabulary parity test (NFR-004) *contained* the drift
risk rather than eliminating it — a missed edit in one copy silently diverged the
gate from the site until a test happened to catch it.

## Decision

Extract a **single canonical, two-layer pure-ESM core** that both sides import:

1. **`src/lib/vocabulary-core.mjs`** — a dependency-light, **fs-free and
   Astro-free** module holding the canonical `STATUSES`/`DOC_TYPES`/`KINDS`
   (as JSDoc-`const` literal tuples), the frozen `SECTION_TYPE`, `expectedDocType`
   + the sub-path switch, the pure vocabulary/axis resolver, and the
   index-basename helpers. Safe for `metadata.ts` and `schema.ts` to import
   without breaking the fs-free boundary.
2. **`src/lib/vocabulary-loader.mjs`** — the thin `node:fs` layer
   (`loadVocabulary`, `loadSectionRegistry`, `sectionTypes`/`sectionSubtypes`),
   imported by `sections.ts` and the bare-Node gate.

Consumers become thin importers; the ~700-line twin and both scaffolder copies
are deleted. The TS unions are **derived** (`type DocStatus = typeof STATUSES[number]`)
so they are no longer a hand-maintained third copy. `allowJs` is already global
(astro strict preset), so the literal-tuple typing needs no `.d.ts` sidecar and
`z.enum(STATUSES)` typechecks under `astro check`. The authored-registry strict
validation in `sections.ts` (throw-on-malformed, duplicate-id detection) is kept
distinct from the lenient loader — only genuinely-common logic is shared. A
committed structural gate (`vocabulary-single-source.test.ts`) fails if a second
definition ever reappears, making single-sourcing enforced by construction rather
than by discipline.

The same single-source principle resolves the two smaller issues in the mission:

- **#39 `durable` doc_status** — added once, in the core `STATUSES` tuple; it
  flows into the zod schema, the gate, and the derived `DocStatus` union with no
  second edit. `durable` is a published, never-retire status
  (see [ADR-0005](./0005-frontmatter-doc-status-and-divio-type.md) and
  [convention](../context/convention.md)).
- **#50 ADR Hub card** — `Hub.astro` and the ADR-index generator now share one
  `extractAdrMeta` (number + status + date), so the rendered ADR hub matches the
  generated own-tree table by construction rather than by a re-parse that could
  drift (see [ADR-0032](./0032-adr-index-generation.md)).

## Consequences

- **Positive:** divergence is impossible by construction (DIRECTIVE_044); a
  vocabulary or type-rule change is a single edit; ~410 net lines of duplication
  removed; the bare-Node gate still runs with no Astro build context (C-001
  preserved); the parity tests become single-implementation unit tests with
  literal oracles (the `schema.ts`-vs-gate *field-shape* parity legitimately
  stays two-armed, as those encodings remain independent).
- **Negative / cost:** one more module boundary (core vs loader) to respect; the
  fs-free/loader split must be honored by future contributors (guarded by the
  structural gate); scaffolders now additionally emit `Presentation` for
  `presentations/` pages (an additive alignment).
- **Neutral:** no dependency added, upgraded, or removed; no runtime behavior
  change on the current corpus — the full toolkit test suite and every
  doc-sanity/build-artifact gate stay green.
