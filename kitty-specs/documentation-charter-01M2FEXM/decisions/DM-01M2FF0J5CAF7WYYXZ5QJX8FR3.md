# Decision Moment `01M2FF0J5CAF7WYYXZ5QJX8FR3`

- **Mission:** `documentation-charter-01M2FEXM`
- **Origin flow:** `specify`
- **Slot key:** `specify.charter.surface-shape`
- **Input key:** `charter_surface_shape`
- **Status:** `resolved`
- **Created:** `2026-09-14T08:02:22.508816+00:00`
- **Resolved:** `2026-09-14T08:21:41.424915+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Should the documentation charter be one new consolidated file that absorbs the existing _meta/*.yaml seams, or a thin umbrella that documents and points at the existing files (no format migration)?

## Options

- Umbrella over existing files (no migration)
- New consolidated charter file (absorbs vocabulary.yaml + sections.yaml)
- Other

## Final answer

New consolidated charter file that absorbs vocabulary.yaml + sections.yaml into one authoritative _meta charter; existing _meta/vocabulary.yaml and _meta/sections.yaml remain honored (deprecated, back-compat) so the proven N=2 consumer path does not regress, with a documented migration.

## Rationale

_(none)_

## Change log

- `2026-09-14T08:02:22.508816+00:00` — opened
- `2026-09-14T08:21:41.424915+00:00` — resolved (final_answer="New consolidated charter file that absorbs vocabulary.yaml + sections.yaml into one authoritative _meta charter; existing _meta/vocabulary.yaml and _meta/sections.yaml remain honored (deprecated, back-compat) so the proven N=2 consumer path does not regress, with a documented migration.")
