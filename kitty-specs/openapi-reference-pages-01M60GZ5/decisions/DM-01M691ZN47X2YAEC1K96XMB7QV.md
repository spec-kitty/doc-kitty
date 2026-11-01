# Decision Moment `01M691ZN47X2YAEC1K96XMB7QV`

- **Mission:** `openapi-reference-pages-01M60GZ5`
- **Origin flow:** `plan`
- **Slot key:** `plan.architecture.renderer-loading`
- **Input key:** `renderer_loading`
- **Status:** `resolved`
- **Created:** `2026-10-31T13:22:01.991138+00:00`
- **Resolved:** `2026-10-31T13:22:07.901935+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How does the toolkit load the optional starlight-openapi renderer?

## Options

- Inject the renderer
- Private Vite server
- Other

## Final answer

Inject the renderer: the adopter imports starlight-openapi in astro.config and passes it as openapi.renderer; the toolkit never imports the optional peers (contract commit bbb8c810).

## Rationale

_(none)_

## Change log

- `2026-10-31T13:22:01.991138+00:00` — opened
- `2026-10-31T13:22:07.901935+00:00` — resolved (final_answer="Inject the renderer: the adopter imports starlight-openapi in astro.config and passes it as openapi.renderer; the toolkit never imports the optional peers (contract commit bbb8c810).")
