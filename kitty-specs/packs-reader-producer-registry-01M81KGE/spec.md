# Mission Specification: Packs reader, charter contract snapshot and producer registry

**Mission Branch**: `kitty/mission-packs-reader-producer-registry-01M81KGE` (lands on `feat/330-packs-reader-producer-registry`)
**Created**: 2026-11-22
**Status**: Draft
**Input**: doc-kitty issue #330 (packs slice 2, epic #328), decided by ADR-0079 D1 to D4 and D6. Brief-intake mode: the issue and ADR-0079 are the brief.

## Intent summary

A maintainer of a doc-kitty site that shows Spec Kitty packs (open-packs, the
charter, core) needs doc-kitty to read a pack directory into one stable view,
`PackModel`, without depending on any one repository's layout. The reader
classifies files with the charter's own packs contract, which doc-kitty vendors
as a pinned snapshot (tag `contract-packs-v0.1.0-rc.1`, charter commit
`69ec326`). It never fails on a pack: it reports what rendering needs to know as
warnings. In the same change, the gates that hard-code the Gherkin and glossary
generators become one **producer registry**, in which each producer declares an
ownership scope (a whole section, or directories within one). The pack pages of
#338 and the generated-section contract of #359 then plug into that registry.

Rule that always holds: a `generated` stamp alone never exempts a page. A page
is generated only when its producer's stamp **and** its producer's ownership
scope both match (the glossary keeps its path-and-kind rule as its scope).

This slice renders no pages. Pack pages are #338.

## Domain language

| Term | Meaning | Avoid |
|---|---|---|
| Pack | A directory holding a `pack.yaml`, under a source root | "doctrine pack" for the directory |
| Packs contract | The charter's `contracts/packs/`: `file-kinds.yaml`, schemas, conformance cases | "the schema" (singular) |
| Contract snapshot | doc-kitty's vendored copy of the packs contract, with its lock | "vendored charter" |
| Classification | The outcome the contract gives a pack file: mapped, excluded, retired or unmodelled | "validation" |
| Constituent | A file the pack manifest lists, with a content hash | "member" |
| Producer | A doc-kitty generator that stamps the pages it writes | "generator" for the registry entry |
| Ownership scope | Where a producer's pages may live: a whole section, or directories within one | "owned path" |
| Provenance-only producer | A producer whose stamp records origin but never ownership (the scaffold) | — |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a pack into one model (Priority: P1)

A site maintainer runs `dockitty-read-pack packs/qa --json` against a checkout of
open-packs. They get one JSON `PackModel`: identity from `pack.yaml`, the README
parsed into title, preamble and sections, presets, the policy, the inventory per
kind labelled with its source, the manifest with a `verified` flag, the contract
commits, and a list of warnings.

**Why this priority**: every later packs slice (#338, #339, #331, #332) reads
packs only through this model.

**Independent Test**: run the reader on fixture packs and compare the model to
the documented shape and expected warnings.

**Acceptance Scenarios**:

1. **Given** a pack with a current manifest, **When** it is read, **Then**
   `manifest.verified` is true and `inventory.source` is `manifest`.
2. **Given** a pack with no manifest, **When** it is read, **Then** `manifest` is
   absent, `inventory.source` is `file-kinds`, and no error is raised.
3. **Given** a pack holding a retired file (`pack.md`), **When** it is read,
   **Then** the model carries a `retired` warning naming the file and the rule.
4. **Given** a pack whose manifest lists a file the directory lacks, or holds a
   wrong `content_hash`, **When** it is read, **Then** `manifest.verified` is
   false, `inventory.source` is `file-kinds`, and a warning names each gap.
5. **Given** any pack of open-packs at a pinned commit, **When** it is read,
   **Then** the reader returns a model and throws nothing.

### User Story 2 - Trust the classification (Priority: P1)

A doc-kitty maintainer refreshes the contract snapshot. The charter's own
classifier conformance cases run against doc-kitty's classifier, and a byte
changed in the snapshot without a matching lock fails the tests.

**Why this priority**: ADR-0079 D1 holds the reimplemented classification to the
charter's cases, not to a reading of the YAML.

**Independent Test**: unit tests over the vendored cases and the lock.

**Acceptance Scenarios**:

1. **Given** the vendored `classifier-cases.yaml`, **When** every case runs,
   **Then** each outcome, rule, kind and content form matches.
2. **Given** a snapshot file changed by one byte, **When** the lock test runs,
   **Then** it fails naming the file.
3. **Given** `pnpm packs:sync-contract --ref <tag-or-sha>` against a charter
   checkout, **When** it runs, **Then** it rewrites the snapshot and the lock
   records the resolved commit and the tag.

### User Story 3 - Show which contract the packs were proven against (Priority: P2)

A packs repository pins its own charter commit (`charter.lock.yaml`). The
maintainer sets `packs.charterLock` and, if needed, `packs.contract` (a newer
snapshot directory).

**Why this priority**: the page must not silently claim a different contract
(ADR-0079 D2).

**Independent Test**: read a fixture pack with a lock file naming another
commit.

**Acceptance Scenarios**:

1. **Given** a `charterLock` file whose `commit` differs from the snapshot's,
   **When** a pack is read, **Then** a warning is raised and the model records
   both `readWith` and `provenAgainst`.
2. **Given** a `contract` directory whose files disagree with its own lock,
   **When** it is loaded, **Then** loading fails with a `[dk-packs]` error.
3. **Given** an invalid `packs` option (unknown key, wrong type), **When** the
   integration starts, **Then** it fails with a `[dk-packs]` error.

### User Story 4 - One registry for generated pages (Priority: P1)

A doc-kitty developer adding a generator registers it once, with its ownership
scope, instead of editing the stamp module, the frontmatter gate and the
generator's own output scan.

**Why this priority**: #338 and #359 build on it, and ADR-0079 D6 amends
ADR-0046 decision 4 through it.

**Independent Test**: the existing Gherkin and glossary ownership tests pass
unchanged, and a test-only producer with a directories scope is recognised only
inside its directories.

**Acceptance Scenarios**:

1. **Given** a page stamped by an ownership producer and inside its scope,
   **When** the gate classifies it, **Then** it is generated.
2. **Given** the same stamp outside the scope, **When** the gate classifies it,
   **Then** it is authored and held to the full contract.
3. **Given** a scaffold stamp, **When** the gate classifies it, **Then** it is
   authored (provenance only).
4. **Given** the Gherkin output directory, **When** the generator scans it,
   **Then** owned and authored files are classified through the registry, as
   before.

### Edge Cases

- A README with no H1, or with frontmatter: the title is absent and the
  frontmatter is kept apart from the preamble.
- `pack.yaml` missing a required key or unreadable YAML: a warning, with empty
  identity fields, never a throw.
- `mutability_policy` absent: `policy` is absent. Named but missing: a warning.
- A `content_form` or top-level `file-kinds.yaml` key the reader does not know:
  a warning, and classification continues.
- A root case variant (`Readme.md`): retired under the root rule.
- CRLF in a constituent: hashed after CRLF and lone CR become LF.
- A symlink inside a pack: not followed; reported as a warning.
- A `charterLock` file that is missing or has no `commit`: a warning, and
  `provenAgainst` is absent.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Status | Delivery | No-op passable? |
|---|---|---|---|---|
| FR-001 | doc-kitty vendors the packs contract snapshot (`file-kinds.yaml`, the schemas the reader uses, `conformance/classifier-cases.yaml`) pinned to tag `contract-packs-v0.1.0-rc.1`, with a lock recording the tag, the charter commit and a sha256 per file. | Proposed | build | no |
| FR-002 | A unit test fails when any snapshot file's bytes disagree with the lock, or a file is added or removed without the lock. | Proposed | build | no |
| FR-003 | A maintainer script `pnpm packs:sync-contract --ref <tag-or-sha> [--from <charter checkout>]` refreshes the snapshot and rewrites the lock. | Proposed | build | no |
| FR-004 | The classifier gives every vendored conformance case its expected outcome, rule, kind, schema and content form. | Proposed | build | no |
| FR-005 | `readPack(dir, options)` returns a `PackModel` with the ADR-0079 D4 shape for any pack directory, and never throws on pack content. | Proposed | build | no |
| FR-006 | The reader parses the README into frontmatter, title (H1), preamble and H2 sections in order. | Proposed | build | no |
| FR-007 | The reader locates the policy through `mutability_policy` and maps `kind_defaults` and `artifacts`. | Proposed | build | no |
| FR-008 | The reader recomputes each constituent's `content_hash` (SHA-256 after CRLF and lone CR become LF) and sets `manifest.verified` only when every hash and the membership match. | Proposed | build | no |
| FR-009 | The inventory comes from the manifest when it is present and verified, else from a file-kinds walk, and is labelled with its source. | Proposed | build | no |
| FR-010 | The reader warns on a retired or unmodelled file, membership drift, a hash mismatch, an unknown `file-kinds.yaml` key or `content_form`, and an unreadable descriptor or policy. | Proposed | build | no |
| FR-011 | `packs.charterLock` names a YAML file with a `commit` key. A mismatch with the snapshot commit warns, and the model records both commits. | Proposed | build | no |
| FR-012 | `packs.contract` names another snapshot directory with its own lock, which is verified when loaded. | Proposed | build | no |
| FR-013 | The `packs` integration option accepts `charterLock` and `contract`, validated eagerly, with `[dk-packs]` errors. | Proposed | build | no |
| FR-014 | `dockitty-read-pack <dir> [--json] [--charter-lock <file>] [--contract <dir>]` prints the model, and has a `bin` entry. | Proposed | build | no |
| FR-015 | A producer registry lists every producer with its role (ownership or provenance-only) and ownership scope (a whole section, or directories within one section, optionally restricted to page kinds). | Proposed | build | no |
| FR-016 | `PRODUCERS`, `isGeneratedStamp`, `isGeneratedPage` and the Gherkin output scan read the registry and keep their current public behaviour. | Proposed | ratchet | no |
| FR-017 | An ownership stamp outside its producer's scope never makes a page generated. | Proposed | build | no |
| FR-018 | ADR-0079 is extended in a new ADR that records the registry and its scopes, with no edit to the accepted ADR's decisions. | Proposed | build | no |

### Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|---|---|---|---|
| NFR-001 | Reading one pack is fast enough for a build | Reading every open-packs pack at the pinned commit takes under 5 s in total on CI | Proposed |
| NFR-002 | The reader is deterministic | Two reads of the same tree give byte-identical JSON | Proposed |
| NFR-003 | Gates stay clean | Lint, typecheck, unit and e2e gates pass with no new suppressions | Proposed |
| NFR-004 | No behaviour change for existing sites | Every existing test passes without being edited | Proposed |

### Constraints

| ID | Constraint | Status |
|---|---|---|
| C-001 | The reader reads files only. It imports no Spec Kitty code and fetches nothing at build time (ADR-0042, ADR-0079 D1, D2). | Accepted |
| C-002 | doc-kitty does not validate a pack against the charter's schemas or codec (ADR-0079 D3). | Accepted |
| C-003 | Accepted ADRs are immutable, so the registry extends ADR-0079 in a new ADR (charter). | Accepted |
| C-004 | Changelog through a fragment, never `CHANGELOG.md`; ADRs add the file, never the index row (AGENTS.md). | Accepted |
| C-005 | No pages are generated in this slice (#338). | Accepted |

## Key Entities

- **PackModel**: ADR-0079 D4, verbatim.
- **ContractSnapshot**: a directory with `file-kinds.yaml`, `schemas/`,
  `conformance/` and `contract.lock.json` (`tag`, `commit`, `source`,
  `files: {path: sha256}`).
- **Classification**: `{expect, rule?, kind?, schema?, contentForm?}`.
- **Producer**: `{id, role, scope?, regenerateHint?, retiredBy?}`.
- **OwnershipScope**: `{type: 'section', section?, kinds?}` or
  `{type: 'directories', section, dirs}`.

## Success Criteria

- SC-001: 100% of the vendored conformance cases pass against the reader. — [build] · no-op passable: no
- SC-002: All 19 open-packs packs at a pinned commit read with zero thrown errors. — [build] · no-op passable: no
- SC-003: The four fixture packs (manifest, no manifest, retired file, stale manifest) produce exactly the expected warnings and `verified` flags. — [build] · no-op passable: no
- SC-004: Zero existing Gherkin or glossary ownership tests are edited, and all of them pass. — [ratchet] · no-op passable: yes (positive control: a test-only directories-scoped producer is recognised inside its scope and refused outside it)

## Assumptions

- The charter tag `contract-packs-v0.1.0-rc.1` on commit `69ec326` already
  publishes the conformance cases (charter #559), so they are copied as data and
  not transcribed from the Java tests.
- open-packs pins another charter commit (`cb9b154`), so its packs read with a
  `charterLock` mismatch warning. That is expected.
- Decisions D1 to D3 (Gherkin scope, glossary recognition, `packs` option
  surface) were resolved on their recommended options and escalated to the
  dispatcher.

## Dependencies

- Part of epic #328. Depends on #329 (ADR-0079, merged). Unblocks #338 and #359,
  then #353 and #401.
