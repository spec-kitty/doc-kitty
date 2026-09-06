# Mission Specification: Feed order determinism (#85)

**Mission Branch**: `feat/feed-order-determinism`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "Issue #85 — rss.xml item order is build-nondeterministic because the feed comparator is not total; make it total and make the collected doc entries order-stable so byte-oracles on the built corpus are reliable."

Found while running the byte-identical corpus oracle for #83: two clean builds of an **unchanged** tree produce different `example/dist/rss.xml` bytes. All other 233 built files are stable. The feed comparator sorts by `updated` only, so tied items (22 of 26 in the demonstrator) fall through to the content-layer insertion order, which is the completion order of a concurrent read+render pool. This mission makes the order deterministic. It is a small, intentional **behaviour change** (tie order becomes slug order) confined to feed ordering; no content changes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A maintainer can trust a byte-diff of the built corpus (Priority: P1)

A maintainer (or CI) compares two builds of the same tree, or a before/after build for a refactor, and expects every file to be byte-identical. Today `rss.xml` can differ on its own, forcing manual "sort the items and compare" workarounds and making golden-feed tests impossible.

**Why this priority**: it is the whole issue; it burned a build cycle in #83's squad round.

**Independent Test**: build the unchanged tree twice; `rss.xml` hashes match. Feed a shuffled entry list to the ranker; the output order is identical to the unshuffled run.

**Acceptance Scenarios**:

1. **Given** two entries with the same `updated` date, **When** `rankForFeed` ranks them in either input order, **Then** they come out in the same order (ascending slug), and entries with different dates still come out most-recent first.
2. **Given** a shuffled copy of an entry list, **When** ranked, **Then** the output equals ranking the original list.
3. **Given** the demonstrator site, **When** it is built twice from the same tree, **Then** `rss.xml` is byte-identical between the builds (the sitemap's own ordering issue is #87, out of scope).
4. **Given** the demonstrator site, **When** it is built after this change, **Then** every file other than `rss.xml` is byte-identical to a build before the change, and `rss.xml` contains the same items (sorted multiset equal) with tied items now in slug order.

---

### User Story 2 - Every downstream surface sees entries in a stable order by construction (Priority: P2)

`collectDocEntries` is the one adapter every route reads. Returning it slug-sorted removes the class of latent tie-order bugs for any consumer that does not sort with a total comparator, instead of fixing them one comparator at a time.

**Why this priority**: structural fix behind the symptom; cheap and zero-risk because every current consumer already sorts.

**Independent Test**: `collectDocEntries` output is ascending by slug regardless of collection order; the llms.txt, agent index, and sitemap outputs are byte-identical before and after.

**Acceptance Scenarios**:

1. **Given** the collection returns entries in an arbitrary order, **When** `collectDocEntries` adapts them, **Then** the result is sorted ascending by slug.
2. **Given** the change, **When** the corpus is rebuilt, **Then** `llms.txt`, the agent index and the sitemap are byte-identical to the pre-change build.

---

### Edge Cases

- **Entries with no `updated`**: `updatedMillis` yields 0; they sort last, among themselves by slug (today: arbitrary).
- **Root entry** (slug `''`): sorts first among ties by `localeCompare`; deterministic.
- **Locale sensitivity of `localeCompare`**: use a locale-independent comparison (e.g. `localeCompare(b, 'en')` or a plain `<`/`>` comparison) so CI and local builds agree.
- **Pure-ESM twin gates** (`src/scripts/*.mjs`): none consume `rankForFeed`; no parity twin to update.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Total feed comparator | As a maintainer, I want `rankForFeed` to break `updated` ties deterministically (ascending slug) so that the feed order does not depend on build timing. | High | Open |
| FR-002 | Order-stable collected entries | As a maintainer, I want `collectDocEntries` to return entries sorted by slug so that every consumer is order-stable by construction. | Medium | Open |
| FR-003 | Regression test | As a maintainer, I want a unit test that a shuffled input yields the same ranked order, so the comparator cannot silently become partial again. | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Reproducible feed | Two clean builds of the same tree yield byte-identical `rss.xml` (0 differing bytes). (`sitemap-0.xml` was found to be intermittently order-nondeterministic for an unrelated reason — Starlight route generation order — and is tracked as #87; it is excluded from this criterion.) | Reliability | High | Open |
| NFR-002 | Corpus delta confined to rss.xml | A fresh build after the change differs from a pre-change build only in `rss.xml`, and there only in item order (sorted item multiset and envelope identical). | Reliability | High | Open |
| NFR-003 | Full gate suite green | Unit, build, validate/assert gates and CI pass. | Quality gate | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Locale-independent tiebreak | The tiebreak must not depend on the runtime locale. | Technical | High | Open |
| C-002 | No dependency change | No package added, upgraded or removed. | Technical | High | Open |
| C-003 | Metadata/routes scope only | Edits confined to `src/lib/metadata.ts`, `src/lib/routes/shared.ts` and their unit tests. `rankForAgents`, `includedInRssFeed` and the route bodies are untouched. | Technical | High | Open |

### Key Entities

- **Feed ranking**: `rankForFeed(entries)` — published entries, most-recently-updated first, ties by ascending slug.
- **Collected entries**: `collectDocEntries()` — the adapter from the Astro collection to `DocEntry[]`, now slug-sorted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 2 consecutive clean builds of the same tree → `rss.xml` byte-identical (previously differing); every other file identical except the pre-existing, separately tracked `sitemap-0.xml` order (#87).
- **SC-002**: A new unit test ranks a shuffled input and asserts equality with the unshuffled ranking; it fails if the tiebreak is removed.
- **SC-003**: Pre/post-change corpus diff → `rss.xml` is the only file whose change is caused by this mission (identical sorted item multiset, tie order now by slug); `sitemap-0.xml` may also differ for the unrelated, pre-existing reason tracked as #87.
