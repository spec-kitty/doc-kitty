# Mission Specification: Page chrome: footer entry points, sidebar, metadata blocks, hub order, page formats and nav icons

**Mission Branch**: `feat/page-chrome`
**Created**: 2026-11-05
**Status**: Draft
**Input**: Tickets #290 (all four items, as amended on 2026-11-05), #292 and #293. Follow-up: the references work in #289 is a separate, later mission.

## Purpose

Reading a page on a DocKitty site takes more effort than it should. Sidebars open fully expanded, metadata blocks push content down, and a hub's child cards come last. Agents and tool authors also can't tell from a page which machine-readable surfaces exist, for the site or for that page. End users have asked for sidebar icons as well.

This mission fixes these as one change to the page chrome, because the work overlaps in the same blocks and carriers.

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| Machine entry point | A site-wide machine-readable surface, such as the LLM index, the agent API index or a feed | "API link", "machine format" |
| Page format | A machine-readable version of the current page: JSON, OKF or Atom entry | "alternate" on its own, "export" |
| Source link | The opt-in link, labelled "source", that opens the current page's file in the site's repository. It is not a page format | "markdown link", "edit link" |
| Metadata block | The Audience, Related, External references or Glossary links block on a page | "panel" in reader-facing text |
| Consumer-mounted surface | A surface that exists only when the consuming site adds its route | |
| Injected surface | A surface the toolkit adds to every site, such as the OKF bundle and the content graph | |
| Generated sidebar | The sidebar the toolkit builds from the docs tree | |
| Consumer-written sidebar | A sidebar a site writes as an explicit list. The toolkit doesn't reshape it | |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find my way in a long sidebar (Priority: P1)

A reader opens a page deep in a large site. The sidebar shows the path to that page, with every other section closed, and each section's README comes first.

**Why this priority**: End users asked for it directly, and it affects every page of every site that uses the generated sidebar.

**Independent Test**: Build a site with nested sections, open a deep page with scripts disabled, and inspect which groups are open.

**Acceptance Scenarios**:

1. **Given** a site with default settings, **When** a reader opens a deep page, **Then** that page's group and its ancestors are open and every other group is closed, with scripts disabled.
2. **Given** a site that sets the collapse opt-out, **When** it builds, **Then** the sidebar output is byte-identical to the output before this mission.
3. **Given** a group with an index page, **When** the sidebar renders in either index mode, **Then** the index is the group's first link.
4. **Given** a site that enables title-as-index, **When** a reader opens a group's index page, **Then** the group label is the link, it is marked as current, no "Overview" entry appears, and a separate control expands and collapses the group.
5. **Given** a site with a consumer-written sidebar, **When** it builds, **Then** the sidebar stays as written.

---

### User Story 2 - See a hub's children first (Priority: P1)

A reader lands on a section hub to choose a child page. The child cards come straight after the hub's own text, and the metadata blocks follow them.

**Why this priority**: The cards are the reason to visit a hub. It's also the smallest item, and the metadata block work builds on it.

**Independent Test**: Build the example site and compare the DOM order on hubs that carry metadata blocks.

**Acceptance Scenarios**:

1. **Given** a hub with metadata blocks (`behaviour/shipping/`, `rhetoric/book-one/`), **When** it renders, **Then** the order is audience, body, child cards, metadata blocks.
2. **Given** a page that isn't a hub, **When** it renders, **Then** its block order is unchanged and no block is lost.

---

### User Story 3 - Read content without metadata in the way (Priority: P1)

A reader opens a page with an audience note, related pages, references and glossary links. Each block starts collapsed and shows its label and count, and the reader expands only what they want.

**Why this priority**: Long metadata blocks push down or trail the content on many pages.

**Independent Test**: Open a page with all four blocks, use only the keyboard to expand each one, then repeat with scripts disabled.

**Acceptance Scenarios**:

1. **Given** a page with metadata blocks on a default site, **When** it first loads, **Then** every block is collapsed and shows its label and a count, for example "External references (4)".
2. **Given** a collapsed block, **When** a reader uses a keyboard or a mouse, **Then** it expands and collapses.
3. **Given** a reader expanded a block, **When** they open another page, **Then** that page's blocks start collapsed.
4. **Given** scripts are disabled, **When** a reader opens a page, **Then** all block content can still be reached.
5. **Given** a site that sets the block opt-out, **When** a page loads, **Then** its blocks start expanded.

---

### User Story 4 - Find the site's machine entry points (Priority: P2)

An agent or tool author on any page looks in the footer and finds links to the surfaces this site actually serves.

**Why this priority**: It's the way to discover these surfaces from a page, and page format links depend on the same knowledge of what a site serves.

**Independent Test**: Build the example with and without the theme and follow every link in the group. Then unmount one surface and rebuild.

**Acceptance Scenarios**:

1. **Given** the example site, **When** it builds, **Then** the footer links the LLM index, agent API index, content graph, RSS feed, sitemap, bibliography and OKF bundle, with and without the theme.
2. **Given** a site that doesn't mount a surface, **When** it builds, **Then** no footer link points to that surface.
3. **Given** a site deployed under a base path, **When** it builds, **Then** every link resolves.
4. **Given** a site that turns the group off or relabels it, **When** it builds, **Then** the footer reflects that.

---

### User Story 5 - Get this page in another format (Priority: P2)

An agent or tool author viewing a page wants that page as data. The footer and the page head both name its JSON, OKF and Atom versions.

**Why this priority**: End users asked for it, and site-wide links can't point to one page's data.

**Independent Test**: On a built page, follow each page format link and confirm it returns that page's content.

**Acceptance Scenarios**:

1. **Given** a published page, **When** it renders, **Then** the footer links each page format the site serves, and the page head declares the same set.
2. **Given** default settings, **When** a site builds, **Then** every published, dated page has a valid Atom entry with no consumer wiring.
3. **Given** a site that turns Atom off, **When** it builds, **Then** no Atom entries are produced and no Atom link appears.
4. **Given** a draft or unpublished page, **When** the site builds, **Then** it has no page format links and no Atom entry.
5. **Given** the spec-kitty theme, **When** a page renders, **Then** the links use the pill style. **Given** no theme, **Then** they are plain links with the same target size.

---

### User Story 6 - Open a page's source (Priority: P3)

A reader or agent wants the file behind a page. On a site that has configured its repository, the footer has a link labelled "source".

**Why this priority**: It replaces the requested markdown format, and it's opt-in.

**Independent Test**: Build with and without repository settings, on one authored page and one generated page.

**Acceptance Scenarios**:

1. **Given** a site with repository settings, **When** an authored page renders, **Then** a link labelled "source" opens that file's view page on the repository host.
2. **Given** a site with no repository settings, **When** a page renders, **Then** no source link appears.
3. **Given** a generated glossary or Gherkin page, **When** it renders, **Then** no source link appears, even with repository settings.

---

### User Story 7 - Recognise sidebar entries by icon (Priority: P3)

An author adds an icon to a page or section so readers can spot it in the sidebar.

**Why this priority**: It's a real request, but the sidebar works without it.

**Independent Test**: Author one page icon, one section icon and one unknown icon name, then build with scripts disabled.

**Acceptance Scenarios**:

1. **Given** an icon on a page and on a section, **When** the site builds, **Then** both appear in the static sidebar, and the entry's label stays its accessible name.
2. **Given** an unknown icon name, **When** the site builds or validates, **Then** it fails with a message naming the page or section and the icon.
3. **Given** a site with no icons authored, **When** it builds, **Then** this feature doesn't change its sidebar.

### Edge Cases

- A site's only group holds the current page: it stays open, and nothing else is affected.
- A page isn't in any group, such as the root page: all groups start closed.
- A metadata block has no entries: it doesn't render, so no "(0)" control appears.
- A hub has no child cards: its metadata blocks still render after the body.
- A route is mounted at a non-standard path: it isn't recognised, so it isn't linked. The limit is documented.
- A published page has no date, which Atom requires: it gets no Atom entry and no Atom link.
- A page format's path contains a nested or README-derived slug: the link still points to that page's file. OKF paths follow source files, not slugs.
- Title-as-index and a custom index label are both set: config validation fails with a clear message.
- A group has no index page in title-as-index mode: its label stays a plain toggle.
- A consumer-written sidebar wants icons: not supported in this mission, and the limit is documented.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Machine entry points group | As an agent or tool author, I want the default footer to link every machine entry point the site serves (LLM index, agent API index, content graph, RSS, sitemap, bibliography, scenarios, OKF bundle), with and without a theme, so that I can discover them from any page. The MCP pointer isn't linked, as it isn't a URL on the site. | High | Open | [build] | no |
| FR-002 | One served-surfaces source | As a site owner, I want the toolkit to detect which surfaces my site serves from its routes at build time, with no declaration, and I want the footer, page head and agent index to read that one result, so that they can't disagree. Only standard paths are recognised. | High | Open | [build] | no |
| FR-003 | No link to an unserved surface | As an agent, I want no link to a surface the site doesn't serve, in the footer or the page head, so that I never follow a dead link. | High | Open | [build] | yes: paired with FR-001 on the same fixture, with the surface mounted and then unmounted |
| FR-004 | Footer group control | As a site owner, I want to turn the machine entry points group off or relabel it, so that the footer fits my site. | Medium | Open | [build] | no |
| FR-005 | Collapsed sidebar by default | As a reader, I want generated sidebar groups closed by default, except the current page's group and its ancestors, in the static HTML, so that I see where I am without scrolling. | High | Open | [build] | no |
| FR-006 | Sidebar collapse opt-out | As a site owner, I want a setting that restores expanded groups with byte-identical sidebar output, so that I can keep today's behaviour. | High | Open | [build] | no |
| FR-007 | Title-as-index option | As a site owner, I want an opt-in mode where a group's label links to its index, no "Overview" entry appears, the current page is marked, and a separate control expands the group, so that the sidebar has no duplicate entry. With scripts off, that control is a native summary, which exposes expanded state. With scripts on, it is a button with `aria-expanded` and `aria-controls`. | Medium | Open | [build] | no |
| FR-008 | Index first in both modes | As a reader, I want a group's index to be its first link in both index modes, so that a README is always easy to find. | High | Open | [ratchet] | yes: a test covers both modes, with a control fixture whose index isn't first in the source order |
| FR-009 | Conflicting index settings | As a site owner, I want title-as-index together with a custom index label to fail validation with a clear message, so that I don't get a silently ignored setting. | Medium | Open | [build] | no |
| FR-010 | Consumer-written sidebar untouched | As a site owner with a consumer-written sidebar, I want it left as written, so that the new default doesn't alter my navigation. | High | Open | [ratchet] | yes: paired with FR-005 in one build, showing the generated sidebar does change |
| FR-011 | Pagination titles preserved | As a reader, I want previous and next links to keep correct page titles in every sidebar mode, so that relabelling doesn't leak into pagination. | Medium | Open | [ratchet] | yes: run against a page with a relabelled index, with and without title-as-index |
| FR-012 | Hub cards before metadata blocks | As a reader, I want a hub's order to be audience, body, child cards, metadata blocks, so that I reach child pages first. Verified on `behaviour/shipping/` and `rhetoric/book-one/`, which carry blocks. | High | Open | [build] | no |
| FR-013 | Other layouts keep their order | As a site owner, I want non-hub pages to keep their block order and lose no block, so that the hub change has no side effects. No layout, including a theme's, can drop the blocks. | High | Open | [ratchet] | yes: paired with FR-012 in one build, plus a negative test for a layout that doesn't place them |
| FR-014 | Collapsed metadata blocks | As a reader, I want the four metadata blocks to start collapsed, showing label and count, and to toggle by keyboard and mouse, so that content comes first. | High | Open | [build] | no |
| FR-015 | Metadata block opt-out | As a site owner, I want a setting that starts blocks expanded, so that a site relying on visible audience notes can keep them. | Medium | Open | [build] | no |
| FR-016 | No persisted block state | As a reader, I want each page's blocks to start collapsed whatever I did on the last page, and nothing stored, so that behaviour stays predictable. | Medium | Open | [build] | yes: paired with FR-014, which proves that blocks toggle on the same page |
| FR-017 | Shared disclosure control | As a reader, I want metadata blocks, the table of contents rail and the title-as-index chevron to use one disclosure control, extracted from the rail's toggle, with a no-script baseline for blocks and groups, and the rail's behaviour and stored preference unchanged, so that they look and work alike. | Medium | Open | [build] | no |
| FR-018 | Blocks work without scripts and in search | As a reader, I want collapsed content to stay reachable with scripts off and findable through site search, so that collapsing hides nothing for good. | High | Open | [ratchet] | yes: a sentinel word in a collapsed block must appear in the search index, with a control word outside the block |
| FR-019 | Page format links | As an agent or tool author, I want the footer to link the current page's JSON, OKF and Atom versions, each marked as an alternate with its media type, and matching the page head, so that I can fetch this page as data. | High | Open | [build] | no |
| FR-020 | Injected Atom entries | As a site owner, I want every published page that has a date to get a valid Atom entry with no wiring, and a setting to turn this off, so that the format is available by default. | High | Open | [build] | no |
| FR-021 | Head links follow served surfaces | As an agent, I want the page head's site-wide alternate links to come from the same served-surface knowledge instead of a fixed list, so that the head can't name a missing feed. | Medium | Open | [build] | no |
| FR-022 | No formats for drafts | As a site owner, I want draft and unpublished pages to expose no page format link and no Atom entry, so that unpublished work doesn't leak. | High | Open | [build] | yes: one fixture holds a published and a draft page, and the published page must show the links |
| FR-023 | Opt-in source link | As a site owner, I want minimal repository settings (provider, repository, branch, docs folder) that add a link labelled "source" to the file's view page, so that readers can open the file. These settings must be reusable by the edit-link work, see #150. | Medium | Open | [build] | no |
| FR-024 | No source link when unset or generated | As a reader, I want no source link when the site has no repository settings, or on a generated page, so that I never reach a wrong or missing file. | High | Open | [build] | yes: one fixture holds an authored and a generated page, and the authored page must show the link |
| FR-025 | Link styling by theme | As a site owner, I want page format and source links in the pill style under the spec-kitty theme and as plain links without a theme, so that the default chrome stays minimal. | Low | Open | [build] | no |
| FR-026 | Page and section icons | As an author, I want to set an optional icon on a page and on a section, rendered in the static sidebar with the label as the accessible name, so that readers can recognise entries. A group takes its icon from `sections.yaml`, or else its index page. | Medium | Open | [build] | no |
| FR-027 | Unknown icon fails | As an author, I want an unknown icon name to fail both the build and the build-free validation, with a message naming the page or section, so that a typo doesn't ship as a blank space. | Medium | Open | [build] | no |
| FR-028 | No icons, no change | As a site owner who authors no icons, I want the feature to leave my sidebar and output files unchanged, so that I don't pay for what I don't use. | Medium | Open | [ratchet] | yes: paired with FR-026 on one fixture, built with and without an icon |
| FR-029 | Documentation and upgrade note | As a site owner, I want the consumer guide to cover each new setting and frontmatter field, the consumer-written sidebar limit for icons, and an upgrade note for the changed sidebar and metadata block defaults, so that an upgrade holds no surprises. | High | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Deterministic output | Two builds of the same input differ by 0 bytes across pages, Atom entries and machine surfaces. | Reliability | High | Open |
| NFR-002 | Accessibility | 0 automated accessibility violations at WCAG 2.2 AA on sidebar, hub, metadata block and footer pages, in light and dark, with and without the theme. | Accessibility | High | Open |
| NFR-003 | Target size and focus | 100% of new links and controls measure at least 24×24 CSS pixels and show a visible focus ring. | Accessibility | High | Open |
| NFR-004 | Works without scripts | With scripts disabled, 100% of sidebar state and metadata block content is correct and reachable. | Reliability | High | Open |
| NFR-005 | Search coverage | 100% of collapsed metadata block text stays in the site search index. | Reliability | High | Open |
| NFR-006 | No first-load layout shift | Metadata blocks and sidebar groups cause 0 script-driven changes of open state on first load. | Performance | Medium | Open |
| NFR-007 | Icon delivery cost | Icons add 0 font files and 0 external requests, and the output holds 0 icons that no page or section uses. | Performance | Medium | Open |
| NFR-008 | Valid Atom | 100% of generated Atom entries are well-formed XML and contain every element RFC 4287 requires of a standalone entry, checked by a strict parser. | Interoperability | High | Open |
| NFR-009 | Link integrity | The base-aware link gate reports 0 broken links on both a root and a based build of the example. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Record the carrier change | Title-as-index and sidebar icons change what the sidebar carrier owns, which ADR-0063 decision 1 forbids. A new ADR must record it before merge, and the carrier count stays at six. ADR-0063 itself stays as written. | Governance | High | Open |
| C-002 | Record the block placement and disclosure seam | Placing a hub's metadata blocks after the layout needs an ADR, with a guard test. The shared disclosure control needs its own ADR. | Governance | High | Open |
| C-003 | No font-based icons | Nerd Fonts and the Font Awesome webfont or Kit are out. Icons are build-time inline SVG from Starlight's built-in set plus one pinned Font Awesome solid package. | Technical | High | Open |
| C-004 | Pill styling is theme-only | Pill and eyebrow styling isn't added to the unthemed default chrome. | Business | Medium | Open |
| C-005 | References out of scope | No citation notation, catalog schema or references page work, see #289. Metadata blocks keep their current row content. | Business | High | Open |
| C-006 | Edit-link work out of scope | No edit link provider logic and no fix for generated pages' real sources, see #150. | Business | Medium | Open |
| C-008 | Font Awesome attribution | Pages that render a Font Awesome icon carry one CC BY 4.0 licence comment in the HTML, and the guide documents it. Pages with none carry no comment. | Regulatory | High | Open |
| C-007 | Repository conventions | User-visible changes add changelog fragments, never edit `CHANGELOG.md`. New ADRs take the next free number and never edit the index table. | Governance | High | Open |

### Key Entities

- **Served surfaces**: the set of surfaces a site serves, detected from its routes at build time. The footer, page head and agent index read it.
- **Repository settings**: provider, repository, branch and docs folder. Their presence turns on the source link.
- **Atom entry**: one per published, dated page, unless the site turns it off.
- **Icon reference**: an optional name on a page or a section, resolved against the allowed icon sets at build time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a default site, a reader sees only the current page's branch of the sidebar open, on 100% of sampled deep pages, with scripts disabled. — [build] · no-op passable: no
- **SC-002**: On both named hubs, 100% of child cards come before the first metadata block. — [build] · no-op passable: no
- **SC-003**: On a page with all four metadata blocks, 100% of blocks start collapsed, and the first paragraph of content sits higher than with those blocks expanded. — [build] · no-op passable: no
- **SC-004**: From any page (a slide deck is not one: it has no Starlight footer or head), an agent reaches every served machine entry point and the page's formats in one link, and 0 links lead to a missing surface. — [build] · no-op passable: no
- **SC-005**: A site owner who wants today's sidebar and expanded metadata blocks gets them with 2 settings. The sidebar output is byte-identical to before, and the blocks keep their new markup, open. — [build] · no-op passable: no
- **SC-006**: An existing site upgrading with no config changes builds with 0 errors, and its only changes are the documented ones. — [ratchet] · no-op passable: yes: paired with SC-001 on the same site, which proves the defaults did change

## Assumptions

- The changed defaults are acceptable while the toolkit is pre-1.0, given an upgrade note. The maintainer chose this on 2026-11-05.
- Surfaces are detected from the routes Astro resolves. The maintainer chose this over #290's site-level declaration on 2026-11-05, after a spike confirmed the routes are reported at build time.
- Injected Atom entries add new output files to existing sites. That is an expected, documented change.
- Repository settings cover the hosted GitHub, GitLab and Bitbucket services, the same three hosts as #150, not self-hosted instances.
- Published pages with no date are the one exception to #292's "every published page gets an Atom entry", since RFC 4287 requires a date.
- The example site stays free of sidebar icons and title-as-index, so its deployed builds keep testing Starlight's renderer. A frozen fixture proves those two features. This amends #293's "the example shows an icon".
- The page head's alternate list includes page formats for published pages only.

## Dependencies and sequencing

- Hub ordering (FR-012, FR-013) comes before collapsible blocks (FR-014 to FR-018), so the slot change happens once.
- Served-surface detection (FR-002) comes before page format links (FR-019) and head links (FR-021).
- The shared disclosure control (FR-017) comes before the title-as-index chevron (FR-007).
- Title-as-index (FR-007) and icons (FR-026) share one ADR (C-001).
- See #264 (card-grid hub), which edits the same hub layout, and #279 (sources block), which can reuse the disclosure control.
