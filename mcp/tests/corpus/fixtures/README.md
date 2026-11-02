# Corpus test fixtures (WP02 scope: `mcp/tests/corpus/fixtures/`)

`example/` is a byte-faithful copy of a real build's machine artifacts:
mint with `pnpm --filter example build` (needs the PlantUML render server,
`docker run -d --rm -p 8091:8080 plantuml/plantuml-server:jetty`, plus
`DK_PLANTUML_SERVER_URL=http://localhost:8091/svg/ DK_DIAGRAM_BUILD_RENDER=on`),
then:

    cp -r example/dist/api mcp/tests/corpus/fixtures/example/api
    node mcp/tests/corpus/fixtures/derive.mjs

It bakes the deploy origin `https://spec-kitty.github.io/doc-kitty`; for a
LOCAL run that origin is effectively dead - exactly what the FR-007
re-origining tests exercise ("dead-origin" case, driven by `--link-base`).

The mutated directories are derivations, sliced to three pages (home +
context/audience + guides/getting-started) so tests stay small and fast:

- `unknown-major/` - index `version` major not in the supported set.
- `non-numeric-version/` - index `version` with no numeric major.
- `torn-build/` - one page artifact carries a diverging `buildId`.
- `pre-buildid/` - no `buildId` on any artifact and no `sections[]` (the
  pre-FR-008 / pre-WP01 migration-allowance corpus).
- `gated-pages/` - records carry no `_links.self` (site set `links.pages:false`).
- `malformed-title/` - first record's `title` removed (guard message check).
- `malformed-markdown/` - the `context/audience` page artifact loses its required `markdown`.

Provenance of the minted example copy: the lane-b `example/dist` build of
2026-11-01 (contract version "3", 70 agent-discoverable pages, `buildId`
present on index, pages and scenarios alike; scenario surface live).
WP05 owns `mcp/tests/fixtures/**` separately - keep this tree WP02-scoped and
re-mintable via the commands above.
