# Research: OKF alignment and content graph

Each entry lists the decision, the rationale and the alternatives rejected. ADR-0059 is binding (C-001), and nothing here departs from it.

## R-01 Export bundle location and form

- **Decision**: a directory, `dist/okf/`, written by an `astro:build:done` hook that reads `dist/api/content-graph.json` and the source tree. The CLI writes the same layout to `--out`.
- **Rationale**: a directory is byte-deterministic for free, static hosting serves it, and the existing two-build diff oracle covers it. Reading the built graph meets C-010.
- **Alternatives**: a `.tar`/`.zip` archive (needs fixed mtimes and ordering, is opaque to the artifact gate, and is one `zip -r` away for adopters); a path outside `dist/` (would not be deployed or checked).

## R-02 Catalog and persona targets

- **Decision**: personas are pages, so they are linked as bundle paths. A catalog citation becomes an external link to its `url`. An entry with no URL is omitted from the body and kept in `sources`.
- **Rationale**: OKF §6.2 permits external links. Inventing catalog concept files would add nodes the source tree does not have.
- **Alternatives**: one concept file per catalog entry (scope creep toward the deferred bibliography page, C-008); dropping all `cites` (loses information).

## R-03 Preserved index metadata

- **Decision**: a sidecar `_index.meta.yaml` next to each exported non-root `index.md`, with the original frontmatter verbatim and sorted keys.
- **Rationale**: non-`.md` files fall outside §11, and readers ignore unknown files (§12). Nothing pollutes the concept graph.
- **Alternatives**: a concept page `_index-meta.md` (a fake concept that needs a `type`); folding the metadata into the root (loses locality).

## R-04 `in-section` and `derived-from` sources

- **Decision**: `in-section` comes from the parent-directory index in the existing route table, with the registry used for labels only. `derived-from` comes from `sources[].resource`, with a `resource:` node per distinct external resource.
- **Rationale**: both read existing data with existing resolvers (C-003), and both are frontmatter or tree facts (C-002). No `generated.source` exists, and adding one is out of scope.
- **Alternatives**: the section registry as the edge source (it lists sections, not page membership); a new `generated.source` field (a new contract with no consumer).

## R-05 What an index file is

- **Decision**: a basename in `normalizeIndexBasenames(indexBasename)`.
- **Rationale**: it is the same function that routing uses, so there is a single owner.
- **Alternatives**: a hard-coded `README.md` (breaks the `index` option).

## R-06 `log.md`

- **Decision**: none exists in either tree. The export copies a source `log.md` as-is and the checker treats it as reserved.
- **Rationale**: OKF reserves the name, and generating one has no consumer.
- **Alternatives**: synthesising a log from `updated` (no requirement asks for it).

## R-07 Instant normalisation

- **Decision**: `normaliseInstant(v)` returns `{iso, dateOnly}`. It accepts `YYYY-MM-DD` and `YYYY-MM-DDTHH:MM:SSZ` (fractional seconds allowed; an offset other than `Z` is a warning). Both twins and the readers call it.
- **Rationale**: single owner (C-009), so parity holds by construction (NFR-002).
- **Alternatives**: each twin keeps `z.coerce.date()` (it diverges on edge strings).

## R-08 Stable `generated.at`

- **Decision**: `makeStamp` reads the existing page's stamp and keeps `at` when `content_hash` is unchanged. `by` is always the current `<producer>/<version>`.
- **Rationale**: it meets the FR-005 and NFR-001 idempotence rules, and a release re-stamps `by` once (a settled rule).
- **Alternatives**: `at` = build time (breaks determinism); `at` = the source file's mtime (not reproducible from git).

## R-09 Toolkit version source

- **Decision**: `generator-stamp.mjs` reads `../package.json` relative to its own URL (that is, `src/package.json` in the packed tarball).
- **Rationale**: C-004. It works the same in the repo and in an adopter's `node_modules`.
- **Alternatives**: the root `package.json` (forbidden); a build-time constant (needs a codegen step).

## R-10 Agent-index version

- **Decision**: bump `'2'`→`'3'`, because the record `updated` changes from a date to an ISO instant.
- **Rationale**: DIRECTIVE_018 and FR-024.

## Dependencies

No new dependencies. Everything uses `node:crypto`, `node:fs`, the YAML parser already in the validator, and Astro integration hooks. The DIRECTIVE_051 supply-chain review does not apply.
