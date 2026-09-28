# Decision Moment `01M3M023898J8E1ZTEDAN71JSK`

- **Mission:** `a11y-baseline-plantuml-service-01M3M00V`
- **Origin flow:** `specify`
- **Slot key:** `specify.scope.parity-depth`
- **Input key:** `parity_depth`
- **Status:** `resolved`
- **Created:** `2026-09-28T12:32:58.121587+00:00`
- **Resolved:** `2026-09-28T12:38:33.699563+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Should the regenerate job mirror build-example's render setup MINIMALLY (plantuml service + DK_DIAGRAM_BUILD_RENDER + DK_PLANTUML_SERVER_URL + wait-step, service reached by name) or add FULL parity (also the @beoe Mermaid render cache restore + DK_BEOE_CACHE_DIR)?

## Options

- minimal-correct
- full-parity-with-cache
- Other

## Final answer

full-parity-with-cache: mirror build-example fully into the regenerate job — plantuml service, DK_DIAGRAM_BUILD_RENDER=on, DK_PLANTUML_SERVER_URL=http://plantuml:8080/svg/ (by service name, containerized job), wait-for-server step before pnpm build, AND the @beoe Mermaid render-cache restore step + DK_BEOE_CACHE_DIR, all adapted for container-to-service networking (no localhost port mapping).

## Rationale

_(none)_

## Change log

- `2026-09-28T12:32:58.121587+00:00` — opened
- `2026-09-28T12:38:33.699563+00:00` — resolved (final_answer="full-parity-with-cache: mirror build-example fully into the regenerate job — plantuml service, DK_DIAGRAM_BUILD_RENDER=on, DK_PLANTUML_SERVER_URL=http://plantuml:8080/svg/ (by service name, containerized job), wait-for-server step before pnpm build, AND the @beoe Mermaid render-cache restore step + DK_BEOE_CACHE_DIR, all adapted for container-to-service networking (no localhost port mapping).")
