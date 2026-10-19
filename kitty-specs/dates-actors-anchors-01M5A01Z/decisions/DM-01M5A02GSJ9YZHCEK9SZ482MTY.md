# Decision Moment `01M5A02GSJ9YZHCEK9SZ482MTY`

- **Mission:** `dates-actors-anchors-01M5A01Z`
- **Origin flow:** `specify`
- **Slot key:** `specify.dates.last-changed-precedence`
- **Input key:** `last_changed_precedence`
- **Status:** `resolved`
- **Created:** `2026-10-19T11:52:11.314255+00:00`
- **Resolved:** `2026-10-19T11:52:14.502936+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

#226: one shared lastChanged helper with a single precedence for RSS, the OKF export and the agent API, or a documented per-output precedence?

## Options

- Per-output, one module + OKF ownership-stamp fix
- Per-output, document only
- One shared helper
- Other

## Final answer

Per-output, one module + OKF ownership-stamp fix: RSS keeps updated -> generated.at, the agent API keeps updated only, the OKF export keeps generated.at -> updated but takes generated.at only from an ownership-producer stamp (isGeneratedStamp), so a provenance-only scaffold stamp falls back to updated; both rules exported side by side from one module and pinned by one test; recorded in ADR-0059 implementation notes.

## Rationale

_(none)_

## Change log

- `2026-10-19T11:52:11.314255+00:00` — opened
- `2026-10-19T11:52:14.502936+00:00` — resolved (final_answer="Per-output, one module + OKF ownership-stamp fix: RSS keeps updated -> generated.at, the agent API keeps updated only, the OKF export keeps generated.at -> updated but takes generated.at only from an ownership-producer stamp (isGeneratedStamp), so a provenance-only scaffold stamp falls back to updated; both rules exported side by side from one module and pinned by one test; recorded in ADR-0059 implementation notes.")
