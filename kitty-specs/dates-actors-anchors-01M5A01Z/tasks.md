# Tasks: Dates, actors and anchors (dates-actors-anchors-01M5A01Z)

**Planning branch**: `feat/dates-actors-anchors` · **Merge target**: `feat/dates-actors-anchors`
**Inputs**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red-first: parity ROWS and `normaliseInstant` rows for the non-date samples and the kept forms | WP01 | |
| T002 | Date-shape rule inside `normaliseInstant` (numbers and non-ISO strings) | WP01 | |
| T003 | `stampAt` instant check in both twins; remove the stale schema comment | WP01 | |
| T004 | Gate error wording names the field and form; no double error on a retired stamp | WP01 | |
| T005 | Verify callers, old-forms tree, example and docs gates | WP01 | |
| T006 | Red-first: one test pinning both precedence rules on three inputs | WP02 | [P] |
| T007 | `feedInstant` and `okfGenerated` side by side in `generator-stamp.mjs` | WP02 | |
| T008 | `feedDateMillis` delegates to `feedInstant`; comment points to the module | WP02 | |
| T009 | `generatedFor` delegates to `okfGenerated` | WP02 | |
| T010 | Verify feed order, export fixtures, two-build determinism | WP02 | |
| T011 | Strengthen the "content precedes the title" single-h1 test with `# Title … ## Title` | WP03 | [P] |
| T012 | Prove the strengthened test is non-vacuous (mutation check) | WP03 | |
| T013 | ADR-0059 implementation note for #226 and #227 | WP04 | |
| T014 | Architecture and guide pages: gherkin-pages, generators, metadata-model, export-okf-bundle | WP04 | |
| T015 | CHANGELOG `[Unreleased]` entries (≤1,200 characters each) | WP04 | |
| T016 | Doc gates: frontmatter, links, markdownlint, Vale | WP04 | |

## Phase 1 — Behaviour (parallel)

### WP01 — Reject non-date values through the one parser (#227)

**Prompt**: [tasks/WP01-reject-non-date-values.md](./tasks/WP01-reject-non-date-values.md)
**Priority**: P2 · **Profile**: node-norris · **Dependencies**: none
**Goal**: `updated`, `stale_after`, `generated.at` and `verified[].at` reject values that
aren't date-shaped. Every old form keeps building, and both twins agree.
**Independent test**: the parity ROWS for `"1"`, `1`, `"2024"`, `"1/2"`, `"abc 2024"` and
`"2024.5"` reject in both twins; the old-forms tree exits 0.

T001 Red-first parity and parser rows (WP01)
T002 Date-shape rule in normaliseInstant (WP01)
T003 stampAt instant check in both twins (WP01)
T004 Gate error wording and retired-stamp single error (WP01)
T005 Verify callers and gates (WP01)

**Risks**:
- A YAML number is read as epoch millis today and is now rejected.
- A retired `sha256:` stamp must still get only its "regenerate" message.

### WP02 — Per-output "last changed" rules in one module (#226)

**Prompt**: [tasks/WP02-last-changed-precedence.md](./tasks/WP02-last-changed-precedence.md)
**Priority**: P1 · **Profile**: node-norris · **Dependencies**: none
**Goal**: the RSS and OKF rules sit side by side in `generator-stamp.mjs`. The OKF export
counts only an ownership stamp and keeps `by` and `at` coherent. One test pins both rules.
**Independent test**: the new test's scaffold case exports `at = updated` and `by` = first
author; the ownership-plus-`updated` case keeps RSS = `updated` and OKF = stamp.

T006 Red-first precedence test (WP02)
T007 feedInstant and okfGenerated (WP02)
T008 feedDateMillis delegates (WP02)
T009 generatedFor delegates (WP02)
T010 Verify feed order, fixtures, determinism (WP02)

**Risks**:
- RSS reads raw frontmatter, but the export reads canonical graph nodes.
- Don't add a node to the shared `graph.json` fixture.

### WP03 — Pin the anchor-collision case (#228)

**Prompt**: [tasks/WP03-anchor-collision-test.md](./tasks/WP03-anchor-collision-test.md)
**Priority**: P3 · **Profile**: node-norris · **Dependencies**: none
**Goal**: the existing single-h1 test covers `# Title … ## Title`, with ids assigned as
in a real build.
**Independent test**: the test fails when the alias skip at `single-h1.ts` is removed.

T011 Strengthen the existing test (WP03)
T012 Mutation proof (WP03)

**Risks**: the harness assigns no ids, so the test must run `rehypeHeadingIds`.

## Phase 2 — Record and document

### WP04 — Decision record, docs and changelog

**Prompt**: [tasks/WP04-docs-adr-changelog.md](./tasks/WP04-docs-adr-changelog.md)
**Priority**: P2 · **Profile**: scribe-sally · **Dependencies**: WP01, WP02, WP03
**Goal**: ADR-0059 records the #226 decision and the #227 rule, the pages that state the
old rules are corrected, and the CHANGELOG has `[Unreleased]` entries.
**Independent test**: the doc gates pass. A reader finds every output's date precedence
in one ADR section.

T013 ADR-0059 implementation note (WP04)
T014 Architecture and guide pages (WP04)
T015 CHANGELOG entries (WP04)
T016 Doc gates (WP04)

**Risks**:
- Keep edited page descriptions at 50–180 characters.
- The changelog will conflict with PR #225 at rebase; resolve it as a union of both.

## MVP

WP02 (#226, P1) is the user-visible fix. WP01 is the largest safety gain.
