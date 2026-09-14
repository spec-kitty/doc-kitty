# Decision Moment `01M2FF0RZYJ68F53BV6ACYGFRJ`

- **Mission:** `documentation-charter-01M2FEXM`
- **Origin flow:** `specify`
- **Slot key:** `specify.scope.strictness-tunability`
- **Input key:** `strictness_in_scope`
- **Status:** `resolved`
- **Created:** `2026-09-14T08:02:29.502586+00:00`
- **Resolved:** `2026-09-14T08:21:48.661953+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Is consumer-tunable strictness (letting an adopter turn warnings into hard failures or vice versa) IN scope for this mission, or deferred to the separate Layer-B/enforcement item?

## Options

- Deferred — keep warn-not-fail defaults, no strictness engine
- In scope — add a strictness knob
- Other

## Final answer

Deferred. Keep the shipped warn-not-fail posture; no consumer-tunable strictness engine in this mission. A configurable-enforcement/strictness surface is split to the separate Layer-B item.

## Rationale

_(none)_

## Change log

- `2026-09-14T08:02:29.502586+00:00` — opened
- `2026-09-14T08:21:48.661953+00:00` — resolved (final_answer="Deferred. Keep the shipped warn-not-fail posture; no consumer-tunable strictness engine in this mission. A configurable-enforcement/strictness surface is split to the separate Layer-B item.")
