# Mission Specification: Slot-name validation and sidebar labels

**Mission Branch**: `issue-114-112-slot-validation-sidebar-labels`
**Created**: 2026-10-14
**Status**: Draft
**Input**: Issues spec-kitty/doc-kitty#114 and #112, both follow-ups from PR #111.
"Theme slot names are validated by types only; a typo in a plain-JS config is
silently ignored" (#114). "Sidebar: generated glossary-context groups show raw
ids; index entry repeats its group label" (#112).

Grounding: [research/code-grounding.md](./research/code-grounding.md).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A misspelt slot name stops the build (Priority: P1)

A site author writes their `astro.config.mjs` in plain JavaScript and fills a
theme slot with `'dk:site-heading'` (meant: `dk:site-header`). Today the build
succeeds and the stock header renders with no hint of why. After this mission
the build fails at config time with a message that names the bad slot and
lists every valid slot name.

**Why this priority**: the failure is silent and the site renders wrong. It
is the cheapest of the defects to hit and the hardest to diagnose.

**Independent Test**: call the toolkit's integration factory, as a `.mjs`
config does, with a theme whose `slots` holds one unknown name.

**Acceptance Scenarios**:

1. **Given** a theme with `slots: { 'dk:site-heading': './Header.astro' }`,
   **When** the config is evaluated, **Then** it throws an error naming
   `dk:site-heading` and listing all valid `dk:` slot names.
2. **Given** a brand theme with valid slots extended by a consumer layer with
   one unknown slot, **When** the config is evaluated, **Then** the error names
   the unknown slot.
3. **Given** a theme whose slot names are all valid, **When** the config is
   evaluated, **Then** it resolves exactly as before.

### User Story 2 - Glossary contexts read as links, not empty groups (Priority: P2)

A reader opens the sidebar's Reference section. Today each glossary context is
a folder group whose only entry repeats its id: `hr > hr`. After this mission
each context page is one link under the glossary, labelled by the context's
name.

**Why this priority**: three of the example's groups read as raw ids; they are
the last unlabelled groups.

**Independent Test**: build the example and read the sidebar under Reference.

**Acceptance Scenarios**:

1. **Given** the example's three glossary contexts, **When** the site is
   built, **Then** the Reference section lists `Glossary`, `hr`, `rhetoric`,
   `shipping` as links and holds no nested group.
2. **Given** any folder whose only published page is its index, **When** the
   sidebar is shaped, **Then** that folder renders as one link, not a group.

### User Story 3 - A section's index entry does not repeat the heading (Priority: P2)

A reader expands "Guides" and sees "Guides" again as the first entry. After
this mission the first entry of a group that repeats the group's label reads
"Overview". Previous/next links still show the page's own title.

**Independent Test**: build the example; for every group, the first entry's
label differs from the group label.

**Acceptance Scenarios**:

1. **Given** the Guides section, **When** the site is built, **Then** its
   first entry links to `/guides/` and reads "Overview".
2. **Given** the page before `/guides/` in reading order, **When** its "Next"
   link renders, **Then** it reads "Guides", not "Overview".
3. **Given** a group in which another page is already labelled "Overview",
   **When** the sidebar is shaped, **Then** the index entry keeps its own label
   (no two entries read "Overview").

### User Story 4 - Rhetoric reads in reading order (Priority: P3)

`/rhetoric/` lists "About and license, Introduction, Preamble"
alphabetically. After this mission it lists Introduction, Preamble, About and
license, then the three books.

### Edge Cases

- A slot name that is valid in a parent theme and misspelt in a child theme:
  the child's name is rejected.
- `slots: {}` and an absent `slots`: accepted.
- Top-level section groups are never collapsed, even with one entry (they come
  from `sections.yaml`; ADR-0029/ADR-0033). Presentations keeps its group and
  its index reads "Overview".
- A consumer-supplied `sidebar` is not shaped (C-004 of the previous mission):
  no collapsing or relabelling applies to it.
- A one-entry group whose single entry is not the folder's index (an index-less
  folder with one page) is left as a group: collapsing would lose its label.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Reject unknown slot names at config time | As a site author, I want a misspelt `dk:` slot name to fail my build with the list of valid names so that I can fix it instead of shipping the stock component. | High | Open | [build] | no — the red test fails on `main` |
| FR-002 | One runtime list of slot names | As a maintainer, I want the valid slot names declared once, with the `DkSlotName` type derived from that list, so that the type and the check cannot drift. | High | Open | [build] | no — a type test pins type ⇔ list equality |
| FR-003 | Valid themes resolve unchanged | As an adopter, I want every theme with valid slot names to resolve exactly as before so that the check costs me nothing. | High | Open | [ratchet] | yes — paired with FR-001 on the same fixture (valid vs one-letter-off name) |
| FR-004 | Collapse a one-page folder group into its index link | As a reader, I want a folder whose only page is its index to show as one link so that I do not open a group to find the same name again. | High | Open | [build] | no — the built example shows `hr > hr` on `main` |
| FR-005 | Index entry reads "Overview" when it repeats the group label | As a reader, I want a group's index entry not to repeat the heading above it so that the sidebar reads as a table of contents. | High | Open | [build] | no — the built example shows `Guides > Guides` on `main` |
| FR-006 | Previous/next keep page titles | As a reader, I want "Next: Guides", not "Next: Overview", so that pagination still names where it goes. | Medium | Open | [build] | no — paired with FR-005; reverting the pagination half turns it red |
| FR-007 | No duplicate "Overview" | As a reader, I want at most one "Overview" in a group so that two entries never share a label. | Medium | Open | [build] | no — unit case with a sibling page titled "Overview" |
| FR-008 | Widen the built-sidebar label check | As a maintainer, I want the built-HTML test to check every group, generated ones included, so that a raw-id or repeated label anywhere fails CI. | Medium | Open | [build] | no — the widened check fails on `main` |
| FR-009 | Rhetoric pages in reading order | As a reader, I want `/rhetoric/` to list Introduction, Preamble, About and license so that the order follows the book. | Low | Open | [build] | no — the built order is alphabetical on `main` |
| FR-010 | Example architecture page avoids a second "Overview" | As a reader of the example, I want the Architecture section's page titled "Overview" to carry a distinct sidebar label so that the section index can read "Overview" (FR-005) without a duplicate (FR-007). | Low | Open | [build] | no — on `main` the Architecture index repeats its heading |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Deterministic sidebar | Two builds of the example produce byte-identical sidebar markup on every page (existing NFR-006 of the previous mission holds). | Reliability | High | Open |
| NFR-002 | Actionable error | The slot error message contains the offending name, the theme layer's `name` when it has one, and all 16 valid names, in one thrown `Error`. | Usability | High | Open |
| NFR-003 | No added build cost | Example build time stays within 5% of `main` on the same machine. | Performance | Low | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Keep `theme.ts` edits to slot validation | The reading-width sibling (#154) edits the width default in `theme.ts`; this mission touches only the slot type, the slot list and `mergeLayers`. | Technical | High | Open |
| C-002 | No change to the Contextive file format | `.contextive/definitions.yaml` gains no toolkit-only key: Contextive's reader rejects unknown keys. | Technical | High | Open |
| C-003 | No `behaviour/` content edits | Gherkin hub titles and groups belong to the Gherkin sibling (#124/#125). | Technical | High | Open |
| C-004 | Top-level groups unchanged | Section identity, label and order stay owned by `sections.yaml`. | Technical | High | Open |
| C-005 | No new size/length ratchet gates | Per dispatch. | Process | Medium | Open |
| C-006 | Baselines from the pinned container only | Visual baselines are regenerated by `update-a11y-baselines.yml`, never on a dev machine. | Process | High | Open |

### Key Entities

- **Slot name**: one of the `dk:` names a theme may fill (16 today).
- **Theme layer**: one `DocKittyTheme` in an `extends` chain; its `slots` map is
  checked.
- **Directory group**: a nested sidebar group that maps to one docs folder; its
  index page names it.
- **Index entry**: the link to a folder's index page, placed first in its group.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A plain-JS config with `dk:site-heading` fails `astro build` with a message listing the 16 valid names — [build] · no-op passable: no
- **SC-002**: The built example sidebar holds no group whose label equals a folder name and no group whose first entry repeats its label — [build] · no-op passable: no
- **SC-003**: Every existing test that passed on `main` passes, apart from expectations this mission deliberately changes, each named in the PR — [ratchet] · no-op passable: yes (positive control: SC-001 and SC-002 fail on `main`)

## Decisions taken in this specification

- **D1, fail rather than warn (#114).** An unknown slot name throws. The
  site it would affect already renders the wrong component, so a warning
  leaves a known-wrong site shipping; a throw names the fix. The toolkit
  already throws on the sibling theme mistake (`--sl-*` token, ADR-0011), so a
  theme author meets one rule. No slot name in the repository, the brand or the
  fixtures is invalid. Recorded in a new ADR because ADR-0044 lists
  "checked by TypeScript only" as a known limit and ADRs are immutable.
- **D2, collapse rather than add a display name (#112a).** A display-name key
  on the context would break Contextive's own reader (unknown keys rejected),
  and Contextive already treats the context `name` as display text. Collapsing
  a one-page folder group into its link is generic (any one-page folder, not
  only glossary contexts) and needs no generator change. The example's
  lowercase context names are content and stay.
- **D3, "Overview" rather than collapse for multi-page groups (#112b).** A
  group with several pages needs its heading; the index entry is renamed, and
  only when it repeats the heading.
