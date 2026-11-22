# Tasks: TOM classification and measures catalog

**Mission**: `tom-classification-measures-catalog-01M81M7T` · **Branch**: `feat/406-tom-classification` (planning base and merge target)
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

Subtask rows are reference rows. Completion is recorded with `spec-kitty agent tasks mark-status <Txxx> --status done`, never by editing this file.

## Subtask index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Mark ADR-0080 Accepted (frontmatter and Status) | WP01 | |
| T002 | Glossary terms "Measure" and "TOM classification" | WP01 | [P] |
| T003 | Changelog fragment `406-tom-classification.md` | WP01 | [P] |
| T004 | Shipped default catalog, now `measures-default.mjs` (17 records; see research R1a) | WP02 | |
| T005 | `parseMeasuresCatalog`, `buildMeasuresIndex` | WP02 | |
| T006 | `normaliseClassification`, `resolveClassification`, `classificationProblems` | WP02 | |
| T007 | Loader: consumer file or default, memoised | WP02 | |
| T008 | Core and loader tests (red first) | WP02 | |
| T009 | `TomClassificationRef` types in `metadata.ts` | WP03 | |
| T010 | Build schema field in `docKittyFields` | WP03 | |
| T011 | Gate field and case-variant warning | WP03 | |
| T012 | Shape fixtures and parity tests (red first) | WP03 | |
| T013 | Measures resolution in `validate-catalog.mjs` | WP04 | |
| T014 | Gate fixture roots | WP04 | |
| T015 | Gate tests incl. CLI exit code (red first) | WP04 | |
| T016 | Graph types and context (`classified-as`, `measure`, `scope`) | WP05 | |
| T017 | `classifiedEdges` emitter, draft-fatal resolution | WP05 | |
| T018 | Content-graph route loads the catalog | WP05 | |
| T019 | Graph tests incl. FR-010 ratchet (red first) | WP05 | |
| T020 | `AgentPageMeasure` payload type | WP06 | |
| T021 | Agent page route resolves the classification | WP06 | |
| T022 | Agent page tests (red first) | WP06 | |
| T023 | OKF `## Measures` section and line rendering | WP07 | |
| T024 | OKF measures fixture graph | WP07 | |
| T025 | OKF measures tests (red first) | WP07 | |
| T026 | Metadata model: field row and section | WP08 | [P] |
| T027 | Content-graph page: node and edge | WP08 | [P] |
| T028 | Consumer setup: measures catalog reference | WP08 | [P] |
| T029 | Authoring guide: classify and link-not-copy | WP08 | [P] |
| T030 | Example organisation-scope page | WP09 | |
| T031 | Example system page linking to it | WP09 | |
| T032 | Build-artifact assertions for graph, page record, OKF | WP09 | |

## Phase 1: Decision and foundations

### WP01 - Accept ADR-0080 and record the vocabulary

**Prompt**: [tasks/WP01-accept-adr-0080-and-vocabulary.md](./tasks/WP01-accept-adr-0080-and-vocabulary.md) · **Priority**: P1 (first commit, operator ruling) · **Dependencies**: none

**Goal**: ADR-0080 reads Accepted; the glossary has both terms; the changelog fragment exists.
**Independent test**: `pnpm validate:docs`, `pnpm validate:changelog`, `pnpm validate:adr-ids`.

T001 Mark ADR-0080 Accepted (WP01)
T002 Glossary terms (WP01)
T003 Changelog fragment (WP01)

**Risks**: Do not touch `docs/adr/README.md` or the Decision text.

### WP02 - Measures core, loader and shipped default catalog

**Prompt**: [tasks/WP02-measures-core-loader-default.md](./tasks/WP02-measures-core-loader-default.md) · **Priority**: P1 · **Dependencies**: none

**Goal**: One pure parser and resolver plus the effective-catalog loader that every surface shares.
**Independent test**: `measures-core.test.ts`, `measures-loader.test.ts`.

T004 Shipped default catalog (WP02)
T005 parseMeasuresCatalog and buildMeasuresIndex (WP02)
T006 normalise, resolve and problems (WP02)
T007 Loader (WP02)
T008 Core and loader tests (WP02)

**Risks**: Default path via `import.meta.url`; no Astro imports.

### WP03 - tom_classification field shape

**Prompt**: [tasks/WP03-field-shape-schema-and-gate.md](./tasks/WP03-field-shape-schema-and-gate.md) · **Priority**: P1 · **Dependencies**: none

**Goal**: The same shape in the build schema and the gate; types; case-variant warning.
**Independent test**: parity and shape tests.

T009 Types (WP03)
T010 Build schema field (WP03)
T011 Gate field and warning (WP03)
T012 Fixtures and tests (WP03)

**Risks**: `schema.ts` may also be touched by the #330 runner; keep the hunk additive.

## Phase 2: Surfaces (parallel after Phase 1)

### WP04 - Build-free catalog gate resolves measure ids

**Prompt**: [tasks/WP04-build-free-gate-parity.md](./tasks/WP04-build-free-gate-parity.md) · **Priority**: P1 · **Dependencies**: WP02

T013 Resolution in validate-catalog.mjs (WP04)
T014 Fixture roots (WP04)
T015 Gate tests (WP04)

### WP05 - classified-as edges and measure nodes in the content graph

**Prompt**: [tasks/WP05-content-graph-classified-as.md](./tasks/WP05-content-graph-classified-as.md) · **Priority**: P1 · **Dependencies**: WP02, WP03

T016 Graph types and context (WP05)
T017 classifiedEdges emitter (WP05)
T018 Route wiring (WP05)
T019 Graph tests (WP05)

### WP06 - Resolved tom_classification on the per-page agent record

**Prompt**: [tasks/WP06-agent-page-classification.md](./tasks/WP06-agent-page-classification.md) · **Priority**: P1 · **Dependencies**: WP02, WP03

T020 Payload type (WP06)
T021 Route (WP06)
T022 Tests (WP06)

### WP07 - Measures relation section in the OKF export

**Prompt**: [tasks/WP07-okf-measures-section.md](./tasks/WP07-okf-measures-section.md) · **Priority**: P2 · **Dependencies**: none (works from the edge contract)

T023 Section and line rendering (WP07)
T024 Fixture graph (WP07)
T025 Tests (WP07)

## Phase 3: Docs and end-to-end

### WP08 - Living docs

**Prompt**: [tasks/WP08-docs-contract-graph-guides.md](./tasks/WP08-docs-contract-graph-guides.md) · **Priority**: P2 · **Dependencies**: WP05, WP06, WP07

T026 Metadata model (WP08)
T027 Content-graph page (WP08)
T028 Consumer setup (WP08)
T029 Authoring guide (WP08)

### WP09 - Example pages and build-artifact assertions

**Prompt**: [tasks/WP09-example-pages-and-artifact-assertions.md](./tasks/WP09-example-pages-and-artifact-assertions.md) · **Priority**: P2 · **Dependencies**: WP05, WP06, WP07

T030 Organisation page (WP09)
T031 System page (WP09)
T032 Artifact assertions (WP09)

## Parallelisation

- WP01, WP02, WP03 and WP07 have no dependencies and can start together.
- WP04 starts after WP02; WP05 and WP06 after WP02 and WP03.
- WP08 and WP09 close the mission and run in parallel.

## MVP

WP02 + WP03 + WP05 give a working, build-fatal classification in the always-on content graph.
