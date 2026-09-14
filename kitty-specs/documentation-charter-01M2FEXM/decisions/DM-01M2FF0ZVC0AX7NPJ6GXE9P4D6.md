# Decision Moment `01M2FF0ZVC0AX7NPJ6GXE9P4D6`

- **Mission:** `documentation-charter-01M2FEXM`
- **Origin flow:** `specify`
- **Slot key:** `specify.status.override-semantics`
- **Input key:** `doc_status_override_semantics`
- **Status:** `resolved`
- **Created:** `2026-09-14T08:02:36.524730+00:00`
- **Resolved:** `2026-09-14T08:21:55.949701+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How should doc_status become consumer-overridable: extend-only (add statuses; canonical five stay reserved so Hub/feed behavior holds) or full-replace (consumer owns the whole enum)?

## Options

- Extend-only; canonical statuses reserved
- Full-replace; consumer owns the enum
- Other

## Final answer

Extend-only. doc_status becomes consumer-overridable via the same alias/forbid axis as type/kind, but the canonical statuses (draft, published, durable, etc.) stay reserved and non-removable so Hub draft-exclusion, feeds, and the durable throughline keep working.

## Rationale

_(none)_

## Change log

- `2026-09-14T08:02:36.524730+00:00` — opened
- `2026-09-14T08:21:55.949701+00:00` — resolved (final_answer="Extend-only. doc_status becomes consumer-overridable via the same alias/forbid axis as type/kind, but the canonical statuses (draft, published, durable, etc.) stay reserved and non-removable so Hub draft-exclusion, feeds, and the durable throughline keep working.")
