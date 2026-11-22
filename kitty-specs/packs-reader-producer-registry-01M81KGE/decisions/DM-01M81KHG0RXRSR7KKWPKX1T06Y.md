# Decision Moment `01M81KHG0RXRSR7KKWPKX1T06Y`

- **Mission:** `packs-reader-producer-registry-01M81KGE`
- **Origin flow:** `specify`
- **Slot key:** `specify.registry.gherkin-scope`
- **Input key:** `gherkin_scope`
- **Status:** `resolved`
- **Created:** `2026-11-22T12:26:20.568791+00:00`
- **Resolved:** `2026-11-22T12:26:38.612941+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

The frontmatter gate does not know the configured gherkin.section. What ownership scope does the Gherkin producer have there?

## Options

- Any one section unless the caller passes the resolved section (tests unchanged)
- Read gherkin.section through site-config evaluation in the gate
- Other

## Final answer

Any one section unless the caller passes the resolved section (tests unchanged)

## Rationale

_(none)_

## Change log

- `2026-11-22T12:26:20.568791+00:00` - opened
- `2026-11-22T12:26:38.612941+00:00` - resolved (final_answer="Any one section unless the caller passes the resolved section (tests unchanged)")
