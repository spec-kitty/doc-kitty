# Decision Moment `01M1MFXYDCDHXXHW00XK6FJT9Y`

- **Mission:** `metadata-vocab-hub-consolidation-01M1MFVT`
- **Origin flow:** `specify`
- **Slot key:** `specify.adr-hub.status-scope`
- **Input key:** `adr_hub_status_scope`
- **Status:** `resolved`
- **Created:** `2026-09-03T20:38:55.660561+00:00`
- **Resolved:** `2026-09-03T20:41:11.122180+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

For #50, how much of the ADR lifecycle should the status-aware Hub card surface?

## Options

- Full lifecycle badge (Proposed/Accepted/Superseded/Deprecated) + date, matching the generated own-tree table
- Just Accepted vs not (minimal badge) + number ordering
- Other

## Final answer

Full lifecycle: the status-aware ADR Hub card surfaces Proposed/Accepted/Superseded/Deprecated status plus date, and orders children by ADR number, so a multi-ADR rendered tree reaches parity with the generated own-tree table.

## Rationale

_(none)_

## Change log

- `2026-09-03T20:38:55.660561+00:00` — opened
- `2026-09-03T20:41:11.122180+00:00` — resolved (final_answer="Full lifecycle: the status-aware ADR Hub card surfaces Proposed/Accepted/Superseded/Deprecated status plus date, and orders children by ADR number, so a multi-ADR rendered tree reaches parity with the generated own-tree table.")
