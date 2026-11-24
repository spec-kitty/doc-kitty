---
title: "ADR-0085: A Role kind for accountable functions"
description: "Role is a canonical kind for an accountable function. A Role page names its role and its responsibilities, and process pages link roles through related."
doc_status: draft
updated: 2026-11-23T00:00:00Z
type: ADR
kind: ADR
authors:
  - process:doc-kitty
related:
  - adr/0019-persona-attribute-fields
  - adr/0067-schematic-pages-reference-a-schema
  - adr/0080-tom-classification-field-and-measures-catalog
  - architecture/research/eu-dpa-compatibility
---

# ADR-0085: A Role kind for accountable functions

## Status

**Proposed**, 2026-11-23.

The decision content follows the operator's rulings for issue #402, relayed
through the dispatcher and recorded as Decision Moments
`01M84X1Q21P9HN21KNN9PFSNN6` (Role is a new kind) and
`01M84X1TXTTJM09B0G0YN2G9BM` (the required fields). The operator accepts the
ADR itself.

## Context

An operating model describes how an organisation runs. It names who is
accountable for what: a data protection officer, an incident owner, a change
approver. About half of the example headings for technical and organisational
measures describe this side of an organisation (see
[ADR-0080](0080-tom-classification-field-and-measures-catalog.md) and the
[EU DPA compatibility research](../architecture/research/eu-dpa-compatibility.md)).

DocKitty has no kind for an accountable function. `Persona`
([ADR-0019](0019-persona-attribute-fields.md)) carries `role`, `goals` and
`responsibilities`, but a persona describes a reader of the documentation. An
accountable function is not a reader. Mixing the two would put duties into the
audience model, and would make every role state reader goals it does not have.

## Decision

1. `Role` is appended to the canonical kinds. The list lives in one place,
   `src/lib/vocabulary-core.mjs`. The frontmatter gate reads it to warn on an
   unknown kind; the build schema keeps `kind` an open string. This follows the
   precedent of `Schematic`
   ([ADR-0067](0067-schematic-pages-reference-a-schema.md)).
2. A `kind: Role` page requires two fields, checked by the frontmatter gate as it
   checks Persona pages:
   - `role`, a non-empty string;
   - `responsibilities`, a non-empty list of non-empty strings.

   `goals` is optional on a Role page. The build schema stays lenient, as it is
   for Persona.
3. A process page names the roles it involves through `related`. The Role page
   does not list its processes in a separate field.
4. `Runbook` stays a `type`, derived from `operations/runbooks/`. It is not a
   kind, and this decision adds no other kind.

## Consequences

### Positive

- An accountable function has a page of its own, separate from the audience
  model.
- The change is one entry in the shared vocabulary core, so there is no second
  list of kinds to keep in step.
- Operating-model templates can ship a Role page with a preset `accountability`
  classification.

### Negative

- The canonical kind list grows to 16 entries.
- A Role page has no layout of its own yet. Unlike a Persona page, its `role`
  and `responsibilities` fields are not rendered on the page, so the Role
  template repeats the duties in a body section. A Role layout is a possible
  follow-up.

### Risks

- Authors may use `Persona` where `Role` is meant. The operating-model guide
  explains the difference.

## Alternatives considered

### Option A: Persona with a marker field

A `kind: Persona` page with a marker such as `persona_type: role`. Rejected: it
mixes readers with accountable functions, and the Persona rule requires `goals`,
which a role does not have.

### Option B: A type only

A `type: Role` with an existing kind. Rejected: `kind` drives layouts and
validation, and a type alone could not carry the requiredness rule.

## References

- Issue #402 and its parent epic #400.
- [ADR-0019](0019-persona-attribute-fields.md): Persona attribute fields.
- [ADR-0080](0080-tom-classification-field-and-measures-catalog.md): the
  `tom_classification` field and measures catalog.
- A generated responsibility (RACI) matrix built from roles and processes is a
  possible later step. It is not part of this decision.
