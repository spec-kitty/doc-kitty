# Decision Moment `01M6F21EKGBG5HF8XA2YFC517K`

- **Mission:** `plantuml-external-opt-in-01M6F052`
- **Origin flow:** `plan`
- **Slot key:** `plan.verification.non-docker-services`
- **Input key:** `non_docker_allowlist`
- **Status:** `resolved`
- **Created:** `2026-11-02T21:18:27.440225+00:00`
- **Resolved:** `2026-11-02T21:18:28.771019+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Allowlist mode needs docker inspect to read the service entries. What about non-docker services?

## Options

_(none)_

## Final answer

Record the limit in ADR-0074 and the guide; operator-asserted entries flag is a follow-up issue, not this mission

## Rationale

_(none)_

## Change log

- `2026-11-02T21:18:27.440225+00:00` - opened
- `2026-11-02T21:18:28.771019+00:00` - resolved (final_answer="Record the limit in ADR-0074 and the guide; operator-asserted entries flag is a follow-up issue, not this mission")
