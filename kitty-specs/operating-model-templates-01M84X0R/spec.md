# Mission Specification: Operating-model templates and a Role kind

**Mission Branch**: `kitty/mission-operating-model-templates-01M84X0R` (lands on `feat/402-operating-model-templates`, then a PR to `main`)
**Created**: 2026-11-23
**Status**: Draft
**Input**: Issue spec-kitty/doc-kitty#402 (part of epic #400): an opt-in operating-model section preset, body templates for the new-doc and scaffold stub tools (a 12-template starter set with preset `tom_classification` entries at organisation scope), and a `Role` kind that reuses the ADR-0019 `role` and `responsibilities` fields, recorded in ADR-0085. Templates hold structure and prompts only, never legal or policy wording.

## Intent Summary

- **Primary actor:** a documentation author at a consumer project. They describe how their organisation runs, often so they can point to it from a data processing agreement's technical and organisational measures (TOMs).
- **Trigger:** the author asks the stub tools for one operating-model page, or for the whole operating-model set.
- **Outcome:** the tools write pages that already carry valid frontmatter, a heading skeleton and authoring prompts. The pages are pre-classified against the measures catalog (ADR-0080) at organisation scope. Accountable functions get their own `Role` page kind, and process pages link to roles through `related`.
- **Invariants:**
  - A stub tool never overwrites an existing file.
  - A template never contains policy or legal wording.
  - A `Role` page must state its role and its responsibilities.
- **Decisions** (operator as decider, relayed by the dispatcher; recorded as Decision Moments):
  1. `Role` is a new canonical kind, not a sub-use of `Persona`. It is recorded in ADR-0085 (DM 01M84X1Q21P9HN21KNN9PFSNN6).
  2. The incident and continuity templates use kind How-To and are placed under `operations/runbooks/`, so their type `Runbook` is derived. `Role` is the only vocabulary change (DM 01M84X1S1BM3T10WV4D4PEM8VH).
  3. A `Role` page requires `role` and `responsibilities`; `goals` stays optional (DM 01M84X1TXTTJM09B0G0YN2G9BM).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record an accountable role (Priority: P1)

An author documents a Data Protection Officer as a page of kind `Role`, naming the role and its responsibilities. Process pages name this role through `related`. The validator rejects a `Role` page that is missing either field.

**Why this priority**: the kind is the only change to the shared vocabulary, and several templates depend on it.

**Independent Test**: validate one `Role` page with both fields, one without `role`, and one without `responsibilities`.

**Acceptance Scenarios**:

1. **Given** a page with `kind: Role`, a non-empty `role` and a non-empty `responsibilities` list, **When** the frontmatter gate runs, **Then** the page passes.
2. **Given** a `kind: Role` page without `role`, or with an empty `responsibilities` list, **When** the gate runs, **Then** it fails with a message naming the missing field.
3. **Given** a `kind: Role` page without `goals`, **When** the gate runs, **Then** it does not fail on `goals`.
4. **Given** the same page, **When** the site builds, **Then** the build accepts `Role` as a known kind.

### User Story 2 - Start one operating-model page from a template (Priority: P1)

An author runs the single-page stub tool with a template id, such as `incident-response`. The tool writes a page with the template's frontmatter, preset measures, heading skeleton and authoring prompts.

**Why this priority**: this is the everyday entry point. It is useful without adopting the whole preset.

**Independent Test**: emit each template into an empty docs tree and run the frontmatter gate over the result.

**Acceptance Scenarios**:

1. **Given** an empty docs tree, **When** the author asks for a known template, **Then** exactly one page is written. Its kind and its preset `tom_classification` entries (each with `scope: organisation`) match the starter set.
2. **Given** a file already exists at the target path, **When** the author asks for a template, **Then** the tool refuses, leaves the file byte-identical and exits non-zero, as it does today without a template.
3. **Given** an unknown template id, **When** the author runs the tool, **Then** it writes nothing, exits non-zero and lists the known ids.

### User Story 3 - Scaffold the whole operating-model set (Priority: P2)

An author runs the tree scaffolder with the `operating-model` preset. It writes the 12 starter pages and the section index. Existing files are skipped, never overwritten.

**Why this priority**: it is a convenience over Story 2 for teams starting from nothing.

**Independent Test**: scaffold the preset into an empty tree, then scaffold again over the result.

**Acceptance Scenarios**:

1. **Given** an empty docs tree, **When** the preset is scaffolded, **Then** all 12 template pages and the section index are written. They all pass the frontmatter gate once the documented preset snippet is applied.
2. **Given** a tree where some of those files exist, **When** the preset is scaffolded again, **Then** existing files are untouched and reported as skipped, and only missing files are written.

### User Story 4 - Opt into the operating-model section (Priority: P2)

A consumer copies a documented `sections.yaml` snippet to add an `operating-model` section to their information architecture. Sites that do not copy it see no change.

**Independent Test**: confirm the default registry has no `operating-model` entry, and that a fixture with the snippet validates.

**Acceptance Scenarios**:

1. **Given** the toolkit's default section registry, **When** it is loaded, **Then** it has no `operating-model` section.
2. **Given** a consumer registry with the documented snippet, **When** operating-model pages are validated, **Then** their expected `type` is `Operations`, or the type the consumer set through the vocabulary.

### User Story 5 - Learn the workflow (Priority: P3)

An author reads a guide, "Documenting your operating model", which explains the preset, the templates, the `Role` kind and how process pages link roles. It states that templates are structure, not policy, and are not legal advice.

### Edge Cases

- A template page is placed under `operations/runbooks/`. Its derived type is `Runbook`, while its kind stays How-To.
- A consumer replaces the measures catalog and drops a preset measure id. The page then warns or fails as ADR-0080 defines; the templates do not get a special case.
- Running the tool twice for the same Role slug: the second run refuses.
- A template is asked for together with `--section`, or with an explicit `--kind`. Behaviour is defined in the plan; it must never silently produce a page that fails the gate.
- Template prompts are HTML comments, so they never render as page text.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Role joins the canonical kinds | As an author, I want `Role` accepted as a kind by both the build schema and the frontmatter gate, so that I can document accountable functions. A page with `kind: Role` that fails today passes after the change. | High | Open | [build] | no |
| FR-002 | Role requires role and responsibilities | As a maintainer, I want the frontmatter gate to reject a `kind: Role` page that lacks a non-empty `role` string or a non-empty list of non-empty `responsibilities`, so that every role names its duties. `goals` is not required. | High | Open | [build] | no — paired with the valid Role page on the same fixture set (FR-001) |
| FR-003 | Persona requiredness unchanged | As a maintainer, I want the existing `Persona` rules (role, goals, responsibilities) to keep their current behaviour, so that the new kind does not loosen them. | Medium | Open | [ratchet] | yes — guarded by the existing Persona tests plus a Persona-without-goals fixture that must still fail |
| FR-004 | ADR-0085 records the kind | As a maintainer, I want an ADR-0085 that records `Role` as a canonical kind: why it is not a Persona sub-use, its required fields, and how processes link roles through `related`. | High | Open | [build] | no |
| FR-005 | Twelve starter templates | As an author, I want the 12 starter templates from issue #402, each with valid frontmatter, a heading skeleton and authoring prompts in HTML comments, and with the kind and preset measures listed in Key Entities. | High | Open | [build] | no |
| FR-006 | Preset measures at organisation scope | As a compliance-minded author, I want each template's `tom_classification` to list its preset measures as entries with `scope: organisation`, each resolving against the default measures catalog. | High | Open | [build] | no |
| FR-007 | Single-page template emission | As an author, I want the single-page stub tool to take a template id and write that template's page. An unknown id writes nothing and exits non-zero, listing the known ids. | High | Open | [build] | no |
| FR-008 | Preset scaffolding | As an author, I want the tree scaffolder to take the `operating-model` preset and write the 12 template pages plus a section index. | Medium | Open | [build] | no |
| FR-009 | Never overwrite | As an author, I want both tools, with a template or the preset, to leave any existing file byte-identical. The single-page tool refuses with a non-zero exit; the scaffolder skips and reports the file. | High | Open | [ratchet] | no — the fixture asserts the pre-existing bytes survive, alongside a positive control in which the missing file is written |
| FR-010 | Opt-in section preset | As a consumer, I want an `operating-model` section preset documented as a `sections.yaml` snippet with default type `Operations`, and absent from the toolkit's default registry. | Medium | Open | [build] | no |
| FR-011 | Runbook placement | As an author, I want the incident and breach response template and the business continuity template to be kind How-To and placed under `operations/runbooks/`, so that their type `Runbook` is derived. | Medium | Open | [build] | no |
| FR-012 | Every template validates | As a maintainer, I want an automated check that emits every template and runs it through the frontmatter gate with zero errors, resolving every measure id against the default catalog. | High | Open | [build] | no |
| FR-013 | Guide and changelog | As an author, I want a "Documenting your operating model" guide and a changelog fragment describing the preset, the templates and the `Role` kind. | Medium | Open | [build] | no |
| FR-014 | Existing behaviour without a template | As an existing user, I want the stub tools run without a template or preset to produce the same pages as today. | High | Open | [ratchet] | yes — guarded by the existing new-doc and scaffold tests, unchanged |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Red-first tests | Every FR marked [build] has at least one test, committed failing before the implementation that makes it pass. | Quality | High | Open |
| NFR-002 | Full suite green | `pnpm test` (both tiers plus mcp) passes with 0 failures at every hand-off. | Reliability | High | Open |
| NFR-003 | Template coverage | 12 of 12 templates are covered by the validation check (FR-012); 0 templates are excluded. | Quality | High | Open |
| NFR-004 | No policy wording | 0 template bodies contain prose outside headings and HTML-comment prompts, apart from frontmatter and a one-line "not legal advice" notice. A test enforces this. | Compliance | High | Open |
| NFR-005 | Docs gates | `validate:docs`, `validate:links` and `validate:changelog` pass with 0 errors on the branch. | Quality | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Structure, not content | Templates hold structure and prompts only, never legal or policy wording (charter scope: the toolkit does not author content). | Business | High | Open |
| C-002 | One vocabulary change | The only addition to the canonical kinds is `Role`; `Runbook` stays a type. | Technical | High | Open |
| C-003 | Single source of truth | `Role` is added through the existing single-source vocabulary core, so that there is no second list of kinds. | Technical | High | Open |
| C-004 | ADR number | The ADR is 0085, as allocated by the dispatcher. If 0085 is taken on main when the PR opens, the dispatcher is told; the runner does not renumber. | Process | High | Open |
| C-005 | Opt-in only | The default section registry and a default scaffold run are unchanged. | Technical | High | Open |
| C-006 | Not legal advice | User-facing docs for the feature state that the templates are not legal advice. | Regulatory | Medium | Open |
| C-007 | Out of scope | A generated responsibility (RACI) matrix is out of scope. | Business | Low | Open |

### Key Entities

- **Role page**: a page with `kind: Role`. It requires `role` and `responsibilities`; `goals` is optional. Process pages reference it through `related`.
- **Template**: a Markdown page body with an id, a kind, a target path, preset `tom_classification` entries and authoring prompts.
- **Section preset `operating-model`**: a documented `sections.yaml` entry with default type `Operations`. It is not in the default registry.
- **Starter set** (template, kind, preset measure ids from the default catalog):

| Template | Kind | Preset measures (scope: organisation) |
|---|---|---|
| Organisation and teams | Explanation | it-security-governance |
| Role | Role | accountability |
| Governance forums and decision rights | Reference | it-security-governance, accountability |
| Policy index | Hub | it-security-governance |
| Access management | How-To | user-identification-authorisation |
| Change and release management | How-To | system-configuration, testing-evaluation |
| Incident and breach response | How-To (under `operations/runbooks/`, type Runbook) | availability-restoration, accountability |
| Business continuity and recovery | How-To (under `operations/runbooks/`, type Runbook) | availability-restoration, confidentiality-integrity-availability-resilience |
| Supplier and sub-processor management | How-To | certification-assurance |
| People: onboarding, training, confidentiality, offboarding | How-To | it-security-governance |
| Data lifecycle: retention and deletion | How-To | limited-retention, portability-erasure |
| Assurance and audits | Reference | testing-evaluation, certification-assurance |

The issue names measures by heading ("governance", "restoring availability", "CIA and resilience"). The ids above are the matching ids in the default catalog (`src/lib/measures-default.mjs`).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An author can produce any one of the 12 operating-model pages with one command. It passes validation with 0 errors and no manual edits to its frontmatter. — [build] · no-op passable: no
- **SC-002**: Scaffolding the preset into an empty tree yields 13 pages (12 templates and a section index), all valid. A second run writes 0 files and changes 0 bytes. — [build] · no-op passable: no
- **SC-003**: 100% of `Role` pages missing `role` or `responsibilities` are rejected, and 0 valid `Role` pages are rejected. — [build] · no-op passable: no
- **SC-004**: Sites that do not opt in see 0 changes in their sections, their scaffold output or their validation results. — [ratchet] · no-op passable: yes — guarded by the unchanged existing scaffold and registry tests

## Assumptions

- ADR-0080 is Accepted (2026-11-21), so the preset `tom_classification` entries land in this mission rather than later.
- Where the template files live and how the tools load them is a plan-phase decision (Approach and Structure are deferred).
- Role pages default to a path inside the operating-model section, such as `operating-model/roles/<slug>.md`; the plan confirms it.
