# Research: TOM annex export

Each finding cites the code it rests on, as of `origin/main` 26170c9.

## R-01 Where the artifact is produced

- **Decision**: An injected, prerendered route (`/api/tom-annex.json`), mounted
  by a small integration. This is the pattern `content-graph.ts` and `gherkin.ts`
  use (`injectRoute`, an entrypoint exported from `src/package.json`).
- **Rationale**: It is Astro-native, it works in dev, and its output is built and
  served like every other agent-API file. `assertAgentLinksResolve`
  (`assert-build-artifacts.mjs:415-510`) already follows every `_links` href and
  fails when the file is missing, which covers FR-005.
- **Alternatives**:
  - Write the file in `astro:build:done` from `dist/api/content-graph.json`, as
    the OKF export does. That is simpler to make conditional, but it is invisible
    in dev and adds a second post-build writer.
  - A route the consuming site mounts by hand. That is one more manual step, and
    FR-012 wants zero cost by default.

## R-02 Sharing the graph

- **Decision**: Extract the inline graph build of `contentGraphRoute`
  (`src/lib/routes/content-graph.ts:56-77`) into one memoised
  `siteContentGraph()`, keyed per build. Both routes call it.
- **Rationale**: C-004 requires a single graph. Building it twice would cost about
  as much as the content-graph route itself (NFR-002). The only cache today is the
  catalog's (`measures-loader.mjs:103`).
- **Guard**: a ratchet test that `api/content-graph.json` is byte-identical before
  and after the extraction.

## R-03 Conditional emission and the draft rule

- **Decision**:
  - At `config:setup`, scan the docs tree's frontmatter for `tom_classification`,
    skipping draft routes by `draftRoutesOf` (`src/lib/draft-publication.mjs:392`,
    the source of `sitemapDraftFilter`, `route-shaping.ts:234`).
  - Mount the route and set `servedSurfaces().tomAnnex` only when a published page
    is classified. `_links.tomAnnex` follows the `scenarios` conditional-spread
    pattern (`agent-index.ts:189-219`), with a field added to `IndexLinks`
    (`contract.ts:138-151`).
  - The route throws if it is mounted but the graph has no `classified-as` edge,
    and the artifact gate fails if the link is present without the file.
- **Rationale**: Astro cannot skip a prerendered static endpoint, so the decision
  has to be taken before routes are injected. Draft edges are already gone from
  the graph (`buildContentGraph` drops drafts, `docs-index.ts:388`), so the index
  content follows the sitemap rule (C-005).

## R-04 The snapshot and the producer registry (ADR-0083 and ADR-0087)

- **Finding**: Registry scopes are page scopes, `section` or `directories`
  (`producers.mjs`). A JSON snapshot is not a page.
- **Decision**:
  - Register `doc-kitty-tom-annex` as an ownership producer.
  - Its **hub page** uses a `directories` scope given by the CLI flag (`kinds: ['Hub']`).
  - The **snapshot** is a non-page file at the explicit path given to `--snapshot`.
    It carries the same stamp, and the CLI applies the ADR-0087 verdicts to it.
  - The registry entry does not need a new scope type for this mission.
- **Follow-up (not in this mission)**: if more non-page generated files appear, a
  `file` scope type would extend ADR-0083 D3. That is recorded in the guide's
  open points.

## R-05 Stamp fields for a build-derived JSON artifact (ADR-0087 D5)

- **Decision**:
  - `by` is `doc-kitty-tom-annex/<toolkit version>`.
  - `source_digest` follows ADR-0087 D2. It covers:
    - the catalog, as canonical JSON of its records under the path
      `catalog:<source>`;
    - every evidence page, by its repo-relative POSIX path and the sha256 of its
      committed bytes, sorted by path.
  - `content_hash` is `sha256:<12 hex>` over the serialised annex with the
    `generated` block removed.
  - `at` is the latest `updated` or `verified[].at` among the evidence pages.
    It is `null` when no page has one. It never comes from the clock.
- **Rationale**: Two builds then give identical bytes with nothing masked (FR-007,
  NFR-001). The digest moves exactly when an input moves.

## R-06 Serialiser

- **Finding**: The agent-API routes disagree on a trailing newline. `content-graph`
  writes one; `agent-index`, `agent-page` and `scenario-index` do not.
- **Decision**: Use `JSON.stringify(value, null, 2) + "\n"` with keys in schema
  order. That is the content-graph convention, and the snapshot needs a final
  newline to diff cleanly. The guide documents it.

## R-07 OKF export

- **Decision**:
  - `okfExportIntegration` also reads `dist/api/tom-annex.json` when it is present.
  - `exportOkfBundle` writes it to the bundle path `tom-annex.json`, through the
    `out.set` seam that `addOpenApiDocuments` uses (`core.mjs:558`).
  - The bundle's root `index.md` gets one labelled line that links it.
  - When the file is absent, nothing changes.

## R-08 Two-builds coverage

- **Decision**: Add `api/tom-annex.json` to `MACHINE_SURFACE_GLOBS` in
  `src/tests/draft-publication-build.test.ts`, whose two-builds diff is
  `diffSurfaces()`. Add a focused `|build|` test that builds the example twice and
  compares the annex bytes with no mask.

## Supply-chain check (DIRECTIVE_051)

The plan adds, upgrades and removes no dependency, so there is nothing to check.
`node:crypto` is built in.

## ⚖ Counsel items carried into the guide

1. The label wording: "evidence index, not the contractual annex".
2. Whether a DPA may cite the living index or needs a dated snapshot.
3. Whether `uncovered` may be shown to third parties, since it could reveal gaps.
