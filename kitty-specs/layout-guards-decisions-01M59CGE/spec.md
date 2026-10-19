# Mission Specification: Layout guards and decisions

**Mission Branch**: `feat/layout-guards-decisions`
**Created**: 2026-10-19
**Status**: Draft
**Input**: Issues #199, #200, #201, #202, #203, #204, #205, #206, #207, #216 and #217, with the owner's decisions recorded in [`docs/architecture/research/layout-guards-and-decisions.md`](../../docs/architecture/research/layout-guards-and-decisions.md) ("Decisions taken"). This mission builds on mission `sidebar-frame-header-carrier-01M4T3CB` (PR #111).

## Intent Summary

- **Actors.** A DocKitty maintainer who changes the page frame, and the readers of
  every site built with the toolkit.
- **Trigger.** The layout guard gaps found after PR #111 (#116), re-measured on
  Starlight 0.42.6, plus two defects found during that research (#216, #217).
- **Outcome.** Every layout behaviour the owner decided is shipped, and each one is
  guarded by a test that a do-nothing change would fail.
- **Rule that always holds.** Screenshot baselines are regenerated only by the CI
  baseline workflow in the pinned container, and each baseline set is regenerated
  once in this mission.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The published reading frame stays put and lines up (Priority: P1)

A reader moves between pages of a DocKitty site on a wide screen. The header search
starts where the reading column starts, whether the page has an outline rail or not
and whether the rail is collapsed. With the rail collapsed, no line of text runs
under the rail toggle. On very wide screens the page frame stops growing at 120rem,
so the navigation and the text stay close together.

**Why this priority**: These are the defects and the default a reader sees on every
page. The search mis-alignment (#216) and the toggle overlap (#217) are bugs today.

**Independent Test**: Load a rail page, a no-rail page and a rail page with the rail
collapsed at 1440, 1920 and 2560 px, and measure the search, column and toggle boxes.

**Acceptance Scenarios**:

1. **Given** a page with an outline rail at 1920 px, **When** it loads, **Then** the
   header search starts at the reading column's start, within 1 px.
2. **Given** that page with the rail collapsed, **When** the column re-centres,
   **Then** the search moves with it and still starts at the column's start, within
   1 px.
3. **Given** a page without a rail, **When** it loads at any measured width,
   **Then** the search starts at the column's start, within 1 px.
4. **Given** the rail collapsed at any width from 72rem (1152 px) to 2560 px,
   **When** the page loads, **Then** the reading column ends at least 4 px before
   the toggle's start edge, whatever the fallback font.
5. **Given** a site that sets no frame cap, **When** it is viewed at 2560 px,
   **Then** the frame is 120rem wide and centred.
6. **Given** a site that sets `--dk-width-frame: 100%`, **When** it is viewed at
   2560 px, **Then** the frame fills the viewport, as it does before this mission.
7. **Given** any viewport of 1920 px or narrower, **When** a page loads, **Then** its
   column position and width are the same as before this mission, within 0.5 px.

---

### User Story 2 - The current sidebar entry is visible from the first paint (Priority: P1)

A reader opens a deep page in a new tab. The sidebar shows the current entry from
the first paint, rather than painting at the top and jumping later.

**Why this priority**: The jump is visible on every first visit; it lasts about
60 ms locally and seconds on a slow link.

**Independent Test**: Load a deep page through a server that delays the rest of the
HTML after the sidebar, and read the sidebar's scroll position at first paint.

**Acceptance Scenarios**:

1. **Given** a first visit to a deep page, **When** the sidebar is first painted,
   **Then** its scroll position already reveals the current entry, within 1 px.
2. **Given** the rest of the page is delayed by 2 s after the sidebar, **When** the
   sidebar is painted, **Then** the current entry is revealed before the delay ends.
3. **Given** in-session navigation with a scroll position saved by Starlight,
   **When** the next page loads, **Then** the saved position wins and the reveal
   does not move it.
4. **Given** a narrow viewport with the menu closed, **When** the page loads,
   **Then** the page does not scroll, and opening the menu still reveals the
   current entry.

---

### User Story 3 - A maintainer is warned when a guard goes stale (Priority: P2)

A maintainer upgrades Starlight or Astro, or changes the frame. Every behaviour the
toolkit promises is checked, and a failure says what changed and how to fix it.

**Why this priority**: These are the guard gaps from #116. Each one let a regression
or a stale fixture pass silently.

**Independent Test**: Inject each defect the guard exists for, and confirm the
guard goes red with a message that names the fix.

**Acceptance Scenarios**:

1. **Given** two drafts-off builds of the same tree, **When** any machine surface
   differs by one byte, **Then** the determinism check fails and names the file.
2. **Given** an installed Starlight, Astro or `compressHTML` setting that differs
   from the header fixture's stamp, **When** the fast tests run, **Then** they fail
   and print the regeneration command.
3. **Given** the regeneration script, **When** it runs, **Then** the fixture comes
   from a build without the header carrier, and the stamp is rewritten.
4. **Given** a rail link or toolbar target shrunk below 24 x 24 px without the
   spacing exception, **When** the geometry lane runs, **Then** it fails and names
   the region, the target and its size.
5. **Given** the pane margin broken on a page without a sidebar, **When** the
   geometry lane runs, **Then** the FR-010 recentre check fails.
6. **Given** the published (drafts-off) build, **When** the a11y lane runs, **Then**
   the sidebar a11y, geometry and screenshot checks run against it, and the
   published sidebar contains no draft entry.
7. **Given** the a11y server pointed at a dist whose draft mode is not the expected
   one, **When** it starts, **Then** it exits with an error rather than a warning.

---

### User Story 4 - Layout decisions are recorded where the next maintainer looks (Priority: P3)

A maintainer wonders why the column shifts between rail and no-rail pages, why the
persona card is not centred, or why the sidebar has its own carrier. The answer is
in an ADR or the architecture docs, with the measured values.

**Why this priority**: The decisions change no reader-visible behaviour on their own,
but without a record the next change reopens them.

**Independent Test**: Every decision in the research note's "Decisions taken" table
is cited from an ADR or an architecture page, and the docs validators pass.

**Acceptance Scenarios**:

1. **Given** the accepted rail/no-rail shift (#204), **When** a maintainer reads the
   rail architecture page, **Then** it states the shift values and that the shift
   is accepted.
2. **Given** the 120rem default (#205), **When** a consumer reads the setup guide,
   **Then** it explains the cap, the default and the opt-out, with figures that
   match the 960 px column.
3. **Given** the persona card (#206), **When** it is viewed at 1920 px, **Then** it
   starts at the column's start and is as wide as the metadata band.

### Edge Cases

- A site sets a cap other than the default, narrower or wider. The search must
  still line up with the column under any cap.
- A future Starlight version renames or moves the sidebar persistence element. The
  reveal must still run after Starlight's own restore, and a test must notice if it
  no longer reveals before first paint.
- A page has a rail but no sidebar (`StarlightPage` with `hasSidebar: false`). No
  such page ships today; the simulation must match one exactly.
- The published lane is pointed at the drafts-on dist by mistake. The server
  refuses to start.
- An inline link in content is smaller than 24 px. It is exempt; the target-size
  check covers only the page chrome.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Machine-surface determinism (#201) | As a maintainer, I want the machine surfaces of two same-input drafts-off builds compared byte for byte over one declared manifest, failing when a glob matches nothing, so that NFR-006 of `sidebar-frame-header-carrier-01M4T3CB` is proven beyond two sidebars. | High | Open | [ratchet] | no — positive control: a one-byte change injected into one build turns it red |
| FR-002 | Header fixture stamp (#207) | As a maintainer, I want the header fixture to carry a stamp of the Starlight version, the Astro version and the `compressHTML` setting, and a fast test that fails with the regeneration command when the installed values differ, so that an upgrade tells me how to fix it. | High | Open | [build] | no |
| FR-003 | Carrier-free fixture capture (#207) | As a maintainer, I want one regeneration script that captures the stock header from a build with the header carrier disabled, so that the carrier-neutrality check compares against real Starlight output. | High | Open | [build] | no |
| FR-004 | Sidebar reveal before first paint (#203) | As a reader, I want the current sidebar entry revealed before the sidebar is first painted, by a script placed right after the sidebar markup, still after Starlight's own restore, so that the sidebar does not jump. | High | Open | [build] | no |
| FR-005 | Search lines up with the column (#216) | As a reader, I want the header search to start at the reading column's start on rail, no-rail and collapsed-rail pages, at 1440, 1920 and 2560 px, with and without a frame cap, so that the header and the text share one edge. | High | Open | [build] | no |
| FR-006 | Toggle clearance (#217) | As a reader, I want the reading column to end at least 4 px before the collapsed rail toggle at every width from 72rem, so that no text runs under the toggle whatever the font. | High | Open | [build] | no |
| FR-007 | 120rem default frame cap (#205) | As a reader on a wide screen, I want the page frame capped at 120rem by default, with a documented opt-out back to full width, so that the navigation and the text stay close together. | High | Open | [build] | no |
| FR-008 | Band-width persona card (#206) | As a reader, I want the persona card start-aligned with the column and as wide as the metadata band, with the passport width still overridable, so that the card does not leave a large blank beside it. | Medium | Open | [build] | no |
| FR-009 | Accepted column shift recorded (#204) | As a maintainer, I want the rail/no-rail column shift recorded as accepted, with its measured values, in the rail architecture page, so that the decision is not reopened. | Medium | Open | [build] | no |
| FR-010 | FR-010 recentre guard (#199) | As a maintainer, I want the recentre of a page without a sidebar checked in the geometry lane by a simulation that removes the sidebar from a real page, at five widths with the rail expanded and collapsed, and the choice recorded in the earlier mission's acceptance matrix, so that the requirement has a guard. | Medium | Open | [ratchet] | no — positive control: breaking the pane margin turns it red |
| FR-011 | Explicit target-size check (#202) | As a maintainer, I want every interactive target in the header, sidebar, rail and footer measured at 24 x 24 px or covered by the WCAG 2.5.8 spacing exception, with at least one target per region, so that NFR-004 of `sidebar-frame-header-carrier-01M4T3CB` does not rest on axe alone. | Medium | Open | [ratchet] | no — positive control: shrinking the rail links turns it red |
| FR-012 | Published-sidebar lane (#200) | As a maintainer, I want the sidebar a11y, geometry and screenshot checks to run against the drafts-off build in the same CI job, with their own baselines, so that the sidebar readers see is measured. | High | Open | [build] | no |
| FR-013 | Draft-mode server check (#200) | As a maintainer, I want the a11y server to know which draft mode it should serve and refuse to start on a mismatch in either direction, so that a lane can never measure the wrong dist. | Medium | Open | [build] | no |
| FR-014 | Sidebar membership check (#200) | As a maintainer, I want a structural check that draft entries appear in the drafts-on sidebar and not in the drafts-off one, so that a screenshot tolerance cannot hide a membership change. | Medium | Open | [build] | no |
| FR-015 | Stale comments and docs | As a maintainer, I want the Starlight 0.32 tripwire stamps, the "no cascade layers" comments and the header-fixture provenance comments corrected, so that the docs match Starlight 0.42.6. | Low | Open | [build] | no |
| FR-016 | Changelog entry | As a consumer, I want a CHANGELOG `[Unreleased]` entry that marks the 120rem default as a breaking change and gives the opt-out line, so that I can keep full width on upgrade. | Medium | Open | [build] | no |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Published lane cost | The published-sidebar lane adds at most 120 s to the a11y CI job and no extra build. | Performance | Medium | Open |
| NFR-002 | Determinism check cost | The determinism check adds no build and at most 1 s to the build test suite. | Performance | Medium | Open |
| NFR-003 | Stamp check cost | The header-fixture stamp test runs without a build in at most 1 s. | Performance | Low | Open |
| NFR-004 | No accessibility regression | The a11y lane reports 0 new axe violations on every route in both colour modes, and the reading-column layout shift stays 0. | Accessibility | High | Open |
| NFR-005 | Reveal measured at first paint | Replaces the reveal half of `sidebar-frame-header-carrier-01M4T3CB#NFR-005`: the sidebar's scroll position at first paint equals the revealed position within 1 px, in all three measured load scenarios (local, delayed HTML, delayed scripts). | Usability | High | Open |
| NFR-006 | Cap leaves narrow layouts alone | At every viewport of 1920 px or narrower, column x and width with the 120rem default equal the values before this mission within 0.5 px. | Compatibility | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Baselines from CI only | Screenshot baselines are regenerated only by the CI baseline workflow in the pinned container, and each baseline set at most once in this mission. | Technical | High | Open |
| C-002 | One new carrier | The `Sidebar` override is the only new Starlight component override. The carrier lock and its ADRs are updated to six carriers. | Technical | High | Open |
| C-003 | No fixture pages in the example | No test page is added to the example site; its machine surfaces and sitemap count stay unchanged. | Technical | High | Open |
| C-004 | Maintainer merges | The mission PR is opened ready for review with CI green; it is never merged by the agent. | Business | High | Open |

### Key Entities

- **Machine surface**: a build output read by tools rather than people: sitemaps,
  RSS, `llms.txt`, the agent API JSON, the OKF export and the search index.
- **Header fixture stamp**: the record of the Starlight version, Astro version and
  `compressHTML` setting that a header fixture was captured with.
- **Carrier**: a Starlight component the toolkit overrides. Five exist; this mission
  adds `Sidebar` as the sixth.
- **Frame cap**: the `--dk-width-frame` token that limits the page frame's width.

## Domain Language

| Canonical term | Meaning | Avoid |
| --- | --- | --- |
| Rail | The table-of-contents column at the end of the page | "right sidebar", "TOC sidebar" |
| Reading column | The text column inside the main pane | "content area" |
| Frame | The page area that holds sidebar, pane and rail | "container", "wrapper" |
| Published build | The drafts-off build readers see | "prod build" |

## Assumptions

- The 120rem default ships in the next minor release (0.5.0). This mission adds the
  `[Unreleased]` entry; the maintainer cuts the release.
- The pinned CI image's fallback font stays as it is; the new toggle-clearance
  check measures boxes, not text, so it does not depend on the font.
- Starlight 0.42.6 stays the installed version for the length of the mission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the published example, the header search and the reading column start within 1 px of each other on every rail, no-rail and collapsed-rail page at 1440, 1920 and 2560 px. — [build] · no-op passable: no
- **SC-002**: A first visit to a deep page shows the current sidebar entry at first paint in 100% of the measured load scenarios. — [build] · no-op passable: no
- **SC-003**: Each of the six guards (determinism, fixture stamp, target size, recentre, published lane, membership) goes red on its injected defect and green without it. — [ratchet] · no-op passable: no
- **SC-004**: At 2560 px the empty space beside the column on a rail page drops from 512 px to 192 px by default, and layouts at 1920 px or narrower do not move. — [build] · no-op passable: no
- **SC-005**: Every decision in the research note's "Decisions taken" table is cited from an ADR or an architecture page. — [build] · no-op passable: no
