# Mission Specification: Large hubs: sidebar child cap

**Mission Branch**: `feat/341-sidebar-child-cap`
**Created**: 2026-11-22
**Status**: Draft
**Input**: Issue #341, "Large hubs slice 1: sidebar child cap" (epic #340). Plan: `docs/plans/features/large-hubs.md`, slice 1. Design: `docs/architecture/research/missions-and-ops.md`, "The sidebar child cap".

Today every page of a section lands in every page's sidebar. Mission, Op, pack and Gherkin sections can each hold hundreds of children, so each built page carries hundreds of sidebar links, and the build renders them hundreds of times. This mission adds a sidebar child cap: a hub (a directory with an index page) that has more children than its cap shows its index link and one "N pages" entry in the sidebar instead of the children. The reader still sees where they are, and the build cost stays bounded.

**Intent summary (decisions recorded as Decision Moments, 2026-11-22):**

- The cap resolves most specific first: hub frontmatter `sidebar_child_cap`, then `sidebar.childCap` on the section in `sections.yaml`, then `sidebar.childCap` in site config, then the default of 50.
- `shapeSidebar` enforces it. No new carrier is added (ADR-0063).
- A hub's children are counted and ordered exactly as the hub page lists them (`selectHubChildren`): published pages and sub-folders one level down.
- This repo's own `docs/adr` group (81 children) keeps its sidebar: its section sets `sidebar.childCap: 100`.
- The capped entry label is translatable (`dockitty.sidebar.cappedEntry`, default "{count} pages"), and a site option wins over the translation, as `indexLabel` does.
- The `sidebar.hidden` hint ships as an exported pure helper that generated producers call. Shaping tolerates children that are already hidden. No existing producer is wired in this slice.
- The 200-child proof is a build-test fixture site that generates its children at test time. The deployed example gets one small capped hub for the configuration page and the browser checks.
- The cap's resolver and per-hub data are exported so the paged hub listing (#342) reuses the same count and order.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader of a large section gets a short sidebar (Priority: P1)

A reader opens any page of a site that has a section with hundreds of children. The sidebar shows the hub's index link and one entry, "835 pages", that leads to the hub, instead of 835 links.

**Why this priority**: this is the slice's purpose. Without it, every page of a large site carries the whole tree.

**Independent Test**: build a fixture site whose hub has 200 children and count the sidebar links inside that hub's group on every built page.

**Acceptance Scenarios**:

1. **Given** a hub with 200 children and the default cap, **When** the site is built, **Then** on every built page the hub's sidebar group holds exactly two links: the index link and the "200 pages" entry, which links to the hub.
2. **Given** a hub with exactly as many children as its cap, **When** the site is built, **Then** its group is not capped.
3. **Given** a hub with one child more than its cap, **When** the site is built, **Then** its group is capped.
4. **Given** a capped hub, **When** the hub page itself is open, **Then** the index link is marked current and the "N pages" entry is not.

---

### User Story 2 - A reader on a capped child still sees where they are (Priority: P1)

A reader follows a link to one child of a capped hub. The sidebar has no link for that page, so the "N pages" entry is marked current instead, and the hub's group is open.

**Why this priority**: losing the "you are here" cue would make the cap an accessibility regression.

**Independent Test**: open a capped child page and check which sidebar entry carries `aria-current="page"`.

**Acceptance Scenarios**:

1. **Given** a capped hub, **When** one of its children is open, **Then** the "N pages" entry carries `aria-current="page"` and it is the only sidebar entry that does.
2. **Given** a capped child page that a generated producer marked `sidebar: { hidden: true }`, **When** it is open, **Then** the "N pages" entry is still marked current and the count still counts it.
3. **Given** a capped child page, **When** prev/next are rendered, **Then** they follow the hub's listing order: the previous and next child as the hub lists them, the hub page before the first child, and the entry after the hub's group after the last child.

---

### User Story 3 - A site owner tunes the cap per site, section or hub (Priority: P2)

A site owner sets a lower cap site-wide, raises it for one section whose children are worth listing, and sets a different cap on one hub.

**Why this priority**: the default suits most sites. Tuning is needed for the rest, and for the dogfood ADR section.

**Independent Test**: set the cap in each of the three places on the same tree and check which value applies to each hub.

**Acceptance Scenarios**:

1. **Given** a site cap of 20, a section cap of 40 and a hub frontmatter cap of 5, **When** the cap of that hub is resolved, **Then** it is 5. Without the frontmatter it is 40, and without the section setting it is 20.
2. **Given** no setting anywhere, **When** the cap is resolved, **Then** it is 50.
3. **Given** a cap that is not a positive whole number (0, a negative number, a fraction, a string), **When** the site config is read, **Then** the build fails with a message that names the setting and where it was set.

---

### User Story 4 - A site with no large hub builds exactly as before (Priority: P1)

A site owner upgrades the toolkit. No hub on their site exceeds the cap, so nothing about their output changes.

**Why this priority**: the toolkit's determinism guarantee (byte-identical builds) must hold for everyone the feature does not touch.

**Independent Test**: build an uncapped hub before and after the change and compare the HTML byte for byte.

**Acceptance Scenarios**:

1. **Given** a hub under its cap, **When** the site is built with this change, **Then** every page's built HTML is byte-identical to the build without it.
2. **Given** the deployed example site, **When** it is built, **Then** only pages whose sidebar contains the example's one capped hub change.

---

### User Story 5 - A generated-pages producer keeps its build cost bounded (Priority: P3)

A producer that writes hundreds of pages (the future missions producer) asks the toolkit whether a child would be capped and, if so, writes `sidebar: { hidden: true }` on it, so Starlight never builds those entries.

**Why this priority**: the cap already bounds the HTML. The hint bounds the work Starlight does before shaping. No producer needs it yet.

**Independent Test**: unit-test the helper, and build the fixture with every child pre-hidden: the sidebar, the current marking and prev/next match the build without the hint.

**Acceptance Scenarios**:

1. **Given** a child count and a resolved cap, **When** a producer calls the helper, **Then** it answers "hide" exactly when the count is above the cap.
2. **Given** a capped hub whose children are all pre-hidden, **When** the site is built, **Then** each page's sidebar and prev/next equal those of the same build without the hint.

### Edge Cases

- A hub whose children include sub-folders: a sub-folder counts as one child, as on the hub page, and is dropped from the sidebar with the pages when the group is capped.
- Draft children withheld from the build are not counted.
- A nested hub inside a capped hub: it is inside the capped group, so it is not shown. A nested hub under its own cap inside an uncapped parent caps on its own.
- The top-level section group is a hub too: a section with 200 direct pages is capped like any other.
- A consumer-written sidebar (`sidebar` array or the `starlight` escape hatch) is never reshaped, so it is never capped (C-004 of the route-shaping seam).
- A child page whose `prev`/`next` frontmatter points elsewhere or is `false` keeps it.
- Site-wide `pagination: false` keeps prev/next off.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Cap resolution | As a site owner, I want the cap read from hub frontmatter `sidebar_child_cap`, then the section's `sidebar.childCap` in `sections.yaml`, then the site's `sidebar.childCap`, then 50, so that the most specific setting wins. | High | Open | [build] | no — each level is asserted with the less specific levels set to different values |
| FR-002 | Cap validation | As a site owner, I want a cap that is not a positive whole number refused at config time, with the setting and its location named, so that a typo does not silently cap or uncap a hub. | High | Open | [build] | no — one valid and one invalid value per level on the same fixture |
| FR-003 | Capped group | As a reader, I want a hub with more children than its cap shown as its index link plus one entry to the hub, so that the sidebar stays short. | High | Open | [build] | no — the same fixture hub at cap and at cap+1 |
| FR-004 | Hub child count and order | As a reader, I want the cap to count and order a hub's children exactly as the hub page lists them, so that the "N pages" count and prev/next match what the hub shows. | High | Open | [build] | no — the count equals `selectHubChildren` on a fixture with drafts and sub-folders |
| FR-005 | Current marking | As a reader on a capped child, I want the "N pages" entry marked current, so that I still see where I am. | High | Open | [build] | no — asserted on a capped child and, as positive control, on the hub page where it is not current |
| FR-006 | Capped entry label | As a site owner, I want the entry label from a site option, else the locale's `dockitty.sidebar.cappedEntry` string, else "{count} pages", with `{count}` replaced, so that it reads naturally in my language. | Medium | Open | [build] | no — each of the three sources asserted on its own |
| FR-007 | Prev/next follow hub order | As a reader, I want prev/next on a capped child, and on the hub page, to follow the hub's listing order, so that paging through children works although they are not in the sidebar. | High | Open | [build] | no — the order differs from Starlight's slug order on the fixture |
| FR-008 | Hidden hint | As a generated-pages producer, I want an exported helper that says whether a child of a hub would be capped, and shaping that gives the same result whether or not capped children are pre-hidden, so that I can skip them before Starlight builds the tree. | Medium | Open | [build] | no — the fixture is built with and without the hint and compared |
| FR-009 | Reusable cap API | As the paged hub listing (#342), I want the cap resolver and each capped hub's data (cap, count, ordered child routes) exported from the toolkit, so that the listing shows the same children in the same order. | Medium | Open | [build] | yes — guarded by a unit test that imports the exports |
| FR-010 | Dogfood ADR section | As a maintainer, I want this repo's `adr` section to set `sidebar.childCap: 100`, so that the repo's own ADR sidebar is unchanged. | Low | Open | [build] | no — the repo docs build keeps every ADR link |
| FR-011 | Documentation | As a site owner, I want a configuration page that explains the three settings, the label, the hint and an example, and a changelog fragment, so that I can adopt the cap. | Medium | Open | [build] | no — the page is in the docs tree and passes doc-sanity |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Bounded sidebar | On the 200-child fixture, every built page's sidebar holds at most cap + 2 links inside the capped hub's group, asserted on the built HTML of every page. | Performance | High | Open |
| NFR-002 | Byte-identity | Every built page of a site with no hub over its cap is byte-identical to the build without this change; asserted on an uncapped fixture hub. | Reliability | High | Open |
| NFR-003 | Determinism | Two builds of the same tree emit byte-identical HTML and an identical route-shaping module. | Reliability | High | Open |
| NFR-004 | Measured cost | Build time and median per-page HTML size on a 1,000-child fixture are measured, capped and uncapped, three runs each, and recorded in `docs/plans/features/large-hubs.md`. The capped median page is at least 50% smaller than the uncapped one. | Performance | Medium | Open |
| NFR-005 | Accessibility | A capped hub's pages pass axe (WCAG 2.2 AA) and exactly one sidebar entry carries `aria-current="page"`, checked in Playwright on the deployed example. | Accessibility | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | No new carrier | The cap lives in route shaping. The six-carrier lock of ADR-0063 stays. | Technical | High | Open |
| C-002 | Pure shaping | The shaping functions stay pure functions of their arguments. The build-time hub data reaches the middleware through the existing `virtual:doc-kitty/route-shaping` module. | Technical | High | Open |
| C-003 | One child definition | The child set and order come from `selectHubChildren`. No second definition is written. | Technical | High | Open |
| C-004 | Consumer sidebar untouched | A sidebar the consumer wrote is never capped. | Technical | High | Open |
| C-005 | Gates clean | Lint, typecheck, unit, build, e2e and a11y gates pass with no suppressions. Tests are written red first. | Process | High | Open |

### Key Entities

- **Hub**: a directory with a published index page. Its children are the published pages and sub-folders one level down, ordered as `selectHubChildren` orders them.
- **Child cap**: the largest number of children a hub shows in the sidebar. Resolved per hub from frontmatter, section and site settings.
- **Capped group**: a hub's sidebar group when its child count is above its cap: the index link and the capped entry.
- **Capped entry**: the one sidebar link that stands for a capped hub's children. It links to the hub and carries the count.
- **Hub data**: per capped hub, the resolved cap, the child count and the ordered child routes and titles, computed at build time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the 200-child fixture, no built page has more than cap + 2 links in the hub's sidebar group. — [build] · no-op passable: no
- **SC-002**: On every capped child page of the fixture, the capped entry is the only sidebar entry marked current. — [build] · no-op passable: no
- **SC-003**: An uncapped fixture hub's built output is byte-identical with and without the change. — [build] · no-op passable: yes — paired with SC-001 on the same fixture
- **SC-004**: The plan records build time and per-page HTML size on a 1,000-child fixture, capped and uncapped. — [build] · no-op passable: no
