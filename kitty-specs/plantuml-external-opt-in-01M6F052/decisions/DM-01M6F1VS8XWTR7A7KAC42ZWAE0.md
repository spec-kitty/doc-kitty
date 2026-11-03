# Decision Moment `01M6F1VS8XWTR7A7KAC42ZWAE0`

- **Mission:** `plantuml-external-opt-in-01M6F052`
- **Origin flow:** `plan`
- **Slot key:** `plan.architecture.site-config-visibility`
- **Input key:** `site_config_visibility`
- **Status:** `resolved`
- **Created:** `2026-11-02T21:15:21.757332+00:00`
- **Resolved:** `2026-11-02T21:15:22.976921+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

The include check runs before install (C-006) but reading astro.config needs the site's deps. Amend FR-013/NFR-003/C-006 so the site-config path requires --astro-config?

## Options

- Amend: site-config path needs --astro-config; env/unset stay pre-install
- Drop site-config form; env only
- Other

## Final answer

Amend: site-config path needs --astro-config; env/unset stay pre-install

## Rationale

_(none)_

## Change log

- `2026-11-02T21:15:21.757332+00:00` - opened
- `2026-11-02T21:15:22.976921+00:00` - resolved (final_answer="Amend: site-config path needs --astro-config; env/unset stay pre-install")
