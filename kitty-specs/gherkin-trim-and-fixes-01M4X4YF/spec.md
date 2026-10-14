# Mission Specification: Gherkin test trim and fixes

**Mission Branch**: `issue-156-gherkin-trim-and-fixes`
**Created**: 2026-10-14
**Status**: Draft
**Input**: GitHub issues #156, #123, #124, #125, #126 and #128 on `spec-kitty/doc-kitty`
(left over from PR #121 and PR #151), the operator's dispatch brief, and the
code-grounding note in [`research/code-grounding.md`](./research/code-grounding.md).

## Summary

The Gherkin support (generated feature pages, ```` ```gherkin ```` fences and
`::gherkin` includes) landed in two quick PRs. It left five small gaps and a
test suite that asserts the same behaviour at several layers.

- **#123**: a feature tagged `@WIP` or `@Deprecated` publishes as an ordinary
  active page, with no message.
- **#124**: a source directory whose features are all drafts gets no index page,
  so the sidebar asks the author for an index they cannot add.
- **#125**: a hub title comes only from its directory name, so `hr` reads "Hr".
- **#126**: `llms.txt` can advertise `/api/scenarios.json` on a site that never
  mounted that route, and the build does not notice.
- **#128**: the worked example `book-consignment.feature` exists in several
  identical copies, and nothing fails when they drift apart.
- **#156**: about 4,700 test lines overlap across the parse, view, emitter and
  include layers. #156 gates the next stable release.

The fixes come first, because they add tests; the trim comes last, so it judges
the final suite.

## Decisions already made

The operator settled these in the dispatch brief. They are not open.

| Topic | Decision |
|---|---|
| #123 matching | Keep exact, case-sensitive matching (Cucumber's tag semantics). A tag that differs from `@wip` or `@deprecated` only in letter case raises a warning that names the shorthand. |
| #124 approach | Option 1: a draft-only directory gets a hub that is itself a draft, so it follows the same draft gating as its pages. The drift gate and the build must agree. |
| #125 approach | An optional `gherkin.titles` map from source-relative directory to title, validated where the rest of the option is validated, with a warning for a key that matches no directory. The example uses `hr: 'HR'`. Document it. |
| #126 approach | Option 2: keep the route site-mounted (the glossary precedent) and fail when `llms.txt` advertises the index but the built site has no `api/scenarios.json`. No injected route. |
| #128 approach | One source of truth: pick parity test or reading the example file, and justify. |
| #156 approach | Test-quality doctrine: KEEP / RETIRE / SPLIT-BY-KIND per test, a retire only when its named covering guard is shown red by a planted break. Keep one smoke per emitter and each rejection path once at its owning layer. Keep `tests/a11y/gherkin.spec.ts` and `assert-consumer-gherkin.mjs`. |
| Bug-fix discipline | Red first through the existing entry point: the failing test is committed before the fix; tidy-first enablers come before the red test. |
| Boundary | One mission, one PR. No new size or length ratchet gate. |

Two refinements of the brief, recorded here and in the new ADR:

- **#124 generation does not read the draft setting.** The brief reads option 1
  as "when drafts are published, generate the hub". The generated pages are
  committed and drift-checked, and the planner is pinned as a pure function of
  the sources and the docs tree (risk R3). A hub that existed only in a
  drafts-on build would make a drafts-off build delete a committed file and the
  drift gate disagree with half the builds. So the draft hub is always
  generated, as a draft. The existing draft gating then builds it exactly when
  its pages are built, which is the behaviour option 1 asks for, and the drift
  gate agrees with every build by construction.
- **#126 check placement.** The check runs at the end of every build of a site
  that generates feature pages, not only in this repository's
  `assert-build-artifacts` script, which only consumer sites never run.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A mis-cased draft tag is caught at build time (Priority: P1)

An author tags a feature `@WIP`, expecting it to stay a draft. Cucumber tags are
case-sensitive, so the toolkit (correctly) does not treat it as the draft
shorthand. Today the page publishes silently. The author wants the build output
to say so.

**Why this priority**: a draft that publishes is the expensive way to find the
mistake.

**Independent Test**: build a feature tagged `@WIP`; the output carries one
warning naming `@WIP` and `@wip`, and the page's status is unchanged.

**Acceptance Scenarios**:

1. **Given** a feature tagged `@WIP`, **When** pages are generated, **Then** one
   warning says `@WIP` is not the draft shorthand and suggests `@wip`, and the
   page keeps `WIP` as an ordinary tag.
2. **Given** a feature tagged `@Deprecated`, **When** pages are generated, **Then**
   the same kind of warning suggests `@deprecated`.
3. **Given** a feature tagged `@wip`, **When** pages are generated, **Then** the
   page is a draft and no warning is raised.

### User Story 2 - A directory of drafts has its own index (Priority: P1)

An author adds a new directory of features, all tagged `@wip`. With drafts
published (the default), the pages appear in the sidebar, and today the sidebar
warns that the directory has no index page. The author cannot add one, because
the section is generated.

**Why this priority**: the warning is noise the author cannot act on, on the
default setting.

**Independent Test**: generate pages for a source tree with one draft-only
directory; a draft hub exists for it, its parent hub does not link it, and the
drift check passes with drafts on and off.

**Acceptance Scenarios**:

1. **Given** a directory whose features are all drafts, **When** pages are
   generated, **Then** the directory gets a hub whose status is draft.
2. **Given** that draft hub, **When** its parent hub is generated, **Then** the
   parent does not list it.
3. **Given** a site built with drafts published, **When** the sidebar is built,
   **Then** no "add an index page" warning names the draft-only directory.
4. **Given** a site built with drafts not published, **When** the build runs,
   **Then** neither the draft hub nor its pages are built.
5. **Given** either draft setting, **When** the drift check runs against the
   committed pages, **Then** it reports no drift.

### User Story 3 - A site can title a hub (Priority: P2)

A site keeps HR features under `features/hr/`. The hub and the sidebar group
read "Hr". The site owner wants "HR".

**Why this priority**: cosmetic, but acronyms and product names cannot be
expressed through a directory name at all.

**Independent Test**: set `titles: { hr: 'HR' }`; the `hr` hub's title, its
heading, its entry in the parent hub and the sidebar group read "HR".

**Acceptance Scenarios**:

1. **Given** `titles: { hr: 'HR' }`, **When** pages are generated, **Then** the hub
   for `hr` is titled "HR" everywhere the title appears.
2. **Given** a `titles` key that matches no source directory, **When** pages are
   generated, **Then** one warning names the key.
3. **Given** a `titles` value that is not a non-blank string, or `titles` without
   `sources`, **When** the site config is read, **Then** the build stops with a
   message naming the option.
4. **Given** the same titles passed to the command-line drift gate, **When** it
   runs, **Then** it agrees with the build.

### User Story 4 - An advertised scenario index exists (Priority: P2)

A site turns on generated pages but skips mounting the scenario index route.
`llms.txt` tells agents to fetch `/api/scenarios.json`, which is a 404.

**Independent Test**: build a site whose `llms.txt` carries the scenario index
line and whose output has no `api/scenarios.json`; the build fails with a
message naming the missing route and how to mount it.

**Acceptance Scenarios**:

1. **Given** a built site whose `llms.txt` advertises the scenario index and has
   no `api/scenarios.json`, **When** the build finishes, **Then** it fails and
   names the route file to add.
2. **Given** a built site that has both, or neither, **When** the build finishes,
   **Then** it passes.

### User Story 5 - The worked example has one source of truth (Priority: P3)

A maintainer edits `example/features/shipping/book-consignment.feature`. Today
the unit fixtures keep their own copies and stay green.

**Independent Test**: change one copy; a test fails and names the copy that
differs.

### User Story 6 - Each Gherkin behaviour has one owning guard (Priority: P1)

A maintainer changes a Gherkin emitter. Today the same behaviour is asserted in
up to three suites, so one change edits three tests.

**Independent Test**: the PR carries a verdict table per Gherkin test file; for
every retired test it names the surviving guard and shows that guard red under
a planted break; the full suite passes.

### Edge Cases

- A feature carries both `@wip` and `@WIP`: it is a draft (from `@wip`) and still
  warns about `@WIP`.
- A draft-only directory nested inside a published directory: the inner hub is a
  draft, the outer hub stays published and does not link the inner one.
- A draft-only directory that holds a draft-only subdirectory: both hubs are
  drafts.
- A titles key written with a trailing slash, a leading `./`, `..` or a
  backslash: refused as not a relative directory path.
- `titles` naming the section root (empty key): refused; the root takes its
  label from the section registry.
- `llms.txt` absent from the build output (a site that never mounted it): the
  scenario-index check passes.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Near-miss status tag warns (#123) | As an author, I want a feature tag that differs from `@wip` or `@deprecated` only in letter case to raise one warning naming the exact shorthand, while the tag stays an ordinary tag and the status is unchanged, so that a mis-cased draft is caught before it publishes. | High | Open | [build] | no — today no warning is raised for `@WIP` |
| FR-002 | Draft-only directory gets a draft hub (#124) | As an author, I want a directory whose features are all drafts to get a generated hub with draft status, not linked from its parent hub, so that the sidebar finds its index and drafts stay out of published hubs. | High | Open | [build] | no — today no hub is planned for that directory |
| FR-003 | Generation is independent of the draft setting (#124) | As a maintainer, I want the generated tree to be the same whatever `DK_PUBLISH_DRAFTS` says, so that the drift gate agrees with every build. | High | Open | [ratchet] | yes — paired with FR-002 on the same fixture: the draft hub is present in both settings |
| FR-004 | `gherkin.titles` sets hub titles (#125) | As a site owner, I want an optional `titles` map from source-relative directory to title that sets the hub title, its heading, its parent listing and so the sidebar label, so that acronyms read correctly. | Medium | Open | [build] | no — today the option is refused as unknown |
| FR-005 | `titles` is validated and its unknown keys warn (#125) | As a site owner, I want a malformed `titles` (not an object, a key that is not a relative directory path, a blank title, or `titles` without `sources`) to stop the build, and a key that matches no directory to warn, so that a typo is never silent. | Medium | Open | [build] | no — paired with FR-004 |
| FR-006 | The drift gate takes the same titles (#125) | As a maintainer, I want the command-line generator to accept the titles and the example's drift-gate script to pass them, with the existing parity test covering the new key, so that build and gate agree. | Medium | Open | [build] | no — the parity test fails until a flag exists |
| FR-007 | Example and docs use `titles` (#125) | As a reader of the example site, I want the `hr` hub to read "HR", and the consumer guide to document `titles`. | Low | Open | [build] | no — the committed hub reads "Hr" today |
| FR-008 | An advertised scenario index must exist (#126) | As a site owner, I want the build to fail when `llms.txt` advertises `/api/scenarios.json` but the output has no `api/scenarios.json`, naming the route to mount, so that agents are never sent to a 404. | Medium | Open | [build] | no — today the build passes |
| FR-009 | One source of truth for the worked example (#128) | As a maintainer, I want every copy of `book-consignment.feature` checked byte-for-byte against the example file, and the copy inlined in a test replaced by a read of a fixture, so that drift fails a test naming the copy. | Low | Open | [build] | no — today a drifted copy stays green |
| FR-010 | Verdict per Gherkin test (#156) | As a reviewer, I want a verdict table for every Gherkin test file (KEEP / RETIRE / SPLIT / MERGE with a reason), so that the trim is auditable. | High | Open | [build] | no — the table is the deliverable |
| FR-011 | Retire only proven duplicates (#156) | As a maintainer, I want every retired test to name the surviving test that covers the same behaviour, shown red under a recorded planted break, so that no behaviour loses its only guard. | High | Open | [build] | no — each retire carries its break evidence |
| FR-012 | Target shape of the suite (#156) | As a maintainer, I want the view-level unit tests kept, one smoke test per emitter (generated-page HTML, fences, includes), and each rejection path asserted once at its owning layer, with `tests/a11y/gherkin.spec.ts` and the consumer-fixture Gherkin proof kept. | High | Open | [ratchet] | yes — paired with FR-011 evidence that the kept guards go red |
| FR-013 | Records and adopter notes | As an adopter, I want each adopter-visible change in the changelog, and the changed ADR-0046 decisions recorded in a new ADR, so that the contract stays traceable. | Medium | Open | [build] | no — new files |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Suite stays green | `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm validate` and `pnpm validate:features` finish with 0 failures after every WP; before/after pass counts recorded in the PR. | Reliability | High | Open |
| NFR-002 | No orphaned behaviour | 0 retired tests without a named covering guard and a recorded red run of that guard under a planted break. | Maintainability | High | Open |
| NFR-003 | Deterministic generation | Two generator runs over the same sources produce byte-identical output under `DK_PUBLISH_DRAFTS=on` and `off` (0 differing bytes). | Reliability | High | Open |
| NFR-004 | Measurable trim | The Gherkin vitest suites end with fewer lines than they start with after the fixes land; the before/after line and test counts per file are reported in the PR (reported, not gated). | Maintainability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | No injected route | The scenario index stays site-mounted; the toolkit adds no `injectRoute`. | Technical | High | Open |
| C-002 | ADRs are immutable | ADR-0046 and ADR-0051 are not edited; a new ADR records the changed decisions. | Governance | High | Open |
| C-003 | No loosened gates | A failing pin is re-pointed to the new truth, never deleted or weakened to get green; no skip or xfail. | Technical | High | Open |
| C-004 | No new ratchets | No new size, length or line-count gate. | Technical | High | Open |
| C-005 | Red first | For #123–#126 the failing test is committed before its fix, through the existing entry point. | Process | High | Open |
| C-006 | Sibling boundaries | Do not edit `src/styles/theme.css`, `src/lib/theme.ts`, `src/lib/glossary/generate.ts` or sidebar build code; in `docs/guides/consumer-setup.md` edit only Gherkin content. | Process | High | Open |
| C-007 | Terminology | "Mission" for the Spec Kitty work object; Gherkin "Feature" is a domain term. Docs pages touched keep the required frontmatter. | Governance | Medium | Open |
| C-008 | Kept proofs | `tests/a11y/gherkin.spec.ts` and `tests/consumption/scripts/assert-consumer-gherkin.mjs` stay. | Technical | High | Open |

### Key Entities

- **Status shorthand**: the Feature tags `@wip` (draft) and `@deprecated`, matched exactly.
- **Hub**: the generated `kind: Hub` index page of a source directory; published or draft.
- **Titles map**: `gherkin.titles`, source-relative directory path → hub title.
- **Scenario index**: the site-mounted `/api/scenarios.json` and its `llms.txt` line.
- **Verdict**: KEEP, RETIRE, SPLIT-BY-KIND or MERGE for one test, with its covering guard and planted-break evidence.

## Success Criteria *(mandatory)*

- **SC-001**: A feature tagged `@WIP` produces exactly one warning naming `@wip`, and a feature tagged `@wip` produces none. — [build] · no-op passable: no
- **SC-002**: A draft-only directory yields 1 draft hub, 0 links to it from published hubs, and 0 sidebar "missing index" warnings for it in a drafts-on build. — [build] · no-op passable: no
- **SC-003**: The example's `hr` hub reads "HR" in its title, heading and parent listing, and the drift gate passes. — [build] · no-op passable: no
- **SC-004**: A build with the scenario index line and no `api/scenarios.json` fails; a build with both passes. — [build] · no-op passable: no
- **SC-005**: Changing one byte in any copy of the worked example fails exactly one parity test that names the copy. — [build] · no-op passable: no
- **SC-006**: 17 of 17 Gherkin test files carry a verdict table, and 100% of retired tests carry planted-break evidence. — [build] · no-op passable: no

## Assumptions

- The example has no draft-only directory today, so #124 changes no example page
  and no Playwright baseline; it is proven on unit fixtures and one ad-hoc
  example build (`@wip` on `hr/request-leave.feature`, not committed).
- The `hr` → "HR" retitle changes generated example pages and may change sidebar
  text in a screenshot; a rebaseline, if needed, is done once.
- Whether hubs should list draft pages when drafts are published (raised on #121
  and #124) stays out of scope: hubs keep leaving drafts out.
