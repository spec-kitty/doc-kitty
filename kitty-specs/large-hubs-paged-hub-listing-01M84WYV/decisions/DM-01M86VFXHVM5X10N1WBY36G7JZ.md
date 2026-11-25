# Decision Moment `01M86VFXHVM5X10N1WBY36G7JZ`

- **Mission:** `large-hubs-paged-hub-listing-01M84WYV`
- **Origin flow:** `specify`
- **Slot key:** `specify.routes.page-slug-collision`
- **Input key:** `page_slug_collision`
- **Status:** `resolved`
- **Created:** `2026-11-24T13:21:29.659453+00:00`
- **Resolved:** `2026-11-24T13:21:32.595579+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

A hub child whose slug is 'page' collides with /<hub>/page/N/. What happens?

## Options

- Fail the build naming the hub and the child
- Skip paging that hub with a warning
- Use another segment
- Other

## Final answer

Fail the build with a clear error naming the hub and the child. Operator answer relayed by the dispatcher 2026-11-24.

## Rationale

_(none)_

## Change log

- `2026-11-24T13:21:29.659453+00:00` - opened
- `2026-11-24T13:21:32.595579+00:00` - resolved (final_answer="Fail the build with a clear error naming the hub and the child. Operator answer relayed by the dispatcher 2026-11-24.")
