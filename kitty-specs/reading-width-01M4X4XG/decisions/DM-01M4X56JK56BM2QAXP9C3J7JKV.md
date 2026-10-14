# Decision Moment `01M4X56JK56BM2QAXP9C3J7JKV`

- **Mission:** `reading-width-01M4X4XG`
- **Origin flow:** `specify`
- **Slot key:** `specify.layout.wide-content`
- **Input key:** `wide_content_behaviour`
- **Status:** `resolved`
- **Created:** `2026-10-14T12:11:39.493585+00:00`
- **Resolved:** `2026-10-14T12:11:51.613431+00:00`
- **Opened by:** `cli`
- **Other answer:** `true`

## Question

Which wide blocks grow past the prose column, and how far?

## Options

- Tables only, to the reading pane, capped by a token
- Tables, diagrams and code
- Keep everything scrolling inside the column
- Other

## Final answer

Tables only: a table that is a direct child of the page body grows past the prose column, centred on it, up to the reading pane (never under the TOC rail) and at most a new --dk-width-wide token, from the 72rem breakpoint up. Diagrams already scale to fit and code blocks scroll by convention; both stay in the column. Resolved autonomously from the brief (issue prefers growth when it does not hurt the TOC rail).

## Rationale

_(none)_

## Change log

- `2026-10-14T12:11:39.493585+00:00` — opened
- `2026-10-14T12:11:51.613431+00:00` — resolved (final_answer="Tables only: a table that is a direct child of the page body grows past the prose column, centred on it, up to the reading pane (never under the TOC rail) and at most a new --dk-width-wide token, from the 72rem breakpoint up. Diagrams already scale to fit and code blocks scroll by convention; both stay in the column. Resolved autonomously from the brief (issue prefers growth when it does not hurt the TOC rail).")
