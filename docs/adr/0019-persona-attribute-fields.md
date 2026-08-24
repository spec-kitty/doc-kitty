---
title: "ADR-0019: Persona attribute fields (role, goals, responsibilities)"
description: The Persona kind gains role/goals/responsibilities; the zod schema stays lenient and the standalone validator enforces requiredness for kind Persona.
doc_status: active
updated: 2026-08-24
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0009-finalize-metadata-contract
  - adr/0011-theme-slot-surface-and-per-kind-layouts
  - architecture/metadata-model
---

# ADR-0019: Persona attribute fields (role, goals, responsibilities)

## Status

Accepted. Additive to the frozen contract of
[ADR-0009](./0009-finalize-metadata-contract.md) — a **new** ADR as ADR-0009's
Consequences require ("adding a field later means a new ADR, not an edit").

## Context

M2 shipped the `Persona` layout as an in-frame passport rendering only *generic*
frontmatter; persona-specific identity was explicitly deferred to M3. M3 wants
persona pages that carry a reader's identity so the audience block (which links to
them) resolves to something meaningful. The exact field keys were left to plan; this
ADR fixes them before the schema/validator work package starts.

## Decision

1. **Three persona attribute fields**, present only on `kind: Persona` pages:
   - `role` — a one-line descriptor of who this persona is (string).
   - `goals` — what they are trying to achieve (string list).
   - `responsibilities` — what they are accountable for (string list).
   These are additive; they alter no frozen `audience`/`related`/`external_references`
   shape.

2. **The build zod schema stays lenient.** `kind` is open-vocabulary `z.string()` and
   the doc-kitty fields are globally optional, so no clean per-kind discriminated
   union exists in the build schema. The three fields are added as optional there.

3. **Requiredness is enforced in the standalone validator.** `validate-frontmatter.mjs`
   is path/kind-aware; when `kind === Persona`, it requires `role`, `goals`, and
   `responsibilities` (non-empty), and errors otherwise. This keeps the
   schema/validator **parity** semantics M1 established (the schema is lenient; the
   validator carries the strict, contextual rules).

4. **The passport renders them.** `Persona.astro` renders `role`/`goals`/
   `responsibilities` in the in-frame passport (ADR-0011: in-frame, not `splash`).

## Consequences

### Positive

- Persona pages carry real identity; the audience block links to a meaningful page.
- Parity discipline is preserved — the strict rule lives in the one place (the
  validator) that already owns contextual requiredness.

### Negative

- A malformed persona is caught by the standalone validator, not the build zod schema
  — an implementer must remember requiredness is a validator concern.

### Risks

- Field creep. Mitigation: three fields only; more persona attributes are a later ADR.

## Alternatives considered

### Enforce requiredness via a zod discriminated union on `kind`

Rejected: `kind` is intentionally open-vocabulary (`z.string()`), so a discriminated
union would fight the schema's design and duplicate the validator's contextual rules.

### Defer persona fields; ship only the audience linkage

Rejected by the product owner at kickoff — persona attribute fields are in M3 scope.

## References

- [ADR-0009](./0009-finalize-metadata-contract.md),
  [ADR-0011](./0011-theme-slot-surface-and-per-kind-layouts.md).
- [Metadata model](../architecture/metadata-model.md).
