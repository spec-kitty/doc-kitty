---
description: "Work package task list for mission okf-alignment-content-graph-01M56PNW"
---

# Work Packages: OKF alignment and content graph

**Inputs**: Design documents from `/kitty-specs/okf-alignment-content-graph-01M56PNW/`
**Prerequisites**: plan.md (IC-01..IC-08), spec.md, research.md, data-model.md, contracts/ (`content-graph.schema.json`, `okf-export.md`), quickstart.md. Binding design: ADR-0059.

**Tests**: Required. DIRECTIVE_041 / C-005: strengthen existing tests first; at most one new focused test per change; never regenerate a timing census. Red-first: write the failing assertion before the fix.

**Organization**: Subtasks (`T###`) roll up into work packages (`WPxx`). Order is #177 (WP01-WP04) → #176 (WP05-WP06) → #178 (WP07-WP08) → docs (WP09).

**Prompt Files**: `tasks/WPxx-slug.md` (flat).

## Subtask Format: `[Txxx] [P?] Description`

- **[P]** means the subtask can run in parallel with siblings (different files).
- Subtasks are reference rows; record completion with `spec-kitty agent tasks mark-status <Txxx> --status done`.

## Ownership notes (no overlapping owned_files)

- `src/lib/vocabulary-core.mjs`, `src/lib/schema.ts`, `src/scripts/validate-frontmatter.mjs`, `src/lib/generator-stamp.mjs`: WP01 only.
- `src/lib/routes/agent-index.ts`, `src/tests/agent-api.test.ts`: WP03. WP05 makes a justified out-of-map edit (`_links.contentGraph`) after WP03 merges.
- `src/lib/config.ts`: WP05. WP08 makes a justified one-line out-of-map registration of its build hook.
- `src/scripts/assert-build-artifacts.mjs`, `src/tests/example-adopter.test.ts`: WP06. WP08 makes a justified out-of-map edit (run the §11 checker on `dist/okf/`).
- `src/package.json` `exports` gains `./routes/content-graph-injected` in WP05 (justified out-of-map, before WP08 which owns the file; needed so the injected route resolves in packed-tarball adopters).
- Committed `example/docs/glossary/**` is regenerated once by WP02 (justified out-of-map; the glossary generator runs every build).
- `tests/consumption/**`: WP08 (one assertion covers graph plus bundle, NFR-005).
- `docs/**` and non-behaviour `example/docs/**`: WP04 (migration). WP09 owns only new docs files and `CHANGELOG.md`; its ADR-0059 addendum and metadata-model touch are justified out-of-map edits after WP04.
- `example/docs/behaviour/**` (generated Gherkin pages): WP02.
- Canonical changelog is root `CHANGELOG.md` (`docs/changelog/CHANGELOG.md` does not exist; `docs/changelog/` holds dated entries).

---

## Work Package WP01: Shared metadata rules in the vocabulary core (Priority: P1)

**Goal**: One owner (C-009) for actor grammar, instant normalisation, `okf_version` check, `doc_status`→`status`, and generator-stamp detection; both validator twins import it.
**Independent Test**: `schema-validator-parity.test.ts` agrees 100% on every new fixture; `okf-status-mapping.test.ts` enumerates `STATUSES`.
**Prompt**: `/tasks/WP01-shared-metadata-rules.md`
**Requirement Refs**: FR-001, FR-002, FR-003, FR-004, FR-006, FR-008, FR-021, FR-022, FR-023, NFR-002, NFR-004, C-001, C-004, C-005, C-009

### Included Subtasks

T001 Red-first parity fixtures for instants, actors, `okf_version`, bare `verified`
T002 `parseActor`/`isActor`, `normaliseInstant`, `okfStatusOf`, `checkOkfVersion` in `vocabulary-core.mjs`
T003 Wire `schema.ts` twin (`updated`, `stale_after`, `verified`, `generated.content_hash`, `authors`, `okf_version`)
T004 Wire `validate-frontmatter.mjs` twin + advisory warnings
T005 [P] New `generator-stamp.mjs` (toolkitVersion, makeStamp, isGeneratedStamp) + prefix detection in the validator
T006 [P] Focused `okf-status-mapping.test.ts` (totality)

### Dependencies

- None.

---

## Work Package WP02: Generators write versioned, stable stamps (Priority: P1)

**Goal**: Gherkin, glossary and scaffold generators write `<producer>/<toolkit version>`, a stable UTC `generated.at`, `generated.content_hash`; scaffold writes UTC `updated`, `okf_version` per index, `human:` author.
**Independent Test**: Gherkin regeneration twice → 0 changed files; content change moves `at`/`content_hash`; version bump changes only `by`.
**Prompt**: `/tasks/WP02-generator-stamps.md`
**Requirement Refs**: FR-003, FR-005, FR-006, NFR-001, C-004, C-007, SC-004, SC-005

### Included Subtasks

T007 Red-first stamp assertions in `gherkin-feature-core.test.ts`
T008 Gherkin core/generate/include-scan adopt `generator-stamp.mjs`
T009 [P] Glossary generator key sets recognise the stamp
T010 [P] Scaffold writes UTC `updated`, per-index `okf_version`, `human:` author
T011 Regenerate `example/docs/behaviour/**` once; prove byte-idempotent rerun

### Dependencies

- Depends on WP01.

---

## Work Package WP03: `updated` consumers and agent-index version (Priority: P1)

**Goal**: Full timestamps render and sort identically to their date-only twins; agent index version `'2'`→`'3'`.
**Independent Test**: `collect-doc-entries-order.test.ts` positive control; `agent-api.test.ts` version + record format.
**Prompt**: `/tasks/WP03-updated-consumers.md`
**Requirement Refs**: FR-009, FR-024, NFR-001, C-007

### Included Subtasks

T012 Red-first order and agent-api assertions
T013 `metadata.ts` (`updatedMillis`, `toAgentRecord`, `rankForFeed`) via `normaliseInstant`
T014 [P] `rss.ts` pubDate; `PageTitle.astro`/`Persona.astro` UTC date display
T015 [P] `generate-adr-index.mjs` keeps `YYYY-MM-DD`
T016 Agent-index version bump + pinned baselines in the same change

### Dependencies

- Depends on WP01. Parallel with WP02.

---

## Work Package WP04: Tree migration and metadata-model doc (Priority: P1)

**Goal**: `docs/` and `example/docs` pass with 0 new warnings (NFR-003).
**Independent Test**: `validate:docs` and `validate:example` report 0 date-only, email-author, missing-`okf_version` warnings.
**Prompt**: `/tasks/WP04-tree-migration.md`
**Requirement Refs**: FR-003, FR-007, FR-008, NFR-003, NFR-004, C-006, C-007

### Included Subtasks

T017 One-off `src/scripts/oneoff/migrate-okf-metadata.mjs` (text-in-place, dry-run first)
T018 Run on `docs/` and non-behaviour `example/docs/`; regenerate ADR/section indexes per repo conventions
T019 `docs/architecture/metadata-model.md` mapping table (FR-008)
T020 Gates and pinned baselines refreshed in the same change

### Dependencies

- Depends on WP02, WP03.

---

## Work Package WP05: Content graph builder and route (Priority: P1)

**Goal**: Pure `buildContentGraph()` next to `buildDocsIndex()`, served always-on at `api/content-graph.json` and linked from `api/index.json` `_links`.
**Independent Test**: `content-graph.test.ts`: determinism, edge ids, sorting, SC-001 equality with the rendered-block resolvers.
**Prompt**: `/tasks/WP05-content-graph-builder.md`
**Requirement Refs**: FR-010, FR-011, FR-012, FR-013, FR-021, FR-022, NFR-001, C-002, C-003, C-009, C-010, C-011, SC-001

### Included Subtasks

T021 Red-first focused `content-graph.test.ts`
T022 `buildContentGraph()` nodes (page/catalog/persona/resource)
T023 Edges from shared resolvers (related, audience, cites, in-section, derived-from) + draft exclusion
T024 Route `routes/content-graph.ts`, export from `routes/index.ts`, injected always-on via an integration in `config.ts`
T025 `_links.contentGraph` in agent index (out-of-map, after WP03)

### Dependencies

- Depends on WP01, WP03.

---

## Work Package WP06: Artifact gate walks the graph (Priority: P1)

**Goal**: The build-artifact gate follows `_links.contentGraph` and fails on any dangling edge; drafts are not reported; two builds are byte-identical.
**Independent Test**: `example-adopter.test.ts` dangling-edge fixture fails naming the edge; draft-target fixture passes.
**Prompt**: `/tasks/WP06-graph-artifact-gate.md`
**Requirement Refs**: FR-014, NFR-001, NFR-006, C-007, C-010, SC-005

### Included Subtasks

T026 Red-first dangling-edge and draft-target fixtures in `example-adopter.test.ts`
T027 Graph walk in `assert-build-artifacts.mjs`
T028 Two-build byte-diff of `api/content-graph.json` in the existing determinism oracle
T029 Pinned example baselines / enumerator ripple

### Dependencies

- Depends on WP04, WP05.

---

## Work Package WP07: OKF export core and conformance checker (Priority: P2)

**Goal**: Pure `(graph, sourceFiles) → Map<path, bytes>` plus an in-repo §11 checker.
**Independent Test**: `okf-export.test.ts`: mapping, relations section, no empty heading, sidecars, missing-`type` positive control, SC-003 equality.
**Prompt**: `/tasks/WP07-okf-export-core.md`
**Requirement Refs**: FR-015, FR-016, FR-017, FR-019, FR-021, FR-022, FR-025, FR-026, C-003, C-010, SC-002, SC-003

### Included Subtasks

T030 Red-first focused `okf-export.test.ts` with small fixtures
T031 Concept documents: frontmatter mapping (status, generated, actors, sources)
T032 Relations sections as `/`-prefixed body links (no empty heading)
T033 OKF-form `index.md` entry lists + `_index.meta.yaml` sidecars; reserved `log.md`
T034 `conformance.mjs` §11 rules 1-3

### Dependencies

- Depends on WP05 (graph schema), WP01 (mapping).

---

## Work Package WP08: Export CLI, build hook and consumption proof (Priority: P2)

**Goal**: `dockitty-export-okf` bin (with `--check`) and an `astro:build:done` hook writing `dist/okf/`; clean-room consumption sees the graph and the bundle.
**Independent Test**: `consumption-gap.test.ts` sees `api/content-graph.json` and `okf/index.md`; two exports byte-identical.
**Prompt**: `/tasks/WP08-export-cli-hook.md`
**Requirement Refs**: FR-018, FR-019, NFR-001, NFR-005, NFR-006, C-004, C-007, C-010

### Included Subtasks

T035 Red-first consumption assertion
T036 `src/scripts/export-okf.mjs` bin + `--check`; `src/package.json` bin entry
T037 `okf-export/integration.ts` build hook, registered after sitemap-order (out-of-map line in `config.ts`)
T038 Gate runs §11 checker on `dist/okf/` (out-of-map in `assert-build-artifacts.mjs`); NFR-006 measured once

### Dependencies

- Depends on WP06, WP07.

---

## Work Package WP09: Docs, ADR-0059 addendum, changelog (Priority: P2)

**Goal**: Living documentation and FR-020 evidence.
**Independent Test**: doc-sanity, links and Vale pass; description 50-180 chars; changelog ≤ 1,200 chars.
**Prompt**: `/tasks/WP09-docs-adr-changelog.md`
**Requirement Refs**: FR-008, FR-020, FR-024, C-001, C-006, C-008

### Included Subtasks

T039 Export how-to guide `docs/guides/export-okf-bundle.md` (CLI, layout, viewer gap, upstream issue URL)
T040 ADR-0059 dated "Implementation notes" addendum (glossary generator now stamped; plan decisions)
T041 `CHANGELOG.md` entry + dated `docs/changelog/` entry; regenerate indexes

### Dependencies

- Depends on WP04, WP08.

---

## Dependency & Execution Summary

- **Sequence**: WP01 → (WP02 ∥ WP03) → WP04 → WP05 → WP06 → WP07 → WP08 → WP09. WP05 may start after WP03 (it does not need WP04); WP07 may run parallel with WP06 after WP05.
- **MVP**: WP01-WP06 (#177 + #176).

## Requirements Coverage Summary

| Requirement | WP(s) |
|---|---|
| FR-001, FR-002, FR-004, FR-023 | WP01 |
| FR-003 | WP01, WP02, WP04 |
| FR-005 | WP02 |
| FR-006 | WP01, WP02 |
| FR-007 | WP04 |
| FR-008 | WP01, WP04, WP09 |
| FR-009 | WP03 |
| FR-010..FR-013 | WP05 |
| FR-014 | WP06 |
| FR-015..FR-017, FR-025, FR-026 | WP07 |
| FR-018 | WP08 |
| FR-019 | WP07, WP08 |
| FR-020 | WP09 |
| FR-021, FR-022 | WP01, WP05, WP07 |
| FR-024 | WP03, WP09 |
| NFR-001 | WP02, WP03, WP05, WP06, WP08 |
| NFR-002 | WP01 |
| NFR-003 | WP04 |
| NFR-004 | WP01, WP04 |
| NFR-005 | WP08 |
| NFR-006 | WP06, WP08 |

## Subtask Index (Reference)

| Subtask | Summary | WP | Parallel? |
|---|---|---|---|
| T001 | Parity fixtures (red) | WP01 | No |
| T002 | Vocabulary-core rules | WP01 | No |
| T003 | schema.ts twin | WP01 | No |
| T004 | validator twin + warnings | WP01 | No |
| T005 | generator-stamp.mjs | WP01 | Yes |
| T006 | okf-status-mapping test | WP01 | Yes |
| T007 | Gherkin stamp tests (red) | WP02 | No |
| T008 | Gherkin adopts stamp | WP02 | No |
| T009 | Glossary key sets | WP02 | Yes |
| T010 | Scaffold forms | WP02 | Yes |
| T011 | Regenerate behaviour pages | WP02 | No |
| T012 | Order/agent-api tests (red) | WP03 | No |
| T013 | metadata.ts | WP03 | No |
| T014 | RSS + display | WP03 | Yes |
| T015 | ADR index date | WP03 | Yes |
| T016 | Agent version + baselines | WP03 | No |
| T017 | Migration script | WP04 | No |
| T018 | Run migration | WP04 | No |
| T019 | Metadata-model doc | WP04 | Yes |
| T020 | Gates + baselines | WP04 | No |
| T021 | content-graph test (red) | WP05 | No |
| T022 | Graph nodes | WP05 | No |
| T023 | Graph edges | WP05 | No |
| T024 | Route + injection | WP05 | No |
| T025 | `_links.contentGraph` | WP05 | No |
| T026 | Gate fixtures (red) | WP06 | No |
| T027 | Gate graph walk | WP06 | No |
| T028 | Two-build byte diff | WP06 | No |
| T029 | Baseline ripple | WP06 | No |
| T030 | okf-export test (red) | WP07 | No |
| T031 | Frontmatter mapping | WP07 | No |
| T032 | Relations sections | WP07 | No |
| T033 | Index entry lists + sidecars | WP07 | No |
| T034 | Conformance checker | WP07 | Yes |
| T035 | Consumption assertion (red) | WP08 | No |
| T036 | CLI bin | WP08 | No |
| T037 | Build hook | WP08 | No |
| T038 | Gate §11 + NFR-006 | WP08 | No |
| T039 | Export guide | WP09 | Yes |
| T040 | ADR-0059 addendum | WP09 | Yes |
| T041 | Changelog + indexes | WP09 | No |
