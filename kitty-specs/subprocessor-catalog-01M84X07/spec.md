# Mission Specification: Sub-processor catalog

**Mission Branch**: `kitty/mission-subprocessor-catalog-01M84X07` (lands on `feat/403-subprocessor-catalog`)
**Created**: 2026-11-23
**Status**: Draft
**Input**: Issue #403 (epic #400): an optional `_meta/subprocessors.yaml` sub-processor catalog, validation, a generated list page, a change feed, an agent API (`api/subprocessors.json`), a `tom_classification` link, docs and tests.

> **Not legal advice.** The toolkit provides structure only. The facts about each
> sub-processor, and the terms under which sub-processors are authorised, are the
> consuming site's own content, and the contract governs. Items marked **⚖** await
> review by data-protection counsel.

## Intent Summary (confirmed by the operator, 2026-11-23)

- **Actor and trigger.** A site maintainer adds, changes or ends a sub-processor by
  editing the optional catalog file `docs/_meta/subprocessors.yaml`.
- **Readers.** Controllers and customers follow a change feed. Agents read a
  machine-readable export.
- **Outcome.** The build validates the catalog and publishes an agent export with
  the records and their changes, plus an RSS change feed with one item for each
  addition and each removal.
- **Advance notice.** A maintainer gives advance notice by dating an addition or
  removal in the future. Outputs carry dates, never a status computed from the build
  date.
- **No file, no output.** A site without the catalog gets no new outputs and no
  errors.
- **Sequencing.** The generated human-readable list page (FR-017) is deferred to
  follow-up #461 (operator ruling, option B, 2026-11-25). It follows ADR-0087,
  whose `source_digest` and D3 machinery arrives with #455, and reuses it.

Decisions recorded in this mission:

| Decision | Outcome | Decider |
|----------|---------|---------|
| DM `01M84X0K4K462YEMYV9RHB5T96`: generated-page sequencing | Final WP, gated on #359 / ADR-0087 (PR #445) merging. Later split out: deferred to follow-up #461, gated on #455 (operator ruling, option B, 2026-11-25) | Operator |
| DM `01M8535645HETHAQ432516SAAY`: change-feed shape | Dedicated RSS feed + JSON `changes`, derived from `since`/`until` only | Operator |
| DM `01M853NP2MPP7HNWKMX9K8Y2ST`: `location` typing | Non-empty list of ISO 3166-1 alpha-2 codes + optional `location_note` | Operator |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep a validated sub-processor list (Priority: P1)

A site maintainer records each sub-processor in one catalog file. The build-free
gate and the build both reject a malformed record and name the record and field
at fault, so the list cannot silently drift into an invalid state.

**Why this priority**: Everything else (export, feed, page) reads this file. An
unchecked list is the problem issue #403 describes.

**Independent Test**: Run the build-free catalog gate against a fixture docs root.
A valid catalog passes. Each invalid fixture fails with a message naming the
record id and the field.

**Acceptance Scenarios**:

1. **Given** a catalog with two complete records, **When** the build-free gate
   runs, **Then** it passes and reports two sub-processor records.
2. **Given** a catalog where two records share an id, **When** the gate or the
   build runs, **Then** both fail and name the duplicate id.
3. **Given** a record whose `until` is before its `since`, **When** the gate runs,
   **Then** it fails and names the record.
4. **Given** a record whose `location` contains `XX` (not an ISO 3166-1 alpha-2
   code) or is empty, **When** the gate runs, **Then** it fails and names the record.
5. **Given** a record whose `tom_classification` names a measure missing from the
   effective measures catalog, **When** the gate runs, **Then** it fails with the
   same message the build gives.
6. **Given** a record whose `external_references` cites a bibliography id that
   does not exist, **When** the gate runs, **Then** it fails and names the id.

---

### User Story 2 - Agents read the sub-processor list (Priority: P1)

An agent or integration discovers the sub-processor export from the agent index
and reads every record and every dated change, without scraping prose.

**Why this priority**: Issue #403 names the agent API as a deliverable. It is also
the machine source the feed and the later page are checked against.

**Independent Test**: Build the example site. Its agent index links the export,
and the export lists the example records and their changes in a stable order.

**Acceptance Scenarios**:

1. **Given** a site with a valid catalog, **When** it is built, **Then**
   `api/subprocessors.json` exists, holds every record, and holds a `changes`
   list with one `added` entry per record and one `removed` entry per record with
   `until`.
2. **Given** the same site, **When** it is built, **Then** `api/index.json` links
   the export and the change feed.
3. **Given** a record with a `tom_classification`, **When** it is exported, **Then**
   the export carries the measure ids so a TOM annex export can reference the
   provider's evidence.

---

### User Story 3 - Follow changes through a feed (Priority: P2)

A controller subscribes to the site's sub-processor feed and sees an item when a
sub-processor is added or removed, including changes dated in the future that
announce what is coming.

**Why this priority**: General written authorisation requires notice of changes
in advance. ⚖ Counsel decides whether a feed satisfies a given contract's notice
terms. The toolkit only provides the channel.

**Independent Test**: Build the example site. `subprocessors.xml` holds one item
per addition and per removal, including a future-dated one, each with its date.

**Acceptance Scenarios**:

1. **Given** a record with `since: 2027-03-01` (after the build date), **When** the
   site is built, **Then** the feed carries an "added" item dated 2027-03-01.
2. **Given** a record with `since` and `until`, **When** the site is built, **Then**
   the feed carries an "added" item and a "removed" item, each with its own date.
3. **Given** the same catalog, **When** the site is built twice on different days,
   **Then** the feed and the export are byte-identical.

---

### User Story 4 - Sites without a catalog are unaffected (Priority: P1)

A site that never authors the catalog gets no new outputs, no new warnings and no
errors.

**Why this priority**: The catalog is optional. Most consumers will never use it.

**Independent Test**: Build a fixture site without the file. There is no export,
no index link and no feed, and the build passes. Build the same fixture with the
file added. All three appear (positive control).

**Acceptance Scenarios**:

1. **Given** a site without `_meta/subprocessors.yaml`, **When** it is built,
   **Then** neither `api/subprocessors.json` nor `subprocessors.xml` exists, the
   agent index has no sub-processor link, and the build exits successfully.

---

### User Story 5 - A generated list page (Priority: P3, deferred to #461)

A reader opens a sub-processor page that lists current sub-processors and,
separately, past ones. The page is generated from the catalog and stamped, and a
drift check catches a stale or hand-edited copy.

**Why this priority**: It needs the generated-section contract (ADR-0087). The
ADR merged with PR #445, but its `source_digest` and D3 machinery arrives with
#455, so the story is deferred to follow-up #461 (operator ruling, option B). All
other stories ship without it.

**Independent Test**: Generate the page from the example catalog. It carries the
ADR-0087 stamp, lists current and past records separately, and the drift check
fails after the catalog changes until the page is regenerated.

**Acceptance Scenarios**:

1. **Given** the example catalog, **When** the page is generated, **Then** it lists
   current and past sub-processors in separate sections and carries a generated
   stamp per ADR-0087.
2. **Given** a generated page, **When** a record is edited without regenerating,
   **Then** the drift check fails.

### Edge Cases

- **Empty catalog file.** A file that holds an empty list is valid. It produces an
  export with no records and an empty feed. A file whose content is not a list is
  an error.
- **Unknown field on a record.** It is an error, naming the field, so a typo such
  as `untill` cannot silently drop a removal date.
- **Same-day changes.** Two changes on the same date are ordered by sub-processor
  id, then by kind (added before removed), so the order is stable.
- **`until` equal to `since`.** This is allowed: a one-day engagement still
  produces both items.
- **Measures catalog replaced by the consumer.** `tom_classification` resolves
  against the effective catalog (consumer file, else the shipped default), as for
  pages.
- **Lower-case country code** such as `de`. It is an error naming the expected
  upper-case form, not silently accepted.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Optional catalog file | As a site maintainer, I want to list my sub-processors in an optional `docs/_meta/subprocessors.yaml` that follows the ADR-0018 catalog pattern, so that the list lives in one checked place. | High | Open | [build] | no |
| FR-002 | Record field set ⚖ | As a site maintainer, I want each record to hold `id`, `name`, `processing`, `location` and `responsibilities` (required), `since` (required date), and optionally `address`, `contact`, `until`, `location_note`, `external_references` and `tom_classification`, with unknown fields rejected, so that records are complete and typos are caught. | High | Open | [build] | no |
| FR-003 | Unique ids | As a site maintainer, I want a duplicate record id to fail validation, naming the id, so that each sub-processor is addressable. | High | Open | [build] | no — paired with the valid two-record fixture |
| FR-004 | Date rules | As a site maintainer, I want `since` and `until` to be calendar dates and `until` never before `since`, so that the change history is coherent. | High | Open | [build] | no |
| FR-005 | Typed location | As a site maintainer, I want `location` to be a non-empty list of upper-case ISO 3166-1 alpha-2 codes, with an optional free-text `location_note`, so that locations are machine-checkable. | High | Open | [build] | no |
| FR-006 | References resolve | As a site maintainer, I want each `external_references` entry, in the existing page shape (inline, or `{type: biblio | tool, id}`), to resolve against the bibliography or tools catalog, so that citations do not dangle. | High | Open | [build] | no |
| FR-007 | Measures link | As a compliance author, I want a record's `tom_classification`, in the ADR-0080 page-field shape, to resolve against the effective measures catalog, so that a TOM annex export can reference a provider's physical-security and assurance evidence. | High | Open | [build] | no |
| FR-008 | One validation, two gates | As a maintainer, I want the build-free gate (`validate-catalog.mjs`) and the build to apply the same checks with the same messages, so that a passing gate predicts a passing build. | High | Open | [build] | no — parity asserted on shared invalid fixtures |
| FR-009 | Agent export | As an agent, I want `api/subprocessors.json` to hold every record and a `changes` list (one `added` entry per `since`, one `removed` entry per `until`), so that I can read the list and its history without scraping prose. | High | Open | [build] | no |
| FR-010 | Discoverable from the index | As an agent, I want `api/index.json` to link the export and the change feed when the catalog exists, so that I can find them. | High | Open | [build] | no |
| FR-011 | Change feed | As a controller, I want an RSS feed `subprocessors.xml` with one item per addition and per removal, each dated with its `since` or `until`, so that I am told about changes, including future-dated ones. | High | Open | [build] | no |
| FR-012 | No file, no output | As a site maintainer without a catalog, I want no export, no index link, no feed and no error, so that the feature costs me nothing. | High | Open | [build] | yes — paired with the same fixture plus the file, which must yield all three outputs |
| FR-013 | Stable output | As a maintainer, I want the export and the feed to depend only on the catalog's content, never on the build time, so that builds stay byte-stable. | High | Open | [build] | no — two builds with different clocks compared |
| FR-014 | Architecture decision | As a maintainer, I want an ADR (ADR-0086) that records the catalog, its field set, the feed and the sequencing, so that the design is reviewable and the ⚖ items are tracked. | Medium | Open | [build] | no |
| FR-015 | Example content | As a toolkit user, I want the example site to carry clearly fictional records covering a current, a past and a future-dated sub-processor, so that the outputs can be seen and tested. | Medium | Open | [build] | no |
| FR-016 | Guide and changelog | As a toolkit user, I want a guide section that explains the catalog, the outputs and the ⚖ limits, plus a changelog fragment, so that I can adopt the feature correctly. | Medium | Open | [build] | no |
| FR-017 | Generated list page | As a reader, I want a generated page that lists current and past sub-processors separately, stamped and drift-checked per ADR-0087, so that the human-readable list cannot fall out of date. Deferred to follow-up #461, gated on #455. | Low | Deferred (#461) | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte-stable outputs | Two builds of the same catalog with system clocks at least one day apart produce byte-identical `api/subprocessors.json` and `subprocessors.xml` (0 differing bytes). | Reliability | High | Open |
| NFR-002 | Gate parity | For every invalid fixture in the test suite (at least 8 cases), the build-free gate and the build report the identical message text. | Maintainability | High | Open |
| NFR-003 | Gate speed | The build-free gate validates a 200-record catalog in under 2 seconds on CI hardware. | Performance | Medium | Open |
| NFR-004 | Test suite | The full `pnpm test` (both tiers and mcp) passes at every hand-off, with 0 skipped or newly quarantined tests. | Quality | High | Open |
| NFR-005 | Actionable errors | 100% of validation failures name the catalog file, the record id (or index when the id is missing) and the field. | Usability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Structure only | The toolkit ships no default sub-processor records. Only the example site carries records, and they are clearly fictional. | Regulatory | High | Open |
| C-002 | Counsel review ⚖ | The field set and the "feed as notice" use are marked ⚖ in the ADR and the guide, and are not described as DPA-ready. | Regulatory | High | Open |
| C-003 | Reuse existing shapes | `external_references` and `tom_classification` use the existing page shapes and resolvers. No new reference shape is introduced. | Technical | High | Open |
| C-004 | Page gated | FR-017 is deferred to follow-up #461, which starts only after #455 (the ADR-0087 `source_digest` and D3 machinery) has merged to `main`. No other requirement depends on it. | Technical | High | Deferred (#461) |
| C-005 | No build clock | No output may depend on the build date. "Current" vs "upcoming" is left to the reader of the dates, except on the deferred page (FR-017, #461), which follows ADR-0087's masking rules. | Technical | High | Open |
| C-006 | Out of scope | No transfer-mechanism field, no derivation from changelog fragments, and no merging with an organisation-wide catalog. Each becomes a follow-up issue. | Business | Medium | Open |
| C-007 | Committed data only | The build reads committed data files only, consistent with ADR-0087 D6. | Technical | Medium | Open |

### Key Entities

- **Sub-processor record**: one third party that processes personal data on the
  site owner's behalf. Identified by a stable `id`. Carries its name, optional
  address and contact, a description of the processing, the countries where it
  processes (`location`), the division of responsibilities, and the dates it
  started (`since`) and optionally ended (`until`). May cite sources and the
  measures it evidences.
- **Change entry**: a dated event derived from a record, either `added` (on
  `since`) or `removed` (on `until`). It carries the record id and the date.
- **Measure**: an entry of the measures catalog (ADR-0080), referenced by id.
- **Bibliography source**: an entry of the bibliography catalog (ADR-0018),
  referenced by id.

## Domain Language

| Canonical term | Meaning | Avoid |
|----------------|---------|-------|
| sub-processor | another processor that the site owner, acting as a processor, engages for specific processing on a controller's behalf (GDPR Art. 28(2), 28(4)) | vendor, supplier, third party (too broad) |
| catalog | the `_meta/subprocessors.yaml` file and its records (ADR-0018 pattern) | registry (that is the ADR-0083 producer registry) |
| change feed | the RSS feed of dated additions and removals | notice (the legal notice is a contract matter ⚖) |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every invalid record shape listed in User Story 1 is rejected by both the build-free gate and the build, with a message naming the record and field (6 of 6 scenarios). — [build] · no-op passable: no
- **SC-002**: A site with a catalog exposes its sub-processor list and its full change history to agents from one link in the agent index. — [build] · no-op passable: no
- **SC-003**: A future-dated addition or removal appears in the change feed on the same build that introduces it. — [build] · no-op passable: no
- **SC-004**: A site without a catalog produces exactly the same output files as before this mission (0 added, 0 changed). — [build] · no-op passable: yes — paired with the same fixture plus the file
- **SC-005**: Two builds of the same catalog on different days produce identical export and feed files. — [build] · no-op passable: no

## Assumptions

- The RSS conventions of the site's existing `rss.xml` (base-aware absolute URLs,
  a `pubDate` per item) apply to `subprocessors.xml`.
- The feed is site-wide, not tied to a section. The section `feeds` setting does
  not gate it, because the catalog belongs to no section until the page (FR-017)
  exists.
- ADR numbering: 0085 belongs to #402 and 0087 to #359, so this mission's ADR is
  ADR-0086 (allocated by the dispatcher).

## Dependencies

- ADR-0080 (Accepted 2026-11-21): the `tom_classification` shape and the measures
  catalog.
- ADR-0018: the catalog pattern and the bibliography catalog.
- ADR-0087 (Accepted 2026-11-23, PR #445, merged to `main` 2026-11-24): FR-017 only.
