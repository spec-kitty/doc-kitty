# Mission Specification: TOM annex export: an evidence index

**Mission Branch**: `feat/401-tom-annex-export` (mission branch `kitty/mission-tom-annex-export-01M84YDP`)
**Created**: 2026-11-23
**Status**: Draft
**Input**: Issue #401 (epic #400), building on ADR-0080 and the generated-section contract of #359 (ADR-0087). The intent summary was confirmed by the operator through the dispatcher on 2026-11-23. Decision Moment `01M84YEF7GB92FTFFX92HWNGPH` resolved to option A.

> [!CAUTION]
> **Not legal advice.** This mission builds an **evidence index, not the
> contractual annex**. The annex in a data processing agreement (DPA) stays the
> parties' own document. Items marked **⚖** need review by data-protection
> counsel before anyone relies on them.

## Intent Summary

- **Who:** an auditor, a data-protection officer (DPO) or a vendor's security
  team reviewing a supplier's technical and organisational measures (TOMs). A
  machine consumer is in scope too: the shared organisation bundle of #404.
- **Trigger:** a site whose pages classify the measures they evidence
  (`tom_classification`, ADR-0080) is built.
- **Outcome:** one documented, stable, machine-readable index. For each measure
  in the catalog it lists the pages that evidence it and says which measures have
  no evidence. A human-readable view is available on request.
- **Invariant:** every generated surface says it is an evidence index, not the
  contractual annex. It never claims to satisfy GDPR Art. 30(2)(d), Art. 28 or an
  SCC annex on its own.

## Domain Language

| Term | Meaning | Avoid |
|---|---|---|
| **evidence index** | The generated listing of measures and the pages that evidence them. | "annex", "TOM annex" on its own, "DPA annex" |
| **contractual annex** | The annex the DPA parties write and sign. It is never generated. | — |
| **measure** | A catalog record from ADR-0080, with an id, label, nature, frameworks and dpv. | "control" (framework-specific) |
| **evidence page** | A published page whose `tom_classification` lists a measure. | "proof" |
| **uncovered measure** | A catalog measure with no evidence page. | "missing control", "gap" in the legal sense |
| **snapshot** | A committed copy of the evidence index that a dated reference can cite. | "release annex" |
| **scope** | `system` or `organisation`, from ADR-0080. | — |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An auditor reads the evidence per measure (Priority: P1)

An auditor opens the site's evidence index. For each catalogued measure they see
its label, nature, framework references and DPV concept, and the published pages
that evidence it, with each page's title, description, URL, last update, status,
verification and the note the page gives for that measure.

**Why this priority**: This is the whole point of #401. Without it, the evidence
is spread across pages and nothing gathers it per measure.

**Independent Test**: Build a site with a small catalog and three classified
pages. Read the index and check that each measure lists exactly its evidence pages
with those fields.

**Acceptance Scenarios**:

1. **Given** page P lists measure M with a note, **When** the site is built,
   **Then** the index lists P under M with P's title, description, URL, `updated`,
   `doc_status`, `verified` and that note.
2. **Given** two pages list M with `scope: organisation`, **When** the site is
   built, **Then** M appears once, in the organisation group, with both pages
   under it.
3. **Given** a draft page lists M, **When** the site is built for production,
   **Then** neither the page nor its link to M appears in the index.

---

### User Story 2 - A DPO sees which measures have no evidence (Priority: P1)

The DPO reads the `uncovered` list to find catalog measures that no published page
evidences yet.

**Why this priority**: The gap list is the actionable part of the index. It is
cheap to deliver with Story 1.

**Independent Test**: A catalog with four measures, of which pages evidence two.
The index names the other two as uncovered.

**Acceptance Scenarios**:

1. **Given** a catalog measure that no published page lists, **When** the site is
   built, **Then** that measure is in `uncovered`.
2. **Given** a measure that only a draft page lists, **When** the site is built
   for production, **Then** that measure is in `uncovered`.

---

### User Story 3 - An agent or a bundle finds and trusts the index (Priority: P1)

An agent finds the index from the agent-API entry point. The #404 bundle reads
the same documented format, and can tell from the stamp whether the copy it holds
is current.

**Why this priority**: #404 depends on this format. A format that cannot be found,
or that changes shape without notice, blocks the epic.

**Independent Test**: Read `api/index.json`, follow its link to the index, and
validate the file against the documented format. Build twice and compare bytes.

**Acceptance Scenarios**:

1. **Given** a site with classified pages, **When** it is built, **Then**
   `api/index.json` links the index and the build's artifact gate checks that link.
2. **Given** the same commit, **When** it is built twice, **Then** the index is
   byte-identical, with no field masked.
3. **Given** the index, **When** it is read, **Then** it carries the
   generated-section stamp and a format version.

---

### User Story 4 - A maintainer keeps a dated snapshot and is told when it drifts (Priority: P2)

A maintainer who wants a dated reference writes a snapshot of the index into the
repository. Later the drift check tells them the snapshot no longer matches the
pages. ⚖ Counsel decides whether a DPA may cite the living index or needs a dated
snapshot; this story makes both possible.

**Why this priority**: The snapshot is opt-in. The living index (Stories 1–3) has
value without it.

**Independent Test**: Write a snapshot, change a classified page, and run the
check. It reports drift; regenerating clears it.

**Acceptance Scenarios**:

1. **Given** no snapshot is configured, **When** the drift check runs, **Then** it
   passes and writes nothing.
2. **Given** a committed snapshot and an unchanged tree, **When** the check runs,
   **Then** it passes.
3. **Given** a committed snapshot and a changed evidence page, **When** the check
   runs, **Then** it fails and names the snapshot as stale.
4. **Given** a snapshot edited by hand, **When** the check runs, **Then** it fails
   and names the snapshot as hand-edited.

---

### User Story 5 - A reader browses a rendered evidence page (Priority: P3)

A site that opts in gets a rendered hub page that groups measures by nature and
scope, with the same labelling.

**Why this priority**: The opt-in page is for humans. The JSON serves auditors'
tools and #404.

**Independent Test**: Turn the option on and build. The page exists, is grouped by
nature and scope, and carries the label. Turn it off and the page is absent.

**Acceptance Scenarios**:

1. **Given** the option is off (the default), **When** the site is built, **Then**
   no hub page exists.
2. **Given** the option is on, **When** the site is built, **Then** the hub page
   groups measures by nature, then scope, and states "evidence index, not the
   contractual annex".

---

### User Story 6 - The OKF export carries the index (Priority: P3)

A consumer of the OKF export (ADR-0059) receives the evidence index with the rest
of the bundle.

**Independent Test**: Export a site with classified pages and find the index in
the bundle, with its label.

**Acceptance Scenarios**:

1. **Given** a site with classified pages, **When** it is exported to OKF, **Then**
   the bundle includes the evidence index with its label.
2. **Given** a site with no classified pages, **When** it is exported, **Then** the
   bundle has no index and the export does not fail.

### Edge Cases

- **No classified pages:** nothing is emitted, nothing is linked, and no gate
  fails. This is true even when a catalog exists.
- **No catalog override:** the default catalog applies (ADR-0080), so `uncovered`
  lists the default measures that have no evidence.
- **One page, two entries for the same measure** (for example `system` and
  `organisation`): the page appears under each scope group once.
- **A page with `scope: system` and another with `scope: organisation` for the same
  measure:** the measure appears in both groups, each with its own pages.
- **An unknown measure id:** this already fails the build (ADR-0080 decision 2).
  The index never sees it.
- **Free-text notes with line breaks or markup:** they are carried as plain text.
  Whitespace is flattened as the OKF export already does.
- **An excluded folder (ADR-0070) or a withheld draft:** neither appears.
- **Line endings:** the snapshot is the same bytes on every platform.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Per-measure records | As an auditor, I want each catalog measure listed with its label, nature, frameworks and dpv, and its evidence pages with title, description, URL, `updated`, `doc_status`, `verified` and the entry's note, so that I can review evidence per measure. | High | Open | [build] | no |
| FR-002 | Grouping by scope | As an auditor, I want entries grouped by `scope`, with an organisation-scope measure appearing once rather than once per page, so that organisation-wide measures are not repeated. | High | Open | [build] | no |
| FR-003 | Uncovered measures | As a DPO, I want an `uncovered` list of catalog measures with no published evidence page, so that I can see the gaps. | High | Open | [build] | no — paired with a covered measure in the same fixture |
| FR-004 | Labelling | As a reader, I want every generated surface (JSON, snapshot, hub page, OKF entry) to state "evidence index, not the contractual annex", and counsel-dependent items to be marked ⚖, so that no one mistakes it for the DPA annex. | High | Open | [build] | no |
| FR-005 | Discovery | As an agent, I want the index linked from `api/index.json` `_links`, so that I can find it and the build's artifact gate checks it. | High | Open | [build] | no |
| FR-006 | Drafts excluded | As an auditor, I want draft pages and their links to measures left out by the same rule the sitemap uses, so that unpublished pages never count as evidence. | High | Open | [build] | no — paired with a published page in the same fixture |
| FR-007 | Deterministic output | As a #404 consumer, I want sorted output that is byte-identical across two builds of one commit, with no masked field, so that a copy can be compared by hash. | High | Open | [build] | no — the two-builds test fails if any order or the clock leaks |
| FR-008 | Generated-section stamp | As a #404 consumer, I want the index and any snapshot to carry the ADR-0087 stamp, with `source_digest` over the catalog and the classified pages, and `at` taken from the latest input instant, never the build clock. | High | Open | [build] | no |
| FR-009 | Opt-in snapshot and drift check | As a maintainer, I want a command that writes an opt-in committed snapshot (a registered producer), and a `--check` that reports it as stale or hand-edited by the ADR-0087 verdicts, so that a dated reference stays honest. | Medium | Open | [build] | no — paired with the unchanged-tree pass on the same fixture |
| FR-010 | Opt-in hub page | As a reader, I want an opt-in rendered page grouping measures by nature and scope, off by default. | Low | Open | [build] | no — paired with the option-off fixture |
| FR-011 | OKF export | As an OKF consumer, I want the export to include the evidence index. | Medium | Open | [build] | no |
| FR-012 | No classified pages | As a site owner without TOM pages, I want nothing emitted, linked or failed, so that the feature costs me nothing. | High | Open | [ratchet] | yes — paired with the classified-site fixture as the positive control |
| FR-013 | Documented, versioned format | As a #404 implementer, I want the format documented in a guide page, with a format version and a rule for when it changes, and a changelog fragment, so that I can build on it. | High | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Byte stability | Two builds of the same commit produce a byte-identical index in 100% of runs, with no masked field. | Reliability | High | Open |
| NFR-002 | Build cost | On the example site, the build with the index takes no more than 2% (or 1 s, whichever is larger) longer than without it. | Performance | Medium | Open |
| NFR-003 | Format stability | A field rename or removal changes the format's major version; additions change the minor version. 0 unversioned breaking changes. | Maintainability | High | Open |
| NFR-004 | Test-first | Every FR has at least one test that was red before the code that makes it pass. | Quality | High | Open |
| NFR-005 | Full suite | `pnpm test` (both tiers and mcp) passes before every hand-off. | Quality | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Not legal advice | No surface claims legal sufficiency. Wording on generated surfaces is marked ⚖ for counsel. | Regulatory | High | Open |
| C-002 | ADR-0087 gate | The parts that depend on ADR-0087 (stamp, snapshot, `--check`) are not implemented until ADR-0087 is Accepted and #445 has merged. Spec, plan and tasks may proceed. | Governance | High | Open |
| C-003 | Committed data only | The build reads committed pages and the catalog. It never runs another repository's code (ADR-0087 D6, ADR-0042). | Technical | High | Open |
| C-004 | Reuse the graph | The index is derived from the content graph's `classified-as` edges (ADR-0080 decision 6), not from a second parse of frontmatter. | Technical | High | Open |
| C-005 | Same draft rule | Draft handling is the sitemap's rule, not a new one. | Technical | Medium | Open |
| C-006 | No history rewrite | No force-push. Clean history goes on a new branch (R24). | Process | High | Open |

### Key Entities

- **Evidence index**: one per build. It holds the format version, the label, the
  generated stamp, measures grouped by scope, and the `uncovered` list.
- **Measure entry**: a catalog measure (id, label, nature, frameworks, dpv) with
  its evidence pages for one scope.
- **Evidence reference**: one page's evidence for one measure: title,
  description, URL, `updated`, `doc_status`, `verified`, note.
- **Snapshot**: an opt-in committed copy of the evidence index, owned by a
  registered producer and checked for drift.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the example site, every evidence page and every uncovered measure an auditor would list by hand is in the index, with 0 extra and 0 missing. — [build] · no-op passable: no
- **SC-002**: 100% of generated surfaces carry the "evidence index, not the contractual annex" label. — [build] · no-op passable: no
- **SC-003**: Two builds of the same commit give identical index bytes in 10 out of 10 runs in CI. — [build] · no-op passable: no
- **SC-004**: A site with no classified pages builds with 0 new outputs and 0 new failures. — [ratchet] · no-op passable: yes — paired with SC-001's classified site as the positive control
- **SC-005**: After any change to an evidence page, a stale snapshot is reported on the first check run, in 100% of cases. — [build] · no-op passable: no

## Assumptions

- ADR-0080's field, catalog and `classified-as` edges are implemented on main
  (#415) and are the only source of classification.
- "The sitemap rule" for drafts is the existing published-page filter that decides
  sitemap inclusion.
- The index lives at `api/tom-annex.json`, the path #401 names. The format
  version starts at 1.
- ⚖ The label wording, and whether a DPA may cite the living index or a dated
  snapshot, are counsel's decisions. The mission ships the label as #401 words it.

## Out of Scope

- The shared organisation bundle itself (#404).
- Generating or filling a contractual annex, a record of processing, or an SCC
  annex.
- Changes to the ADR-0080 field, the catalog format or the edge.
- Implementing ADR-0087 for other producers (Gherkin migration, #360–#363).
