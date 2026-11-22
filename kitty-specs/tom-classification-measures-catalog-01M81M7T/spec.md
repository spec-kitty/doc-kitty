# Mission Specification: TOM classification and measures catalog

**Mission Branch**: `feat/406-tom-classification`
**Created**: 2026-11-22
**Status**: Draft
**Input**: Issue #406 (gate of epic #400). It accepts and implements ADR-0080. Operator ruling of 2026-11-21: ADR-0080 is accepted now, and counsel's two ⚖ questions do not block the work (ruling D1). Research: `docs/architecture/research/eu-dpa-compatibility.md`.

> **Not legal advice.** This mission builds structure and metadata. It ships no legal or policy text. The default catalog holds short labels for headings named in public legislation.

## Purpose

A processor that signs an EU data processing agreement (DPA) describes its technical and organisational measures (TOMs). DocKitty already holds the evidence for most of them: architecture, security, operations and configuration pages, with review metadata. What it lacks is a way for a page to say which measure it evidences, so the evidence cannot be gathered, checked for gaps or exported.

This mission adds that classification as page metadata, checks it against a measures catalog, and carries it into the machine surfaces agents read. A docs tree that never uses the field must not change.

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| Measure | One technical, organisational, legal or physical safeguard, identified by a stable id in the measures catalog | "control" (ISO wording), "TOM" for a single measure |
| TOM classification | A page's list of the measures it provides evidence for, with an optional scope and note per entry | "TOM tag", "TOM category", `TOM_classification` |
| Measures catalog | The list of known measures for a docs tree: the consumer's file when present, else the shipped default | "measure registry", "TOM list" |
| Scope | Whether a classification entry describes this system (`system`, the default) or the whole organisation (`organisation`) | "level", American spelling |
| Nature | The measure's group, after DPV: `technical`, `organisational`, `legal` or `physical`. It lives on the catalog entry, never on the page | "type" (that is the section axis) |
| Classified-as edge | The content-graph relation from a page to a measure it evidences | "tagged", "cites" |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An author classifies a page (Priority: P1)

A security engineer writes a page about TLS termination. They add `tom_classification: [transmission-protection]` to its frontmatter. The site builds, and the page's machine record lists the measure with its label and nature.

**Why this priority**: Without the field nothing else in epic #400 can start.

**Independent Test**: Build a fixture docs tree with one classified page and read its per-page agent record.

**Acceptance Scenarios**:

1. **Given** a page with `tom_classification: [transmission-protection]`, **When** the site builds, **Then** the build succeeds and the page's per-page agent record lists `transmission-protection` with its catalog label, nature and scope `system`.
2. **Given** an entry `{ measure: events-logging, scope: system, note: "Every admin action is logged." }`, **When** the site builds, **Then** the note and scope appear on that entry in the agent record.
3. **Given** a page with no `tom_classification`, **When** the site builds, **Then** its agent record and graph node are byte-identical to before this mission.

---

### User Story 2 - A typo fails the build (Priority: P1)

An author writes `transmision-protection`. The build stops with a message that names the page and the unknown id. The same check runs in the build-free catalog gate, so CI catches it without a site build.

**Why this priority**: ADR-0080 decision 2 makes a measure id a closed reference.

**Independent Test**: Run the build and the catalog gate on a fixture with one misspelled id.

**Acceptance Scenarios**:

1. **Given** a page with an id that is not in the effective catalog, **When** the site builds, **Then** the build fails and the message names the page and the id.
2. **Given** the same tree, **When** the build-free catalog gate runs, **Then** it exits non-zero and reports the same page and id.
3. **Given** an entry with a `scope` other than `system` or `organisation`, or with neither a bare id nor a `measure` key, **When** the page is validated, **Then** it is rejected.

---

### User Story 3 - An agent gathers TOM evidence (Priority: P1)

An agent reads the content graph and the OKF bundle. Each classified page has a `classified-as` edge to a measure record, which carries the label, nature and DPV concept. The agent groups pages by measure without parsing prose.

**Independent Test**: Build the example site and inspect `api/content-graph.json` and the OKF bundle for the classified pages.

**Acceptance Scenarios**:

1. **Given** a published page classified as `events-logging`, **When** the content graph is built, **Then** it holds one measure node for `events-logging` and one `classified-as` edge from the page to it, carrying the entry's note and scope.
2. **Given** the same build, **When** the OKF bundle is exported, **Then** that page's concept document lists the measure under its own relation section.
3. **Given** a draft page with a classification, **When** the graph is built, **Then** no edge or node for it appears, exactly as for its other relations.

---

### User Story 4 - A consumer uses its own catalog (Priority: P2)

A company that works to ISO/IEC 27001 writes its own `docs/_meta/measures.yaml` with its own ids. That file replaces the shipped default entirely. A shipped id it did not copy is now unknown.

**Independent Test**: A fixture with a consumer catalog builds pages that use its ids and fails a page that uses a shipped-only id.

**Acceptance Scenarios**:

1. **Given** a consumer catalog with id `a-5-15-access-control`, **When** a page uses that id, **Then** the build succeeds.
2. **Given** the same consumer catalog, **When** a page uses the shipped id `transmission-protection` that the consumer file lacks, **Then** the build fails naming the page and the id.
3. **Given** no consumer catalog, **When** a page uses a shipped id, **Then** it resolves against the shipped default.

---

### User Story 5 - Organisation measures are written once (Priority: P2)

A team documents its incident process once, on an organisation page with entries of `scope: organisation`. Product pages that rely on it point to it through `related` instead of restating it. The scope is visible in the machine surfaces, so a later export can list the measure once, as inherited.

**Independent Test**: The example docs carry one organisation page and one system page that links to it; the graph shows the organisation scope on the first page's edge and a `related` edge from the second.

**Acceptance Scenarios**:

1. **Given** an organisation page with `{ measure: accountability, scope: organisation }`, **When** the graph is built, **Then** its `classified-as` edge carries scope `organisation`.
2. **Given** a system page that lists the organisation page in `related`, **When** the graph is built, **Then** it has a `related` edge to that page and no copied classification.

### Edge Cases

- A page lists the same measure twice: the build keeps one edge, as the graph does for every other duplicate relation.
- A page lists the same measure twice with different scopes: this is an author error, and the gates report it.
- The consumer catalog is present but empty: every classified page fails, because no id resolves. A page without the field still builds.
- The consumer catalog has a duplicate id, a missing `label`, or an unknown `nature`: the catalog itself is rejected, naming the file and the record.
- `TOM_classification` or another case variant on a page: it is not the field, and the build ignores it like any undeclared key. The frontmatter gate warns and names the lowercase key (FR-014).
- A site does not mount the per-page agent route: the content graph, which every site serves, still fails the build on an unknown id.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Status | Delivery | No-op passable? |
|----|-------------|--------|----------|-----------------|
| FR-001 | ADR-0080 is marked Accepted in its frontmatter and its Status section; its index row is left for the post-merge bot. | Proposed | [build] | no |
| FR-002 | Pages accept an optional `tom_classification` list whose entries are a bare measure id or `{ measure, scope?, note? }`, with `scope` one of `system` (default) or `organisation`. Any other shape fails validation, in the build schema and the frontmatter gate alike. | Proposed | [build] | no |
| FR-003 | DocKitty ships a default measures catalog: the 17 example headings of Decision (EU) 2021/914 Annex II, with GDPR Article 32(1)(a)–(d) carried as a second framework reference on headings 1–4. Each entry has an id, label, nature, framework references and a DPV concept IRI. | Proposed | [build] | no |
| FR-004 | When `<docsRoot>/_meta/measures.yaml` exists it replaces the shipped default wholesale; when it is absent the default applies. No consumer configuration change is needed for either. | Proposed | [build] | no |
| FR-005 | A measure id that is not in the effective catalog fails the build. The message names the page and the id. | Proposed | [build] | no |
| FR-006 | The build-free catalog gate runs the same resolution as the build and reports the same page and id, and also rejects a malformed catalog (duplicate id, missing required field, unknown nature). | Proposed | [build] | no |
| FR-007 | The content graph gains a `classified-as` edge from each published classified page to a measure node. The node carries the label, nature and DPV IRI; the edge carries the entry's note and scope. | Proposed | [build] | no |
| FR-008 | The per-page agent record lists the page's classification, each entry resolved to measure id, label, nature, scope and optional note. | Proposed | [build] | no |
| FR-009 | The OKF export renders a page's measures as a relation section in its concept document, read from the graph's `classified-as` edges. | Proposed | [build] | no |
| FR-010 | A page without `tom_classification` produces byte-identical machine surfaces to the pre-mission build. | Proposed | [ratchet] | yes — positive control: FR-007 on the same fixture |
| FR-011 | The docs describe the field in the metadata contract, the catalog in the configuration reference, the organisation link-not-copy pattern in a guide, and add the glossary terms "Measure" and "TOM classification". | Proposed | [build] | no |
| FR-012 | The example docs tree carries one organisation-scope page and one system page that links to it, so the example build exercises FR-007 to FR-009. | Proposed | [build] | no |
| FR-013 | A changelog fragment records the user-visible change. | Proposed | [build] | no |
| FR-014 | The frontmatter gate warns on a case variant of the key (such as `TOM_classification`) and names `tom_classification`; it is a warning, never a failure. | Proposed | [build] | no |

### Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|----|-------------|-----------|--------|
| NFR-001 | Deterministic output | Two builds of the same tree give byte-identical graph, agent records and OKF files; measure nodes and edges sort by code unit like the rest of the graph | Proposed |
| NFR-002 | Gate parity | For every fixture in the catalog parity suite, the build verdict and the build-free gate verdict agree (100%) | Proposed |
| NFR-003 | Quality gates | Lint, typecheck, unit tests and the example build and e2e gates pass with zero new suppressions | Proposed |
| NFR-004 | Cost to non-users | A tree that never uses the field reads no extra file beyond one existence check of `_meta/measures.yaml` per build surface | Proposed |

### Constraints

| ID | Constraint | Status |
|----|------------|--------|
| C-001 | Lowercase `tom_classification` only; no uppercase alias (ADR-0080 decision 1, option D). | Active |
| C-002 | Consumer catalog replaces, never merges (ADR-0080 decision 4). A merge mechanism is a follow-up. | Active |
| C-003 | No generated TOM annex, templates, sub-processor catalog or shared organisation bundle: those are ADR-0080 follow-ups (#401–#404). | Active |
| C-004 | No ADR number is claimed; the mission accepts the existing ADR-0080. | Active |
| C-005 | No legal or policy text beyond short labels taken from public legislation. | Active |
| C-006 | The ADR index table is not edited by hand (AGENTS.md). | Active |

## Success Criteria *(mandatory)*

- SC-001: An author classifies a page with one frontmatter line and sees the measure in the page's machine record on the next build. — [build] · no-op passable: no
- SC-002: 100% of misspelled measure ids in the fixture suite stop the build and the build-free gate, each naming the page and the id. — [build] · no-op passable: no
- SC-003: An agent finds every classified page for a given measure from the content graph alone, with no prose parsing. — [build] · no-op passable: no
- SC-004: A consumer swaps the whole catalog by adding one file, with no configuration change. — [build] · no-op passable: no
- SC-005: Sites that do not use the field see zero changed bytes in their machine surfaces. — [ratchet] · no-op passable: yes (paired with SC-003 on the same fixture)

## Key Entities

- **Classification entry**: `measure` (id), `scope` (`system` | `organisation`, default `system`), `note` (optional string).
- **Measure record**: `id`, `label`, `nature` (`technical` | `organisational` | `legal` | `physical`), `frameworks` (list of `{ framework, ref }`), `dpv` (optional IRI).
- **Measure node** (graph): one per measure that at least one published page uses.
- **Classified-as edge** (graph): page → measure node, with optional `note` and `scope`.

## Assumptions

- Headings 1–4 of 2021/914 Annex II restate GDPR Article 32(1)(a)–(d), so the default holds 17 records, with the four Article 32(1) items as a second framework reference. This meets ADR-0080 decision 3 without duplicate measures.
- Each DPV IRI names the nearest DPV 2.3 concept. It is a pointer for linked-data tools, not a legal equivalence. Some headings (accountability, data minimisation, portability) have no exact DPV class, so the nearest broader concept is used.
- The catalog is read from disk by the toolkit, with no new content collection, so the "absent file means default" rule needs no consumer wiring (decision DM-01M81M98JR2GQJ03SNS8MPVRTK).
- The graph schema stays `dockitty.content-graph/1`: a new relation and optional edge fields are additive.

## Open Questions (non-blocking, operator ruling D1)

These belong to data-protection counsel. They do not block this mission. If counsel objects, they file a bug and the default labels change there.

- **OQ-1 ⚖ counsel**: Is shipping the 17 SCC headings and the four Article 32(1) items as default labels acceptable?
- **OQ-2 ⚖ counsel**: Should headings 13–17 be marked as controller-leaning? The default ships without such a marker.
- **OQ-3 ⚖ counsel** (ADR-0080 risk): A classified page marks evidence. It does not make a TOM description specific or sufficient. The docs say so.

## Out of Scope

- Rendering the classification on the HTML page.
- The generated TOM annex (`api/tom-annex.json`), operating-model templates, a `Role` kind, a sub-processor catalog, a shared organisation bundle and a catalog merge mechanism.
