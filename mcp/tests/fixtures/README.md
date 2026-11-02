# WP05 conformance fixtures (`mcp/tests/fixtures/`)

Hand-authored, ASCII-only corpora for the conformance suite. Distinct from
WP02's `mcp/tests/corpus/fixtures/` set (which is a byte-faithful copy of a
real example build plus its mutations); the WP02 `example` corpus is re-USED
by the golden matrix as the fast-lane committed copy, but is not duplicated
here - freshness anchoring via a fresh `example/dist` build is WP08's
serialized lane.

All WP05 fixtures bake the declared origin
`https://conformance.example.net/library` and carry `buildId` on every
artifact (identity emission enabled) unless the fixture's entire point is
otherwise.

| Fixture | Purpose |
|---|---|
| `search-controls/` | A 7-page corpus owning the three SC-002 discriminating terms. `zephyrquill` appears ONLY in `controls/alpha`'s keywords (keyword-only hit). `morrowdust` appears ONLY in `controls/beta`'s markdown body (zero hits). `amberline` appears in exactly three searchable spots - `controls/gamma` title, `controls/delta` description, `controls/epsilon` keywords - plus a body-only distractor in `controls/zeta` (known-K: exactly those three, registry order, distractor excluded). Term isolation was verified programmatically at authoring time. |

The failure corpora (unknown major, non-numeric version, torn build, gated pages, malformed field) are
derived from the example fixture by `mcp/tests/corpus/fixtures/derive.mjs`; there is no hand-authored copy.
