---
title: "ADR-0009: Finalize the metadata contract"
description: Promote the metadata-model design decisions into the record and rename the page-kind axis to kind.
doc_status: active
updated: 2026-08-21
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - architecture/metadata-model
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0005-frontmatter-doc-status-and-divio-type
---

# ADR-0009: Finalize the metadata contract

## Status

Accepted. Supersedes the `divio_type` decision in
[ADR-0005](./0005-frontmatter-doc-status-and-divio-type.md); the `doc_status`
rename in ADR-0005 stands.

## Context

The metadata model was designed iteratively. Decisions accumulated in a holding
block in [the metadata model](../architecture/metadata-model.md), pending
reconciliation once the contract stopped growing. ADR-0005 recorded the page-kind
axis as `divio_type` with four values, before it was renamed to `kind` and grown
into a taxonomy.

Finalizing the design and moving to mission specs means declaring the contract
stable. This ADR promotes those decisions into the record so the missions build
against a coherent set of ADRs, not a design-doc holding pattern.

## Decision

The metadata contract, finalized:

1. **Page kind is `kind`** (supersedes ADR-0005's `divio_type`). Required on every
   page. Open vocabulary: `Tutorial`, `How-To`, `Reference`, `Explanation`, `Hub`,
   `ADR`, `Changelog`, `Glossary`, `Presentation`, `Persona`. It drives per-kind
   layout. `type` names the section; `kind` names how to read the page.
2. **`related`** is a bare slug or `{ ref, note }`. A bare slug renders the target
   page's `description`; a `note` overrides it. The build fails on a ref that does
   not resolve.
3. **`external_references`** is inline `{ url, title, note? }` or catalog
   `{ type, id }`, where catalog entries resolve against `bibliography` and `tools`
   collections.
4. **Images**: `banner` (`{ src, alt }`, the page hero and the default social
   image) and `social_thumb` (the Open Graph and Twitter card; falls back to
   `banner.src`, then a site default).
5. **`type` is authored** and validated against the section. The value set is open:
   the validator checks the canonical set strictly and warns on an unknown value
   (from [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md); restated
   for completeness).
6. **Freshness**: `stale_after` and `updated` feed a nightly, non-blocking
   freshness report. Thresholds are defined with the freshness feature, not here.

`doc_status` (ADR-0005) is unchanged.

## Consequences

- The contract is stable enough to spec M1. The M1 migration applies `doc_status`,
  `kind`, and these fields across the repo, and updates the validator and the Astro
  schema.
- The metadata-model page drops its holding block and points here for the "why."
- Adding a field later means a new ADR, not an edit to this one.

## Alternatives considered

### Option A: Keep the decisions in the architecture holding block

Rejected. Decisions belong in ADRs; a mission needs a stable record to build from,
not a design doc marked "pending reconciliation."

### Option B: One ADR per field

Rejected for now. This is one cohesive finalization of a contract designed in a
single pass. It can be split later if a field's decision is revisited.

## Update (2026-08-22)

The `banner` field in decision 4 was renamed to `hero_image` by
[ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md), to avoid a collision
with Starlight's built-in `banner`. The shape and `social_thumb` fallback are
unchanged; the fallback chain is now `social_thumb` → `hero_image.src` → site
default.

## Update (2026-08-31) — `type` and `kind` are optional (#38/#40)

The QOL adoption-enabler mission (issues #38/#40) amends decisions 1 and 5 of the
finalized contract so an adopter is not forced to hand-annotate two required
fields across a large corpus:

- **`kind` is OPTIONAL** (decision 1 said "required on every page"). The standalone
  gate no longer requires `kind`; an absent `kind` is accepted (there is no
  derivation source for it). When present it must still be a non-empty string, and
  the open-vocabulary warn on an unknown value is unchanged. The site zod schema
  was already lenient here; this aligns the gate with it.
- **`type` is OPTIONAL and section-DERIVED** (decision 5 said "`type` is
  authored"). When a page omits `type`, the gate derives the effective type from
  the section registry; an authored `type` wins, and an authored-vs-derived
  mismatch is an advisory `warnings[]` entry, not a hard error. A root/orphan page
  with no derivable type is accepted as deterministically untyped. The rationale
  and the absent-derivation behavior are recorded in
  [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md).
- **Vocabulary override.** `type`/`kind` terms are aliasable/forbiddable per
  consumer via `_meta/vocabulary.yaml`, applied to authored and derived values —
  see [ADR-0031](./0031-vocabulary-override.md).

Backward compatibility holds: a page that already declares `type`/`kind` validates
exactly as before, and with no `_meta/vocabulary.yaml` the shipped defaults apply
unchanged (`Feature` stays valid).

## References

- [Metadata model](../architecture/metadata-model.md)
- [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md),
  [ADR-0005](./0005-frontmatter-doc-status-and-divio-type.md),
  [ADR-0031](./0031-vocabulary-override.md)
