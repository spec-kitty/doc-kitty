# Decision Moment `01M81KQKWM2X9TQ6H99VVZRJ1N`

- **Mission:** `packs-reader-producer-registry-01M81KGE`
- **Origin flow:** `plan`
- **Slot key:** `plan.testing.open-packs-corpus`
- **Input key:** `open_packs_corpus`
- **Status:** `resolved`
- **Created:** `2026-11-22T12:29:41.140674+00:00`
- **Resolved:** `2026-11-22T12:29:46.721098+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

How does CI prove every open-packs pack at a pinned commit reads with no error?

## Options

- Separate packs-corpus vitest project fed by a CI step that fetches open-packs at a pinned commit
- Fetch inside the unit test
- Vendor a reduced copy
- Other

## Final answer

Separate packs-corpus vitest project fed by a CI step that fetches open-packs at a pinned commit

## Rationale

_(none)_

## Change log

- `2026-11-22T12:29:41.140674+00:00` - opened
- `2026-11-22T12:29:46.721098+00:00` - resolved (final_answer="Separate packs-corpus vitest project fed by a CI step that fetches open-packs at a pinned commit")
