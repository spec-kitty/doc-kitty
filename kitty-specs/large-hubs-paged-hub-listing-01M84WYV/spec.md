# Mission Specification: Large hubs: paged hub listing

**Mission Branch**: `kitty/mission-large-hubs-paged-hub-listing-01M84WYV` (lands on `feat/342-paged-hub-listing`, based on `main` after PR #426 merged)
**Created**: 2026-11-23
**Status**: Draft
**Input**: Issue #342, "Large hubs slice 2: paged hub listing" (epic #340), with #429 folded in. Plan: `docs/plans/features/large-hubs.md`, slice 2. Design: `docs/architecture/research/missions-and-ops.md`, "Listing a large hub". Builds on slice 1 (#341, PR #426, ADR-0084).

Slice 1 caps a large hub's sidebar group to its overview link and one "N pages" entry that leads to the hub. The hub page itself still lists every child, so a hub with 1,000 children is one very long page. This mission pages that listing. A hub over its sidebar child cap lists its first page of children, and static pages from `/<hub>/page/2/` onwards list the rest. A pagination navigation links them all, so every child is reachable with scripts off.

**Intent summary (Decision Moments under `decisions/`; confirmed by the operator 2026-11-24):**

- **#429 is folded in.** The build's hub data covers every `kind: Hub` hub, whatever the sidebar mode, and marks whether each hub is capped. The hub page, the paged pages and the sidebar read the same resolved cap, count and order. The `HubCap` shape stays backward compatible.
- **Page size is its own setting** at hub, section and site level, resolved most specific first, default 50. Only hubs over their sidebar child cap are paged.
- **Paged pages are included everywhere.** The sitemap, the agent API, `llms.txt` and site search all include them, and each is self-canonical. In the operator's words: "The hub and sidenav exclusions are for human navigation ease purposes, not as a means to hide content." This deliberately reverses #342's original criterion that the sitemap holds no paged URL.
- **A child whose slug is `page`** fails the build when its hub is paged.
- **Locales mirror #341.** A locale with its own over-cap hub index gets its own paged pages, and fallback pages are not listed. This limit is documented.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A reader without scripts reaches every child of a large hub (Priority: P1)

A reader opens a hub with 200 children, with scripts off. The hub lists the first page of children and a pagination navigation. The reader follows "Next" or a page number to `/<hub>/page/2/`, which lists the next children in the same order, and so on to the last page.

**Why this priority**: this is the slice's purpose. Slice 1 removed the children from the sidebar, so the hub's listing is now the human route to them.

**Independent Test**: build a fixture site whose hub has 200 children and a page size of 50. Follow only the pagination links in the built HTML, from the hub, and collect every child link reached.

**Acceptance Scenarios**:

1. **Given** a hub with 200 children and page size 50, **When** the site is built, **Then** the hub lists children 1–50, and `/<hub>/page/2/`, `/page/3/` and `/page/4/` list children 51–100, 101–150 and 151–200.
2. **Given** the same hub, **When** a reader follows only pagination links from the hub, **Then** every one of the 200 children is linked from exactly one listing page, in the hub's listing order.
3. **Given** a hub with exactly as many children as its sidebar child cap, **When** the site is built, **Then** it is not paged, and its hub page is byte-identical to today's.
4. **Given** a capped hub with 120 children and page size 50, **When** the site is built, **Then** there are three listing pages (50, 50, 20), and no `/<hub>/page/1/` or `/<hub>/page/4/` page exists.

---

### User Story 2 - A keyboard or screen-reader user operates the pagination (Priority: P1)

A reader tabs to the pagination navigation, hears its name ("Pagination"), and hears which page is current. They move to the previous, next or any numbered page with the keyboard alone.

**Why this priority**: the charter targets WCAG 2.2 AA. A pagination that fails it would make the cap an accessibility regression.

**Independent Test**: run axe and a keyboard walk over the hub and a paged page in the example, in the light and dark themes.

**Acceptance Scenarios**:

1. **Given** a paged hub, **When** any of its listing pages is open, **Then** the pagination is a navigation landmark with an accessible name. The current page's item carries `aria-current="page"` and is not a link to itself.
2. **Given** the first listing page, **When** it is rendered, **Then** there is no active "Previous" link. On the last page there is no active "Next" link.
3. **Given** a listing page, **When** axe runs in the light and dark themes, **Then** it reports no violations. Every pagination link has a visible focus indicator and a target of at least 24×24 CSS px.
4. **Given** a locale with translated UI strings, **When** a listing page renders in that locale, **Then** the pagination's name, "Previous", "Next" and the page labels use that locale's strings, with English defaults.

---

### User Story 3 - A paged page sits in the site frame (Priority: P1)

A reader on `/<hub>/page/3/` sees the normal site frame: header, search, the sidebar with the hub's "N pages" entry marked current, the hub's title and lead, and the listing. The pagination navigation takes the place of the page-level previous/next links.

**Why this priority**: a paged page that leaves the frame or loses "you are here" would disorient readers.

**Independent Test**: inspect a built paged page's HTML for the frame, the sidebar's current entry, the title and the absence of the page-level previous/next links.

**Acceptance Scenarios**:

1. **Given** `/<hub>/page/N/`, **When** it is built, **Then** it renders inside the site frame, its sidebar marks the hub's "N pages" entry as current, and the page-level previous/next links are absent.
2. **Given** `/<hub>/page/N/`, **When** it is built, **Then** its title names the hub and the page number ("<hub title>, page N"), and its canonical URL is its own URL.
3. **Given** the hub page itself (page 1) of a paged hub, **When** it is built, **Then** its sidebar and page-level previous/next behave exactly as in slice 1, and the pagination navigation follows its listing.

---

### User Story 4 - Agents, crawlers and search reach the paged pages and every child (Priority: P2)

An agent reads the agent API or `llms.txt`, a crawler reads the sitemap, and a reader searches the site. Each finds every child and every paged listing page.

**Why this priority**: the operator ruled that hiding children from navigation is for human ease, never to hide content. Machine surfaces must stay complete.

**Independent Test**: build the fixture and compare the sitemap, the agent API, `llms.txt` and the search index with the expected sets of child and paged URLs.

**Acceptance Scenarios**:

1. **Given** a paged hub, **When** the site is built, **Then** the sitemap holds every child and every paged URL `/<hub>/page/2/` onwards, each exactly once.
2. **Given** a paged hub, **When** the site is built, **Then** the agent API and `llms.txt` list every child as before, and list each paged URL exactly once as a listing of its hub.
3. **Given** a paged hub, **When** the search index is built, **Then** each paged page is indexed. A search for a child's title still leads to the child page; how paged pages show in results is decided in the plan.
4. **Given** the links gate and the agent-API checks, **When** they run on a site with paged hubs, **Then** they pass.

---

### User Story 5 - A site owner tunes the page size (Priority: P2)

A site owner sets a site-wide page size, overrides it for one section, and sets a different page size on one hub.

**Why this priority**: the default suits most sites. Tuning is needed for very long or very rich listings.

**Independent Test**: build fixtures with the setting at each level and count the children per listing page.

**Acceptance Scenarios**:

1. **Given** a page size set on a hub, its section and the site, **When** the site is built, **Then** the hub's setting wins, then the section's, then the site's, then the default of 50.
2. **Given** a page size that is not a positive whole number at any level, **When** the site is built, **Then** the build stops with an error naming the setting and where it was set.
3. **Given** a hub under its sidebar child cap with a page size smaller than its child count, **When** the site is built, **Then** it is not paged.

---

### User Story 6 - Sites with their own sidebar get the same listing (Priority: P2)

A site owner who supplies their own Starlight sidebar still has large hubs. Their hub pages are paged exactly as on a site whose sidebar the toolkit shapes, and their sidebar is left exactly as they wrote it.

**Why this priority**: #429. Paging is about the hub page, not the sidebar, so it must not depend on the sidebar mode.

**Independent Test**: build the same fixture with and without a consumer sidebar and compare the listing pages.

**Acceptance Scenarios**:

1. **Given** a site with its own sidebar and a hub over its cap, **When** the site is built, **Then** the hub page and its paged pages list the same children in the same order as on a shaped-sidebar site, and the consumer sidebar is unchanged.
2. **Given** any site, **When** it is built, **Then** the build's hub data has one entry for every published `kind: Hub` hub, with its cap, page size, count, children and whether it is capped.

---

### Edge Cases

- **A child with the slug `page` under a paged hub** fails the build with an error that names the hub and the child (decision 01M86VFXHVM5X10N1WBY36G7JZ). Under an unpaged hub, it is allowed.
- **The child count is an exact multiple of the page size.** No empty last page is emitted.
- **The page size is at or above the child count of a capped hub** (for example, cap 50, page size 100, 80 children). The hub lists all its children on one page, and there are no paged pages or pagination.
- **Draft children and `type: Template` ADRs** are not listed or counted, exactly as on the hub page and in slice 1's cap.
- **An ADR hub** keeps its order: ADR cards first by id, then the other children, paged across pages in that order.
- **A sub-folder child** (a nested hub) is listed by its own index link, as today.
- **A non-default base path** (`base: /docs/`) prefixes every paged URL, pagination link and canonical URL.
- **Locales**: a locale whose hub index is not translated is not paged in that locale. Fallback pages are not listed (decision 01M86VG35H42R2ACQCMZKD6V5P).
- **A draft hub index** is not a hub, so it is not paged (as in slice 1).

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Hub data for every hub (#429) | As the toolkit, I want the build's hub data to hold one entry for every published `kind: Hub` hub in every sidebar mode, with its cap, count, children in listing order and a `capped` flag, so that the hub page, the paged pages and the sidebar read one resolved source. | High | Open | [build] | no — today a hub under its cap or a consumer-sidebar site yields no entry; the test asserts entries for both |
| FR-002 | Backward-compatible hub data | As a consumer of `@spec-kitty/doc-toolkit/child-cap`, I want the existing `HubCap` fields unchanged and only new optional fields added, so that code written against slice 1 keeps compiling and the sidebar output for capped and uncapped hubs is unchanged. | High | Open | [ratchet] | yes — paired with FR-001's entries on the same fixture; existing goldens must pass |
| FR-003 | Page-size setting | As a site owner, I want a page size on the hub (frontmatter), its section (`sections.yaml` or the charter's `sections.entries`) and the site (`defineDocKittyIntegrations`), resolved most specific first with a default of 50, so that I can tune listing length. | High | Open | [build] | no — a fixture sets different values at each level and asserts the winner |
| FR-004 | Invalid page size stops the build | As a site owner, I want a page size that is not a positive whole number to stop the build with an error naming the setting and its location, so that a typo never ships a broken listing. | Medium | Open | [build] | no — each invalid value must raise; a valid one in the same fixture must not |
| FR-005 | Only capped hubs are paged | As a reader, I want only hubs over their sidebar child cap to be paged, and a hub at or under its cap to render byte-identically to today, so that small hubs do not change. | High | Open | [build] | no — the over-cap hub must page while the at-cap hub in the same fixture stays identical to its golden |
| FR-006 | First page on the hub | As a reader, I want a paged hub's own page to list its first page-size children in listing order, followed by the pagination navigation, so that the hub stays short. | High | Open | [build] | no — asserts the hub lists exactly page-size children |
| FR-007 | Static paged pages | As a reader without scripts, I want `/<hub>/page/N/` for N = 2 to the last page, each listing the next page-size children in listing order, so that every child is reachable without scripts. | High | Open | [build] | no — asserts the union of listings equals the hub's children, each once, in order |
| FR-008 | Accessible pagination navigation | As a keyboard or screen-reader user, I want a navigation landmark named "Pagination" with Previous, Next and numbered page links, `aria-current="page"` on the current page and no self-link, so that I can move between pages and know where I am. | High | Open | [build] | no — axe and DOM assertions on the built pages |
| FR-009 | Localisable pagination strings | As a reader of a translated site, I want the pagination's name and labels to come from UI strings with English defaults, so that they read in my language. | Medium | Open | [build] | no — a translated fixture string must appear in the built HTML |
| FR-010 | Paged page in the site frame | As a reader, I want each paged page inside the site frame, titled "<hub title>, page N", showing the hub's lead, with the sidebar's "N pages" entry current where the sidebar is shaped and the page-level previous/next replaced by the pagination, so that I keep my bearings. | High | Open | [build] | no — asserts frame, title, current entry and the absence of page-level prev/next |
| FR-011 | Self-canonical paged pages | As a crawler, I want each paged page's canonical URL to be its own URL, honouring the site base, so that it is not folded into the hub. | Medium | Open | [build] | no — asserts the canonical link on a paged page equals its own URL |
| FR-012 | Paged pages in the sitemap | As a crawler, I want the sitemap to hold every child and every paged URL, each exactly once, so that all content is retrievable. | High | Open | [build] | no — asserts the paged URLs are present (and children still present) in the built sitemap |
| FR-013 | Paged pages in the agent surfaces | As an agent, I want the agent API and `llms.txt` to list every child as before and each paged URL once as a listing of its hub, so that iterative deepening reaches every page. | High | Open | [build] | no — asserts the paged URLs appear exactly once in each surface |
| FR-014 | Paged pages in site search | As a reader using search, I want paged pages indexed, without making a child's own page harder to find than today, so that search covers the listing. | Medium | Open | [build] | no — asserts paged pages are in the built index and a child-title query's top hit is the child |
| FR-015 | Gates stay green | As a maintainer, I want the links gate, the agent-API checks and the build-artifact assertions to pass with paged routes present, and to fail on a broken pagination link, so that the gates cover the new routes. | High | Open | [build] | no — a broken pagination link in a fixture must fail the gate |
| FR-016 | `page` slug collision | As a site owner, I want the build to fail with an error naming the hub and the child when a paged hub has a child whose slug is `page`, so that no route is silently shadowed. | Medium | Open | [build] | no — the collision fixture must fail; the same child under an unpaged hub must build |
| FR-017 | Consumer-sidebar parity | As a site owner with my own sidebar, I want my hubs paged exactly as on a shaped-sidebar site and my sidebar left as written, so that paging does not depend on the sidebar mode. | Medium | Open | [build] | no — compares the listings across the two modes on one fixture |
| FR-018 | Locale paging | As a reader of a multilingual site, I want each locale with its own over-cap hub index to get its own paged pages, so that paging works per language as the cap does. | Low | Open | [build] | no — a translated over-cap hub fixture must produce locale paged pages |
| FR-019 | Exported pure API | As a generated-pages producer, I want the page-size resolver and the paging arithmetic (page count, the slice for page N) exported from the package, so that I compute pages exactly as the build does. | Medium | Open | [build] | no — unit tests on the exported functions |
| FR-020 | Documentation | As a site owner, I want a configuration page for paged hub listings, updated slice-1 guide and ADR references, a changelog fragment, and an example hub in the deployed example that is paged, so that the feature is discoverable. | Medium | Open | [build] | no — docs validators and the example build assertion must see the new page and paged routes |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Bounded hub page | On a 1,000-child fixture with page size 50, the hub page's HTML is at most 25% of the unpaged hub page's HTML, with sizes recorded in the plan document. | Performance | Medium | Open |
| NFR-002 | Build time | On the same 1,000-child fixture, the median of three paged builds is no more than 10% slower than the median of three unpaged builds, measured interleaved and recorded in the plan document. | Performance | Medium | Open |
| NFR-003 | Deterministic output | Two builds of one tree emit byte-identical paged pages, hub data and sitemap entries, so that page order is stable across hosts. | Reliability | High | Open |
| NFR-004 | Accessibility | Listing pages report 0 axe violations (WCAG 2.2 AA rules) in light and dark themes, and every pagination link is reachable and operable with the keyboard alone. | Accessibility | High | Open |
| NFR-005 | No regression for small hubs | Sites with no hub over its cap build byte-identical pages to before this mission, checked against the existing goldens. | Reliability | High | Open |
| NFR-006 | No added scripts | Listing pages add 0 bytes of client JavaScript. | Performance | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | One composition | Count and order come from the one composition the hub page and slice 1's cap use. No second ordering of hub children is introduced. | Technical | High | Open |
| C-002 | No new sidebar carrier | ADR-0063's carrier set stays as is; paging lives in the hub page and in build-generated routes. | Technical | High | Open |
| C-003 | Based on main | PR #426 (slice 1) merged on 2026-11-23, so this work is based on `main`; the PR is not stacked. | Business | High | Open |
| C-004 | Out of scope | "Load more", sorting, filters and the per-hub `index.json` (#343), and `llms: summary` mode (#344) are out of scope. | Business | High | Open |
| C-005 | Starlight frame | Paged pages render in the Starlight frame, not as a splash or a bare page, and keep the theme layer swappable (charter: presentation axis). | Technical | High | Open |
| C-006 | Changelog by fragment | The changelog is changed only by adding a fragment under `docs/changelog/unreleased/`; an ADR adds its file but never its index row (AGENTS.md). | Business | High | Open |

### Key Entities

- **Hub**: a folder whose published index page has `kind: Hub`. Has a sidebar child cap, a page size and an ordered list of published children.
- **Hub data entry** (`HubCap`, widened): per hub folder, the resolved cap, the child count, the children in listing order (slug and label), whether the hub is capped, and the resolved page size.
- **Listing page**: page N of a paged hub. Page 1 is the hub page; pages 2 onwards live at `/<hub>/page/N/`. Each holds at most page-size children.
- **Page size**: a positive whole number per hub, resolved from hub frontmatter, then section, then site, then the default of 50.
- **Pagination navigation**: the labelled landmark linking a hub's listing pages.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With scripts off, 100% of a 200-child fixture hub's children are reachable from the hub by following pagination links only, each listed exactly once. — [build] · no-op passable: no
- **SC-002**: The pagination reports 0 axe violations on the example's paged hub in both themes, and a keyboard-only user can reach every listing page. — [build] · no-op passable: no
- **SC-003**: The built sitemap holds 100% of the fixture's children and 100% of its paged URLs, with no duplicate entries. — [build] · no-op passable: no
- **SC-004**: The links gate and the agent-API checks pass on a build with paged hubs, and fail when a pagination link is broken. — [build] · no-op passable: no
- **SC-005**: Every site with no hub over its cap builds byte-identical pages to before, and the slice-1 goldens pass unchanged. — [ratchet] · no-op passable: yes — paired with SC-001 on the same fixture set
- **SC-006**: Vitest tests, a built-output fixture assertion, a configuration page and a changelog fragment all ship. — [build] · no-op passable: no

## Assumptions

- The listing order is the hub page's deterministic order. Sorting and filtering arrive with #343.
- "Included everywhere" (decision 01M858BAP6FM32TPQRB7594R40) means each paged URL appears once per surface. The plan decides how to keep repeated child titles in search and `llms.txt` from crowding out the children themselves, and records why.
- Paged pages are not part of the docs content collection, so surfaces built from the collection need explicit handling. The plan names each one.
- Whether this needs a new ADR or an amendment note on ADR-0084 is a plan decision.
- `llms: summary` mode (#344) may later change how `llms.txt` lists a large hub. This mission keeps the current one-line-per-page format.

## Dependencies

- PR #426 (slice 1) supplies the cap, `HubCap`, `composeHubChildren` and the route-shaping data this mission widens.
- Follow-up issues: #343 (progressive listing) and #344 (agent and feed modes) build on this listing.
