---
title: "ADR-0010: Planning page kinds and a MoSCoW field"
description: Add Planning, Feature, and User-Journey page kinds and a moscow priority field with rationale.
doc_status: active
updated: 2026-08-22
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0009-finalize-metadata-contract
  - architecture/metadata-model
  - plans/roadmap
---

# ADR-0010: Planning page kinds and a MoSCoW field

## Status

Accepted. Extends the `kind` vocabulary in
[ADR-0009](./0009-finalize-metadata-contract.md).

## Context

The plan is growing beyond a single roadmap. As research settles into scoped
features, the plan needs to carry priority and rationale, and to distinguish the
kinds of planning page (the roadmap itself, a feature description, a user journey).
The metadata contract has a page-`kind` axis but no priority field, and no kinds
for planning artifacts.

## Decision

Two additions to the contract.

1. **Three page kinds**, added to the open `kind` vocabulary
   ([ADR-0009](./0009-finalize-metadata-contract.md)):
   - `Planning` — a plan or roadmap page.
   - `Feature` — a feature description page.
   - `User-Journey` — a user-journey page.
2. **A `moscow` field** carrying a MoSCoW priority and its rationale:

   ```yaml
   moscow:
     level: Must | Should | Could | Won't
     rationale: One sentence on why this priority.
   ```

   `level` is required when `moscow` is present; `rationale` is required with it, so
   a priority never appears without its reason. `moscow` applies to `Feature`,
   `Planning`, and `User-Journey` pages. `Won't` means "not this scope," recorded
   with the reason it is out.

The roadmap becomes a `Planning` page that splits work into MVP and extended
scope; feature pages are `Feature` pages that each carry a `moscow`.

## Consequences

- Priority and its reason live in metadata, so tools can build an MVP-versus-
  extended view and a MoSCoW board from frontmatter, and a priority is never
  unexplained.
- The plan gains structure (roadmap, features, journeys) without leaving the
  convention.
- `kind` follows the same M1 deferral as the rest of the contract; the `moscow`
  field is additive and can be authored now, since it does not clash with the
  `status`-to-`doc_status` or `divio_type`-to-`kind` migrations.

## Alternatives considered

### A single `priority` integer

Rejected. A bare number carries no rationale and does not map to the MVP-versus-
extended language the team already uses. MoSCoW with a required rationale is
clearer and self-documenting.

## References

- [ADR-0009](./0009-finalize-metadata-contract.md), the metadata contract this
  extends.
- [Metadata model](../architecture/metadata-model.md); [Roadmap](../plans/roadmap.md).
