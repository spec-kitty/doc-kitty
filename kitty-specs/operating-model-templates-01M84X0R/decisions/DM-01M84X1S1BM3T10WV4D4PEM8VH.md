# Decision Moment `01M84X1S1BM3T10WV4D4PEM8VH`

- **Mission:** `operating-model-templates-01M84X0R`
- **Origin flow:** `specify`
- **Slot key:** `specify.templates.runbook-kind`
- **Input key:** `runbook_template_kind`
- **Status:** `resolved`
- **Created:** `2026-11-23T19:10:14.571475+00:00`
- **Resolved:** `2026-11-23T22:26:09.048399+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Runbook is a type, not a kind. Which kind do the incident and continuity templates carry?

## Options

- How-To kind with type Runbook (recommended)
- Add Runbook as a new kind
- Other

## Final answer

A: the Incident and breach response and Business continuity templates use kind How-To and are placed under operations/runbooks/, so type Runbook is derived. Role is the only vocabulary change. Decider: operator (verbatim "as recommended", dispatcher session, ledger R81, to the dispatcher prompt "#402: Q2 and Q3. I recommend A for both"; relayed by the dispatcher; checked against the dispatcher transcript).

## Rationale

_(none)_

## Change log

- `2026-11-23T19:10:14.571475+00:00` - opened
- `2026-11-23T22:26:09.048399+00:00` - resolved (final_answer="A: the Incident and breach response and Business continuity templates use kind How-To and are placed under operations/runbooks/, so type Runbook is derived. Role is the only vocabulary change. Decider: operator (verbatim "as recommended", dispatcher session, ledger R81, to the dispatcher prompt "#402: Q2 and Q3. I recommend A for both"; relayed by the dispatcher; checked against the dispatcher transcript).")
