# Decision Moment `01M81KH7C1P04R1JSAYF0QDTWW`

- **Mission:** `large-hubs-sidebar-child-cap-01M81KGV`
- **Origin flow:** `specify`
- **Slot key:** `specify.defaults.repo-adr-cap`
- **Input key:** `repo_adr_cap`
- **Status:** `resolved`
- **Created:** `2026-11-22T12:26:11.713216+00:00`
- **Resolved:** `2026-11-23T07:22:37.619164+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

The default cap of 50 would cap this repo's own docs/adr group (81 children). Keep the default and let the ADR group collapse to one entry, or raise the cap for the adr section in docs/_meta/sections.yaml?

## Options

- Keep default 50; ADR group caps
- Set sidebar.childCap on the adr section
- Other

## Final answer

Set sidebar.childCap: 100 on the adr section; default stays 50

## Rationale

_(none)_

## Change log

- `2026-11-22T12:26:11.713216+00:00` - opened
- `2026-11-23T07:22:37.619164+00:00` - resolved (final_answer="Set sidebar.childCap: 100 on the adr section; default stays 50")
