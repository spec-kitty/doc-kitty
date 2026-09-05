# Decision Moment `01M1R1FKFW64JM0898BP8MAEVF`

- **Mission:** `deck-layout-polish-01M1R1EB`
- **Origin flow:** `specify`
- **Slot key:** `specify.layout.wide-cap-depth`
- **Input key:** `wide_cap_depth`
- **Status:** `resolved`
- **Created:** `2026-09-05T05:43:23.388131+00:00`
- **Resolved:** `2026-09-05T05:49:38.911895+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

For #67, how far should the wide-screen fix go?

## Options

- Cap + center the frame only (max-width ~90rem, min-width 100rem)
- Cap + center AND bump the content measure on wide screens
- Cap + center with a different breakpoint/max-width

## Final answer

Cap + center the whole frame on wide viewports only (approx max-width 90rem above a 100rem breakpoint); keep the 45rem reading measure unchanged. Verify the real Starlight frame class in the built DOM before choosing the selector.

## Rationale

_(none)_

## Change log

- `2026-09-05T05:43:23.388131+00:00` — opened
- `2026-09-05T05:49:38.911895+00:00` — resolved (final_answer="Cap + center the whole frame on wide viewports only (approx max-width 90rem above a 100rem breakpoint); keep the 45rem reading measure unchanged. Verify the real Starlight frame class in the built DOM before choosing the selector.")
