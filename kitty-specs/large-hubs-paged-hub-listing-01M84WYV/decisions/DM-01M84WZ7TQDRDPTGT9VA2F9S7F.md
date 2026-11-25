# Decision Moment `01M84WZ7TQDRDPTGT9VA2F9S7F`

- **Mission:** `large-hubs-paged-hub-listing-01M84WYV`
- **Origin flow:** `specify`
- **Slot key:** `specify.scope.fold-429`
- **Input key:** `fold_issue_429`
- **Status:** `resolved`
- **Created:** `2026-11-23T19:08:51.415623+00:00`
- **Resolved:** `2026-11-23T21:27:11.607999+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

Fold #429 (widen HubCap route-shaping data to every kind: Hub hub, also on sites with their own sidebar) into this mission?

## Options

- Fold in: every hub gets an entry with a capped flag; hub page and paged routes read that one resolved data; Closes #429 too
- Do not fold: paged routes compose children from the collection themselves; #429 stays open
- Partial: emit data for over-cap hubs on custom-sidebar sites too, not every hub
- Other

## Final answer

Fold in: every kind: Hub hub gets an entry in every sidebar mode, HubCap shape kept with a capped flag; hub page and paged routes read that one resolved data; PR closes #342 and #429

## Rationale

_(none)_

## Change log

- `2026-11-23T19:08:51.415623+00:00` - opened
- `2026-11-23T21:27:11.607999+00:00` - resolved (final_answer="Fold in: every kind: Hub hub gets an entry in every sidebar mode, HubCap shape kept with a capped flag; hub page and paged routes read that one resolved data; PR closes #342 and #429")
