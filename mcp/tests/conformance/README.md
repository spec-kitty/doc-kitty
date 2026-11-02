# Conformance suite (WP05; T020 golden gate + T021 failure matrix)

This directory is the mission's acceptance heart (SC-002/SC-003/SC-004,
FR-010): it proves the pass-through invariant BY CONSTRUCTION and is built so
a dishonest implementation cannot pass.

## What lives here

| File | Role |
|---|---|
| `projection.ts` | The independent in-test projection. Re-reads fixture artifact bytes itself (fs read or http fetch), parses them itself, and derives page ids / the site slug / the FR-007 link carve-out from the contract prose in `kitty-specs/doc-kitty-mcp-server-01M6BAQX/contracts/mcp-surface.md` - it shares NO code with `mcp/src`. Expectations are computed from these bytes, never captured from server output, and no vitest `toMatchSnapshot` is used anywhere (reviewer pin V4). |
| `compare.ts` | Field-level byte equality: recursive comparator; string leaves compare as UTF-8 byte buffers; arrays keep order (registry order is contractual); objects compare exact key sets. Returns a mismatch LIST (empty = green) so the same code can drive both the golden assertion and the seeded-fault proof. |
| `sweep.ts` | One full sweep over all five tools (`get_site_info`, `list_pages`, `get_page`, `search_pages`, `list_scenarios`) comparing every output field against the projection. |
| `serve-fixture.ts` | Local static server for the https input mode (rebases the fixture's baked origin onto loopback, can pin a 500 status for chosen paths, and mints a guaranteed-dead loopback port for the UNREACHABLE rows). |
| `harness.ts` | Per-mode server/client wiring through the REAL adapters + `createServer`. |
| `golden.test.ts` | T020: SC-003 minimum matrix - all 5 tools, >=10 example pages including the empty-slug home, BOTH input modes plus the fs `--link-base` carve-out run, a pages-links-gated run, and the three SC-002 discriminating controls (own fixture terms). Resources assertions run unconditionally (the resources surface is part of the server since WP04). |
| `seeded-fault.test.ts` | T020 auto-vacuity control: re-runs the SAME sweep against `createServer(snapshot, { ...config, faults: { uppercaseTitles: true } })` and asserts the comparisons GO RED. |
| `failure-matrix.test.ts` | T021: SC-004 - one fixture+assertion per named error, each inside a hard time budget, measured numbers printed to the test output. |

## Seeded-fault mechanism

The dev-only hook lives in `mcp/src/server.ts` (`ServerFaults`; WP05's one
sanctioned edit to WP03-owned code - a constructor-config pass-through read
by the projection seam; the cli never sets it). With
`faults.uppercaseTitles: true`, the assembly seam uppercases every projected
page title, so the tools output diverges from the fixture-derived expectation
and the comparisons must report mismatches. If this suite cannot be turned
red by the flag, the golden gate is vacuous and WP05 fails its own gate.

## Modes and carve-outs

- https mode: expectations byte-equal the SERVED artifact values (the
  projection fetches them itself from the local static server).
- fs mode without `--link-base`: the effective link base equals the declared
  origin, so expectations byte-equal the on-disk values (identity arm).
- fs mode with `--link-base`: exactly the carve-out link fields
  (`source`/`url`, `href` under `links`/`_links`) carry the documented
  re-origining; content fields still byte-equal the on-disk values. The suite
  asserts BOTH sides (rewrite engaged + content untouched).
