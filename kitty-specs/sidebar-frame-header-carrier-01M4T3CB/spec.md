# Mission Specification: Sidebar, TOC rail and page-frame remediation with Header carrier

**Mission Branch**: `fix/sidebar-frame-header-carrier`
**Created**: 2026-10-13
**Status**: Delivered (see Amendments)
**Input**: User description: "Fix the broken sidebar and collapsible table-of-contents rail on the published docsite, keep draft pages off the live environment, derive navigation labels and order from page metadata, and add a toolkit-owned Header carrier."

A four-lens review of the published docsite on 2026-10-13 measured the layout at six viewport widths and crawled all 68 pages. It found that the page frame, the left sidebar and the collapsible "On this page" rail only line up near one desktop width (about 1296px). At 1600px and wider the reading column shrinks from 720px to 552px and a dead gutter of 432px (at 1920px) opens between the sidebar and the content. The rail's collapse toggle floats over the article at 1280px and sits 280px inside the rail at 1920px. Independently, seven draft pages appear in every page's sidebar although the sitemap, feed, `llms.txt` and agent index all exclude them, and several navigation groups are labelled with raw directory names in alphabetical order (`book-one, book-three, book-two`).

The existing layout guards run at a single width (1280px), where the error is about 8px, so none of this was caught.

**Intent summary (owner-confirmed decisions, 2026-10-13):**

- The page frame is full-width by default. A width cap becomes something a consumer opts into.
- Draft pages are built, but not published onto the live environment. An environment setting, settable from an env file, controls this.
- A toolkit-owned Header carrier is added so a theme can replace the site header.
- No framework upgrade is part of this mission.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader sees an aligned layout at every desktop width (Priority: P1)

A reader opens a documentation page on a laptop, a desktop monitor or an ultra-wide screen. The left sidebar, the reading column, the header and the "On this page" rail sit against each other with no dead gutter, and the reading column never gets narrower as the window gets wider.

**Why this priority**: this is the reported defect and it affects every page at 1600px and wider.

**Independent Test**: load a page with both a sidebar and a rail at 1152, 1280, 1600, 1920 and 2560px and measure the four regions.

**Acceptance Scenarios**:

1. **Given** the default configuration, **When** a page is viewed at 1152, 1280, 1600, 1920 and 2560px, **Then** the frame spans the full viewport width, the left sidebar starts at the frame's start edge, and the rail ends at the frame's end edge.
2. **Given** the default configuration, **When** the viewport widens from 1280px to 2560px, **Then** the reading column's width never decreases.
3. **Given** a consumer has set a frame-width cap smaller than the viewport, **When** the page is viewed, **Then** the frame fills exactly that cap, is centred, and the left sidebar, header content and rail are all positioned relative to the capped frame, not the viewport.
4. **Given** a consumer has set the frame width to an invalid value, **When** the page is viewed, **Then** the layout is the same as the full-width default.
5. **Given** a right-to-left page, **When** it is viewed at 1280px and 1920px, **Then** the layout is the mirror image of the left-to-right layout.

---

### User Story 2 - A reader can collapse and expand the rail with the control where they expect it (Priority: P1)

A reader collapses the "On this page" rail to get more reading width, and expands it again. The control sits on the rail's edge at every width, and a keyboard user reaches it next to the rail it controls.

**Why this priority**: the toggle currently overlaps article text or TOC links at most desktop widths, and keyboard users reach it only after the footer.

**Independent Test**: at each of the five widths, compare the toggle's position with the rail's edge in both states; tab through the page and note where the toggle receives focus.

**Acceptance Scenarios**:

1. **Given** the rail is expanded, **When** the page is viewed at any of the five widths, **Then** the toggle sits on the rail's inner edge and overlaps neither article text nor TOC links.
2. **Given** the rail is collapsed, **When** the page is viewed at any of the five widths, **Then** the toggle and the collapsed rail's boundary are at the same horizontal position, and the reading column is recentred in the freed space.
3. **Given** a keyboard user tabbing through the page, **When** focus reaches the rail region, **Then** the toggle is focused immediately before or after the rail's links, not after the footer, and it announces which region it controls and whether that region is expanded.
4. **Given** a reader who collapsed the rail before this change, **When** they return after it, **Then** the rail is still collapsed.
5. **Given** a page with a rail but no left sidebar, **When** the rail is collapsed, **Then** the reading column is recentred as it is on pages with a sidebar.
6. **Given** a page whose table of contents would list one entry or fewer, **When** it is viewed, **Then** no rail and no toggle are shown and the reading column uses the space.

---

### User Story 3 - A site owner keeps drafts off the live site without losing them locally (Priority: P1)

A site owner writes draft pages. They see them when building or previewing locally, and the live deployment never shows them — not as pages, not in navigation, and not in any machine-readable surface.

**Why this priority**: eight draft pages are currently reachable on the live site and seven are in every sidebar, while the machine surfaces already exclude them.

**Independent Test**: build the example site twice, once with the setting on and once off, and compare which draft routes exist and where they are listed.

**Acceptance Scenarios**:

1. **Given** the draft-publication setting is off, **When** the site is built, **Then** no draft page exists in the output, no sidebar lists one, and the sitemap, feeds, `llms.txt` and agent index list none.
2. **Given** the setting is on, **When** the site is built, **Then** every draft page exists in the output, is listed in the sidebar, and is marked so that search engines do not index it; the sitemap, feeds, `llms.txt` and agent index still list none.
3. **Given** no setting is provided at all, **When** the site is built, **Then** the result is the same as with the setting off.
4. **Given** the setting is provided through an env file in the site directory, **When** the site is built or served locally, **Then** it takes effect without any other configuration.
5. **Given** the setting holds an unrecognised value, **When** the site is built, **Then** the build stops with a message naming the setting and the accepted values.
6. **Given** the live deployment, **When** it runs, **Then** drafts are not published.

---

### User Story 4 - A reader finds their way through a navigation that reads like a table of contents (Priority: P2)

A reader scans the left sidebar. Groups carry human titles, appear in the order the author intended, each section's overview comes first, and the entry for the current page is visible without scrolling the sidebar by hand.

**Why this priority**: it is the second half of the "messed up" sidebar, but the site remains usable without it.

**Independent Test**: build the example site and read the sidebar's group labels and order from the built pages; open a deep page and check whether the current entry is in view.

**Acceptance Scenarios**:

1. **Given** a nested section whose index page has a title, **When** the sidebar is rendered, **Then** the group is labelled with that title, not the directory name.
2. **Given** sibling groups whose index pages declare an order, **When** the sidebar is rendered, **Then** they appear in that order; siblings with no declared order follow, alphabetically by label.
3. **Given** a section with an index page and child pages, **When** the sidebar is rendered, **Then** the index page is the first entry of its group.
4. **Given** a page deep in a long sidebar, **When** it loads, **Then** its sidebar entry is within the visible part of the sidebar.
5. **Given** a nested directory with no index page, **When** the sidebar is rendered, **Then** the group falls back to a readable form of the directory name and the build reports the missing title.

---

### User Story 5 - A theme author replaces the site header (Priority: P2)

A theme author supplies their own header (for example a brand bar with a product switcher). The toolkit renders it in place of the stock header. A site with no such header looks and behaves exactly as before.

**Why this priority**: it is an extension point, not a defect; nothing shipped today depends on it.

**Independent Test**: build the example site with and without a theme-supplied header and compare the rendered header.

**Acceptance Scenarios**:

1. **Given** no theme supplies a header, **When** a page is built, **Then** the header markup is identical to the markup before this change.
2. **Given** a theme supplies a header, **When** a page is built, **Then** that header is rendered once, in place of the stock header, with no extra wrapping element.
3. **Given** a theme author reading the documentation, **When** they look up the header extension point, **Then** they find which responsibilities a replacement header takes on: search, the theme switch, the mobile menu control and the skip link.
4. **Given** the decision records, **When** a maintainer looks up how many chrome carriers the toolkit owns, **Then** one accepted record states five and marks the earlier four-carrier statements as superseded.

---

### Edge Cases

- **Viewports below the desktop breakpoint** (1024px, 768px, 390px): the toggle stays hidden and the mobile menu behaves as it does today.
- **Collapsed rail on a capped frame**: the toggle and the collapsed boundary stay together at the capped frame's end edge.
- **A draft page that is a section's index**: with the setting off, the section's group is still shown if it has published children, labelled by fallback; if it has none, the group is not shown.
- **A published page linking to a draft**: with the setting off the link target does not exist; the build's link gate reports it instead of shipping a dead link.
- **A consumer that supplies its own sidebar configuration**: derived labels and ordering do not override it.
- **A theme header that omits the skip link**: documented as the theme's responsibility; the toolkit does not inject one.
- **Pages that suppress the table of contents in front matter**: no rail and no toggle, as today.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Full-width frame by default | As a reader, I want the page frame to span the viewport by default so that wide screens are used instead of leaving dead gutters. | High | Open | [build] | no |
| FR-002 | Public frame-width token | As a consumer, I want one documented frame-width token so that I can cap the frame without overriding toolkit styles. | High | Open | [build] | no |
| FR-003 | Invalid frame value falls back | As a consumer, I want an invalid frame-width value to behave like the default so that a typo cannot break the layout. | Medium | Open | [build] | no — paired with the valid-cap scenario on the same page |
| FR-004 | Sidebar and header follow a capped frame | As a reader, I want the left sidebar and header content to sit at the frame's edges when the frame is capped so that no gutter separates them from the content. | High | Open | [build] | no |
| FR-005 | Rail column has a definite width | As a reader, I want the rail to keep a fixed width at every desktop viewport so that the reading column and the toggle have a stable edge to align with. | High | Open | [build] | no |
| FR-006 | Reading column never shrinks as the viewport grows | As a reader, I want the reading column to be at least as wide at a larger viewport as at a smaller one. | High | Open | [build] | no |
| FR-007 | Toggle anchored to the rail edge | As a reader, I want the collapse toggle on the rail's edge in both states at every desktop width so that it never covers text or links. | High | Open | [build] | no |
| FR-008 | Toggle in reading order with a named target | As a keyboard or screen-reader user, I want the toggle adjacent to the rail in focus order and announcing the region it controls. | High | Open | [build] | no |
| FR-009 | Collapse state survives the change | As a returning reader, I want my collapsed or expanded choice kept across this change and across page navigation. | Medium | Open | [ratchet] | yes — paired with the toggle-interaction scenario that flips the stored state on the same page |
| FR-010 | Collapsed recentre without a left sidebar | As a reader, I want the reading column recentred when the rail is collapsed on pages that have no left sidebar. | Low | Open | [build] | no |
| FR-011 | No rail for a near-empty table of contents | As a reader, I want no rail reserved when the table of contents would hold one entry or fewer. | Medium | Open | [build] | no |
| FR-012 | Right-to-left parity | As a reader of a right-to-left page, I want the frame, sidebar, rail and toggle mirrored. | Medium | Open | [build] | no |
| FR-013 | Draft-publication setting | As a site owner, I want one environment setting, readable from an env file, that decides whether draft pages are published. | High | Open | [build] | no |
| FR-014 | Drafts unpublished by default | As a site owner, I want drafts left out when the setting is absent so that a deployment that forgets it cannot leak drafts. | High | Open | [build] | no |
| FR-015 | All surfaces agree on drafts | As a reader or agent, I want pages, sidebar and machine surfaces to give one consistent answer for each setting value. | High | Open | [build] | no — proven half by half: setting off and setting on |
| FR-016 | Published drafts are not indexed | As a site owner, I want any draft page that is published marked as not to be indexed by search engines. | Medium | Open | [build] | no |
| FR-017 | Unrecognised setting value stops the build | As a site owner, I want a clear error for a mistyped setting value instead of a silent default. | Medium | Open | [build] | no |
| FR-018 | Live deployment does not publish drafts | As the project owner, I want the project's own live deployment to run with drafts unpublished. | High | Open | [build] | no |
| FR-019 | Group labels from index titles | As a reader, I want nested sidebar groups labelled with their index page's title. | Medium | Open | [build] | no |
| FR-020 | Group order from declared order | As an author, I want sibling groups ordered by the order their index pages declare, with a deterministic fallback. | Medium | Open | [build] | no |
| FR-021 | Section index first | As a reader, I want each section's index page listed first in its group. | Medium | Open | [build] | no |
| FR-022 | Current entry revealed | As a reader, I want the current page's sidebar entry in view when the page loads. | Medium | Open | [build] | no |
| FR-023 | Fallback label and report for untitled groups | As an author, I want a readable fallback label and a build-time notice when a group has no index title. | Low | Open | [build] | no |
| FR-024 | Header carrier | As a theme author, I want to supply a site header that the toolkit renders in place of the stock one. | Medium | Open | [build] | no |
| FR-025 | Stock header unchanged without a theme header | As an existing consumer, I want the header markup unchanged when no theme header is supplied. | High | Open | [ratchet] | yes — paired with the theme-header scenario on the same fixture |
| FR-026 | Header replacement contract documented | As a theme author, I want the responsibilities of a replacement header documented. | Medium | Open | [build] | no |
| FR-027 | Decision record for the fifth carrier | As a maintainer, I want an accepted decision record that supersedes the four-carrier statements and explains why. | High | Open | [build] | no |
| FR-028 | Multi-width layout guard | As a maintainer, I want automated layout checks at 1152, 1280, 1600, 1920 and 2560px so that a single-width guard can no longer hide a wide-screen defect. | High | Open | [build] | no — each assertion must fail against the layout as shipped before this mission |
| FR-029 | Frame-token documentation and catalog entry | As a consumer, I want the frame-width token listed in the token catalog and documented with a capped-frame example. | Medium | Open | [build] | no |
| FR-030 | Retire the wide-screen unchanged-layout constraint | As a maintainer, I want the earlier promise that layout below 1600px stays unchanged explicitly withdrawn in the records, so that the new geometry is not read as a regression. | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Geometry tolerance | Every alignment assertion (sidebar to frame, rail to frame, toggle to rail edge, header content to frame) holds within 1 CSS pixel at each of the five guarded widths. | Reliability | High | Open |
| NFR-002 | Reading-column floor | With the default configuration and an expanded rail, the reading column is at least 720px wide at 1600, 1920 and 2560px. | Usability | High | Open |
| NFR-003 | No horizontal page scroll | Document scroll width equals viewport width on every guarded page at 390, 768, 1024, 1152, 1280, 1600, 1920 and 2560px. | Usability | High | Open |
| NFR-004 | Accessibility gates stay green | The existing automated accessibility suite reports zero new violations; the toggle and rail links meet a 24 by 24 CSS pixel minimum target size. | Accessibility | High | Open |
| NFR-005 | No layout shift from enhancement | Revealing the current sidebar entry and mounting the toggle cause no visible movement of the reading column after first paint (cumulative layout shift contribution of 0 for those two behaviours). | Performance | Medium | Open |
| NFR-006 | Deterministic output | Two builds of the same tree with the same setting value produce byte-identical sidebars and machine surfaces. | Reliability | Medium | Open |
| NFR-007 | Header neutrality | With no theme header, 100% of built pages have header markup byte-identical to a build from before this mission. | Compatibility | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | No framework upgrade | The mission stays on the currently supported framework generation; advertised peer ranges do not change. | Technical | High | Open |
| C-002 | Token namespace and measured evidence | New tokens use the `--dk-*` namespace. Numbers quoted in code comments, tests and documentation are measured on this repository's builds. | Business | High | Open |
| C-003 | Stable reader state | The stored collapse preference and the page attribute that reflects it keep their current names and meaning. | Technical | High | Open |
| C-004 | Consumer configuration wins | A consumer's own sidebar configuration and framework escape hatch continue to take precedence over toolkit defaults. | Technical | High | Open |
| C-005 | Baselines regenerated deliberately | Pinned visual and accessibility baselines that move are regenerated in the project's standard container and reviewed; none is updated to silence an unexplained difference. | Process | High | Open |
| C-006 | Public surface is covered | The new token, the draft setting and the Header carrier are each exercised by the packed-consumer test, so they work from the published package and not only inside the repository. | Technical | Medium | Open |
| C-007 | Delivery | Work lands on `fix/sidebar-frame-header-carrier` and is offered as a draft pull request to `main`; the owner merges. | Process | High | Open |

### Out of Scope

- Moving to a newer framework generation.
- An image lightbox.
- Repairing the deployment and nightly workflows' failing steps (a separate small fix), other than the single change FR-018 needs.
- The duplicated page heading found on most pages.
- Issue #103 (agent index links, sitemap path) and issue #104 (design-package adoption) — see those issues; this mission owes them no work.

### Assumptions

- **Draft default is fail-closed.** "Build drafts, but do not publish on the live environment" is read as: the setting is off unless turned on, the repository's example env file turns it on for local work, and the live deployment leaves it off. If the owner prefers drafts on by default with the live deployment turning them off, FR-014 and scenario 3.3 flip and nothing else changes.
- **"Published" covers three things together**: the page being emitted, its sidebar entry, and its indexability. Machine surfaces (sitemap, feeds, `llms.txt`, agent index) exclude drafts under both values, as they do today.
- **The desktop breakpoint stays where it is.** Below it the rail and toggle are not shown, as today.
- **Ordering metadata already exists** in page front matter and the section registry; no new authoring field is introduced unless planning shows the existing ones cannot express sibling order.
- **A one-entry table of contents** is the page-title "Overview" entry alone.

### Key Entities

- **Page frame**: the region holding sidebar, reading column and rail; has a width that defaults to the full viewport and can be capped by the frame-width token.
- **Rail**: the "On this page" column; has an expanded and a collapsed state, a fixed expanded width, and a toggle.
- **Draft-publication setting**: an on/off environment value; decides whether draft pages are emitted, listed and left indexable.
- **Sidebar group**: a navigation node for a directory; has a label, an order and an optional index page.
- **Carrier**: a toolkit-owned chrome component through which theme content is rendered; the set grows from four to five with the Header.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1920px and 2560px the gap between the left sidebar and the reading area is 0px beyond normal padding, down from 432px and 752px. — [build] · no-op passable: no
- **SC-002**: At 1600px and wider the reading column is at least 720px wide, up from 552px. — [build] · no-op passable: no
- **SC-003**: At each of the five guarded widths the toggle is within 1px of the rail edge in both states, compared with offsets of 8px to 280px before. — [build] · no-op passable: no
- **SC-004**: A keyboard user reaches the toggle within two tab stops of the rail's links, instead of as the second-to-last focusable element on the page. — [build] · no-op passable: no
- **SC-005**: With the setting off, 0 draft pages are reachable and 0 appear in any sidebar on the live site, down from 8 and 7. — [build] · no-op passable: no
- **SC-006**: 0 sidebar group labels on the example site are raw directory names, down from 8, and numbered sections appear in numeric order. — [build] · no-op passable: no
- **SC-007**: The layout guard fails on the pre-mission layout at 1600, 1920 and 2560px and passes on the delivered one. — [build] · no-op passable: no
- **SC-008**: A site with no theme header has byte-identical header markup before and after; a site with one shows that header on 100% of pages. — [ratchet] · no-op passable: yes — paired with the theme-header half on the same fixture

## Amendments (2026-10-13, during implementation)

The requirement text above is as written at planning time. Where it differs from what was delivered, these points apply.

- **Toggle position.** Expanded, the toggle is centred on the rail's inner edge. Collapsed, it is aligned to the frame's end edge. This supersedes the wording of User Story 2 scenario 1 and of SC-003. SC-003's 1px tolerance applies to the toggle's centre when expanded and to its end edge when collapsed.
- **Replacement header.** The framework keeps the skip link and the mobile menu control. A replacement header supplies the title or logo, search, social links, the theme switch and the language switch if it wants them. This supersedes the list in FR-026, User Story 5 scenario 3 and the skip-link edge case.
- **Draft count.** The example has nine draft pages. Eight of them are listed in the sidebar when drafts are on.
- **Local builds.** Only `astro dev` reads the example's env file. A local build or preview is draft-free unless `DK_PUBLISH_DRAFTS=on` is set. This is narrower than User Story 3's "building or previewing locally".
- **Reading column.** It is 528px at a 1152px viewport and 656px at 1280px.
- **SC-006.** Met for five of the eight labels. The three generated glossary-context groups keep a raw id as label.
- **FR-010.** Verified by simulation only. No page in the example has a rail and no sidebar.
- Owner decision 2026-10-13: the draft-publication default is `on`; the live deployment sets `off` explicitly. This supersedes FR-014, scenario 3.3 and the fail-closed assumption.
