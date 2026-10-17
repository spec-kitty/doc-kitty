# Decision Moment `01M55KNHV1TDHKK582YZ5SMDWT`

- **Mission:** `gate-config-hardening-01M55KMR`
- **Origin flow:** `specify`
- **Slot key:** `specify.gates.eval-failure`
- **Input key:** `eval_failure_policy`
- **Status:** `resolved`
- **Created:** `2026-10-17T18:58:25.761356+00:00`
- **Resolved:** `2026-10-17T18:58:27.332246+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

When a config exists but fails to evaluate, what do the draft gates do?

## Options

_(none)_

## Final answer

Fail closed with exit 2 (check-links parity); --env-dir <dir|false> is the explicit override that skips evaluation.

## Rationale

_(none)_

## Change log

- `2026-10-17T18:58:25.761356+00:00` — opened
- `2026-10-17T18:58:27.332246+00:00` — resolved (final_answer="Fail closed with exit 2 (check-links parity); --env-dir <dir|false> is the explicit override that skips evaluation.")
