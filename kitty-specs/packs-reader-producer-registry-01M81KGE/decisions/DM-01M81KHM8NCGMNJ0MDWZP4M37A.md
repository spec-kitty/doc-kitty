# Decision Moment `01M81KHM8NCGMNJ0MDWZP4M37A`

- **Mission:** `packs-reader-producer-registry-01M81KGE`
- **Origin flow:** `specify`
- **Slot key:** `specify.options.packs-surface`
- **Input key:** `packs_option_surface`
- **Status:** `resolved`
- **Created:** `2026-11-22T12:26:24.917572+00:00`
- **Resolved:** `2026-11-22T12:26:42.815933+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

packs.charterLock and packs.contract arrive before the packs option exists (#338). Where do they live in this slice?

## Options

- A packs option accepting only charterLock and contract, validated eagerly, plus CLI flags; #338 widens it
- CLI flags and readPack options only; config key in #338
- Other

## Final answer

A packs option accepting only charterLock and contract, validated eagerly, plus CLI flags; #338 widens it

## Rationale

_(none)_

## Change log

- `2026-11-22T12:26:24.917572+00:00` - opened
- `2026-11-22T12:26:42.815933+00:00` - resolved (final_answer="A packs option accepting only charterLock and contract, validated eagerly, plus CLI flags; #338 widens it")
