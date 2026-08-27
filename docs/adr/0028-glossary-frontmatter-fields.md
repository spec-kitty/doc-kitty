---
title: "ADR-0028: The glossary_context and glossary_autolink frontmatter fields"
description: Two optional page-local frontmatter fields extend the M4 metadata contract — a bounded-context selector and an auto-link opt-out — per ADR-0009's new-field-means-new-ADR rule.
doc_status: active
updated: 2026-08-26
type: ADR
kind: ADR
authors:
  - stijn@spec-kitty.ai
related:
  - plans/features/glossary-and-contextive
  - adr/0009-finalize-metadata-contract
  - adr/0027-auto-link-resolution-scoping-and-term-directive
  - architecture/metadata-model
---

# ADR-0028: The `glossary_context` and `glossary_autolink` frontmatter fields

## Status

Accepted. Extends the metadata contract finalized in
[ADR-0009](./0009-finalize-metadata-contract.md) with two M4 fields, per ADR-0009's own
rule: *"Adding a field later means a new ADR, not an edit to this one."* Settles spec
constraint **C-007**. The fields are consumed by
[ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md).

## Context

M4 scoping is **page-local** (Assumptions; C-005). Two page decisions must be authored in
frontmatter:

- **Which bounded context a page belongs to**, so the auto-linker resolves a term to the
  right definition and can resolve an otherwise-unresolved collision (FR-007).
- **Whether a page opts out of auto-linking entirely** (FR-008), independent of the
  ignore-list and `:term`.

ADR-0009 makes the metadata contract a governed surface: a new field is a new ADR so the
schema, validator, and Astro collection schema (`docKittyDocsSchema`) grow deliberately,
not ad hoc. The squad flagged the naming: an earlier `glossary: false` boolean was
ambiguous (feature-off vs autolink-off, and a future object-shape collision), so rev 2
renamed the opt-out to **`glossary_autolink`** (terminology finding L-02).

## Decision

1. **`glossary_context: <string>`** — optional, page-local. Names the bounded context the
   page belongs to; the auto-linker (ADR-0027) uses it to pick the right definition and to
   resolve a collision the page context covers. **Not inherited** in v1 (a page that omits
   it is treated as context-less: single-candidate terms still link, collisions become
   unresolved). Validation: when present it **must name a context defined in the loaded
   definitions file**; an unknown context is a **build warning** (consistent with the
   skip-and-warn posture, NFR-007), not fatal — a page may be authored before its context
   exists. The generated glossary pages (ADR-0026) set this on themselves.

2. **`glossary_autolink: boolean`** — optional, page-local, **defaults to `true`** (absent
   = auto-linking on, the presence-driven default C-005). `false` suppresses **all**
   auto-linking on the page (the ignore-list and `:term` are orthogonal: `:term` still
   works — it is explicit — and the "On this page" block still lists any `:term` links
   used). This is the per-page twin of the ignore-list.

3. **Both fields extend `docKittyDocsSchema` as optional; absence is the M1-identical
   path.** The zod schema (`src/lib/schema.ts`) gains two optional keys; the standalone
   validator mirrors them. A page with neither field validates and renders exactly as
   before this ADR (NFR-002) — the fields are purely additive. They reach the remark layer
   via `file.data.astro.frontmatter` (AS-5, the confirmed bridge), where the auto-linker
   reads them.

4. **Scope boundary: exactly these two fields.** No other frontmatter field is added by
   M4 (hard scope cut). Any future glossary field is a further ADR.

## Consequences

### Positive

- The metadata contract grows by exactly two well-named, page-local, optional fields —
  ADR-0009's governance rule is honored and the naming ambiguity the squad found is fixed.
- Absent fields = byte-identical build (NFR-002); additive and presence-driven (C-005).

### Negative

- Two more fields for authors to learn. Mitigated: both are optional with sensible defaults
  (no context = link only unambiguous terms; auto-link on by default), documented on the
  feature page (FR-015).

### Risks

- An author typos `glossary_context`. Mitigation: the unknown-context **warning** (Decision
  1) surfaces it in the build log without failing the build; the greppable line names the
  page.

## Alternatives considered

### Reuse a single `glossary:` object with `{ context, autolink }`

Rejected (squad L-02) — an object invites the ambiguous `glossary: false` shorthand and a
feature-off vs autolink-off confusion. Two flat, explicitly-named fields are unambiguous
and match the flat metadata style of ADR-0009.

### Make `glossary_context` inheritable from a section default

Rejected for v1 (Assumptions) — inheritance adds resolution complexity and a hidden data
path; page-local is testable and explicit. Revisit on demand.

### Make an unknown `glossary_context` build-fatal

Rejected — it would block authoring a page before its context lands; the warning posture
(NFR-007) matches the rest of the collision handling.

## References

- [ADR-0009](./0009-finalize-metadata-contract.md) (the contract + the new-field rule),
  [ADR-0027](./0027-auto-link-resolution-scoping-and-term-directive.md) (the consumer),
  [metadata model](../architecture/metadata-model.md).
- Spec C-005/C-007; FR-007/008; NFR-002/007; post-spec squad L-02.
