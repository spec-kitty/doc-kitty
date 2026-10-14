# Mission Specification: Gherkin test trim, scenario-results follow-ups and a translatable Overview label

**Mission Branch**: `chore/gherkin-trim-and-followups`  
**Created**: 2026-10-14  
**Status**: Draft  
**Issues**: #166 (scenario-results follow-ups, including the test trim), #161 (Overview sidebar label)  
**Input**: Operator brief: "action both, on mission. Especially the test-trim is needed desperately at this point." Binding operator decisions recorded below.

## Intent Summary (confirmed 2026-10-14)

The Gherkin and scenario-results features grew quickly across 0.3.0. Their tests
now span about 9.9k lines in 26 files (about 516 cases) plus 3.0k fixture lines,
with heavy overlap: the same status checked once per report format, the same
markup asserted at five layers, a review-regressions block repeating earlier
cases, and duplicate fixtures. **A maintainer** changing Gherkin code today pays
for that on every change. This mission's headline deliverable is a trimmed suite
that guards the same behaviour with far less code.

Alongside the trim it closes the scenario-results follow-ups from the #165
landing review and makes the sidebar's "Overview" label translatable.

**Invariant**: after the trim, every behaviour guarded before is still guarded
by at least one test that goes red when that behaviour breaks.

### Operator decisions (binding)

1. One mission covers #161 and #166.
2. Trim target: at least **30% fewer test lines** and **25% fewer fixture lines** on the in-scope surface; deeper where the coverage map allows.
3. The adjacent include and loader suites (`docs-loader-includes`, `agent-page-includes`, `docs-loader-includes-build`) are in scope.
4. Hand-written results fixtures (`cucumber-js.json`, `cucumber-jvm.json`, `messages.ndjson`) are replaced by the upstream Cucumber Compatibility Kit (CCK) fixtures wherever CCK covers the case. CCK fixtures stay byte-for-byte upstream copies.
5. A missing results report warns locally and **fails the build when the `CI` environment variable is set**: non-empty and not `false` or `0`, case-insensitive. Because GitHub Actions sets `CI=true` for every job, an opt-out `gherkin.results.required: false` (exact name settled in the plan) keeps a report-less job, such as a preview build, warning only; the CHANGELOG calls this out.
6. A stale report on a single-scenario `::gherkin` include shows a note **on the result line**.
7. A hand-mounted scenario route called without `results`, while `gherkin.results` is set, produces **one build warning**.
8. The "Overview" label becomes a Starlight UI string with English default "Overview", **and** a `defineDocKittyIntegrations` option that overrides it.

## Domain Language

| Term | Meaning |
|---|---|
| **in-scope test surface** | The Gherkin and scenario-results test files listed in the baseline inventory (research/), plus the three adjacent include/loader suites and their fixtures. |
| **guard** | A test assertion that goes red when a named behaviour breaks. |
| **behaviour row** | One observable rule (input class → output, warning or error), written before any trim by the baseline work package from the baseline tests' assertions. A reviewer checks the map by finding every baseline `it`/`test` in at least one row. |
| **coverage map** | A before/after table: behaviour row → the tests that guard it before → the test that guards it after. |
| **RETIRE** | Removing a test because another test guards the same behaviour (KEEP / RETIRE / SPLIT rubric, DIRECTIVE_041). |
| **CCK fixture** | A report fixture copied unchanged from the upstream Cucumber Compatibility Kit, with provenance recorded. |
| **built output** | Everything the site build writes: HTML pages, `llms.txt` and its variants, `api/scenarios.json`, the agent API JSON, feeds. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A maintainer changes Gherkin code against a lean suite (Priority: P1)

A maintainer changes the parser, the renderer or the results matcher. The
suite they run is at least 30% smaller in lines, still fails on any real
regression, and does not fail three times for one regression.

**Independent Test**: the before/after coverage map shows every behaviour row
guarded after the trim, and a mutation spot-check per suite family turns at
least one KEEP red.

**Acceptance Scenarios**:

1. **Given** the baseline line counts, **When** the trim is done, **Then** in-scope test lines drop by at least 30% and fixture lines by at least 25%.
2. **Given** a behaviour row in the coverage map, **When** its code is broken on purpose, **Then** at least one remaining test goes red (spot-checked per suite family).
3. **Given** a test removed as a duplicate, **When** the reviewer checks it, **Then** the record names the surviving test and confirms that test really asserts the same behaviour.
4. **Given** the CCK fixtures, **When** the trim is done, **Then** they are unchanged from upstream, and every hand-written report fixture left has a recorded reason (a case CCK lacks).

### User Story 2 - No report text reaches the published site (Priority: P1)

A site author sets `gherkin.results` to a report that contains failure
messages, stack traces and attachments. None of that text appears anywhere in
the built output; only statuses are published.

**Acceptance Scenarios**:

1. **Given** a report with sentinel failure text, a stack trace and an attachment, **When** the site builds, **Then** none of the sentinels appears in any HTML page, `llms.txt` variant, `api/scenarios.json` or agent API file.
2. **Given** the same build, **Then** the statuses still appear (positive control on the same fixture).

### User Story 3 - Result handling the operator decided (Priority: P2)

**Acceptance Scenarios**:

1. **Given** `gherkin.results` points at a missing file, **When** the build runs without `CI` set, **Then** it warns and builds without results; **When** `CI` is set (non-empty, not `false`/`0`), **Then** it fails and names the missing path; **When** `CI` is set and the opt-out is set, **Then** it warns only.
2. **Given** a stale report and a `::gherkin{src=… scenario=…}` include, **When** the page renders, **Then** the result line reads a short "results not shown: report is out of date" note instead of nothing; a fresh report still shows the status (control).
3. **Given** `gherkin.results` is set and the site hand-mounts `api/scenarios.json` without passing `results`, **When** the site builds, **Then** one warning names the route file and the missing option; with `results` passed, no warning (control).
4. **Given** this repository's own CI (where `CI` is set), **When** the example builds, **Then** its report exists and the build passes.

### User Story 4 - A site in another language gets its own "Overview" label (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a site with a non-English locale that supplies a per-locale translation of the label through Starlight's i18n mechanism, **When** the sidebar renders, **Then** the index entry shows the translated label.
2. **Given** `defineDocKittyIntegrations({ sidebar: { indexLabel: '…' } })` (exact option name settled in the plan), **When** the sidebar renders, **Then** that label wins over the translation.
3. **Given** neither, **Then** the label is "Overview", as in 0.3.0 (control).
4. **Given** the prev/next page links, **Then** they keep showing the page's own title, as in 0.3.0; the index label never appears there (control).

### User Story 5 - The decisions are recorded in a new ADR (Priority: P3)

**Acceptance Scenarios**:

1. A new ADR-0056, stating "Amends ADR-0055" (ADR-0055 is not edited), documents: a scenario with zero steps shows "Not run" (and why); a generated page without `generated.at` gets results by matching headings in order; adopters produce the report in CI rather than committing it; a missing report fails when `CI` is set; the stale note on includes; the hand-mounted-route warning.

### Edge Cases

- A fixture shared by several suites (for example `book-consignment.feature`): consolidating it must keep the fixture-parity guard and the pinned example/a11y baselines green.
- `CI` set to an empty string or `false`: the plan states how the check reads it.
- A site with several locales and no translation for some: falls back to English.
- Retiring tests must not change the pinned a11y and example baselines.
- A report format CCK does not cover (for example a legacy JSON dialect quirk) keeps a hand-written fixture with a recorded reason.
- A report that exists but is empty or malformed while `CI` is set fails as today (unreadable report).
- A stale-note include that points at a scenario missing from the report shows the stale note, not an error.
- The hand-mounted-route warning is emitted once per build, not once per page.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status | Delivery | No-op passable? |
|----|-------|------------|----------|--------|----------|-----------------|
| FR-001 | Trim the results suites | As a maintainer, I want the results, results-render, results-build and scenario-index suites consolidated (table-driven format matrix, folded review-regressions block, one assertion per behaviour per layer), so that they are smaller without losing a guard (#166). | High | Open | [build] | no — measured against the baseline line counts and the coverage map |
| FR-002 | Trim the core Gherkin suites | As a maintainer, I want the core Gherkin suites and the adjacent include/loader suites in the frozen baseline file list consolidated the same way (decision 3). | High | Open | [build] | no — measured against the baseline |
| FR-003 | Replace hand-written report fixtures | As a maintainer, I want the hand-written report fixtures replaced by CCK fixtures wherever CCK covers the case, with any remaining hand-written fixture justified, and duplicated feature fixtures shared (decision 4). | High | Open | [build] | no — fixture line target and the provenance record |
| FR-004 | Coverage map and verdicts | As a reviewer, I want a before/after coverage map and a KEEP/RETIRE/SPLIT verdict per removed or changed test. Every RETIRE names its survivor as `file:test-name` plus the asserting line; a reviewer breaks at least 20% of the RETIREd behaviours and any RETIRE whose survivor stays green blocks the work package. | High | Open | [build] | no — the map must cover every behaviour row |
| FR-005 | No report text in built output | As a site author, I want a build-level check that sentinel failure text, stack traces and attachments from the report appear in no built output file, paired with statuses still appearing (#166 item 1). | High | Open | [build] | no — paired with the status positive control |
| FR-006 | Missing report fails in CI | As a site maintainer, I want a missing results report to fail the build when `CI` is set (non-empty, not `false`/`0`) and warn otherwise, with an opt-out that keeps a report-less CI job warning only (decision 5). | Medium | Open | [build] | no — same fixture, both env states |
| FR-007 | Stale note on includes | As a reader, I want a single-scenario include from a stale report to show a short note on its result line (decision 6). | Medium | Open | [build] | no — paired with a fresh-report control |
| FR-008 | Warn for a hand-mounted route without results | As a site author, I want one build warning when I hand-mount the scenario route without `results` while `gherkin.results` is set (decision 7). | Medium | Open | [build] | no — paired with the with-results control |
| FR-009 | Translatable Overview label | As a site author with a non-English site, I want the sidebar's "Overview" label to be a Starlight UI string with an English default, used by the sidebar (#161, decision 8); prev/next keep the page title. | Medium | Open | [build] | no — a translated fixture changes the label |
| FR-010 | Overview label option | As a site author, I want a `defineDocKittyIntegrations` option that sets the label and wins over the translation (#161, decision 8). | Medium | Open | [build] | no — paired with the default control |
| FR-011 | ADR-0056 | As a maintainer, I want a new ADR-0056 that amends ADR-0055 to document zero-step scenarios, the heading-order overlay without `generated.at`, producing the report in CI, and the decisions in FR-006 to FR-008 (#166 item 3). ADR-0055 is not edited. | Low | Open | [build] | no — reviewed against the code |
| FR-012 | Release notes and docs | As an adopter, I want CHANGELOG entries and guide updates for FR-005 to FR-010, written for site authors. | Medium | Open | [build] | no — reviewed for accuracy |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Test lines | In-scope test lines drop by at least 30%. Test lines = non-blank, non-comment lines in the frozen baseline file list plus every file those files create or import under the test folders (helpers, matrices, fixtures-as-code), counted after the repo formatter/linter passes. The baseline (file list, per-file counts, command, commit SHA) is committed in research/ before the first trim work package; new files count against the target. | Maintainability | High | Open |
| NFR-002 | Fixture lines | In-scope fixture lines drop by at least 25%. CCK fixtures count at their full upstream size; a fixture moved to a shared location counts once, at its new path. | Maintainability | High | Open |
| NFR-003 | No lost guard | 100% of behaviour rows in the coverage map are guarded after the trim. | Reliability | High | Open |
| NFR-004 | Non-vacuity | At least one KEEP per suite family is shown red by a deliberate break of its behaviour. | Reliability | High | Open |
| NFR-005 | Suite time | Median of 3 runs of the in-scope vitest command, recorded before and after; after ≤ before × 1.10. | Performance | Medium | Open |
| NFR-006 | Example output | The example site's built output is unchanged except where FR-007 or FR-009 intends it. | Reliability | High | Open |
| NFR-007 | Gates green | Typecheck, lint, unit tests, a11y, doc sanity, the example build and the consumption test pass on the PR head. | Reliability | High | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Test economy | Trim and new tests follow DIRECTIVE_041 and the development-assist-test-cleanup rubric; new guards strengthen existing tests where possible. | Process | High | Open |
| C-002 | Upstream fixtures untouched | CCK fixtures are not edited; their provenance stays recorded. | Process | High | Open |
| C-003 | Accepted ADRs not edited | ADR-0055 is accepted and is not edited; its amendments go into the new ADR-0056. | Governance | High | Open |
| C-004 | Behaviour unchanged by the trim | The trim work packages change tests and fixtures only; any production change belongs to FR-005 to FR-010. | Technical | High | Open |
| C-006 | Security guards kept | No RETIRE may remove the only guard of include path confinement, the report size cap, or report-text privacy. | Security | High | Open |
| C-005 | Changelog style | Entries are user-focused and under 1,200 characters, and no line starts with `#` followed by a digit. | Process | Medium | Open |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In-scope test lines are at least 30% lower than the baseline. — [build] · no-op passable: no
- **SC-002**: In-scope fixture lines are at least 25% lower than the baseline. — [build] · no-op passable: no
- **SC-003**: 0 behaviour rows lose their last guard (coverage map). — [build] · no-op passable: no
- **SC-004**: 0 sentinel strings from the report appear in built output. — [build] · no-op passable: no
- **SC-005**: A site sets its "Overview" label in 1 place (option) or per locale (UI string). — [build] · no-op passable: no

## Assumptions

- The baseline inventory from grounding (26 files, 9,923 lines, about 516 cases; 64 fixture files, 3,002 lines) is re-measured at the start of the trim and recorded as the official baseline.
- The example site's committed demo report exists in CI so FR-006 does not break this repository's own build; the plan verifies this with a check, not an assumption.
