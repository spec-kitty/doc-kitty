# OpenAPI fixtures (mission openapi-second-slice-01M6WXJ4, WP01)

The corpus every later work package of the mission builds on. `src/tests/helpers/openapi-build.ts`
copies `site/` plus `astro.config.mjs` into a throwaway root under
`example/.dk-test-openapi/` (so the toolkit, Astro, Starlight and the pinned renderer resolve
through `example/node_modules`), copies the named fixture directory to `<root>/openapi/`, and runs
a real `astro build`. Rejected-input rows run in-process instead (no build): the seam suite copies
`rejected/<case>/` into a temp site and calls `defineDocKittyIntegrations` directly.

- `site/` — the shared site scaffold: two docs pages (fixed `updated` dates, so no build clock can
  break the two-build compare), the content config, and the `llms.txt`, `api/index.json` and
  `api/pages/*` routes. The sitemap, the content-graph route and the OKF export come with
  `defineDocKittyIntegrations` itself.
- `astro.config.mjs` — the fixture config: `DK_TEST_OPTIONS` carries the doc-kitty options and the
  `openapi` option (minus `renderer`, which this config injects); `DK_OUTDIR` names the dist.
- `two-versions/` — `v1` released, `v2` unreleased. `v1` has `deleteParcel` (v1-only, the switcher
  fallback), `v2` has `getParcel` (v2-only), both share `listParcels` (the switcher deep link).
  `v1`'s descriptions link to a docs page, a fragment and an external URL (FR-009 targets).
- `ops-1/` — one operation, for the agent-index growth check (NFR-004).
- `ops-200/` — `generate.mjs` emits 50 paths x 4 methods = 200 operations (some without summary or
  operationId, two duplicate operationIds); never hand-edit the output, edit the generator.
- `zero-ops/` — a spec version with no operations (spec edge case).
- `multi-file/` — a definition split across files with relative `$ref` and an internal cycle
  (FR-019), plus the external-cycle pair `cycle-a.yaml`/`cycle-b.yaml`.
- `swagger2/petstore.json` — a Swagger 2.0 document (FR-020).
- `archive/releases/` — three tagged-release files for the archive input (FR-018).
- `hostile/` — script tags, embedded newlines and `](javascript:alert(1))` in spec-derived titles,
  operation summaries and tag names that DocKitty's own outputs must flatten and escape (FR-028).
  Rendered descriptions carry no clickable dangerous link; WP06 rejects those in its own fixtures.
  The renderer's HTML is owner-trusted and NOT sanitised (C-008), so no case asserts on the
  renderer's own markup.
- `rejected/<case>/` — one directory per row of
  [`kitty-specs/openapi-second-slice-01M6WXJ4/contracts/rejected-inputs.md`](../../../../kitty-specs/openapi-second-slice-01M6WXJ4/contracts/rejected-inputs.md).
  Rows whose input is only an option shape carry a README naming the option; the option itself
  lives in the seam suite's row table. Rows that need unwieldy artifacts (a 10 MB file, 201
  archive matches, a ref-count bomb) or a symlink pointing outside the site are generated at test
  time by the row's `setup`/`files`.

## Flip inventory

Every `it.fails` case in `src/tests/openapi-seam.test.ts` and in arm B of
`tests/consumption/openapi-optin.test.ts` is titled `[WPnn] …`. When work package `nn` lands its
behaviour, it flips each of its own cases from `it.fails` to `it` (and, where noted, tightens the
assertion). This table is the inventory: the case title prefix each WP owns.

| WP | Cases it flips (title prefix `[WPnn]`) |
|----|-----------------------------------------|
| WP03 | one synthetic index entry per spec version (two-versions, ops-1, ops-200); `/api/pages/reference/api/<label>.json` with `rawDocumentUrl` and `sha256`; sha256 equals the served bytes; hostile entry flattening; consumption arm B index/page/sha256 cases |
| WP04 | `llms.txt` operation lines (two-versions, hostile, consumption arm B) |
| WP05 | unreleased version absent from the sitemap and the search index |
| WP07 | version nav links the same operation in the target version, else the overview |
| WP08 | rejected rows: archive zero matches, empty derived label, duplicate label, archive over 200 matches |
| WP09 | rejected rows: every `$ref` row (escape, non-file scheme, unresolvable, external cycle, absolute/`file://`/`http(s)`, symlink escape, ref limits) |
| WP10 | rejected rows: sha256 mismatch, more than 5 redirects, offline without cache, fetch timeout |
| WP12 | content-graph node and OKF file per spec version (two-versions and consumption arm B) |

The rejected rows owned by WP02 (unknown version, http URL, remote without sha256, labelPattern,
userinfo, archive glob static, size, alias count) are `[WP02]` cases in the same table. Two rows
are already enforced today and run as ordinary `it`s: the unparsable file and the missing file
(both `cannot …` causes of the current `checkSpecFile`).

## Regenerating

`ops-200` and the test-time artifacts need no regeneration step — the generator is the source of
truth and the rest is written per run. `example/openapi/` (the worked example the assert gate
walks) is separate from this tree; its mirror lives in `EXAMPLE_OPENAPI` in
`src/scripts/assert-openapi-artifacts.mjs`.
