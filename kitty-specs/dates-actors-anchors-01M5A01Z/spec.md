# Mission Specification: Dates, actors and anchors: follow-ups from #181 and #218

**Mission**: `dates-actors-anchors-01M5A01Z`
**Created**: 2026-10-19
**Status**: Draft
**Issues**: #226, #227, #228 (#229 closed as already delivered by #182 and #183; see Assumptions)

## Intent Summary

The operator's brief settles the scope; the one open question (#226) was decided at
specify as a Decision Moment.

- **Actors**: a site author writing page frontmatter; a feed reader and an OKF tool
  consuming the build's outputs; a maintainer reading the decision record.
- **Trigger**: a page carries `updated`, a `generated` stamp, or both; or an author
  writes a value such as `updated: "1"` by mistake; or a page repeats its title as a
  body heading and later reuses that title as a sub-heading.
- **Outcome**: each output reports a "last changed" date by one documented rule, the
  OKF export no longer reports a scaffold's creation time as the last content change,
  a non-date value fails the build with a clear message, and the anchor-collision
  case is pinned by a test.
- **Invariant**: every date form in the old-forms fixtures and the validator parity rows
  that built before this mission still builds, with the same warnings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One documented date rule per output (Priority: P1)

A maintainer reading the decision record, or a consumer of RSS or the OKF bundle, can
tell which date each output reports as a page's "last changed" date and why. An author
who scaffolds a page and later edits it sees the OKF export report the edit, not the
scaffold time.

**Why this priority**: the outputs already disagree on purpose, but the reason lives
only in a code comment, and the OKF export reports a stale date for every edited
scaffolded page.

**Independent Test**: build a page that carries a provenance-only scaffold stamp and a
later `updated`; the OKF export reports the `updated` instant, and RSS reports the same
date it did before.

**Acceptance Scenarios**:

1. **Given** a page with a scaffold stamp at T1 and `updated` at T2, **When** the site
   builds, **Then** the OKF export's last-change instant is T2, and the RSS item date is
   T2.
2. **Given** a generated Gherkin or glossary page with an ownership stamp at T1 and no
   `updated`, **When** the site builds, **Then** both RSS and the OKF export report T1.
3. **Given** a page with an ownership stamp at T1 and `updated` at T2, **When** the site
   builds, **Then** RSS reports T2 and the OKF export reports T1, as documented.
4. **Given** any page, **When** the agent API is built, **Then** its record carries
   `updated` only, unchanged from today.

### User Story 2 - Non-date values fail the build (Priority: P2)

An author who writes `updated: "1"`, `updated: 1`, `stale_after: "12"` or
`generated.at: "1"` gets a validation error naming the field and the expected form,
instead of a page silently dated in 2001 or 1970.

**Why this priority**: the mistake is easy, and the wrong date then appears in the feed,
the content graph and the OKF export.

**Independent Test**: validate a page with `updated: "1"`; it fails with a message that
names `updated` and the accepted form. Validate the old-forms fixture set; it still
exits 0.

**Acceptance Scenarios**:

1. **Given** `updated: "1"`, **When** the frontmatter is validated, **Then** it fails
   with a message naming the field and the accepted form.
2. **Given** a YAML number such as `updated: 20241001`, **When** validated, **Then** it
   fails the same way.
3. **Given** `generated.at: "1"`, **When** validated, **Then** it fails the same way.
4. **Given** each form in the old-forms fixtures and the parity rows (date-only,
   zone-less, `±HHMM`, `±HH`, no seconds, calendar rollover, a written-out date such as
   `"May 1, 2024"`, a numeric date such as `"1/2/24"`, a YAML date), **When** validated,
   **Then** it passes with the same warning it had before.
5. **Given** any of the above, **When** checked by either validator twin, **Then** both
   reach the same verdict.

### User Story 3 - The anchor-collision case is pinned (Priority: P3)

A maintainer changing the single-h1 pass learns from a failing test if a body
`# Title … ## Title` ever gets a duplicate `id`.

**Why this priority**: the behaviour exists and works; only the test is missing.

**Independent Test**: render `# Title … ## Title` with page title "Title"; there is no
alias span, and exactly one element, the later heading, carries `id="title"`.

**Acceptance Scenarios**:

1. **Given** a body `Intro … # Title … ## Title` and page title "Title", **When** the
   single-h1 pass runs and heading ids are then assigned as in a real build, **Then** no
   alias element is added and exactly one element carries `id="title"`, the `## Title`
   heading.

### Edge Cases

- A page with neither `updated` nor a stamp: RSS leaves it out of the feed (unchanged);
  the OKF export writes no `at` (unchanged).
- A stamp whose producer is retired (`doc-kitty/gherkin`): already fails the frontmatter
  gate; out of scope.
- A YAML date value (`updated: 2024-10-01` unquoted): parsed by YAML into a date; must
  keep passing.
- A rolled-over calendar date (`2026-02-30`): keeps passing with its rollover warning.
- A written-out date with a 4-digit year (`"May 1, 2024"`, `"1 May 2024"`): keeps
  passing with its non-ISO warning.
- A year alone (`"2024"`), a short numeric string (`"1/2"`), a word plus a year
  (`"abc 2024"`) or a decimal (`"2024.5"`): rejected; none is a realistic page date.
- A retired `sha256:` value in `generated.at`: keeps failing with the existing
  "regenerate" message only, not an extra date-shape error.
- A page whose stamp is not from an ownership producer (a scaffold stamp, or any other
  tool's or person's stamp): the OKF export treats the page as unstamped.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Requirement | Status | Delivery | No-op passable? |
|----|-------------|--------|----------|-----------------|
| FR-001 | The RSS and OKF "last changed" precedence rules are defined side by side in one place, each documented with the reason it differs. RSS: `updated`, then the stamp instant. OKF export: the ownership-stamp instant, then `updated`. (#226) | Proposed | [build] | no |
| FR-002 | The OKF export takes a page's `generated` block from its stamp only when the stamp's producer is an ownership producer (the Gherkin or glossary pipeline). Any other stamp, such as the provenance-only scaffold stamp, is treated as absent: `by` is the first author (who then leaves `authors`), else the export process, and `at` is `updated`, else the stamp's `at`. So `by` and `at` always describe the same event. (#226) | Proposed | [build] | no |
| FR-003 | One test pins both precedence rules on the same three inputs: an ownership stamp only, a scaffold stamp plus a later `updated`, and an ownership stamp plus a different `updated`. (#226) | Proposed | [build] | no |
| FR-004 | RSS item dates and feed order, and the agent API's `updated`, are unchanged for every existing page. (#226) | Proposed | [ratchet] | yes; positive control: FR-003's ownership-stamp-plus-different-`updated` case, which flips if the RSS order changes |
| FR-005 | The decision is recorded in ADR-0059's implementation notes, and the pages and comments that state the old rules are updated: `docs/architecture/gherkin-pages.md` (feed dates), `docs/architecture/generators.md` (stamps), `docs/architecture/metadata-model.md` (date fields and the new rejection), `docs/guides/export-okf-bundle.md` (export `generated` rule), and the precedence comment on the RSS date function. (#226, #227) | Proposed | [build] | no |
| FR-006 | `updated`, `stale_after`, `generated.at` and `verified[].at` reject a value that is not date-shaped. Date-shaped means a YAML date, an ISO-8601 form, a year-month (`YYYY-MM`), or a string with a month name and a number, or with at least three numeric groups. So a YAML number, `"1"`, `"2024"`, `"1/2"`, `"abc 2024"` and `"2024.5"` are rejected. The frontmatter gate's error names the field and the accepted form. (#227) | Proposed | [build] | no |
| FR-007 | Every form in the old-forms fixtures and the parity rows keeps passing with the warning it had before, including written-out dates (`"May 1, 2024"`), numeric dates (`"1/2/24"`), a year-month (`"2024-10"`), calendar rollover and YAML date values. (#227) | Proposed | [ratchet] | yes; positive control: FR-006's `"1"` row in the same parity table |
| FR-008 | Both validator twins reach the same verdict (accept or reject) for every FR-006 and FR-007 case, shown by rows in the existing parity test. Message wording is checked in the gate only. (#227) | Proposed | [build] | no |
| FR-009 | The date parser remains the single source of truth for what counts as a date: it returns "not a date" for non-date-shaped values, and both twins and the build-time readers rely on that. Its unit test gains rows for the rejected samples. (#227) | Proposed | [build] | no |
| FR-010 | The existing "content precedes the title" single-h1 test also covers `# Title … ## Title`: no alias element, the heading list is the single `## Title`, and once heading ids are assigned as in a real build exactly one element has `id="title"`, the later heading. (#228) | Proposed | [build] | no |

### Non-Functional Requirements

| ID | Requirement | Threshold | Status |
|----|-------------|-----------|--------|
| NFR-001 | Output determinism | Two builds of the example site produce byte-identical `rss.xml`, `api/*.json`, `api/content-graph.json` and `okf/` output (checked by building twice and diffing, plus the existing two-run export test); every pinned baseline and count passes unchanged | Proposed |
| NFR-002 | Test economy (DIRECTIVE_041) | At most one new focused test per issue; the rest strengthen existing tests; no new test file for #228; no timing census regenerated | Proposed |
| NFR-003 | Gates | `pnpm lint`, the frontmatter gate on `docs/` and `example/docs/`, the full Vitest suite and the example build pass; typecheck errors per file are no more than on `main` | Proposed |
| NFR-004 | Changelog | One `[Unreleased]` entry per issue, each at most 1,200 characters (checked by hand, no gate exists); every new or edited page description is 50–180 characters (enforced by the frontmatter gate) | Proposed |

### Constraints

| ID | Constraint | Status |
|----|------------|--------|
| C-001 | No API or schema version bump. The agent API, scenarios API and content graph keep their `version`. | Fixed |
| C-002 | No change to the RSS precedence or to the agent API's date field. | Fixed |
| C-003 | Red-first: each behaviour change has a failing test before its fix. | Fixed |
| C-004 | #229 is out of scope (closed, delivered by #182 and #183). | Fixed |
| C-005 | Never merged by the agent; the operator merges. | Fixed |

### Key Entities

- **Ownership stamp**: a `generated` block written by a producer that owns the page
  (Gherkin or glossary pipeline). Its `at` is the last content change.
- **Provenance stamp**: a `generated` block written by the scaffold. It records where the
  page started, not when its content last changed.
- **Date-shaped value**: a YAML date; an ISO-8601 string; a year-month (`YYYY-MM`); or a
  string with a month name and a number, or with at least three numeric groups. Anything else in a date field is a
  validation error.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For an edited scaffolded page, the OKF bundle reports the edit's date, not
  the scaffold date (1 of 1 fixture case). — [build] · no-op passable: no
- **SC-002**: 100% of existing pages keep their RSS date and feed position, and two builds
  produce identical feed bytes. — [ratchet] · no-op passable: yes; positive control: SC-001
- **SC-003**: Each of the 7 non-date sample values (`"1"`, `1`, `20241001`, `"2024"`,
  `"1/2"`, `"abc 2024"`, `"2024.5"`) fails validation in both validator twins. — [build] · no-op passable: no
- **SC-004**: 100% of old-forms fixtures still validate, with the same warnings. —
  [ratchet] · no-op passable: yes; positive control: SC-003
- **SC-005**: The anchor-collision render has exactly one element with `id="title"`. —
  [build] · no-op passable: no
- **SC-006**: A reader finds the date precedence of every output in one ADR section. —
  [build] · no-op passable: no

## Assumptions

- #229 was already delivered: #182 added `generated_by`, and 0.4.0 (#183) removed
  `generated_from`. The operator chose to close it and drop it from this mission.
- No page in `docs/` or `example/docs/` carries both `updated` and a stamp today, so FR-002
  changes no pinned baseline; the fixture tests carry the change.
- "Date-shaped" is decided by the rule in Key Entities. A year alone is not a realistic
  page date, and it was only ever accepted as a side effect of the old coercion.
- The retired `sha256:` stamp form already fails the gate (ADR-0059, 0.4.0), so giving
  `generated.at` a date check removes no accepted value.
- Post-spec squad findings (2026-10-19) were folded: heading ids in the #228 test,
  `generated.at`/`verified[].at` covered explicitly, coherent export `by`/`at`, the
  date-shape rule, the docs list, and the gate-only message check.
