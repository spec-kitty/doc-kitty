# Mission Specification: Base-aware links in generated outputs

**Mission Branch**: `fix/base-aware-generated-links`
**Created**: 2026-10-24
**Status**: Draft
**Input**: GitHub issues #236 and #237, plus the grounding comments on them (236#issuecomment-6381877740, 237#issuecomment-6381878039). The intent summary was confirmed by the operator on 2026-10-24.

## Intent Summary

A consumer site is served under a base path, for example `/socratesbe_26_secondbrain` on a GitHub Pages project site. When it builds, or runs the OKF export CLI, every link in a generated output must resolve: either on the deployed site, or inside the OKF bundle. An unbased site's output does not change, apart from the per-page agent record's `source` becoming an absolute URL (#236). Invariant: no generated output turns a link into a site URL without the base, or into a URL that 404s.

## User Scenarios & Testing *(mandatory)*

### User Story 1: An agent follows a page record's `source` (Priority: P1)

An agent reads `/api/pages/<id>.json` on a site with a base, and follows its `source` to fetch the same record again.

**Why this priority**: the index and the per-page record disagree today, and the per-page value 404s. Following the field is the documented way to discover records (ADR-0037, ADR-0058).

**Independent Test**: build or route-test a site with a base set, then compare the per-page `source`, `_links.self.href`, and the index's `source` for that page.

**Acceptance Scenarios**:

1. **Given** a site with `base: /sub`, **When** `/api/pages/<id>.json` is generated, **Then** `source` is `<site>/sub/api/pages/<id>.json` and equals `_links.self.href`.
2. **Given** the same site, **When** `/api/index.json` is generated, **Then** that page's index `source` equals the per-page `source`.
3. **Given** an unbased site, **When** the per-page record is generated, **Then** `source` is `<site>/api/pages/<id>.json`, and nothing else in the payload changes.

### User Story 2: A reader follows a link between pages inside an OKF bundle (Priority: P1)

A reader or agent opens a page in the exported OKF bundle and follows a relative link that the author wrote to another page's `.md` source file.

**Why this priority**: this is the most common link shape in the bundle (severity:major). Every such link is currently broken on based sites.

**Independent Test**: export a graph that contains a section index and a nested page, then check how each link is rewritten.

**Acceptance Scenarios**:

1. **Given** `docs/context/about.md` links to `../guides/README.md`, **When** the bundle is exported, **Then** the link becomes the bundle path of the Guides index (`/guides/index.md`).
2. **Given** a nested page links to `../../guides/add-a-session-note.md#steps`, **When** the bundle is exported, **Then** the link becomes `/guides/add-a-session-note.md#steps`.
3. **Given** the target is `.mdx`, root-absolute (`/guides/README.md`), already includes the base (`/sub/guides/README.md`), or contains `%`-escapes, **When** the bundle is exported, **Then** the link resolves to the same bundle page.
4. **Given** a `.md` target that matches no bundle page (a draft, an excluded page, or a repo file outside `docs/`), **When** the bundle is exported, **Then** the link is left unchanged, and the advisory bundle link check reports it as dangling. The check is extended to relative links, because today it only checks root-absolute ones.

### User Story 3: A reader follows a link to a generated site file from the bundle (Priority: P2)

A bundle page links to a file the site generates, such as `llms.txt`, which is not a bundle page.

**Why this priority**: there are fewer such links, but each one currently lands on the wrong origin path.

**Independent Test**: export with a base and an origin-only site URL, from both the integration and the CLI.

**Acceptance Scenarios**:

1. **Given** a page three levels deep links to `../../../llms.txt` on a site with `base: /sub`, **When** the bundle is exported, **Then** the link is `<site>/sub/llms.txt`.
2. **Given** the CLI is called with an origin-only `--site-url` and a base, **When** it exports, **Then** the output matches what the integration produces.
3. **Given** the caller passes a site URL that already includes the base, **When** it exports, **Then** the base is not doubled.
4. **Given** an unbased site, **When** it exports, **Then** links inside the bundle and external links are byte-identical to the current output.

### Edge Cases

- A link from the root `README` (id `README`, empty source directory) must resolve against the docs root, without a doubled slash.
- Fragments and queries are kept. `.md` detection runs on the path only.
- Detecting a non-`.md` relative link (for example `../deep/dive/`) keeps the current route-relative behaviour.
- Lookups by id match case exactly, because ids keep the source case (`README`).
- Section-index page bodies are not link-rewritten, because the export does not write those bodies today. This is out of scope and is filed as a follow-up.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Absolute per-page `source` | As an agent, I want a per-page record's `source` to be the absolute, base-including URL that equals `_links.self.href` and the index's `source`, so that following it never 404s (#236). | High | Open | [build] | no: the based-fixture test fails on the current code |
| FR-002 | Base-aware OKF fallback URL | As a reader, I want OKF links that fall back to the site to carry origin plus base, composed once and shared by the integration and the CLI without doubling an included base, so that site files resolve (#237 defect 1). | High | Open | [build] | no: the `llms.txt` row fails on the current code |
| FR-003 | Source-relative `.md` resolution | As a reader, I want relative, root-absolute and already-based `.md`/`.mdx` links to resolve against the linking page's source directory, matched by page id, so that they become links inside the bundle (#237 defects 2 and 3). | High | Open | [build] | no: the `../guides/README.md` row fails on the current code |
| FR-004 | Route-relative non-`.md` links unchanged | As a reader, I want links that do not name a `.md` file to keep resolving against the page route, so that links to generated files and directory routes keep working. | Medium | Open | [ratchet] | yes: paired with the FR-003 rows on the same fixture |
| FR-005 | Unresolved `.md` left as authored | As an author, I want a `.md` target with no bundle page left unchanged and reported by the advisory dangling-link check, rather than turned into a URL that 404s. | Medium | Open | [build] | no: the current code turns it into a site URL |
| FR-006 | Docs follow the behaviour | As a consumer, I want the export-okf guide (`--site-url` meaning), the ADR-0059 link-form section (as an addendum), the rewrite-policy comments in the code, and the CHANGELOG to describe the new behaviour. | Medium | Open | [build] | no: reviewed against the diff |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Failing tests first | Each of the four defects (#236, and #237 defects 1–3) has at least one test that fails on the merge-base and passes on the PR head. | Reliability | High | Open |
| NFR-002 | Unbased parity | On an unbased fixture, 0 bytes change in the OKF bundle and in the agent API, apart from the per-page `source` field. | Reliability | High | Open |
| NFR-003 | Complexity | No new or changed function exceeds cyclomatic complexity 15. | Maintainability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Graph-only resolution | The OKF export keeps resolving links through its own content graph. It adds an id index next to the route index and builds no second route resolver. | Technical | High | Open |
| C-002 | Pure agent record | `toAgentRecord` stays base-less. The base is added only at the route boundary (ADR-0037). | Technical | High | Open |
| C-003 | ADRs are immutable | ADR-0059 is changed only by an addendum, not by rewriting its accepted text. | Governance | Medium | Open |

### Key Entities

- **Agent page record**: the per-page JSON at `/api/pages/<id>.json`. Its `source` is its own canonical URL.
- **OKF bundle page**: an exported page, identified by its graph node id (the source path without its extension), written at a bundle path (a README becomes `index.md`).
- **Site URL**: the origin plus the base. Every link that falls back to the site is resolved against it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a based fixture, 100% of per-page agent records have a `source` equal to their `_links.self.href`. — [build] · no-op passable: no
- **SC-002**: On a based fixture, 0 OKF links between pages point outside the bundle when their target is a bundle page. — [build] · no-op passable: no
- **SC-003**: The four example links in the #237 issue table all produce the expected output under the fixed rules. — [build] · no-op passable: no
- **SC-004**: An unbased fixture's OKF bundle stays byte-identical before and after the change. — [ratchet] · no-op passable: yes, paired with SC-002 on the based fixture

## Assumptions

- `options.base` reaches `exportOkfBundle` from both the integration and the CLI. The CLI already accepts a base.
- No external consumer depends on the per-page `source` being base-less. ADR-0037 already documents it as absolute.
- Follow-up: rewriting links in section-index page bodies is filed as a separate issue.
