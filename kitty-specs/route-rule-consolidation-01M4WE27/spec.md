# Mission Specification: Route rule and index-name consolidation

**Mission Branch**: `fix/route-rule-consolidation`  
**Created**: 2026-10-14  
**Status**: Draft  
**Issues**: #134, #135, #136, #137, #138, #139 (follow-ups from PR #133)  
**Target release**: 0.3.0 (ships before 0.3.0 is cut, so adopters migrate once)  
**Input**: Operator brief: "follow-ups from PR #133 (route rule / index names / glossary autolinker)", plus binding operator decisions recorded below.

## Intent Summary (confirmed 2026-10-14)

A **site author** builds a DocKitty site, or runs `dockitty-check-links --strict`
on its sources. Every surface that shows a page address (feeds, `llms.txt`,
related links, the Hub, the scenario index, the on-this-page block, the
sidebar) derives it from the one shared route rule. Index names are set once.
Two published files that would share an address stop the build with a message
that names both files and says how to fix it. The glossary autolinker never
places a link inside another link.

**Invariant**: every surface derives a page's address from the same rule, and no
two published files share an address without an error.

### Operator decisions (binding)

1. #139 is part of this mission, in its own work package with no dependency on the routing work.
2. A route collision fails the build and `check-links --strict`, with a message that names both files and the fix. This is breaking. In the same spirit, a disagreeing index-name setting is an error, not a warning (FR-007, FR-008).
3. Index names are configured once, in the toolkit config. The docs loader and `dockitty-check-links` derive them from it.
4. The mission ships before 0.3.0.
5. The reserved `_meta/` folder (registry data) is excluded everywhere: loader, route table, link check and sidebar (decision `01M4WE30W61BS7CG5D0KH99T0T`).

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| **source path** | A docs file's path under the docs folder, e.g. `guide/README.md`. | "file path" when the project-root path is meant |
| **page id** | The id the docs loader gives an entry, e.g. `guide/index`. The reserved root id `index` stands for the site root. | "slug" as a synonym for route |
| **route** | The path a page is served at, without the site base, e.g. `/guide/`. Produced only by the shared route rule. | "URL", "link" |
| **address** | The route with the site base added, as written into HTML, feeds and `llms.txt`. | "href" in user-facing text |
| **index name** | A configured file stem that makes a file its folder's index page, e.g. `README`. | "index file" when the literal `index.md` is meant |
| **route collision** | Two or more published source paths that produce the same route. | "duplicate page" |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Page addresses that resolve everywhere (Priority: P1)

A site author has a page whose id ends in `/index` (for example a folder with an
`index.md` on a site that lists `README` and `index`). Today, feeds, `llms.txt`,
related links and other surfaces advertise `/<id>/`, for example
`/guide/index/`, which the site does not serve. After this mission, every
surface advertises the address the site actually serves (`/guide/`).

**Why this priority**: broken addresses in feeds and `llms.txt` reach readers and
tools outside the site, and the link gate cannot see them.

**Independent Test**: build a fixture with an id ending in `/index`; every
surface that lists that page shows the folder address, and none shows
`/index/`.

**Acceptance Scenarios**:

1. **Given** a page with id `guide/index`, **When** the site builds, **Then** RSS, `llms.txt`, related links, the Hub, the scenario index and the on-this-page block all give its address as `<base>/guide/`.
2. **Given** the root page (reserved id `index`), **When** the site builds, **Then** every surface gives its address as `<base>/`, never `<base>/index/`.
3. **Given** a page with an ordinary id `guide/setup`, **When** the site builds, **Then** its address stays `<base>/guide/setup/` (positive control: nothing else changes).

---

### User Story 2 - Two files cannot silently claim one address (Priority: P1)

A site author has `x/README.md` and `x/index.md` in one folder, or a Gherkin
`index.feature` that would generate a page at its folder's address. Today one
of them silently wins, depending on settings. After this mission the build and
`check-links --strict` stop, name every file involved, and say how to fix it.

**Why this priority**: today the reader may see the wrong page and the author is
not told.

**Independent Test**: a fixture with `x/README.md` and `x/index.md` fails the
build and `check-links --strict` with both paths in the message. Removing one
file makes both pass.

**Acceptance Scenarios**:

1. **Given** a site whose index names are only `README`, with `x/README.md` and `x/index.md`, **When** the site builds, **Then** the build fails, naming both files and suggesting a fix (rename or remove one).
2. **Given** the same tree, **When** `dockitty-check-links --strict` runs, **Then** it fails with the same collision.
3. **Given** `README.md` and `index.md` at the docs root, **When** the site builds, **Then** the build fails the same way.
4. **Given** a Gherkin source holding `x/index.feature`, **When** pages are generated, **Then** generation stops with an error naming the feature file, on any index-name setting.
5. **Given** a draft file and a published file that collide, **When** drafts are on or off, **Then** the collision is reported either way (a collision is about the sources, not about what one build publishes).
6. **Given** a folder with only `x/README.md`, **When** the site builds, **Then** it builds, and the folder's index page is `x/README.md` (positive control).

---

### User Story 3 - Index names set in one place (Priority: P2)

A site author sets index names once, in the `indexBasename` option of
`defineDocKittyIntegrations` in their `astro.config.*`. The docs loader and
`dockitty-check-links` use the same names without being told again.
Today they are set in three places, and the check's default (`README,index`)
differs from the loader's (`README`), so the build and the check can disagree.

**Why this priority**: two settings that must agree, but are never compared,
produce silent disagreements.

**Independent Test**: set index names to `['index']` in the toolkit config only;
the loader routes `x/index.md` to `/x/` and `check-links --strict`, run with no
`--index-basename` flag, resolves a link to `x/index.md` the same way.

**Acceptance Scenarios**:

1. **Given** index names set only in the toolkit config, **When** the site builds and `check-links --strict` runs, **Then** both use those names.
2. **Given** no index names set, **When** both run, **Then** both use the same documented default.
3. **Given** an author passes `--index-basename` that disagrees with the configured index names, **When** the check runs, **Then** it exits non-zero and prints both values.
4. **Given** an author passes `--index-basename` that matches the configured names, **When** the check runs, **Then** it passes (positive control).
5. **Given** `docKittyDocsLoader` is called with an `indexBasename` that differs from the integration's, **When** the site builds, **Then** the build fails, naming both values.
6. **Given** an adopter whose content config never calls `docKittyDocsLoader`, **When** `check-links --strict` runs, **Then** it uses the documented default and says which source it used.

---

### User Story 4 - The sidebar recognises a folder's index page (Priority: P2)

A site author has a folder with a draft `README.md` and a published `index.md`.
Today the sidebar shows the folder under its raw directory name instead of the
index page's title. After this mission, the sidebar decides what a folder's
index page is with the same rule as the rest of the site, and it reads the docs
tree with the same walk.

**Why this priority**: the sidebar is the most visible place where two rules
disagree.

**Independent Test**: the fixture above shows the folder labelled with the
published page's title, with drafts off.

**Acceptance Scenarios**:

1. **Given** index names `['index']` and a folder with a draft `README.md` and a published `index.md`, **When** the site builds with drafts off, **Then** the sidebar labels the folder with `index.md`'s title, matching the route table.
2. **Given** index names `['README']`, a draft `x/README.md` and a published `x/other.md`, **When** the site builds with drafts off, **Then** the sidebar shows no title taken from the unpublished index page and matches the route table's view of `/x/`.
3. **Given** markdown files under `_meta/`, **When** the site builds, **Then** none appears in the sidebar, the route table, the loader or the link check, while `docs/_meta/bibliography.yaml` and the other registry files still load through their catalog loaders.
4. **Given** a normal folder with a published `README.md`, **When** the site builds, **Then** the sidebar is unchanged from today (positive control).

---

### User Story 5 - Glossary terms inside reference-style links (Priority: P3)

An author writes `[some glossary term][ref]`. Today the glossary autolinker wraps
the term in its own link, inside the author's link: invalid HTML and an
accessibility failure. After this mission it leaves link text alone in
reference-style links and in link definitions, as it already does for inline
links.

**Independent Test**: a page with a glossary term inside `[text][ref]` renders one
link, not nested ones; the same term in plain text on the same page is still
autolinked.

**Acceptance Scenarios**:

1. **Given** a glossary term inside `[term][ref]`, **When** the page renders, **Then** there is exactly one link (the author's).
2. **Given** the same term in plain text on the same page, **When** it renders, **Then** it is autolinked (positive control on the same fixture).

### Edge Cases

- A collision in which one file is a draft: reported regardless of the draft setting.
- A collision between a generated page and an authored page: already stops the build (ADR-0048); the message stays consistent with the new collision report.
- A site with a single index name and a folder holding both files: this is the case #135 reports, and it must fail.
- The site root: `README.md` and `index.md` at the docs root collide exactly like a folder.
- `.mdx` collisions: `x/README.mdx` with `x/index.md`, and `x/index.md` with `x/index.mdx` (same stem, two extensions).
- Letter case: `x/readme.md` on a case-insensitive filesystem. The plan states whether index-name matching is case-sensitive and records it in the ADR.
- An authored index page at a generated glossary or Gherkin hub route goes through the same collision report as any other collision; the ADR-0048 wording stays.
- `_meta` as a file stem (`_meta.md`), not only as a folder.
- `_meta/` inside a subfolder (`guide/_meta/`): excluded the same way as the root `_meta/`, or the plan records otherwise with a reason.
- The example site and this repository's own docs may already contain a collision: audit both before collisions fail, including `example/docs/plans/` (the example sets index names `['README','index']` on purpose), and fix any found as part of the mission.
- Address changes in feeds and `llms.txt` change their built output; the determinism gates must still produce identical bytes across two builds.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | One address rule for every surface | As a site author, I want feeds, `llms.txt`, related links, the Hub, the scenario index and the on-this-page block to show the address the site serves, so that no surface advertises an unserved `/<id>/index/` route (#134). | High | Open | [build] | no — fixture with an `/index` id fails today on each surface |
| FR-002 | Root page address | As a site author, I want the root page (reserved id `index`) to be listed at the site base on every surface, so that no surface shows `/index/` (#134). | High | Open | [build] | no — fails today on the related-links surface |
| FR-003 | No new hand-built addresses | As a maintainer, I want a test that walks the listing-surface modules and fails on a page address built from a page id without the shared route rule, so that #134 cannot regress; it fails on a planted example and passes on the unchanged tree. | Medium | Open | [build] | no — guard must fail on a planted hand-built address (positive control) |
| FR-004 | Route collisions stop the build | As a site author, I want two published source paths that produce the same route to stop the build with a message naming every file and the fix, so that a reader never gets the wrong page silently (#135). | High | Open | [build] | no — README-only fixture with `x/README.md` + `x/index.md` builds today |
| FR-005 | Route collisions fail the strict check | As a site author, I want `dockitty-check-links --strict` to report the same collisions as the build, so that I find them before building (#135). | High | Open | [build] | no — same fixture passes the strict check today |
| FR-006 | `index.feature` is rejected | As a site author, I want Gherkin generation to reject a feature file named `index.feature` on any index-name setting, even when no other file collides, so that it cannot take its folder's address (#137). | Medium | Open | [build] | no — README-only fixture generates today; paired with `x/other.feature` generating |
| FR-007 | Index names set once | As a site author, I want to set index names once, in the `indexBasename` option of `defineDocKittyIntegrations` in my `astro.config.*`, and have `docKittyDocsLoader` (when not given its own value) and `dockitty-check-links` use them, so that the build and the check cannot disagree; a loader value that differs is an error naming both (#136). The plan names how the check reads the configured value. | High | Open | [build] | no — config-only `['index']` fixture disagrees today |
| FR-008 | Conflicting index-name flag fails | As a site author, I want `dockitty-check-links` to exit non-zero, printing both values, when `--index-basename` disagrees with the configured index names, so that a stale flag cannot silently change the check (#136). | Medium | Open | [build] | no — paired with a matching flag that passes on the same fixture |
| FR-009 | Sidebar uses the shared index rule | As a site author, I want the sidebar to recognise a folder's index page with the shared route rule, so that a draft index next to a published one does not hide the folder's title (#138). | Medium | Open | [build] | no — draft-README fixture shows the raw directory name today |
| FR-010 | One docs walk, `_meta/` excluded | As a maintainer, I want the sidebar to read the docs tree through the shared walk, and the shared walk to exclude `_meta/`, so that every consumer sees the same set of files, while the registry files in `_meta/` still load through their catalog loaders (#138, decision 5). | Medium | Open | [build] | no — a `_meta/x.md` fixture gets a route today; paired with the bibliography still loading |
| FR-011 | Glossary skips reference-style link text | As a reader, I want the glossary autolinker to leave terms inside reference-style links and link definitions unlinked, so that pages never contain a link inside a link (#139). | Medium | Open | [build] | no — paired with the plain-text autolink on the same fixture |
| FR-012 | Upgrade notes for adopters | As an adopter, I want each breaking change written in the changelog in plain, user-focused language, with what I see and what to do, so that I can upgrade to 0.3.0 in one pass. | High | Open | [build] | no — reviewed by a communications reviewer before the PR is ready |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Unchanged output where nothing collides | For the example site, built output is byte-identical before and after the mission except for files whose addresses FR-001/FR-002 correct; every changed file is listed and explained. | Reliability | High | Open |
| NFR-002 | Deterministic output | Two consecutive builds of the example site produce byte-identical output (existing determinism gates stay green). | Reliability | High | Open |
| NFR-003 | Actionable collision message | Every collision message names 100% of the colliding source paths, the shared route, and at least one concrete fix. | Usability | High | Open |
| NFR-004 | Build time | Example-site build time does not grow by more than 10% (median of 3 runs, same machine). | Performance | Medium | Open |
| NFR-005 | Existing gates green | Typecheck, lint, unit tests, a11y, link integrity, doc sanity and the consumption test all pass on the PR head. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Shared rule is the only authority | Routes come only from the shared route rule introduced in PR #133; no new parallel rule is added. | Technical | High | Open |
| C-002 | Accepted ADRs are not edited | Decisions are recorded in a new ADR that amends ADR-0047 and ADR-0048. | Governance | High | Open |
| C-003 | Ships before 0.3.0 | The mission merges before 0.3.0 is cut; its breaking entries join the existing 0.3.0 Breaking section. | Business | High | Open |
| C-004 | Config without import cycles | Index names reach the docs loader without an import cycle between the content config and the toolkit config; spike this before implementing FR-007. | Technical | High | Open |
| C-005 | Test economy | Tests guard behaviour through existing entry points and fail when the fix is reverted (DIRECTIVE_041); no shape pins, no duplicate assertions. | Process | High | Open |
| C-006 | Changelog is user-focused | The changelog entries are reviewed and rewritten by the communications profile (comms-cleo) to lead with what the user sees, without internal jargon, before the PR is marked ready. | Process | High | Open |

### Key Entities

- **Route table**: the map from each published source path to its route, plus the collisions found while building it.
- **Index-name setting**: the ordered list of index names, set once in the toolkit config.
- **Route collision**: a route plus every source path that produces it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fixture covering every listing surface, 0 surfaces advertise an address the site does not serve (today: at least 5). — [build] · no-op passable: no
- **SC-002**: 100% of route collisions in a fixture set (folder, site root, draft-involved, `index.feature`) stop both the build and the strict check. — [build] · no-op passable: no
- **SC-003**: An author sets index names in exactly 1 place, and the build and the strict check agree on 100% of links in the example site and this repository's docs. — [build] · no-op passable: no
- **SC-004**: 0 nested links in rendered pages of a fixture with glossary terms inside reference-style links. — [build] · no-op passable: no
- **SC-005**: Every breaking change in this mission has a changelog entry an adopter can act on without reading code (communications review passed). — [build] · no-op passable: no

## Assumptions

- An adopter who has two files sharing a route today gets a clear error with a fix; the example site's `['README','index']` setting is kept and audited, not assumed collision-free.
- The example site and this repository's docs contain no route collision; the audit in the plan confirms or fixes this.
- Index names keep their current default (`README`) unless the plan finds a reason to change it, recorded in the ADR.
