# Implementation Plan: TOM annex export: an evidence index

**Branch**: `feat/401-tom-annex-export` (mission branch `kitty/mission-tom-annex-export-01M84YDP`) | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/tom-annex-export-01M84YDP/spec.md`

> [!CAUTION]
> **Not legal advice.** Every surface this plan builds is an **evidence index,
> not the contractual annex**. Items marked **⚖** await counsel.

## Summary

The mission adds `api/tom-annex.json`, which gathers, per catalog measure, the
published pages that evidence it, grouped by `scope`, and lists the uncovered
measures. It is built from the content graph's `classified-as` edges (ADR-0080
D6) by one pure, fs-free core. Three places call that core:

1. **An injected, prerendered route.** It is mounted only when the site has
   published classified pages, and `api/index.json` links it.
2. **A bare-Node CLI.** It reads the built artifact (the pattern `export-okf.mjs`
   uses). It writes an opt-in committed **snapshot** and an opt-in rendered **hub
   page**, and implements the ADR-0087 `--check` verdicts for both.
3. **The OKF export.** It adds the built artifact to the bundle.

The ADR-0087 parts (the stamp, the snapshot, `--check`, registry entries) are
sliced apart from the rest. They start only after ADR-0087 is Accepted and #445
has merged (C-002).

## Technical Context

**Language/Version**: JavaScript ESM (`.mjs`, with `// @ts-check` and JSDoc) for the fs-free core and the bare-Node CLI. TypeScript for the Astro route and integration. Node >= 22.22.0.
**Primary Dependencies**: Astro ^7.4 and Starlight ^0.42 (existing). `node:crypto` for sha256. No new dependency.
**Storage**: Files. The built artifact is `dist/api/tom-annex.json`. The opt-in snapshot and hub page are committed files at paths given to the CLI.
**Testing**: Vitest ^2.1 in both tiers (`src` unit and `|build|` tests) plus the mcp suite, through `pnpm test`. Tests are written red-first (NFR-004). Build tests reuse the two-builds harness of `src/tests/draft-publication-build.test.ts`.
**Target Platform**: Static site build (Node), plus the bare-Node CLI on Linux, macOS and Windows (LF only).
**Project Type**: Single package (`src/` is `@spec-kitty/doc-toolkit`; `example/` is the consuming site).
**Performance Goals**: The added build time on the example site is no more than 2% or 1 s, whichever is larger (NFR-002). The graph is built once per build and shared (IC-02).
**Constraints**: Committed data only, with no other repository's code at build time (C-003). The draft rule is the sitemap's (C-005). Output is byte-stable with no masks (NFR-001). No new dependency, so DIRECTIVE_051 has nothing to check.
**Scale/Scope**: Catalogs of tens to a few hundred measures, and sites with up to a few thousand pages. Output is linear in the number of edges.

## Charter Check

The charter is `.kittify/charter/charter.md`.

| Charter value | How the plan meets it | Result |
|---|---|---|
| Structure: a predictable, browsable shape | The artifact sits beside the agent-API files. The hub page is an ordinary stamped page in a section the site chooses. | Pass |
| Maintainability: docs stay correct next to the code | A guide page documents the format. `--check` keeps the snapshot and the hub honest. The format is versioned (NFR-003). | Pass |
| Agent interoperability | The artifact is linked from `api/index.json` `_links`, and the artifact gate follows the link. | Pass |
| Flexibility: adapt without a rewrite | Everything is opt-in or conditional. A site with no classified pages sees no change (FR-012). | Pass |
| Authority paths (`docs/adr/`, `docs/context/`) | The plan builds on ADR-0080, 0083, 0087, 0059 and 0042. The domain terms go into the guide. | Pass |

There are no violations, so Complexity Tracking is empty.

## Engineering Alignment

These decisions follow from the confirmed intent and the research in `research.md`:

- **One core, three callers.** `src/lib/tom-annex/core.mjs` is pure. It turns the
  graph and the catalog into an annex object and serialises it. The route, the CLI
  and the OKF export never re-derive anything (C-004).
- **The route reads the graph through a shared builder.** The inline graph build in
  `src/lib/routes/content-graph.ts` is extracted into one memoised
  `siteContentGraph()`, so `content-graph.json` and `tom-annex.json` share one
  graph per build (NFR-002).
- **Conditional emission.** At `config:setup`, a frontmatter-only scan
  (`tom_classification` present on a page that is not a draft, by
  `draftRoutesOf`) decides whether to mount the route and declare the `_links`
  entry. A cross-check at build end fails the build if the link and the file
  disagree. That scan is a single yes or no; the index content still comes only
  from the graph.
- **The CLI works on the built artifact.** It never evaluates site config or Astro.
  `--snapshot <path>` and `--hub <path>` are flags in the site's package scripts,
  as Gherkin's are.
- **Format version 1.0, additive changes only.** Every field is named in
  `contracts/tom-annex.schema.json`, and the guide states the versioning rule.

## Project Structure

### Documentation (this mission)

```
kitty-specs/tom-annex-export-01M84YDP/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tom-annex.schema.json
└── tasks.md             # /spec-kitty.tasks
```

### Source Code (repository root)

```
src/lib/tom-annex/
├── core.mjs              # pure: graph + catalog -> annex object; sort; serialise; label
├── stamp.mjs             # ADR-0087: source_digest, content_hash, at   [gated]
└── hub-page.mjs          # pure: annex -> hub Markdown                 [gated]
src/lib/routes/
├── site-graph.ts         # extracted, memoised siteContentGraph()
├── content-graph.ts      # now calls siteContentGraph()
├── tom-annex.ts          # route factory
└── tom-annex-injected.ts # injected entrypoint
src/lib/integrations/tom-annex.ts  # config:setup scan, injectRoute, link declaration
src/lib/served-surfaces.ts         # + tomAnnex flag
src/lib/contract.ts                # IndexLinks.tomAnnex
src/lib/routes/agent-index.ts      # conditional _links.tomAnnex
src/lib/producers.mjs              # + doc-kitty-tom-annex producer  [gated]
src/lib/okf-export/{core.mjs,integration.ts}  # include the annex
src/scripts/tom-annex.mjs          # CLI: --snapshot, --hub, --check [gated]
src/scripts/assert-build-artifacts.mjs  # annex assertions
src/package.json                   # exports + bin/script entries
src/tests/tom-annex-*.test.ts      # unit + |build| tests
example/docs/...                   # fixture pages already classified (ADR-0080); snapshot + hub opt-in
docs/guides/tom-annex.md           # guide + format reference (⚖ wording)
docs/changelog/unreleased/401-tom-annex-export.md
```

**Structure Decision**: This is a single package, and new code follows the
existing split. Pure `.mjs` cores sit in `src/lib/`, with Astro routes and
integrations beside them in TypeScript. Bare-Node CLIs go in `src/scripts/`.

## Complexity Tracking

None.

## Implementation Concern Map

### IC-01 — Annex core and format

- **Purpose**: The pure transformation from the content graph and the catalog to
  the documented annex object and its canonical bytes. This is the format #404
  builds on.
- **Relevant requirements**: FR-001, FR-002, FR-003, FR-004, FR-007, FR-013 (format half), NFR-001, NFR-003
- **Affected surfaces**: `src/lib/tom-annex/core.mjs`, `kitty-specs/.../contracts/tom-annex.schema.json`, unit tests
- **Sequencing/depends-on**: none
- **Risks**:
  - The page URL is not in the graph (page nodes carry `href`), so the core takes
    `site` and `base` and builds the URL the way `absolute()` does.
  - Line breaks in notes are flattened as the OKF export flattens them.

### IC-02 — Build route, discovery and draft rule

- **Purpose**: Emit `api/tom-annex.json` only for sites with published classified
  pages, link it from `_links`, and let the artifact gate check it.
- **Relevant requirements**: FR-005, FR-006, FR-012, NFR-001, NFR-002
- **Affected surfaces**: `site-graph.ts` (extracted), `content-graph.ts`, `tom-annex.ts`, `tom-annex-injected.ts`, `integrations/tom-annex.ts`, `served-surfaces.ts`, `contract.ts`, `agent-index.ts`, `config.ts`, `src/package.json` exports, `assert-build-artifacts.mjs`, the two-builds globs
- **Sequencing/depends-on**: IC-01
- **Risks**:
  - The config-time scan and the graph could disagree. That is guarded by the
    build-end cross-check.
  - Extracting the graph builder must leave `content-graph.json` byte-identical
    (ratchet test).

### IC-03 — Generated-section contract for the annex (ADR-0087) [gated]

- **Purpose**: Stamp the artifact and the snapshot with `{by, at, source_digest, content_hash}`, register the producer, and add the CLI with its `--snapshot`, `--hub` and `--check` verdicts.
- **Relevant requirements**: FR-008, FR-009, FR-010
- **Affected surfaces**: `stamp.mjs`, `hub-page.mjs`, `producers.mjs`, `src/scripts/tom-annex.mjs`, the example's package scripts
- **Sequencing/depends-on**: IC-01, IC-02, **and ADR-0087 Accepted with #445 merged (C-002)**
- **Risks**:
  - The snapshot is a JSON file, not a page, and ADR-0083 scopes are page scopes.
    See research R-04: the snapshot is recognised by an explicit path that the
    CLI is given, and only the hub page uses a registry scope.
  - `at` comes from input instants. It is `null` when no input has one.

### IC-04 — OKF export

- **Purpose**: Carry the annex in the OKF bundle, with its label.
- **Relevant requirements**: FR-011, FR-004
- **Affected surfaces**: `src/lib/okf-export/core.mjs`, `integration.ts`, `src/scripts/export-okf.mjs`
- **Sequencing/depends-on**: IC-02
- **Risks**: The bundle must stay sorted and byte-stable. A site with no annex is unchanged.

### IC-05 — Guide, format reference and changelog

- **Purpose**: Document the format and its versioning for #404, the opt-ins, and
  the ⚖ items. Add a changelog fragment.
- **Relevant requirements**: FR-013, FR-004, C-001
- **Affected surfaces**: `docs/guides/tom-annex.md`, `docs/architecture/metadata-model.md` (one cross-link), `docs/changelog/unreleased/401-tom-annex-export.md`
- **Sequencing/depends-on**: IC-01 (format), IC-03 (CLI usage)
- **Risks**: Wording must never read as legal sufficiency. ⚖ marks every counsel item.
