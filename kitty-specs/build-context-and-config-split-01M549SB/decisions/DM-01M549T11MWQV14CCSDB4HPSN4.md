# Decision Moment `01M549T11MWQV14CCSDB4HPSN4`

- **Mission:** `build-context-and-config-split-01M549SB`
- **Origin flow:** `specify`
- **Slot key:** `specify.drafts.env-file-contract`
- **Input key:** `env_file_contract`
- **Status:** `resolved`
- **Created:** `2026-10-17T06:46:52.212169+00:00`
- **Resolved:** `2026-10-17T06:52:41.422981+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

DocKitty reads .env files itself to find DK_PUBLISH_DRAFTS, with documented limits (two modes, no envDir, simplified quoting). Keep it or change the contract?

## Options

- Keep the reader as is
- Process environment only
- Keep it and honour envDir and --mode
- Other

## Final answer

Keep the reader and honour Vite's envDir and the active --mode

## Rationale

_(none)_

## Change log

- `2026-10-17T06:46:52.212169+00:00` — opened
- `2026-10-17T06:52:41.422981+00:00` — resolved (final_answer="Keep the reader and honour Vite's envDir and the active --mode")
