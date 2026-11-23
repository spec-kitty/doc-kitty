# Decision Moment `01M84YEF7GB92FTFFX92HWNGPH`

- **Mission:** `tom-annex-export-01M84YDP`
- **Origin flow:** `specify`
- **Slot key:** `specify.contract.drift-and-snapshot`
- **Input key:** `annex_drift_snapshot`
- **Status:** `resolved`
- **Created:** `2026-11-23T19:34:39.088953+00:00`
- **Resolved:** `2026-11-23T20:56:45.578830+00:00`
- **Opened by:** `cli`
- **Other answer:** `false`

## Question

api/tom-annex.json is derived at build time from committed pages, so ADR-0087's --check and the per-release snapshot need a committed file to compare. Which shape?

## Options

- A: build always emits api/tom-annex.json (stamped, source_digest over catalog + classified pages, at = latest input instant); a CLI writes an opt-in committed snapshot (a registered ADR-0087 producer) and --check reports drift of that snapshot against the tree
- B: build-only artifact; --check recomputes and compares two builds, no committed snapshot (versioned snapshot deferred to #404 / counsel)
- C: committed snapshot is the source of truth; the build copies it and fails when it is stale
- Other

## Final answer

A: the build always emits api/tom-annex.json (stamped; source_digest over the catalog and the classified pages; at = latest input instant). A CLI writes an opt-in committed snapshot, a registered ADR-0087 producer, and --check reports drift of that snapshot against the tree. Decider: operator, relayed by the dispatcher 2026-11-23 (not independently verified).

## Rationale

_(none)_

## Change log

- `2026-11-23T19:34:39.088953+00:00` - opened
- `2026-11-23T20:56:45.578830+00:00` - resolved (final_answer="A: the build always emits api/tom-annex.json (stamped; source_digest over the catalog and the classified pages; at = latest input instant). A CLI writes an opt-in committed snapshot, a registered ADR-0087 producer, and --check reports drift of that snapshot against the tree. Decider: operator, relayed by the dispatcher 2026-11-23 (not independently verified).")
