---
title: "ADR-0031: Consumer-overridable type/kind vocabulary"
description: A declarative _meta/vocabulary.yaml seam that aliases, neutralizes, or forbids type/kind terms, resolved default → consumer and applied to authored and derived values.
doc_status: active
updated: 2026-08-31
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0004-amend-common-docs-as-extensible-variation
  - adr/0009-finalize-metadata-contract
  - adr/0008-swappable-theme-layer
  - architecture/section-registry
---

# ADR-0031: Consumer-overridable `type`/`kind` vocabulary

## Status

**Accepted** — 2026-08-31. Introduced by the QOL adoption-enabler mission
(issue #40); amends the vocabulary posture of
[ADR-0004](./0004-amend-common-docs-as-extensible-variation.md) and
[ADR-0009](./0009-finalize-metadata-contract.md).

## Context

doc-kitty ships a canonical `type` set that includes `Feature`. A demanding real
adopter (the spec-kitty proving ground) governs its docs under a Mission-canon
charter that **forbids** the term `Feature` in CI. Because the section-registry
derivation types every `docs/plans/features/*` page as `Feature`, an adopter can
be forced to emit the forbidden term even when they never authored it (the
DERIVED value carries it). Removing `Feature` from the canonical set is not an
option — it is a legitimate default term for other adopters, and the derivation
still fires — so a per-consumer override is needed.

The override must:

- resolve WITHOUT an Astro build (the standalone `validate-frontmatter.mjs` gate
  is the enforcement surface, NFR-003);
- apply to BOTH authored and section-derived values (so a forbidden term is caught
  wherever it originates, FR-004/FR-005);
- resolve `default → consumer` (shipped defaults, overlaid by the consumer file);
- be inert when absent (shipped defaults unchanged, `Feature` valid, NFR-002);
- resolve identically on the mjs gate and the ts library (NFR-004).

## Decision

Add a declarative, on-disk `_meta/vocabulary.yaml` seam and a resolver.

### File shape (`<docsRoot>/_meta/vocabulary.yaml`)

```yaml
types:
  aliases:
    Feature: Mission        # authored OR derived "Feature" resolves to "Mission"
  forbidden:
    - Feature               # an effective type of "Feature" fails, naming the alias
kinds:
  aliases: {}
  forbidden: []
```

All keys are optional. An absent file means the shipped defaults (no aliases, no
forbidden terms — `Feature` stays valid).

### Resolver

`loadVocabulary(docsRoot)` (canonical unit in `src/lib/sections.ts`, beside
`loadSectionRegistry`) returns `{ resolveType, resolveKind }`. Each `resolve*`
returns `{ effective, forbidden, aliasedFrom? }`:

- **`forbidden` is checked on the raw term and takes precedence** — a banned term
  fails even when an alias exists; the alias then merely supplies the replacement
  to NAME in the failure message.
- an **alias** otherwise rewrites the term to its replacement (the neutralize
  path);
- an **unlisted** term passes through unchanged (identity).

The gate applies the resolver in the contract order **derive-if-absent → resolve
(alias then forbidden) → validate**: it computes the effective `type` (authored,
else section-derived), resolves it, fails on a forbidden effective term, and
otherwise keeps the authored-vs-derived mismatch advisory.

### Twin discipline

The resolver is hand-mirrored into `src/scripts/validate-frontmatter.mjs` because
the TS module cannot load in bare Node — the same discipline already applied to
`SECTION_TYPE` and the zod field shape. `src/tests/vocabulary-resolver.test.ts`
pins the two twins to identical RESOLVED output for identical YAML (NFR-004),
asserting on the resolved values, not on any static default array. The single
runtime enforcement surface is the mjs `validate()`; `metadata.ts` stays
deliberately fs-free and is not threaded with the vocabulary (it does not enforce
authored-vs-derived typing). Consolidating the mjs↔ts split is a filed follow-up
(spec C-006b).

## Consequences

### Positive

- A Mission-canon adopter can neutralize or forbid `Feature` (authored or derived)
  without doc-kitty dropping it from the canonical set — the hard adoption blocker
  is removed by data, not by a code change.
- The override is build-independent and read by the same gate that already owns
  path-aware presence rules, so it needs no Astro context.

### Negative

- A second hand-mirrored twin (the resolver) joins the existing `SECTION_TYPE` and
  zod-shape mirrors as split-brain surface; the parity test is the guard, and a
  structural consolidation is a filed follow-up.

### Why not the theme-merge seam (ADR-0008)?

The [swappable theme layer](./0008-swappable-theme-layer.md) merges design tokens
at build time inside Astro. The vocabulary override must run in the bare-Node gate
with no build context, so it is a plain on-disk file read alongside
`sections.yaml`, not a theme-merge concern.

## References

- [ADR-0004](./0004-amend-common-docs-as-extensible-variation.md) (optional,
  registry-derived `type`), [ADR-0009](./0009-finalize-metadata-contract.md) (the
  frontmatter contract).
- [Section registry](../architecture/section-registry.md), the sibling on-disk
  `_meta/` seam this resolver mirrors.
