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
| `failure-unknown-major/` | Index `version` major `99` - outside the supported set. |
| `failure-non-numeric-version/` | Index `version` `beta` - no numeric major. |
| `failure-malformed-field/` | `controls/broken` page artifact with the required `markdown` field removed. |
| `failure-gated-pages/` | Index records carry no `_links.self` (site ran with `links.pages: false`); scenarios surface stays live. |
| `failure-torn-build/` | Mixed build identities with emission enabled: the index and `home` agree, `controls/torn` diverges (V6 - a no-buildId corpus would silently no-op the torn-detection proof). |
