# Implementation Plan: Sub-processor catalog

**Branch**: `kitty/mission-subprocessor-catalog-01M84X07` (lands on `feat/403-subprocessor-catalog`) | **Date**: 2026-11-23 | **Spec**: [spec.md](spec.md)
**Input**: Mission specification from `kitty-specs/subprocessor-catalog-01M84X07/spec.md`

> **Not legal advice.** The toolkit ships structure only. ⚖ marks items for counsel.

## Summary

The mission adds an optional `docs/_meta/subprocessors.yaml` catalog (issue #403,
epic #400).
- **Validation.** A pure, bare-Node core validates records and derives a dated
  change list. A bare-Node loader reads the file. The build-free gate
  (`validate-catalog.mjs`) and the build both import the same pair.
- **Integration.** A new file-gated Astro integration, `doc-kitty:subprocessors`,
  validates once at `astro:config:setup` and throws one aggregate error. When the
  file exists, it injects two prerendered routes: `/api/subprocessors.json` and
  `/subprocessors.xml`.
- **Index links.** Served-surface detection finds the two routes, and the agent
  index links them.
- **Records ADR.** ADR-0086 records the catalog.
- **Generated page.** The page follows ADR-0087 and is the last work package,
  blocked until PR #445 merges.

Planning decisions:

| Decision | Outcome | Decider |
|----------|---------|---------|
| DM `01M8545YJX3DY4G3DEYX81G49Y`: build failure point | Fail at `astro:config:setup` in a file-gated integration, with one aggregate error. Routes are injected only when the file exists. | Operator (relayed by the dispatcher) |
| Engineering alignment | Pure core plus a bare-Node loader. The caller passes in the bibliography and measures ids. ISO alpha-2 list embedded. RSS reuses `rss.ts` helpers. WP01–WP05, with WP05 gated on #445. | Operator (relayed by the dispatcher) |

## Technical Context

**Language/Version**: TypeScript 5 and ES-module JavaScript (`.mjs` with `// @ts-check`) on Node.js 24, inside the `@spec-kitty/doc-toolkit` package (`src/`).
**Primary Dependencies**: Astro and Starlight (existing integrations API: `injectRoute`, `updateConfig`), and `yaml` (already a dependency, used by `measures-loader.mjs`). No new dependencies.
**Storage**: Committed files only: `docs/_meta/subprocessors.yaml`, read at build and by the gate.
**Testing**: Vitest (`pnpm test`: toolkit tiers plus mcp), red-first per work package.
- Unit tests for the core and the loader.
- A parity test between the gate and the build core.
- A served-surfaces build test with a no-file and a file fixture.
- `assert-build-artifacts.mjs` checks on the example build.
**Target Platform**: The static site build (Astro `output: 'static'`; the routes are prerendered even under `output: 'server'`).
**Project Type**: single. A toolkit package with an example consumer site (`example/`).
**Performance Goals**: The gate validates 200 records in under 2 s (NFR-003). The integration adds a single `stat` when the file is absent.
**Constraints**:
- Byte-stable output: no build clock (NFR-001, C-005).
- Gate/build message parity (NFR-002).
- No default records (C-001).
- Existing reference shapes are reused (C-003).
- Committed data only (C-007).
**Scale/Scope**: Tens of records per site, with 200 as the test ceiling. There are 2 new routes, 1 new integration, 2 new library modules, 1 ADR, 1 guide section and 1 changelog fragment.

### Supply-chain check (DIRECTIVE_051)

No dependency is added, upgraded or removed. The ISO 3166-1 alpha-2 code list is
embedded as a static, reviewed constant (research R-03), not pulled from a
package. No adversarial supply-chain pass is needed.

## Charter Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Charter value | How the plan honours it | Status |
|---------------|-------------------------|--------|
| Structure: a predictable, browsable shape | The catalog follows the ADR-0018 `_meta/*.yaml` pattern. The page, when it lands, follows ADR-0087. | Pass |
| Maintainability: docs stay correct next to the code | One validation core is shared by the gate and the build, and a parity test pins it. Validation fails hard on dangling references. | Pass |
| Agent interoperability | `api/subprocessors.json` is linked from `api/index.json` through served-surface detection. | Pass |
| Flexibility | The catalog is optional and file-gated, and costs nothing when absent. A site-owned route at the same path wins, as for scenarios. | Pass |
| Authority paths: `docs/adr/` | ADR-0086 records the structural addition. Terms are checked against `docs/context/`. | Pass |

Post-design re-check: pass, with no violations, so Complexity Tracking is omitted.

## Project Structure

### Documentation (this mission)

```
kitty-specs/subprocessor-catalog-01M84X07/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── subprocessors-catalog.contract.md   # file format + validation messages
│   ├── subprocessors-api.contract.md       # api/subprocessors.json + index links
│   └── subprocessors-feed.contract.md      # subprocessors.xml
└── tasks.md             # /spec-kitty.tasks
```

### Source Code (repository root)

```
src/lib/
├── subprocessors-core.mjs          # NEW pure: parse/validate records, derive changes, ISO list
├── subprocessors-iso3166.mjs       # NEW static ISO 3166-1 alpha-2 constant
├── subprocessors-loader.mjs        # NEW bare-Node: read <docsRoot>/_meta/subprocessors.yaml
├── integrations/subprocessors.ts   # NEW file-gated integration (validate, inject 2 routes)
├── routes/subprocessors-api.ts     # NEW route factory: api/subprocessors.json
├── routes/subprocessors-feed.ts    # NEW route factory: subprocessors.xml (reuses rss helpers)
├── routes/subprocessors-*-injected.ts  # NEW injected entrypoints (package exports)
├── served-surfaces.ts              # +2 SURFACE_ROUTES entries
├── routes/agent-index.ts           # +2 conditional _links
├── contract.ts                     # +2 optional IndexLinks fields
└── config.ts                       # register the integration
src/scripts/validate-catalog.mjs    # + sub-processor catalog check per root
src/scripts/assert-build-artifacts.mjs  # + example-site assertions
src/tests/subprocessors-*.test.ts   # NEW unit, parity, loader, integration, build tests
src/package.json                    # + exports for the injected entrypoints
example/docs/_meta/subprocessors.yaml   # NEW fictional records
docs/adr/0086-subprocessor-catalog.md   # NEW ADR (Proposed)
docs/guides/authoring.md (or consumer-setup.md)  # + "Sub-processor catalog" section
docs/changelog/unreleased/403-subprocessor-catalog.md  # NEW fragment
```

**Structure Decision**: the changes extend the existing single-package layout and
mirror the measures-catalog modules (`measures-core.mjs`, `measures-loader.mjs`)
and the gherkin injected-route precedent (`integrations/gherkin.ts`).

## Implementation Concern Map

### IC-01 — Catalog contract, validation core and build-free gate

- **Purpose**: Define the file format in ADR-0086, and validate it identically in
  the gate and the build.
- **Relevant requirements**: FR-001 to FR-008, FR-014, NFR-002, NFR-003, NFR-005, C-002, C-003
- **Affected surfaces**: `docs/adr/0086-subprocessor-catalog.md`, ADR index, `src/lib/subprocessors-core.mjs`, `src/lib/subprocessors-iso3166.mjs`, `src/lib/subprocessors-loader.mjs`, `src/scripts/validate-catalog.mjs`
- **Sequencing/depends-on**: none
- **Risks**:
  - Citation resolution is re-implemented in `validate-catalog.mjs`, not shared. The core therefore takes the known bibliography/tool ids and the measures index as inputs, and each caller supplies them from its own loader. Parity is pinned on shared invalid fixtures.

### IC-02 — Integration, agent API and index links

- **Purpose**: Fail the build early on an invalid catalog, and serve the records
  and changes to agents only when the file exists.
- **Relevant requirements**: FR-009, FR-010, FR-012, FR-013, NFR-001
- **Affected surfaces**: `src/lib/integrations/subprocessors.ts`, `src/lib/routes/subprocessors-api.ts`, injected entrypoint, `served-surfaces.ts`, `routes/agent-index.ts`, `contract.ts`, `config.ts`, `src/package.json` exports
- **Sequencing/depends-on**: IC-01
- **Risks**:
  - The agent index contract (`version: "3"`) gains optional links only, which is additive. The MCP package must still pass.
  - A site-owned `src/pages/api/subprocessors.json.*` must suppress injection, as for scenarios.

### IC-03 — Change feed

- **Purpose**: Publish `subprocessors.xml`, with one RSS item per addition and
  removal, dated and byte-stable.
- **Relevant requirements**: FR-011, FR-013, NFR-001
- **Affected surfaces**: `src/lib/routes/subprocessors-feed.ts`, injected entrypoint, served surfaces, agent index link
- **Sequencing/depends-on**: IC-01, IC-02 (shares the integration)
- **Risks**:
  - `rss.ts` may stamp `lastBuildDate` from the clock. The feed must omit or derive it from the data (research R-04).
  - Base-aware absolute URLs, as in `findBaselessFeedUrls`.

### IC-04 — Example content, guide and changelog

- **Purpose**: Show and test the feature end to end, and document it with its ⚖ limits.
- **Relevant requirements**: FR-015, FR-016, C-001, C-002
- **Affected surfaces**: `example/docs/_meta/subprocessors.yaml`, `src/scripts/assert-build-artifacts.mjs`, `docs/guides/*`, `docs/changelog/unreleased/403-subprocessor-catalog.md`
- **Sequencing/depends-on**: IC-02, IC-03
- **Risks**:
  - The example records must be obviously fictional (`.example` domains, invented names).

### IC-05 — Generated list page (gated)

- **Purpose**: A generated page listing current and past sub-processors, stamped and drift-checked.
- **Relevant requirements**: FR-017
- **Affected surfaces**: to be fixed against ADR-0087 as merged: the generator script, the page under the example docs, and the `--check` gate.
- **Sequencing/depends-on**: IC-01; external: PR #445 merged to `main` (C-004)
- **Risks**:
  - The current-vs-past split needs a reference date. It must follow ADR-0087's masking rules (`at`), not the raw build clock.
