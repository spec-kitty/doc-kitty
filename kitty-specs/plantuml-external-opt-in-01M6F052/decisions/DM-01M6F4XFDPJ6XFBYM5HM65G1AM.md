# Decision Moment `01M6F4XFDPJ6XFBYM5HM65G1AM`

- **Mission:** `plantuml-external-opt-in-01M6F052`
- **Origin flow:** `plan`
- **Slot key:** `plan.verification.unset-profile-read`
- **Input key:** `unset_profile_read`
- **Status:** `resolved`
- **Created:** `2026-11-02T22:08:42.934414+00:00`
- **Resolved:** `2026-11-02T22:08:44.114631+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

A real INTERNET service refuses the private canary, so with the opt-in unset the check passes it (analyze A2; also true of the pre-existing check). Accept the limit, or read the profile in unset mode when --service-container is given?

## Options

- Read profile in unset mode with --service-container: must be SANDBOX; pass output unchanged, new failure only
- Accept the limit and document it
- Other

## Final answer

Read profile in unset mode with --service-container: must be SANDBOX; pass output unchanged, new failure only

## Rationale

_(none)_

## Change log

- `2026-11-02T22:08:42.934414+00:00` - opened
- `2026-11-02T22:08:44.114631+00:00` - resolved (final_answer="Read profile in unset mode with --service-container: must be SANDBOX; pass output unchanged, new failure only")
