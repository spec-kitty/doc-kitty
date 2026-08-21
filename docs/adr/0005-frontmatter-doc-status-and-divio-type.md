---
title: "ADR-0005: Rename status to doc_status and add divio_type"
description: Two changes to the frontmatter contract — a clearer lifecycle field name and a reading-mode axis.
status: active
updated: 2026-08-21
type: ADR
authors:
  - stijn@sddevelopment.be
related:
  - context/convention
  - adr/0004-amend-common-docs-as-extensible-variation
  - plans/roadmap
---

# ADR-0005: Rename status to doc_status and add divio_type

## Status

Accepted

## Context

The convention requires `status`, `updated`, and `type` on every page. Two gaps
show up in practice.

`status` clashes with Spec Kitty's work-package lane status. A repo that runs both
carries the word `status` with two meanings.

`type` records where a page lives (its section: Context, Architecture, and so on).
It does not tell a reader how to read the page. A reference page and a tutorial
can share a section but demand different reading.

## Decision

Make two changes to the frontmatter contract.

1. Rename `status` to `doc_status`. The values do not change (`draft`, `active`,
   `deprecated`, `superseded`). The new name states what the field is and removes
   the collision.
2. Add `divio_type` with values `Tutorial`, `How-To`, `Reference`, `Explanation`,
   next to `type`. The two axes answer different questions: `type` says where a
   page lives, `divio_type` says how to read it.

Both changes land in M1. Until then the repo keeps `status` and omits `divio_type`
so the spec does not drift ahead of the code.

## Consequences

Field names now carry their meaning, and tooling can pick pages by reading mode,
not only by section.

The rename touches every existing page's frontmatter, and authors have two typing
axes to learn instead of one. The migration is mechanical for `doc_status`; a
`divio_type` value has to be chosen per page.

## Alternatives considered

Keep `status`. Rejected: the collision with lane status is real in Spec Kitty
repos and confuses both readers and tools.

Fold reading mode into `type` as one axis. Rejected: section and reading mode are
separate questions, and merging them drops one of the two.

## Update (2026-08-21)

During the same design session, `divio_type` was renamed to `kind` and grown into
a page-kind taxonomy: the four Divio quadrants plus structural kinds (`Hub`,
`ADR`, `Changelog`, `Glossary`, `Presentation`, `Persona`), required on every
page, driving per-kind layout. The current shape lives in
[the metadata model](../architecture/metadata-model.md). This ADR will be revised
or superseded to record the final field name and vocabulary once the contract
stops growing.

## References

- [Convention](../context/convention.md)
- [Roadmap](../plans/roadmap.md) (M1)
- [Metadata model](../architecture/metadata-model.md)
