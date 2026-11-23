# Tasks: TOM annex export: an evidence index

**Mission**: `tom-annex-export-01M84YDP` · **Spec**: [spec.md](spec.md) · **Plan**: [plan.md](plan.md)
**Planning base / merge target**: `feat/401-tom-annex-export`

> **Evidence index, not the contractual annex.** Not legal advice. ⚖ marks items
> for counsel.

## Gate on ADR-0087 (C-002)

WP06 and WP07 implement the generated-section contract (ADR-0087). ADR-0087 was
accepted on 2026-11-23 (PR #445). These two WPs may be claimed only once **PR
#445 has merged** and the dispatcher has confirmed it. Every other WP may start
now.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Graph and catalog fixture builders for the annex tests | WP01 | |
| T002 | Per-measure records grouped by scope (FR-001, FR-002) | WP01 | |
| T003 | The `uncovered` list (FR-003) | WP01 | [P] |
| T004 | Label, notice and ⚖ counsel constants (FR-004) | WP01 | [P] |
| T005 | URL building, note flattening and sorting (FR-007) | WP01 | |
| T006 | Canonical serialiser and shipped format schema (FR-013) | WP01 | |
| T007 | Ratchet: content-graph.json bytes before the extraction | WP02 | |
| T008 | Extract the memoised `siteContentGraph()` | WP02 | |
| T009 | Route `content-graph.json` through it, with a ratchet green | WP02 | |
| T010 | Config-time scan for published classified pages | WP03 | |
| T011 | Route factory and injected entrypoint for `/api/tom-annex.json` | WP03 | |
| T012 | Integration: conditional `injectRoute`, wired into `defineDocKittyIntegrations` | WP03 | |
| T013 | `servedSurfaces().tomAnnex` and `IndexLinks.tomAnnex` | WP03 | [P] |
| T014 | Conditional `_links.tomAnnex` in `api/index.json` (FR-005) | WP03 | |
| T015 | Package exports for the new entrypoints | WP03 | [P] |
| T016 | Build-end cross-check: mounted but no `classified-as` edge fails | WP03 | |
| T017 | `exportOkfBundle` writes `tom-annex.json` when given one | WP04 | |
| T018 | Root `index.md` gets one labelled line linking it | WP04 | |
| T019 | `okfExportIntegration` and the `export-okf` CLI read the built artifact | WP04 | |
| T020 | No-annex site: the bundle is byte-identical to before | WP04 | |
| T021 | Artifact gate: annex shape, label, link and agreement with the graph | WP05 | |
| T022 | Build test: drafts and their edges are absent (FR-006) | WP05 | |
| T023 | Build test: two builds give identical annex bytes, unmasked (FR-007) | WP05 | |
| T024 | Build test: a site with no classified pages has no file, link or failure (FR-012) | WP05 | |
| T025 | Two-builds glob and build-suite registration; build-time budget (NFR-002) | WP05 | |
| T026 | `stamp.mjs`: `source_digest` over the declared inputs (ADR-0087 D2) | WP06 | |
| T027 | `stamp.mjs`: `content_hash` and `at` from input instants (ADR-0087 D5) | WP06 | |
| T028 | Register the `doc-kitty-tom-annex` producer (ADR-0083) | WP06 | [P] |
| T029 | Wire the stamp into the route; schema and gate accept `generated` | WP06 | |
| T030 | `hub-page.mjs`: annex to stamped hub Markdown, by nature then scope (FR-010) | WP07 | |
| T031 | `check.mjs`: ADR-0087 verdicts for the snapshot and the hub (FR-009) | WP07 | |
| T032 | `src/scripts/tom-annex.mjs` CLI: `--dist`, `--snapshot`, `--hub`, `--check` | WP07 | |
| T033 | Example opt-in: committed snapshot and hub page, package scripts | WP07 | |
| T034 | CLI tests: write, ok, stale-source, hand-edited, stale-render, missing, usage | WP07 | |
| T035 | Guide page: what the index is and is not, with ⚖ items | WP08 | |
| T036 | Format reference and versioning rule for #404 (FR-013, NFR-003) | WP08 | |
| T037 | Opt-ins, CLI usage and Deferred list (`file` scope type) | WP08 | |
| T038 | Changelog fragment and one cross-link from the metadata model | WP08 | |

## Work Packages

## Phase 1 — Foundation

## Work Package WP01 — Annex core and format ([prompt](tasks/WP01-annex-core-and-format.md))

- **Goal**: The pure, fs-free transformation from content graph and catalog to the
  documented evidence-index object, and its canonical bytes.
- **Priority**: P1 (MVP).
- **Independent test**: unit tests over hand-built graph and catalog fixtures.
- **Subtasks**:
  T001 Graph and catalog fixture builders for the annex tests (WP01)
  T002 Per-measure records grouped by scope (WP01)
  T003 The `uncovered` list (WP01)
  T004 Label, notice and ⚖ counsel constants (WP01)
  T005 URL building, note flattening and sorting (WP01)
  T006 Canonical serialiser and shipped format schema (WP01)
- **Dependencies**: none.
- **Parallel**: can run alongside WP02.
- **Risks**: the format is what #404 builds on. Field names follow
  `contracts/tom-annex.schema.json` exactly.

## Work Package WP02 — Shared site graph ([prompt](tasks/WP02-shared-site-graph.md))

- **Goal**: Build the content graph once per build and share it, with
  `content-graph.json` byte-identical.
- **Priority**: P1.
- **Independent test**: a ratchet over `api/content-graph.json` bytes.
- **Subtasks**:
  T007 Ratchet: content-graph.json bytes before the extraction (WP02)
  T008 Extract the memoised `siteContentGraph()` (WP02)
  T009 Route `content-graph.json` through it, with a ratchet green (WP02)
- **Dependencies**: none.
- **Parallel**: can run alongside WP01.
- **Risks**: memoisation must not leak between builds, or between tests that
  build different sites.

## Phase 2 — The artifact (User Stories 1–3)

## Work Package WP03 — Route, conditional mount and discovery link ([prompt](tasks/WP03-route-mount-and-link.md))

- **Goal**: Serve `/api/tom-annex.json` exactly when a published page is
  classified, and link it from `api/index.json`.
- **Priority**: P1.
- **Subtasks**:
  T010 Config-time scan for published classified pages (WP03)
  T011 Route factory and injected entrypoint for `/api/tom-annex.json` (WP03)
  T012 Integration: conditional `injectRoute`, wired into `defineDocKittyIntegrations` (WP03)
  T013 `servedSurfaces().tomAnnex` and `IndexLinks.tomAnnex` (WP03)
  T014 Conditional `_links.tomAnnex` in `api/index.json` (WP03)
  T015 Package exports for the new entrypoints (WP03)
  T016 Build-end cross-check: mounted but no `classified-as` edge fails (WP03)
- **Dependencies**: WP01, WP02.
- **Risks**: the scan and the graph disagreeing (T016 guards it). Existing
  `_links` golden tests must still pass for sites with no classified pages.

## Work Package WP04 — OKF export carries the annex ([prompt](tasks/WP04-okf-export.md))

- **Goal**: The OKF bundle includes the evidence index and labels it.
- **Priority**: P3.
- **Subtasks**:
  T017 `exportOkfBundle` writes `tom-annex.json` when given one (WP04)
  T018 Root `index.md` gets one labelled line linking it (WP04)
  T019 `okfExportIntegration` and the `export-okf` CLI read the built artifact (WP04)
  T020 No-annex site: the bundle is byte-identical to before (WP04)
- **Dependencies**: WP03.
- **Risks**: bundle ordering, and the `okf_version` fence on the root index.

## Work Package WP05 — Build gates: artifact gate, drafts, byte stability, empty site ([prompt](tasks/WP05-build-gates.md))

- **Goal**: Prove FR-005 to FR-007 and FR-012 on real builds, and keep them
  proven in CI.
- **Priority**: P1.
- **Subtasks**:
  T021 Artifact gate: annex shape, label, link and agreement with the graph (WP05)
  T022 Build test: drafts and their edges are absent (WP05)
  T023 Build test: two builds give identical annex bytes, unmasked (WP05)
  T024 Build test: a site with no classified pages has no file, link or failure (WP05)
  T025 Two-builds glob and build-suite registration; build-time budget (WP05)
- **Dependencies**: WP03, WP04.
- **Risks**: build tests are slow and serialised. Reuse existing fixtures and
  output directories where possible.

## Phase 3 — Generated-section contract (gated on #445 merging)

## Work Package WP06 — ADR-0087 stamp and producer registration ([prompt](tasks/WP06-stamp-and-producer.md))

- **Goal**: Stamp the artifact with `{by, at, source_digest, content_hash}` and
  register the producer.
- **Priority**: P2.
- **Subtasks**:
  T026 `stamp.mjs`: `source_digest` over the declared inputs (WP06)
  T027 `stamp.mjs`: `content_hash` and `at` from input instants (WP06)
  T028 Register the `doc-kitty-tom-annex` producer (WP06)
  T029 Wire the stamp into the route; schema and gate accept `generated` (WP06)
- **Dependencies**: WP03. **Gate**: PR #445 merged.
- **Risks**: `at` must never come from the clock, or the build would no longer
  be byte-stable.

## Work Package WP07 — Snapshot, hub page and `--check` CLI ([prompt](tasks/WP07-snapshot-hub-check-cli.md))

- **Goal**: An opt-in committed snapshot and an opt-in hub page, each checked
  for drift with the ADR-0087 verdicts.
- **Priority**: P2.
- **Subtasks**:
  T030 `hub-page.mjs`: annex to stamped hub Markdown, by nature then scope (WP07)
  T031 `check.mjs`: ADR-0087 verdicts for the snapshot and the hub (WP07)
  T032 `src/scripts/tom-annex.mjs` CLI: `--dist`, `--snapshot`, `--hub`, `--check` (WP07)
  T033 Example opt-in: committed snapshot and hub page, package scripts (WP07)
  T034 CLI tests: write, ok, stale-source, hand-edited, stale-render, missing, usage (WP07)
- **Dependencies**: WP06. **Gate**: PR #445 merged.
- **Risks**: a new example page shifts existing example goldens (sitemap, llms,
  page counts).

## Phase 4 — Documentation

## Work Package WP08 — Guide, format reference and changelog ([prompt](tasks/WP08-guide-and-changelog.md))

- **Goal**: Document the format and its versioning for #404, the opt-ins and
  the ⚖ items.
- **Priority**: P1 for the format reference; the rest is polish.
- **Subtasks**:
  T035 Guide page: what the index is and is not, with ⚖ items (WP08)
  T036 Format reference and versioning rule for #404 (WP08)
  T037 Opt-ins, CLI usage and Deferred list (`file` scope type) (WP08)
  T038 Changelog fragment and one cross-link from the metadata model (WP08)
- **Dependencies**: WP01, WP07.
- **Risks**: wording that reads as legal sufficiency. Every counsel item is
  marked ⚖.

## Deferred (not in this mission)

- **A `file` scope type for the producer registry.** It would let non-page
  generated files, such as the snapshot, be owned through the registry instead
  of by an explicit CLI path. It amends ADR-0083 D3. The operator ruled to keep
  R-04 as planned (via the dispatcher, 2026-11-23).
- Routing the edit link, the RSS hub filter and `okfGenerated` through
  `ownerOfPage` (ADR-0087 D4).
- The Gherkin migration to the four-key stamp (ADR-0087 D8), and #360–#363.
- The shared organisation bundle (#404).
- **An ADR-0087 D5 follow-up:** the annex uses `verified[].at` as an input
  instant for `at`, but D5 names only `generated.at` and `updated`. Either
  name verification instants in D5, or drop them (analysis I5; dispatcher,
  2026-11-23).

## MVP

WP01 + WP02 + WP03 + WP05 give an auditor the index (User Stories 1–3).
