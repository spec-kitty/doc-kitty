# Changelog

All notable changes to `@spec-kitty/doc-toolkit` are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 💥 Breaking

- **The project is now DocKitty and the package is `@spec-kitty/doc-toolkit`**
  (`#105`) — the toolkit was renamed from `@commondocs-kitty/toolkit` to
  `@spec-kitty/doc-toolkit`, and the product name from "Common Docs — Kitty
  Variation" to **DocKitty**. Adopters must update their dependency and every
  `@commondocs-kitty/toolkit/*` import to `@spec-kitty/doc-toolkit/*` (the
  subpath exports are otherwise unchanged). The package has not been published to
  npm, so there are no released consumers to migrate. Publishing under the
  `@spec-kitty` scope refines the zero-Spec-Kitty-coupling invariant (NFR-001):
  the toolkit still carries no Spec Kitty *runtime* coupling, but its own
  self-reference is no longer treated as coupling — see
  [ADR-0043](docs/adr/0043-toolkit-package-scope-and-self-reference.md).

### Added

- **Attribution for the upstream Common Docs specification** (`#105`) — DocKitty
  is based on the **Common Docs** convention created by **Christopher Skene**. A
  new root `NOTICE` reproduces the upstream MIT notice (spec v1.2, © Christopher
  Skene) and ships inside the package; the README gains an **Accreditation**
  section, and the convention doc credits the Common Docs specification to
  Christopher Skene alongside the DocKitty variation.
- **One `_meta/charter.yaml` now governs a docsite's whole convention** (M7;
  `#100`, closes `#98`, `#99`) — the `type`/`kind` vocabulary, the `doc_status`
  set, the sections/IA registry, and the required-field set used to be spread
  across separate `_meta/*.yaml` files, with a couple of knobs hardcoded in the
  toolkit. A consumer can now author a single optional charter, resolved natively
  by doc-kitty with **no Spec Kitty runtime dependency**, under a documented
  per-axis `default → consumer` precedence. Existing `_meta/*.yaml` files are
  still honored (with a one-shot deprecation notice), so current consumers keep
  working unchanged; a charter-only consumer is now governed end-to-end — the
  frontmatter gate and every build output (`llms.txt`, the agent-API, `rss.xml`,
  the Hub grid, and the sidebar/sitemap) resolve through the charter. `doc_status`
  is extend-only (the canonical statuses stay reserved) and the required-field set
  keeps a non-removable `title` floor; a malformed charter fails closed. See
  [ADR-0042](docs/adr/0042-native-documentation-charter.md) and the consumer
  charter reference + migration guide.

## [0.1.0] — 2026-09-09

First tagged release. Collects the delivered MVP of the **DocKitty** toolkit:
point it at a documentation tree that follows the convention
and get a Starlight docsite plus `sitemap.xml`, `rss.xml`, `llms.txt`, and a JSON
agent-API out of the box. See [`docs/plans/roadmap.md`](docs/plans/roadmap.md) for
the feature-by-feature status and the decision records under
[`docs/adr/`](docs/adr/) for the reasoning.

### Added

- **Common Docs rendering** — the README-as-index loader renders a repo-root
  `docs/` tree; `README.md` (or `index.md`) is the section index and carries
  frontmatter.
- **Metadata model + chrome** (M1) — the first-class frontmatter contract
  (`doc_status`, `type`, `kind`, `audience`, `related`, …) that drives navigation,
  feeds, and the agent-API (ADR-0005/0009).
- **Generators** — `rss.xml`, `llms.txt`, generated `sitemap.xml`, and an enriched
  HATEOAS agent-API (`_links`, enriched `related[]`/`audience[]`).
- **Component system + swappable theme** (M2) — per-kind layouts (Default, Hub,
  Persona, Deck) and a pure `default → brand → consumer` token-theme merge
  (ADR-0008/0011/0013).
- **Audience + related + external references** (M3) — audience targeting, rendered
  relationships, and an external-reference catalog.
- **Slide decks** (M6) — static reveal.js decks on an out-of-frame route.
- **Diagrams** (M5 → #13) — client-side Mermaid and build-time static-SVG Mermaid
  (`@beoe`) + PlantUML (self-hosted service), dual-mode and self-contained; theming
  via `--dk-diagram-*` (ADR-0040).
- **Glossary + Contextive** (M4) — multi-context autolinking, hover preview, the
  `:term` directive, and an On-this-page block.
- **Markua syntax support** (subset) — preprocess-to-directive pipeline, callouts,
  and opt-in first-class footnotes (ADR-0030, ADR-0041) — a Markua-clean source for
  a future Leanpub export path.
- **Example corpus** — the ars-rethorica showcase (Introduction, Preamble, Book I
  15 chapters, Book II/III landings, a generated rhetoric glossary, two reader
  personas).
- **Packaging** — published as `@spec-kitty/doc-toolkit` with an `exports` map,
  a `files` allowlist, and `astro`/`@astrojs/starlight` peer dependencies;
  workspace-split from `example/`.

### Adoption enablers (spec-kitty proving ground, #37–#44)

- `index.md` accepted as a section index alongside `README.md` (#37).
- `type`/`kind` optional, `type` derivable from the section registry (#38).
- `durable` added to the `doc_status` enum (#39).
- Overridable `type`/`kind` vocabulary (#40).
- Tolerate `adr/<era>/NNNN-` era-partitioned ADR paths (#41).
- First-class redirect-coverage gate for migrating adopters —
  `check-redirect-coverage.mjs` (#42).
- MIT LICENSE (#43).
- Doc-honesty fixes across the index, `AGENTS.md`, and `README` (#44).

### Known limitations

- Reuse is proven at **N=1** — only the spec-kitty brand theme is instantiated; the
  `consumer` theme layer is a contract, not yet a demonstrated second consumer. A
  dedicated consumption-test workflow is scoped to close this.
- Repository portals (mission-status, QA, ticketing) are design-only.
- Build-time PlantUML rendering requires a PlantUML service (provided in CI); a
  local build without it skips PlantUML figures.

[Unreleased]: https://github.com/spec-kitty/doc-kitty/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/spec-kitty/doc-kitty/releases/tag/v0.1.0
