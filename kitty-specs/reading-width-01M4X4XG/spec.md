# Mission Specification: Wider reading column and room for wide content

**Mission Branch**: `issue-154-reading-width`
**Created**: 2026-10-14
**Status**: Draft
**Input**: Issue #154, "Default reading column is too narrow on wide screens; tables are squashed", plus the dispatch brief (raise the default, let wide content grow without hurting the TOC rail, keep small screens unchanged, rebaseline deliberately, document how to restore 45rem).

## Intent Summary

A reader of any DocKitty site on a wide screen (1440-2560px) sees a 720px text
column centred in a mostly empty page, and tables inside it wrap into tall,
narrow cells. The site owner has changed nothing; this is the default every
adopter gets.

After this mission, the default reading column is wider (52rem, settled from a
line-length measurement recorded in `research/code-grounding.md`), and a table
that needs more room than the column grows past it, centred on the column,
into the free space of the reading pane, but never under the right-hand
outline rail and never wider than a cap the site owner can set. Below the
72rem desktop breakpoint tables do not grow, and phones and tablets look as
before; the only change there is that, on a narrow laptop window (about 1057 to
1151px) with a sidebar, the column now fills its pane instead of stopping at
720px. A site owner who wants the old look sets one token back to `45rem`.

Discovery was resolved from the brief (no interactive operator in this
dispatch); the two design decisions are recorded as Decision Moments
`01M4X56F1GE5HAWSXBGWSNMAB9` (default width) and `01M4X56JK56BM2QAXP9C3J7JKV`
(wide-content scope).

## Domain Language

| Term | Meaning | Avoid |
|------|---------|-------|
| **reading column** | The box that holds a page's prose, at most `--dk-width-content` wide. | "content width" for the measured box |
| **reading pane** | The part of the page frame between the left sidebar and the outline rail, minus its inline padding. The column is centred in it from 72rem. | "main area" |
| **outline rail** | The right-hand "On this page" column, collapsible to a 1px hairline. | "TOC sidebar" |
| **wide table** | A table written directly in the page body whose natural width is larger than the reading column. | "overflowing table" |
| **page frame** | The box capped by `--dk-width-frame`. | — |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Prose uses more of a wide screen (Priority: P1)

A reader opens a documentation page on a 1920px screen. The prose column is
832px wide instead of 720px, and still centred between the sidebar and the
outline rail.

**Why this priority**: It is the visible default every adopter gets; the issue's headline.

**Independent Test**: Load a page with a sidebar and an outline at 1440px and 1920px and measure the column.

**Acceptance Scenarios**:

1. **Given** the default theme, **When** a page with a sidebar and an outline is shown at 1920px, **Then** the reading column is 832px (52rem) wide and centred in the reading pane.
2. **Given** the default theme, **When** the same page is shown at 1440px, **Then** the reading column fills the reading pane (816px).
3. **Given** a site that sets `--dk-width-content: 45rem`, **When** the page is shown at 1920px, **Then** the column is 720px, as before this mission.

---

### User Story 2 - A wide table gets room (Priority: P1)

A reader opens a page with a five-column table of prose cells on a 1920px
screen. The table is wider than the prose column, centred on it, and ends
before the outline rail.

**Why this priority**: The squashed table is the concrete defect in the issue.

**Independent Test**: Load the example page that carries a wide table at 1920px and 2560px, expanded and collapsed, left-to-right and right-to-left, and compare the table box with the column, the pane and the rail.

**Acceptance Scenarios**:

1. **Given** a wide table, **When** the page is shown at 1920px with the rail expanded, **Then** the table is wider than the reading column, its centre is within 1px of the column's centre, and it lies inside the reading pane.
2. **Given** the same page with the rail collapsed, **When** shown at 1920px, **Then** the table lies inside the frame and does not cross the 1px rail hairline.
3. **Given** the same page at 2560px with the rail collapsed, **When** shown, **Then** the table is no wider than the wide-content cap.
4. **Given** a right-to-left page, **When** shown at 1920px, **Then** the table is mirrored: centred on the column and inside the pane.
5. **Given** a table narrower than the column, **When** shown at any width, **Then** it renders as before: starting at the column's start edge.

---

### User Story 3 - Small screens are unchanged (Priority: P2)

A reader on a phone or a tablet sees the same layout as before, and below 72rem
no table grows past the column. (Clarified after the WP02 review: on a narrow
laptop window of about 1057 to 1151px with a sidebar the pane is wider than
720px, so the column follows the new default and fills the pane; that is
FR-001, not a regression.)

**Why this priority**: The issue requires it explicitly; regressions there affect most readers.

**Independent Test**: Load the wide-table page at 390, 768 and 1024px; the table box equals the column box.

**Acceptance Scenarios**:

1. **Given** a viewport below 72rem, **When** a page with a wide table is shown, **Then** the table is exactly as wide as the reading column and starts at its start edge.

---

### User Story 4 - A site owner can see and undo the change (Priority: P2)

A site owner upgrading DocKitty reads in the changelog that the default
reading width changed, and in the theming documentation which tokens control
the column and the wide-content cap and how to restore the old width.

**Independent Test**: The changelog `[Unreleased]` has a Changed entry naming the new default and the restore line; the theming page documents both tokens.

**Acceptance Scenarios**:

1. **Given** the release notes, **When** the owner reads the Changed section, **Then** it names `52rem`, `--dk-width-content: 45rem` as the restore line, and the new table behaviour with its opt-out.

### Edge Cases

- A table nested in a list, an aside or a component is not a direct child of the page body and stays in the column.
- A table whose natural width exceeds the pane (or the cap) wraps or scrolls inside the cap, as tables do today inside the column.
- A page without a left sidebar keeps Starlight's own 67.5rem column (unchanged).
- A capped frame (`--dk-width-frame: 90rem`): the pane is narrower, and the table stays inside it.
- Gherkin Examples tables on generated feature pages are ordinary tables; a narrow one renders as before.
- Setting the wide cap to `0` or to the column width turns the growth off.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Wider default reading width | As a reader on a wide screen, I want the default reading column to be 52rem so that prose uses more of the screen. The default is the same in the token sheet and in the theme catalog. | High | Open | [build] | no — at 1920px the column measures 720px on the current default |
| FR-002 | Wide tables grow past the column | As a reader, I want a table written directly in the page body that is wider than the column to grow past it, centred on the column, from the 72rem breakpoint up, so that its cells stop wrapping into narrow strips. | High | Open | [build] | no — on the current layout the table box equals the column box |
| FR-003 | Wide tables stay out of the outline rail | As a reader, I want a grown table to stay inside the reading pane, expanded or collapsed, capped frame or not, left-to-right or right-to-left, so that it never covers the outline. | High | Open | [build] | yes — paired with FR-002 on the same fixture and widths, which fails when nothing grows |
| FR-004 | A cap for wide content | As a site owner, I want a token that caps how wide a grown table may get, so that a table on a 2560px screen does not span the whole pane. Setting it to the column width or less turns the growth off. | Medium | Open | [build] | no — at 2560px collapsed the uncapped table would be wider than the cap |
| FR-005 | Small screens unchanged | As a reader below 72rem, I want tables to stay in the column, and on phones and tablets (below 1024px) the layout I had before this mission, so that nothing regresses there. The column may fill a pane wider than 720px (FR-001). | High | Open | [ratchet] | yes — positive control: FR-002 on the same fixture at 1920px |
| FR-006 | Narrow tables unchanged | As a reader, I want a table narrower than the column to render where it did, starting at the column's start edge. | Medium | Open | [ratchet] | yes — positive control: FR-002 on the same page |
| FR-007 | Deliberate rebaseline | As a maintainer, I want the layout ratchet and the visual baselines moved to the new measures on purpose, with the evidence recorded, so that the gates keep guarding the new layout. | High | Open | [build] | no — the old ratchet values fail on the new layout |
| FR-008 | Documentation and release note | As a site owner, I want the theming documentation to describe both tokens and how to restore 45rem, an ADR to record the decision, and a changelog Changed entry, so that I can decide whether to keep the new default. | High | Open | [build] | no — the restore line is absent today |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Geometry tolerance | Every new layout assertion holds within 1 CSS pixel, the tolerance of the existing layout guard. | Reliability | High | Open |
| NFR-002 | No horizontal page scroll | Document scroll width equals viewport width at 390, 768, 1024, 1152, 1280, 1600, 1920 and 2560px on the existing scroll routes and on the wide-table page. | Usability | High | Open |
| NFR-003 | Accessibility | The axe lane (WCAG 2.2 AA, both colour modes) reports zero new violations. | Accessibility | High | Open |
| NFR-004 | Line length bound | At the default font size the default column holds no more than 120 characters per line of the example's prose, measured as in the research note. | Usability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Geometry survives a brand swap | Layout rules live in the component sheet that a brand swap keeps, not in the token sheet. | Technical | High | Open |
| C-002 | Logical properties | Geometry rules use logical properties so right-to-left pages mirror. | Technical | High | Open |
| C-003 | Collapsed-rail recentre keeps winning | Nothing added may outrank the collapsed-rail recentre rule on the reading pane. | Technical | High | Open |
| C-004 | Sibling dispatch boundaries | In `src/lib/theme.ts` only the width defaults change; `docs/guides/consumer-setup.md` and Gherkin sources are not touched. | Process | High | Open |
| C-005 | No loosened gates, no new ratchets | No existing assertion is loosened; ratchet values move only with recorded evidence; no new size or length ratchet gate is added. | Process | High | Open |
| C-006 | Baselines from the pinned container | Visual baselines are regenerated only in the pinned Playwright container. | Process | High | Open |
| C-007 | Docs convention | Every touched docs page keeps `title`, `description`, `doc_status`, `updated`, with `updated` bumped. | Process | High | Open |

### Key Entities

- **`--dk-width-content`**: the reading-column width token; new default 52rem.
- **`--dk-width-wide`**: the new cap for grown tables; default 80rem.
- **Wide-table fixture**: a table in the example site that is wider than the column at the default width.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1920px, on a page with a sidebar and an outline, the reading column is 832px ± 1px (720px before). — [build] · no-op passable: no
- **SC-002**: At 1920px the example's wide table is at least 100px wider than the reading column and fully inside the reading pane. — [build] · no-op passable: no
- **SC-003**: At 390, 768 and 1024px the wide table's box equals the column box within 1px. — [ratchet] · no-op passable: yes (positive control SC-002)
- **SC-004**: A site owner restores the previous look with one declaration, `--dk-width-content: 45rem`, documented in the changelog and the theming page. — [build] · no-op passable: no

## Assumptions

- 52rem is the operator-reviewable default; the issue proposed about 60rem and asked for a measured value. Changing it is a one-token edit in two files plus the recorded measures.
- Diagrams already scale down to fit the column and code blocks scroll by convention; they stay in the column. Growing them is out of scope.
- The visual baselines move on the home route; they are regenerated by the repository's `Update a11y baselines` workflow.

## Out of Scope

- Growing diagrams, code blocks or embedded components past the column.
- Changing the outline rail, sidebar or frame geometry.
- Changing the column of pages without a left sidebar.
