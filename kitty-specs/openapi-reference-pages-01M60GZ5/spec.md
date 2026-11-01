# Mission Specification: OpenAPI reference pages

**Mission Branch**: `feat/openapi-reference-pages`
**Created**: 2026-10-28
**Status**: Draft
**Input**: GitHub issue #244, plus its grounding comment (244#issuecomment-6461777328). The intent summary was confirmed by the operator on 2026-10-29. #244 is the first slice of parent #140, which remains the umbrella issue.

## Intent Summary

A docsite author lists one or more OpenAPI 3.x documents in the site's DocKitty options, each with a label and a released or unreleased flag, and builds the site. Each version then has reference pages in the normal site layout and theme, links to the other versions, and a visible "unreleased" label when it is not released. The raw document is published next to its pages, byte for byte, with its sha256.

The first consumer is the spec-kitty-charter docsite. It publishes its latest release and `main`, and checks the published document against its own checksum.

Operator decisions (see `decisions/`):
- **Rendering.** Use an existing Starlight integration first, following ADR-0049. The first work package is a spike that decides whether it fits. If it does not, the fallback is the toolkit's own build-time generator, recorded in a new ADR. Redoc is rejected: it renders a standalone page, keeps content in JavaScript, needs inline scripts and styles, uses its own dark-mode switch, and carries telemetry.
- **Issues.** #244 is a slice of the parent #140, which keeps Swagger 2 and later work.
- **Boundary.** Per-operation search, an `llms.txt` summary of operations, a dropdown switcher, an archive of older tagged versions, multi-file documents and the 0.6.0 release are out of this mission.

## User Scenarios & Testing *(mandatory)*

### User Story 1: An author publishes two versions of an API (Priority: P1)

A docsite author configures two OpenAPI documents, `v1.2.0` (released) and `main` (unreleased), and builds the site. A reader then opens the API section and reads either version in the normal layout.

**Why this priority**: this is exactly what the first consumer needs, and nothing like it exists today.

**Independent Test**: build a fixture site that configures two OpenAPI 3.1 documents, then inspect the built pages.

**Acceptance Scenarios**:

1. **Given** two configured versions, **When** the site builds, **Then** each version has reference pages under the API section that show its operations and schemas, inside the site's header, sidebar and footer.
2. **Given** the same build, **When** a reader opens either version, **Then** the page links to every other configured version, and to the version's own raw document.
3. **Given** `main` is configured as unreleased, **When** a reader opens any of its pages, **Then** the text "unreleased" is visible on the page, not conveyed by colour alone. Released versions show no such label.
4. **Given** the build, **When** the reader switches the site to dark or light mode, **Then** the reference pages follow, using the site's theme colours.
5. **Given** a reader's browser, **When** a reference page loads, **Then** no request fetches the OpenAPI document and no "try it" console is offered.

### User Story 2: The consumer verifies what was published (Priority: P1)

The charter docsite checks that the API reference it published is the contract it bundled.

**Independent Test**: build the fixture, then compare the published raw document with the input file.

**Acceptance Scenarios**:

1. **Given** a configured document, **When** the site builds, **Then** the raw document is published next to its version's pages, identical byte for byte to the input file.
2. **Given** the same build, **When** the consumer reads the published sha256 for that version, **Then** it equals the sha256 of the input file.

### User Story 3: A broken input stops the build (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a configured path that does not exist, **When** the site builds, **Then** the build fails, and the error names the option and the missing path.
2. **Given** a file that is not a valid OpenAPI 3.x document, **When** the site builds, **Then** the build fails, and the error names the file and what is wrong with it.
3. **Given** one valid and one broken version, **When** the site builds, **Then** the build exits non-zero and the output directory holds no reference pages and no raw document for either version.

### User Story 4: Sites without an API are unaffected (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a site that does not set the OpenAPI option, **When** it installs the toolkit, **Then** no packages used only for API pages are installed. The renderer is an optional peer that only sites using the option install.
2. **Given** the example site built without the option, **When** the PR head is compared with the merge-base, **Then** the output is identical apart from the toolkit version stamps, which the test lists.
3. **Given** a site that sets the option without installing the renderer, **When** it builds, **Then** the build fails with an error naming the package to install.

### User Story 5: The pages are found (Priority: P2)

**Acceptance Scenarios**:

1. **Given** configured versions, **When** the site builds, **Then** the API section appears in the site navigation, and every reference page is in the sitemap. Pages of unreleased versions are included and marked unreleased on the page.
2. **Given** the site's search, **When** a reader searches for an API page's title, **Then** the page is found.
3. **Given** configured versions, **When** the site builds, **Then** `llms.txt` lists each version with a link to its raw document.

### Edge Cases

- **One version only.** The version links list just that version. No empty switcher is shown.
- **Duplicate labels.** Labels are compared without regard to case, so `Main` and `main` are duplicates. Duplicates fail the build, naming both entries.
- **A label that is unsafe in a page address.** A label with any character outside `a-z`, `0-9`, `.`, `_` and `-` (after lower-casing) is rejected with an error naming the entry. Labels are never rewritten.
- **A route collision.** A generated page whose address equals an authored page, or another generated page, fails the build through the existing route-collision report (ADR-0050), naming both.
- **An authored file at a generated path.** If the renderer writes files, an authored file at one of their paths stops the build, naming the path (ADR-0049 §3).
- **Released flag missing.** The build fails, naming the entry. There is no default.
- **A site with a base path.** All reference-page links and the raw-document link include the base.
- **A document that references other files.** It is rejected with an error saying a single bundled file is required (multi-file documents are a follow-up).
- **Swagger 2.** It is rejected with an error saying OpenAPI 3.x is required. Swagger 2 stays with the parent issue.
- **A valid document with no operations.** It builds a page that says the API has no operations. It does not fail.
- **An empty or unreadable file.** It is invalid input and fails the build per FR-007. When generated pages already exist, they are never deleted (ADR-0049 §3).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Configure versions | As an author, I want to list one or more OpenAPI 3.x documents in the DocKitty options, each with a path, a label and a required released flag, so that I can publish my API contract (#244). | High | Open | [build] | no: the fixture site's pages do not exist without it |
| FR-002 | Reference pages per version | As a reader, I want each configured version rendered at build time as reference pages in the normal site layout (header, sidebar, TOC rail, footer), showing every operation and every component schema name an operation references. | High | Open | [build] | no: asserts the rendered operations and schema names of the fixture |
| FR-003 | Version links | As a reader, I want every reference page to link to every other configured version. | High | Open | [build] | no: asserts the links on the fixture's two versions |
| FR-004 | Unreleased label | As a reader, I want an unreleased version marked with the visible text "unreleased", and released versions unmarked. | High | Open | [build] | no: asserts the text on `main` and its absence on the released version |
| FR-005 | Site theme | As a reader, I want the reference pages styled from the `--dk-*` token catalog, following branding and theme overrides in light and dark mode, with no hard-coded colours or fonts and no renderer stylesheet that overrides the site's (ADR-0049 §1). | Medium | Open | [build] | no: asserts a branding override reaches the reference page in both modes |
| FR-006 | Raw document and checksum | As a consumer, I want each version's raw document published at `<base>/<section>/<label>/openapi.<ext>` (keeping the input's extension), byte-identical to the input, with a sidecar `openapi.<ext>.sha256` in `sha256sum` format, so that I can verify what was published. The how-to states these addresses as a stable contract. | High | Open | [build] | no: compares published bytes and checksum with the input |
| FR-007 | Fail closed | As an author, I want a missing path, an empty, unreadable, invalid or non-3.x document, a multi-file document, a duplicate or unsafe label, a missing released flag, or a missing renderer package to fail the build with an error that names the entry and the file, and to publish nothing. | High | Open | [build] | no: each case has a failing-build test with the expected message |
| FR-008 | Navigation, sitemap, search, llms.txt | As a reader or agent, I want the API section in the navigation, its pages (including unreleased ones) in the sitemap, its page titles findable by the site search, and each version listed in `llms.txt` with a link to its raw document. | Medium | Open | [build] | no: asserts the nav entry, sitemap entries, search index entries and `llms.txt` lines |
| FR-009 | Static only | As a reader, I want the pages to work without fetching the document in the browser, and with no request console. | High | Open | [build] | no: asserts the built pages make no request for the document and contain no console |
| FR-010 | Opt-in at no cost | As an author of a site without an API, I want nothing extra installed (the renderer is an optional peer) and my build output unchanged against the merge-base, apart from listed version stamps. | High | Open | [ratchet] | yes: paired with the FR-001 fixture as the positive control |
| FR-011 | Docs | As an author, I want a how-to page with the raw-document contract and a content-security note; the renderer's licence in `NOTICE`; an ADR-0049 addendum (or a superseding ADR) that records the spike and moves the decision to Accepted, with the ADR index regenerated; and a CHANGELOG entry. | Medium | Open | [build] | no: reviewed against the diff |
| FR-012 | Generated-page rules | As a maintainer, I want whatever DocKitty writes for these pages to follow ADR-0049 §3: a generated marker, pruning of pages the document no longer produces, a stop on an authored file at a generated path, and never deleting existing pages on an empty or unreadable document. | High | Open | [build] | no: each rule has a test with a fixture that triggers it |
| FR-013 | Site surfaces recorded | As a maintainer, I want the spike to record, in the ADR, whether reference pages reach the agent API, the content graph and the glossary autolinker, and how the frontmatter gate (including required `kind`) treats them. A surface they do not reach is either wired or listed as a follow-up. | Medium | Open | [build] | no: the ADR lists every surface with a verdict |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Repeatable builds | Two builds of the same inputs produce byte-identical reference pages and raw documents. 0 bytes differ. | Reliability | High | Open |
| NFR-002 | Content security | On a reference page of the two-version fixture, the external origins equal those of an ordinary page (0 additions). The inline script and style hashes equal an ordinary page's, plus only the renderer's known, pinned inline scripts (waiver, DM plan.security.nfr002-waiver). A gate lists those hashes and fails on any other addition. The how-to publishes them. | Security | High | Open |
| NFR-003 | Accessibility | The reference pages have 0 serious or critical accessibility violations in the project's automated accessibility check, in light and dark modes. | Accessibility | High | Open |
| NFR-004 | Build cost | The median of 3 CI builds of the example site with the two-version fixture, minus the median of 3 without it, is at most 10 seconds. | Performance | Medium | Open |
| NFR-005 | Tests that bite | Each of FR-001 to FR-009 and FR-012 has at least one test that fails when its specific behaviour is removed or broken on the PR head (a mutation check recorded in the review). | Reliability | High | Open |
| NFR-006 | Complexity | No new or changed function exceeds cyclomatic complexity 15. | Maintainability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Existing integration first | The rendering follows ADR-0049: an existing Starlight integration, unless the spike shows none fits. Then the fallback is an own build-time generator, recorded in a new ADR. Redoc is not used. | Technical | High | Open |
| C-002 | ADRs are immutable | ADR-0049 is changed only by an addendum, or superseded by a new ADR. | Governance | High | Open |
| C-003 | Pinned dependencies | Any new dependency is pinned to an exact version and checked against the project's supply-chain directive (no install scripts without review, licence recorded). | Security | High | Open |
| C-004 | Producing the document is out of scope | The toolkit does not produce, bundle or lint the consumer's document beyond rejecting invalid input. | Technical | Medium | Open |
| C-005 | No release in this mission | The 0.6.0 release is cut separately after merge. | Process | Medium | Open |
| C-006 | Spike exit criteria | The integration passes the spike only if it works with the toolkit's Astro and Starlight versions and markdown pipeline (ADR-0060), meets ADR-0049 §1 (through thin adapters where needed), and can meet FR-002 to FR-009 and NFR-001 to NFR-003 (NFR-002 as amended by the waiver). Descriptions that bypass the glossary autolinker and link checks are recorded as a known limit, not a failure. If any criterion fails, the fallback generator applies. | Technical | High | Open |

### Key Entities

- **API version**: one configured entry, with a document path, a label and a released flag.
- **Reference pages**: the built pages of one API version.
- **Raw document**: the published copy of a version's input file, plus its sha256.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A site that configures two versions publishes reference pages for 100% of the operations in both fixture documents. — [build] · no-op passable: no
- **SC-002**: The published raw document of every version matches its input byte for byte, and its published checksum matches. — [build] · no-op passable: no
- **SC-003**: 100% of the broken-input cases listed in FR-007 fail the build with a message naming the entry or file. — [build] · no-op passable: no
- **SC-004**: A site that does not use the option installs no extra packages, and its build output does not change. — [ratchet] · no-op passable: yes, paired with SC-001 as the positive control

## Assumptions

- The consumer publishes a single, pre-bundled OpenAPI 3.x document per version.
- The site's existing content-security posture is the baseline. The only addition is the renderer's pinned inline scripts on API pages (NFR-002 waiver).
- The page address scheme is one section, `reference/api/<label>/` by default, and configurable. `api/` is reserved for the agent API.
- Swagger 2 is deferred, as ADR-0049 §2 allows ("ship 3.x first and track 2.x as a follow-up").

## Follow-ups (out of scope)

Each is filed as an issue at close-out:
- per-operation search;
- an `llms.txt` summary of operations;
- a dropdown version switcher;
- an archive of older tagged versions;
- multi-file documents;
- a remote URL as input (ADR-0049 allows it; v1 takes a local path);
- Swagger 2 (which stays with the parent issue).
