# Decision Moment `01M549SZH3QDE24BQ4R9V24SYH`

- **Mission:** `build-context-and-config-split-01M549SB`
- **Origin flow:** `specify`
- **Slot key:** `specify.drafts.redirect-integrity`
- **Input key:** `redirect_integrity`
- **Status:** `resolved`
- **Created:** `2026-10-17T06:46:50.659679+00:00`
- **Resolved:** `2026-10-17T06:52:39.819935+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

With drafts off, a configured redirect that ends at a draft page would send its old URL to a 404. DocKitty now deletes those redirect stubs after a static build. Should DocKitty own this?

## Options

- Keep withholding, static only
- Fail the build listing the redirects
- Warn only, no deletion
- Other

## Final answer

Keep withholding, static only; document the limit in the ADR

## Rationale

_(none)_

## Change log

- `2026-10-17T06:46:50.659679+00:00` — opened
- `2026-10-17T06:52:39.819935+00:00` — resolved (final_answer="Keep withholding, static only; document the limit in the ADR")
