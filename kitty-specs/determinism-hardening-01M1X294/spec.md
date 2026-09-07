# Mission Specification: Determinism hardening (#87 + #88)

**Mission Branch**: `feat/determinism-hardening`
**Created**: 2026-09-07
**Status**: Draft
**Input**: User description: "Do #87 and #88 together — make the built sitemap
order deterministic (a post-build sort hook) and run the comparator hygiene
sweep: intrinsic-total rankers, locale-independent sorts, one shared code-unit
comparator, and dedupe the inline copies."

Two follow-ups from #85 (`feed-order-determinism`), delivered as one mission.
#85 made `rankForFeed` total and `collectDocEntries` slug-sorted; the two-build
oracle then exposed that `sitemap-0.xml` is still order-nondeterministic (#87)
and that several sibling sorts are only *positionally* deterministic or
duplicate the comparator idiom (#88). This mission closes both so the built
corpus is fully reproducible and the comparator family has one source.

The guiding constraint is **byte-neutrality except for the sitemap**: the only
built file whose bytes this mission may change is `sitemap-0.xml` (which becomes
deterministically `<loc>`-sorted). Every #88 change is verified byte-neutral on
the demonstrator against a pre-change build.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The built sitemap is reproducible (Priority: P1)

Two clean builds of the same tree must produce a byte-identical
`sitemap-0.xml`. Today `@astrojs/sitemap` serializes pages in Astro's
route-generation order, which for Starlight docs routes is the concurrent glob
loader's completion order (the #85 root cause, unreachable from
`collectDocEntries`). A toolkit-owned post-build step sorts the `<url>` entries
by `<loc>`.

**Why this priority**: it is the remaining hole in the corpus byte-oracle and
the headline of #87.

**Independent Test**: build the unchanged tree twice; `sitemap-0.xml` hashes
match, and its `<url>` blocks are in ascending `<loc>` order.

**Acceptance Scenarios**:

1. **Given** a built site, **When** `sitemap-0.xml` is written by
   `@astrojs/sitemap`, **Then** a subsequent toolkit build step rewrites it with
   its `<url>` blocks ordered by `<loc>` (code-unit ascending), and re-emits a
   consistent `sitemap-index.xml` if pagination is present.
2. **Given** two clean builds of the same tree, **When** their `sitemap-0.xml`
   files are compared, **Then** they are byte-identical.
3. **Given** the sorted sitemap, **When** the existing `assert:no-broken-links`
   / `assert:artifacts` gates run, **Then** they still pass (the same URL set,
   only reordered).

---

### User Story 2 - Every ranker is intrinsically total and locale-independent (Priority: P1)

The rankers and sorts that feed the agent surfaces and the docs chrome must
order deterministically from their inputs alone, not by relying on a
pre-sorted feed plus a stable sort, and must not depend on the runtime locale.

**Why this priority**: it is the substance of #88 — the determinism guarantee
should be intrinsic, so a consumer calling a public ranker (e.g.
`rankForAgents`, exported from the package) on its own array gets a stable
order.

**Independent Test**: a shuffled input to each ranker yields the same output;
the built agent surfaces (`api/index.json`, `llms.txt`) and hub pages are
byte-identical to a pre-change build.

**Acceptance Scenarios**:

1. **Given** `rankForAgents`, **When** it ranks entries that tie on section and
   priority, **Then** it breaks the tie deterministically and
   locale-independently, and a shuffled input ranks identically. The demonstrator
   output is unchanged (the tiebreak is appended after the existing title order,
   which is unique on the corpus, so it never fires there).
2. **Given** the llms.txt section ordering and the hub-children ordering,
   **When** two sections/children tie on their primary key, **Then** the tie is
   broken deterministically; the built `llms.txt` and hub pages are unchanged.
3. **Given** any sort keyed on an id, path, or ADR number, **When** it runs,
   **Then** it uses a locale-independent comparison; the built output is
   unchanged (those keys are ASCII/digit and already code-unit-ordered).

---

### User Story 3 - One shared code-unit comparator, no inline twins (Priority: P2)

The `a < b ? -1 : a > b ? 1 : 0` idiom and the bare `localeCompare` calls should
resolve to a single shared comparator reachable from both the `.ts` modules and
their pure-ESM `.mjs` twins, so the convention #85 introduced has one home.

**Why this priority**: removes the standing duplication #88 catalogued and
prevents the twins from drifting.

**Independent Test**: exactly one code-unit comparator definition exists in the
shared core; the inline twins and the relevant `localeCompare` sites route
through it; the `.mjs`/`.ts` parity guards stay green.

**Acceptance Scenarios**:

1. **Given** the shared `compareCodeUnit` in the pure-ESM core, **When** the
   glossary generators, the registry/section/catalog sorts, and their `.mjs`
   twins need a code-unit order, **Then** they import it rather than re-inlining
   the idiom or calling bare `localeCompare`.
2. **Given** `compareSlug` (#85), **When** the refactor lands, **Then** it is
   the slug-typed alias of `compareCodeUnit` (one implementation).

---

### User Story 4 - The component read-paths use the shared, sorted helpers (Priority: P3)

`Hub.astro` inlines a copy of the `collectDocEntries` map body over a raw
`getCollection('docs')` (so it does not get #85's slug-sorted baseline), and
three slot components inline copies of `buildDocsIndex`. Route them through the
shared exports so the latent #85-class hazard is closed by construction.

**Why this priority**: duplication cleanup with a determinism angle (Hub's
children ordering currently depends on its comparator over raw-order input);
lowest priority because it is byte-neutral and order-insensitive today.

**Independent Test**: the components import the shared `buildDocsIndex` /
slug-sorted collection helper instead of inlining it; hub pages and the slot
outputs are byte-identical to a pre-change build.

**Acceptance Scenarios**:

1. **Given** `Hub.astro` and the Audience/Related/OnThisPage slot components,
   **When** they build their docs index or child list, **Then** they call the
   shared helper (no inline copy of its body remains); the built pages are
   byte-identical.

---

### Edge Cases

- **Sitemap pagination**: `@astrojs/sitemap` emits `sitemap-0.xml` (+ index)
  for the demonstrator's 30 URLs; if a larger site paginates into
  `sitemap-1.xml` etc., the hook must sort each page file it finds and leave the
  index consistent. The hook keys off the files actually present in `dist`.
- **`rankForAgents` locale on titles**: the title order is human-facing, so it
  keeps a `localeCompare` (pinned to a fixed locale for reproducibility) as the
  primary alphabetic key, with the code-unit slug tiebreak appended only for
  totality. This must not reorder the demonstrator (verified by the oracle); if
  pinning the locale reorders anything, fall back to leaving the title compare
  exactly as-is and appending the slug tiebreak (still total, still byte-neutral).
- **id/path/number sorts**: routing these through `compareCodeUnit` changes the
  collation from `localeCompare`-default to code-unit; verified byte-neutral
  because every such key on the corpus is lowercase-ASCII / zero-padded-digit.
- **No `.mjs` twin for `metadata.ts`**: `compareSlug` currently lives ts-only;
  moving the implementation to `vocabulary-core.mjs` (which `metadata.ts` already
  imports from) and re-exporting keeps it reachable from every twin.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Sitemap post-build sort | As a maintainer, I want the built `sitemap-*.xml` `<url>` entries sorted by `<loc>` so the sitemap is byte-reproducible. | High | Open |
| FR-002 | Intrinsic-total rankers | As an adopter, I want `rankForAgents` (and the llms.txt/hub sorts) to break ties deterministically and locale-independently from their inputs alone. | High | Open |
| FR-003 | Locale-independent id/path sorts | As a maintainer, I want every id/path/number sort to be locale-independent so builds do not depend on the runtime locale. | Medium | Open |
| FR-004 | One shared code-unit comparator | As a maintainer, I want a single `compareCodeUnit` in the pure-ESM core that the `.ts` modules, their `.mjs` twins, the glossary generators, and `compareSlug` all use. | Medium | Open |
| FR-005 | Component read-paths use shared helpers | As a maintainer, I want `Hub.astro` and the slot components to call the shared collection/index helpers rather than inline copies. | Low | Open |
| FR-006 | Regression tests | As a maintainer, I want a unit test per hardened ranker/sort proving a shuffled input ranks identically, and a sitemap-sort test. | High | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Reproducible sitemap | Two clean builds of the same tree yield a byte-identical `sitemap-0.xml` (0 differing bytes). | Reliability | High | Open |
| NFR-002 | Corpus delta confined to the sitemap | A fresh build after this mission differs from a pre-change build only in `sitemap-*.xml` (now sorted). No other built file changes bytes. | Reliability | High | Open |
| NFR-003 | Parity twins stay green | The `.ts`↔`.mjs` parity guards pass with the shared comparator (no twin drift). | Correctness | High | Open |
| NFR-004 | Full gate suite green | Unit, build, validate/assert gates, and CI pass. | Quality gate | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Byte-neutral except the sitemap | No built file other than `sitemap-*.xml` may change bytes. Any other delta is a defect (or, for a deliberate exception like a golden-artifact reorder, must be called out and approved — not expected here). | Technical | High | Open |
| C-002 | Locale-independent comparisons | Every comparison this mission touches must be locale-independent (code-unit, or `localeCompare` pinned to a fixed locale). | Technical | High | Open |
| C-003 | No dependency change | No package added, upgraded, or removed. | Technical | High | Open |
| C-004 | One comparator source | `compareCodeUnit` has a single definition in the pure-ESM core; `compareSlug` is its slug-typed alias; no new inline code-unit twin is introduced. | Technical | Medium | Open |

### Key Entities

- **`compareCodeUnit(a, b)`**: the one code-unit string comparator, in the
  pure-ESM core (`vocabulary-core.mjs`), reachable from every `.ts` and `.mjs`.
- **`compareSlug`**: `#85`'s slug comparator, re-expressed as the slug-typed
  alias of `compareCodeUnit`.
- **Sitemap-order integration**: a toolkit `AstroIntegration` whose
  `astro:build:done` hook sorts each `sitemap-*.xml`'s `<url>` blocks by `<loc>`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 2 consecutive clean builds of the same tree → 0 differing files in
  `example/dist` (previously 1: `sitemap-0.xml`).
- **SC-002**: Pre/post-mission corpus diff → `sitemap-*.xml` is the only file
  whose bytes change (now `<loc>`-sorted); every other file byte-identical.
- **SC-003**: Code-unit comparator definitions across `src/lib`/`src/scripts`
  collapse to one (`compareCodeUnit`); the two inline `a<b?...` twins and the
  bare `localeCompare` sites route through a locale-independent comparison.
- **SC-004**: A shuffled-input regression test exists for each hardened ranker
  (`rankForAgents`, the llms.txt section sort, hub-children) and for the sitemap
  sort; each fails if its tiebreak/sort is removed.
