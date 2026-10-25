# Mission Specification: Export section-index page bodies

**Mission Branch**: `fix/index-page-bodies`
**Created**: 2026-10-25
**Status**: Draft
**Input**: GitHub issue #238, plus its grounding comment (238#issuecomment-6395348048). The intent summary was confirmed by the operator on 2026-10-25.

## Intent Summary

A consumer runs the OKF export, from the build hook or the CLI, on a site whose section `README.md` pages contain authored prose. Each section's bundle `index.md` must carry that prose, with relative `.md` links rewritten to bundle paths exactly as concept pages have been since #237. Invariant: an index with no body exports byte-identically to the current output, and the entry list stays strictly formed.

Operator decisions:
- `index.md` stays strictly OKF §8, and conformance rule 4 is unchanged (DM 01M5S3K92JHE9P6B427E8WH4VC). OKF §8 neither allows nor forbids prose in `index.md`; its examples are all headings and entry lists.
- A README body becomes a sibling concept page at `<id>.md`, for example `guides/README.md`, listed as the first entry of its index.
- The earlier decisions DM 01M5S2FGAY1DGG6WSGYKPQ4AG7 (relax rule 4) and DM 01M5S2FK74STAHJC6762PPY5NZ (h1 placement) are superseded by this choice.

## User Scenarios & Testing *(mandatory)*

### User Story 1: A reader finds a section overview in the bundle (Priority: P1)

A reader or agent opens `guides/index.md` in an exported bundle. Its first entry leads to the overview that the author wrote in `guides/README.md`, with that overview's links pointing inside the bundle.

**Why this priority**: today that prose is silently dropped.

**Independent Test**: export a graph whose section README has a body containing relative `.md` links, then read the files `guides/index.md` and `guides/README.md`.

**Acceptance Scenarios**:

1. **Given** `docs/guides/README.md` has a body that links to `./add-a-session-note.md`, **When** the bundle is exported, **Then** `guides/README.md` exists as a concept page. It contains the body with frontmatter stripped, the link is rewritten to `/guides/add-a-session-note.md`, and it carries concept frontmatter.
2. **Given** the same README, **When** the bundle is exported, **Then** the first entry of `guides/index.md` is `- [<README title>](/guides/README.md)`, followed by ` - <description>` when there is one, and then the sorted children.
3. **Given** the body links to `../other/README.md`, **When** the bundle is exported, **Then** the link becomes `/other/index.md`. A link to a section README still means that section's index, as #237 established.
4. **Given** the section README has a body, **When** the bundle is exported, **Then** its sidecar `_index.meta.yaml` is unchanged.
5. **Given** a fixture section with a body, **When** the bundle is exported, **Then** `guides/index.md` and `guides/README.md` match a byte-exact expectation.

### User Story 2: The root README overview (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `docs/README.md` has a body, **When** the bundle is exported, **Then** a root `README.md` concept page is written, and the root `index.md` (with `okf_version` as its only frontmatter) lists it first.

### User Story 3: The bundle stays conformant (Priority: P1)

**Acceptance Scenarios**:

1. **Given** an export of READMEs with bodies, **When** `checkOkfBundle` runs, **Then** it reports no violations. Conformance rule 4 is unchanged.
2. **Given** the CLI export with `--check` on such a site, **When** it runs, **Then** it exits 0.

### Edge Cases

- **Empty body.** An empty body means the README text is blank once its frontmatter is removed (`trim() === ''`). This covers a README with only frontmatter or only whitespace. In that case no sibling file is written, and the index is byte-identical to today's output.
- **Basename `index`.** When the basename is `index`, the sibling path equals the index path, so no sibling is written and the output is unchanged.
- **Configured index basename.** With an `indexBasename` such as `_index`, the sibling is `<section>/_index.md`. It never collides with another page, because no other page can have that id.
- **Persona and hub READMEs.** A persona or hub page whose file is a README follows the same path, if it reaches the index branch. The plan confirms this.
- **MDX tags.** MDX component tags in a body are carried through raw, as they already are for concept pages.
- **Relations.** Outgoing relations of the README node are written as relation sections on the sibling page, as they are for any concept page.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Section overview page | As a reader, I want a section README with a non-empty body exported as a sibling concept page at `<id>.md`, with links rewritten as on any concept page, so that section overviews reach the bundle (#238). | High | Open | [build] | no: the overview-page row fails on the current code |
| FR-002 | Root overview page | As a reader, I want the root README body exported the same way, with the root `index.md` keeping `okf_version` as its only frontmatter. | High | Open | [build] | no: the root row fails on the current code |
| FR-003 | Overview listed first | As a reader, I want the index to list the overview page first, as a well-formed §8 entry labelled with the README title and description. | High | Open | [build] | no: the entry-order row fails on the current code |
| FR-004 | Conformance unchanged | As a maintainer, I want the bundle check (including the CLI `--check`) to pass on such exports without any change to rule 4. | High | Open | [ratchet] | yes: paired with the FR-001 fixture, which has a body |
| FR-005 | Persona and hub READMEs | As a reader, I want persona and hub README pages that reach the index branch to follow the same path. | Medium | Open | [build] | no: the persona-README row fails on the current code, or the row is dropped if the plan shows that persona READMEs never reach the index branch |
| FR-006 | Docs follow the behaviour | As a consumer, I want the export guide (with its "Known limit" section replaced), an ADR-0059 addendum, and the CHANGELOG to describe the new behaviour. | Medium | Open | [build] | no: reviewed against the diff |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Failing tests first | Each of FR-001, FR-002, FR-003 and FR-005 has at least one test that fails on the merge-base and passes on the PR head. | Reliability | High | Open |
| NFR-002 | Body-less parity | For indexes with no body, 0 bytes change in output and sidecars. For fixtures with a README body, the bundle diff is purely additive: the overview file plus one leading index entry, with every pre-existing file and line byte-identical. | Reliability | High | Open |
| NFR-003 | Complexity | No new or changed function exceeds cyclomatic complexity 15. | Maintainability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Emission-only change | The content graph and link resolution are not changed. Bodies reuse the existing concept-page path. | Technical | High | Open |
| C-002 | ADRs are immutable | ADR-0059 is changed only by an addendum. | Governance | Medium | Open |
| C-003 | Strict §8 index | `index.md` holds only headings and entries. Conformance rule 4 is not relaxed. | Technical | High | Open |

### Key Entities

- **Section index page**: `<section>/index.md`. It holds a generated §8 entry list.
- **Overview page**: the concept page `<id>.md`, written from a README's non-empty body.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of section READMEs with a non-empty body have an overview page that is listed first in their index. — [build] · no-op passable: no
- **SC-002**: The bundle check passes on an export of a site whose READMEs contain prose. — [build] · no-op passable: no
- **SC-003**: The unbased bundle snapshot diff is purely additive (overview page plus a leading entry). — [build] · no-op passable: no

## Assumptions

- A concept page named `README.md` is allowed in an OKF bundle. Only `index.md` and `log.md` are reserved names.
- No consumer depends on section index bodies being absent.
