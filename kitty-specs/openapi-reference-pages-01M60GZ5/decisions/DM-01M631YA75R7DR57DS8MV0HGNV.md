# Decision Moment `01M631YA75R7DR57DS8MV0HGNV`

- **Mission:** `openapi-reference-pages-01M60GZ5`
- **Origin flow:** `plan`
- **Slot key:** `plan.architecture.injected-routes`
- **Input key:** `injected_routes_policy`
- **Status:** `resolved`
- **Created:** `2026-10-29T05:25:51.461133+00:00`
- **Resolved:** `2026-10-29T05:26:18.911319+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

If the spike finds starlight-openapi injects routes (no content entries), is that acceptable with gaps wired or listed, or does it trigger the own-generator fallback?

## Options

- Accept injected routes
- Require content entries
- Other

## Final answer

Accept injected routes. Wire the llms.txt version list (FR-008). Exempt generated API routes from the frontmatter gate. Record the agent API, the content graph and glossary autolinking as follow-ups in the ADR (FR-013). Routes alone do not trigger the fallback.

## Rationale

_(none)_

## Change log

- `2026-10-29T05:25:51.461133+00:00` — opened
- `2026-10-29T05:26:18.911319+00:00` — resolved (final_answer="Accept injected routes. Wire the llms.txt version list (FR-008). Exempt generated API routes from the frontmatter gate. Record the agent API, the content graph and glossary autolinking as follow-ups in the ADR (FR-013). Routes alone do not trigger the fallback.")
