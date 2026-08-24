---
title: "ADR-0018: Citation catalog collections (bibliography + tools)"
description: Two build-time data collections back the external-reference catalog form; a CSL-JSON-lite record cited by stable id, resolved fail-fast, exported for one-step consumer wiring.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0009-finalize-metadata-contract
  - architecture/metadata-model
---

# ADR-0018: Citation catalog collections (bibliography + tools)

## Status

Accepted. Implements the `bibliography`/`tools` catalog collections named but
deferred by [ADR-0009](./0009-finalize-metadata-contract.md) decision 3.

## Context

ADR-0009 froze the `external_references` shape as `{ url, title, note? }` (inline)
**or** `{ type, id }` (catalog), and named two backing collections — `bibliography`
and `tools` — but deferred them to M3. No catalog, resolver, or endpoint exists yet.
M3 must let a source be described once and cited consistently from many pages, and
expose it to agents as a dereferenceable projection.

## Decision

1. **Two Astro content-layer data collections**, loaded with the `file()` loader,
   one YAML file per catalog: `docs/_meta/bibliography.yaml` and
   `docs/_meta/tools.yaml`, mirrored under `example/docs/_meta/`. `_meta/` is the
   established home for authored registries (alongside `sections.yaml`).

2. **CSL-JSON-lite record shape.** A hand-rolled flat subset of CSL-JSON — no
   citation-processing library (NFR-006):
   - `bibliography`: `{ id, type?, title, authors?: string[], container?, url, issued?, accessed?, note? }`
   - `tools`: `{ id, name, url, note? }`
   `id` is the stable, agent-facing citation key. `authors` are flat strings and
   `issued` is a year-or-`YYYY-MM-DD` string; full CSL name-parts and structured
   dates are a deliberate later extension.

3. **The catalog `type` discriminator** on a `{ type, id }` citation selects the
   collection: `biblio` → `bibliography`, `tool` → `tools`. This field is the frozen
   ADR-0009 `type`; it deliberately overloads the frontmatter `type` (section) axis,
   so it is always written and read as "catalog `type`". "CSL-JSON-lite" and this
   overload are this ADR's glossary home.

4. **Resolution is fail-fast.** An `{ type, id }` whose id is absent from its
   collection, or whose catalog `type` is neither `biblio` nor `tool`, is a **blocking
   build error** — the same posture ADR-0009 sets for a dangling `related` ref. A
   build-free catalog validator (`validate-catalog.mjs`) parity-duplicates the check
   for the doc-sanity lane (the standalone-gate/parity pattern; the resolver is not
   imported into the `.mjs` gate).

5. **The toolkit exports the catalog schema + loader** (mirroring
   `docKittyDocsSchema()` / `docKittyDocsLoader()`) so a consumer wires
   `bibliography`/`tools` into `content.config.ts` in one step. Fail-fast assumes the
   collections are wired; the export makes that a single documented step.

6. **`/api/bibliography.json`** projects the `bibliography` collection by stable `id`
   (with `title` and `url`). It sits **outside `doc_status` gating** — catalog records
   are not pages.

## Consequences

### Positive

- A citation is single-sourced and renders identically everywhere; agents resolve a
  stable id instead of re-parsing prose.
- Fail-fast keeps a mistyped citation from shipping; parity keeps the build-free gate
  honest.
- No new dependency; the catalog is plain YAML.

### Negative

- Citing `{ type, id }` requires the consumer to wire two extra collections (mitigated
  by the toolkit export + a documented one-step wiring).

### Risks

- The rendered site-wide bibliography *page* is deferred; only the data, the per-page
  references list, and the JSON endpoint ship. A later mission adds the page.

## Alternatives considered

### BibTeX / full CSL

Rejected for MVP: LaTeX-oriented parser (BibTeX) or a heavy citeproc dependency
(full CSL) — both violate NFR-006. CSL-JSON-lite keeps the field names CSL-aligned so
a later round-trip stays cheap.

### One combined catalog collection

Rejected: `bibliography` and `tools` have genuinely different shapes; the catalog
`type` discriminator already routes cleanly to two collections.

## References

- [ADR-0009](./0009-finalize-metadata-contract.md).
- [Metadata model](../architecture/metadata-model.md).
