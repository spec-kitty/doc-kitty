# Decision Moment `01M60GZXNJ6PPNSM1C3JGMTHEX`

- **Mission:** `openapi-reference-pages-01M60GZ5`
- **Origin flow:** `specify`
- **Slot key:** `specify.approach.renderer`
- **Input key:** `renderer`
- **Status:** `resolved`
- **Created:** `2026-10-28T05:51:09.490671+00:00`
- **Resolved:** `2026-10-28T05:51:10.963972+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Which way should #244 render OpenAPI pages?

## Options

- starlight-openapi first
- Own generator
- Pinned Redoc

## Final answer

starlight-openapi first, per ADR-0049. A WP01 spike checks OpenAPI 3.1, content entries, theme tokens and byte-stable rebuilds. If it doesn't fit, the fallback is our own build-time Markdown generator, recorded in a new ADR. Redoc is rejected: standalone page, JS-only content, loose CSP, its own dark-mode class, telemetry.

## Rationale

_(none)_

## Change log

- `2026-10-28T05:51:09.490671+00:00` — opened
- `2026-10-28T05:51:10.963972+00:00` — resolved (final_answer="starlight-openapi first, per ADR-0049. A WP01 spike checks OpenAPI 3.1, content entries, theme tokens and byte-stable rebuilds. If it doesn't fit, the fallback is our own build-time Markdown generator, recorded in a new ADR. Redoc is rejected: standalone page, JS-only content, loose CSP, its own dark-mode class, telemetry.")
