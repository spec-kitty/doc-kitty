# Decision Moment `01M4WENQAJN2S0N7WXR12F7YY4`

- **Mission:** `route-rule-consolidation-01M4WE27`
- **Origin flow:** `plan`
- **Slot key:** `plan.index-names.flag-order`
- **Input key:** `flag_order_matching`
- **Status:** `resolved`
- **Created:** `2026-10-14T05:37:58.610698+00:00`
- **Resolved:** `2026-10-14T05:45:35.797312+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Should --index-basename index,README count as matching a configured README,index (same names, different order)?

## Options

- No: order must match
- Yes: same set is enough
- Other

## Final answer

Yes: same set is enough (order-insensitive comparison)

## Rationale

_(none)_

## Change log

- `2026-10-14T05:37:58.610698+00:00` — opened
- `2026-10-14T05:45:35.797312+00:00` — resolved (final_answer="Yes: same set is enough (order-insensitive comparison)")
