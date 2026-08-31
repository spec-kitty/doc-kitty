# Data Model — QOL Adoption-Enabler Cluster

Static-file toolkit; "entities" are governance-data shapes and derived records, not a database.

## Entity — Vocabulary Override (`_meta/vocabulary.yaml`, new)

Declarative per-consumer override of the shipped `type`/`kind` vocabulary. Resolved `default → consumer` (consumer file, when present, overlays the shipped defaults).

| Field | Type | Meaning |
|-------|------|---------|
| `types.aliases` | map<string,string> | `authored-or-derived-term → canonical-term` (e.g. `Feature: Mission`). Applied to authored AND derived values. |
| `types.forbidden` | list<string> | Terms that must not appear as an effective `type`; emitting one is a validation failure naming the allowed replacement. |
| `kinds.aliases` | map<string,string> | Same as `types.aliases` for `kind`. |
| `kinds.forbidden` | list<string> | Same as `types.forbidden` for `kind`. |

**Resolution semantics**
- Absent file → shipped defaults unchanged (`Feature` remains valid). (NFR-002)
- Malformed file → clear validation error, never a silent fallback.
- Applied identically by the mjs gate and the ts schema, at both the authored-value path and the derivation switch (NFR-004, FR-004).
- Alias is applied **before** forbidden-check (aliasing `Feature→Mission` satisfies a `Feature`-forbidden rule).

**Invariants**
- INV-V1: For identical `vocabulary.yaml` input, mjs and ts resolve to identical effective vocabulary and derived-type results (parity test asserts on resolved output).
- INV-V2: A term neither aliased nor forbidden resolves to itself.

## Entity — ADR-Index Record (derived by `generate-adr-index.mjs`)

One row per ADR file discovered recursively under `docs/adr/` (excluding `template.md`).

| Field | Source | Meaning |
|-------|--------|---------|
| `number` | filename `NNNN-…` | ADR number; primary sort key (ascending). |
| `title` | frontmatter `title` | Display title / link text. |
| `path` | relative file path | Link target (depth-tolerant; era subfolders included). |
| `status` | body `## Status` (first status token) | accepted / proposed / superseded. |
| `date` | frontmatter `updated` | Last-updated date. |

**Invariants**
- INV-A1: The generated table is a pure function of the ADR files (deterministic, idempotent) — regenerating twice yields byte-identical output (so the lockfile sync-check has no false diffs).
- INV-A2: Every `docs/adr/NNNN-*.md` (any depth) appears exactly once; `template.md` never appears.
- INV-A3: Rows are number-ordered ascending.

## Entity — Section Registry (`_meta/sections.yaml`, existing — unchanged)

Authority for `expectedType` derivation. This mission reads it; it does not change its schema. The `plans/features → Feature` subtype remains hardcoded in the derivation twins (unchanged, per Decision 6).

## Relationships
- The **frontmatter contract** (a doc's `type`/`kind`) is validated against the **Section Registry** (derivation) and the **Vocabulary Override** (alias/forbid), in that order: derive if absent → apply override to the effective value → validate.
- The **ADR-Index Record** set is independent of the vocabulary/derivation surface (parallel track).
