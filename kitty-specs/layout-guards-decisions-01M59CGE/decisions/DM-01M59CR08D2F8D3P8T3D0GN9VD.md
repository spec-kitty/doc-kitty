# Decision Moment `01M59CR08D2F8D3P8T3D0GN9VD`

- **Mission:** `layout-guards-decisions-01M59CGE`
- **Origin flow:** `plan`
- **Slot key:** `plan.fixture.stock-header-switch`
- **Input key:** `stock_header_switch`
- **Status:** `resolved`
- **Created:** `2026-10-19T06:14:23.757607+00:00`
- **Resolved:** `2026-10-19T06:35:58.892703+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How should the #207 regeneration script build the example without the Header carrier?

## Options

- Internal env switch in createConfig
- Separate stock-Starlight fixture site
- Other

## Final answer

Internal env switch in createConfig (test-only, off by default, unit-tested)

## Rationale

_(none)_

## Change log

- `2026-10-19T06:14:23.757607+00:00` — opened
- `2026-10-19T06:35:58.892703+00:00` — resolved (final_answer="Internal env switch in createConfig (test-only, off by default, unit-tested)")
