---
affected_files: []
cycle_number: 1
mission_slug: internal-env-owner-01M4ZNK1
reproduction_command:
reviewed_at: '2026-10-15T12:01:07Z'
reviewer_agent: claude
wp_id: WP03
---

# WP03 review feedback 1 (reviewer-renata)

Table, writers/readers, write times, env-as-transport reason, pointers (additive), README row, CHANGELOG (style, placement after Added, accuracy) and src scope all pass. Two ADR gaps and one guide wording fix.

## 1. ADR-0057 omits the C-003 rationale (spec C-003)
Append to `## Decision`, as item 7:

7. **Only `DK_INDEX_BASENAME` keeps a format check.** It holds a JSON list, so a hand-set value can be checked and rejected. The other four hold free strings (a path, a route, `on`/`off`), so no check could tell a hand-set value from a real one. The check is not extended to them.

## 2. ADR-0057 omits the interleaved-define limit (spec Assumptions, line 112)
Add under `### Risks`:

- Each config's define and its setup hooks must run as a pair. If two defines interleave with setup hooks (define A, define B, setup A), setup A sees B's values. Astro does not do this, and handling it is out of scope.

## 3. consumer-setup.md wording
`A value you set is replaced when the config loads.` is not accurate: `clearInternalEnv` removes all five, and some are only written back when an option asks for them. Replace with:

`DocKitty clears any value you set when the config loads.`
