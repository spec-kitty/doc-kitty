# Mission Specification: One owner for DocKitty's internal process.env handoffs

**Mission Branch**: `chore/internal-env-owner`
**Created**: 2026-10-15
**Status**: Draft
**Input**: GitHub issue #167, grounded by a two-lens squad on `main` at a871405d.

## Intent Summary

The operator asked for this mission in semi-auto mode: proceed without an interview unless a decision is genuinely theirs. This summary stands in for the discovery interview.

- **Primary actor:** a DocKitty maintainer adding or changing a value that one Astro hook passes to another; secondarily a site author running more than one DocKitty config (or a test suite) in one process.
- **Trigger:** DocKitty passes five values between its own hooks through `process.env`. Each was added on its own, with its own name constant, its own clearing rule and its own test restore code.
- **Desired outcome:** one module names all five values and owns their lifecycle. Every value is cleared when a config is defined, so no value can leak from one config into the next. One test helper restores all of them.
- **Rule that must always hold:** the built site is byte-identical to today's. Adopter-facing settings are untouched.
- **Known defect:** the resolved draft-publication value is never cleared. A second config or test in the same process inherits the first one's draft setting.

## Domain Language

| Term | Meaning | Avoid |
|---|---|---|
| internal handoff | A `process.env` value that DocKitty sets and DocKitty reads; adopters never set it | "internal setting", "private env" |
| adopter setting | A `process.env` value a site author or CI sets for DocKitty to read (`DK_PUBLISH_DRAFTS`, `DK_DIAGRAM_BUILD_RENDER`, `CI`, the PlantUML server URL) | — |
| define time | The moment `defineDocKittyIntegrations` runs for one config | "init" |
| setup time | Astro's `astro:config:setup` hook of one DocKitty integration | — |

The five internal handoffs: `DK_INDEX_BASENAME`, `DK_GHERKIN_RESULTS`, `DK_GHERKIN_ROUTE`, `DK_PUBLISH_DRAFTS_RESOLVED`, `DK_DOCS_ROOT`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A second config does not inherit the first one's values (Priority: P1)

A test suite (or a site author with two configs in one process) defines a DocKitty config that publishes drafts, then defines a second config with default settings. Today the second config's pages can still see "drafts published", because the resolved draft value from the first config was never cleared.

**Why this priority**: this is the one live defect, and it is the failure #167 warns about.

**Independent Test**: define two configs in one process with different draft settings; the second config's resolution matches its own setting, and every internal handoff the second config does not publish is absent.

**Acceptance Scenarios**:

1. **Given** a first config ran its draft-publication setup with drafts on, **When** a second config is defined, **Then** the resolved draft value is absent until the second config's own setup publishes it.
2. **Given** any internal handoff was set by a previous config, **When** a new config is defined, **Then** that handoff holds the new config's value or is absent.

### User Story 2 - A maintainer adds a handoff in one place (Priority: P2)

A maintainer needs a new value to cross from a hook into the content config. They add one entry to the owner module. Its clearing at define time and its restoring in tests follow without further edits.

**Why this priority**: it stops the pattern from spreading.

**Independent Test**: the test restore helper and the define-time clear both read the owner's list, so a test adding a name to the list sees it cleared and restored.

**Acceptance Scenarios**:

1. **Given** the owner module's list of internal handoffs, **When** a config is defined, **Then** every listed name is cleared before any is published.
2. **Given** a test that sets internal handoffs, **When** it finishes, **Then** the shared helper restores every listed name to its value before the test.

### User Story 3 - A site author knows not to set these (Priority: P3)

A site author reads the consumer setup guide and learns which `DK_*` values they may set and which DocKitty sets for itself.

**Independent Test**: the guide lists the five internal handoffs and says DocKitty sets them and they must not be set by hand.

### Edge Cases

- The hand-mounted scenario route and the resolved draft value are published at setup time, not define time. Clearing at define time must not wipe them: setup runs after define for the same config.
- Content-collection config and routes run in Vite's separate module graph. Only `process.env` crosses into it, so readers must keep reading `process.env` at call time; module-level state would arrive empty.
- `site-index-names.mjs` runs as plain Node and spawns a child process with the index-name value removed from its environment; the owner module must be importable there.
- An adopter who sets `DK_DOCS_ROOT` by hand today is overwritten at define time; that stays so.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Status | Delivery | No-op passable? |
|---|---|---|---|---|
| FR-001 | One dependency-free module names all five internal handoffs and exports the list; every other module takes the names from it (existing constant exports remain as re-exports). No second definition of any of the five names exists in `src/`. | Proposed | [build] | no — today `DK_DOCS_ROOT` is defined twice and four modules define names |
| FR-002 | Defining a DocKitty config clears every listed internal handoff before publishing any define-time value (so the clear precedes the `DK_INDEX_BASENAME` write, and a child process can still read "absent" as "the config never published"). | Proposed | [build] | no — today `DK_PUBLISH_DRAFTS_RESOLVED` survives into the next config |
| FR-003 | Values published at setup time (`DK_GHERKIN_ROUTE`, `DK_PUBLISH_DRAFTS_RESOLVED`) are written and removed through the owner module, and survive the define-time clear of their own config. | Proposed | [build] for the draft value; [ratchet] for the route (already cleared at define and set at setup today) | yes for the route; no for the draft value — one test defines, runs setup, defines again and asserts (merged with SC-001) |
| FR-004 | Readers keep reading `process.env` at call time; the owner holds no module-level copy of any value. | Proposed | [ratchet] | yes — pinned by the existing schema and route tests passing unchanged; positive control: FR-003's present-after-setup assertion |
| FR-005 | One test helper saves and restores every listed internal handoff around a test, and every suite that sets or deletes one of them uses it instead of ad-hoc code. | Proposed | [build] | no — today three restore patterns exist across about 14 suites |
| FR-006 | The consumer setup guide lists the five internal handoffs and states that DocKitty sets them and they must not be set by hand. | Proposed | [build] | no |
| FR-007 | A short ADR records the seam (names, the two write times, clear on define, no module state, never set by hand); ADR-0050, ADR-0055 and ADR-0056 point to it without changing their decisions. | Proposed | [build] | no |
| FR-008 | The CHANGELOG `[Unreleased]` section records the stale draft value fix for site authors. | Proposed | [build] | no |

### Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|---|---|---|---|
| NFR-001 | Built example site output | `diff -r` of the example `dist/` on `main` vs the branch reports 0 differences | Proposed |
| NFR-002 | Existing test assertions | 0 assertions changed; only restore plumbing changes in existing suites | Proposed |
| NFR-003 | Owner module cost | no I/O and no child-process spawn in the owner module | Proposed |
| NFR-004 | Owner module portability | `node --check` passes; the owner imports no module, and the modules that defined names before import from the owner (never the reverse) | Proposed |

### Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | Adopter settings (`DK_PUBLISH_DRAFTS`, `DK_DIAGRAM_BUILD_RENDER`, `CI`, the PlantUML server URL) and their resolution order are untouched. | Active |
| C-002 | `process.env` stays the transport; no module state, no new mechanism. | Active |
| C-003 | The hand-set guard is not generalised: only `DK_INDEX_BASENAME` keeps its format check, since the other values are free strings. | Active |
| C-004 | Test economy (DIRECTIVE_041): prefer strengthening an existing test; at most one new focused test per behaviour. SC-001 and FR-003 share one test (define, setup, define again, assert); User Story 2 needs no test of its own beyond FR-005's helper. | Active |

## Success Criteria *(mandatory)*

- SC-001: A second config defined in the same process never sees an internal handoff value from an earlier config. — [build] · no-op passable: no
- SC-002: Adding a sixth internal handoff takes one edit to the owner list for clearing and test restore to cover it. — [build] · no-op passable: no
- SC-003: Site authors see no difference in their built sites (0 changed files in the example build). — [ratchet] · no-op passable: yes (positive control: SC-001's two-config test is red on `main`)

## Assumptions

- `DK_DOCS_ROOT` is internal in practice: DocKitty overwrites it on every config and no adopter doc mentions it. Clearing it and then publishing it again behaves the same as today.
- Each config's define and its setup hooks run as a pair: two configs' defines do not interleave with each other's setup hooks (define A, define B, setup A is out of scope).
- Production builds define one config per process; the stale value shows up only in tests and multi-config processes. The CHANGELOG says so.

## Out of Scope

- Replacing `process.env` as the transport.
- Changing adopter settings or how DocKitty resolves them.
- Format checks for hand-set values other than `DK_INDEX_BASENAME`.
