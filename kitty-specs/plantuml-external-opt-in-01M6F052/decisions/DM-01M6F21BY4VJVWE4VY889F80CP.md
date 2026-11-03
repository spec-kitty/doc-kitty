# Decision Moment `01M6F21BY4VJVWE4VY889F80CP`

- **Mission:** `plantuml-external-opt-in-01M6F052`
- **Origin flow:** `plan`
- **Slot key:** `plan.verification.unset-site-config-silence`
- **Input key:** `unset_site_config_note`
- **Status:** `resolved`
- **Created:** `2026-11-02T21:18:24.708742+00:00`
- **Resolved:** `2026-11-02T21:18:26.058589+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Unset mode prints no new lines (FR-007), so a site-config-only allowlist checked without --astro-config passes as unset. Amend NFR-003 to exclude unset, or allow a stderr note?

## Options

_(none)_

## Final answer

Amend NFR-003 to exclude unset; the build notice prints the full verify command incl. --astro-config

## Rationale

_(none)_

## Change log

- `2026-11-02T21:18:24.708742+00:00` - opened
- `2026-11-02T21:18:26.058589+00:00` - resolved (final_answer="Amend NFR-003 to exclude unset; the build notice prints the full verify command incl. --astro-config")
