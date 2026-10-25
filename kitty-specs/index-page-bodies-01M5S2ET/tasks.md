# Tasks: Export section-index page bodies

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red-first tests: a section overview page, the entry listed first, links rewritten, sidecar unchanged, a byte-exact fixture | WP01 | |
| T002 | Red-first tests: root overview, persona README, configured `indexBasename` | WP01 | |
| T003 | Implement `hasBody`, the overview emission, and the `indexDocument` leading entry | WP01 | |
| T004 | Parity, conformance and CLI: the unbased snapshot is unchanged, `checkOkfBundle` is clean, the CLI `--check` exits 0; keep the intent of the existing base-hint test | WP01 | |
| T005 | Export guide: replace "Known limit" and amend the index form | WP02 | [P] |
| T006 | ADR-0059 addendum for #238 | WP02 | [P] |
| T007 | CHANGELOG `[Unreleased]` Fixed entry for #238 | WP02 | [P] |

## WP01: Overview page emission (#238)

**Prompt**: [tasks/WP01-overview-page-emission.md](tasks/WP01-overview-page-emission.md)
**Goal**: a README with a non-empty body exports a sibling concept page `<id>.md`, which is listed first in its strict §8 index. Body-less indexes stay byte-identical.
**Independent test**: `vitest run tests/okf-export.test.ts tests/okf-export-links.test.ts`
**Dependencies**: none

T001 Red-first tests: a section overview page, the entry listed first, links rewritten, sidecar unchanged, a byte-exact fixture (WP01)
T002 Red-first tests: root overview, persona README, configured indexBasename (WP01)
T003 Implement hasBody, the overview emission, and the indexDocument leading entry (WP01)
T004 Parity, conformance and CLI; keep the intent of the existing base-hint test (WP01)

## WP02: Docs and CHANGELOG (#238)

**Prompt**: [tasks/WP02-docs-and-changelog.md](tasks/WP02-docs-and-changelog.md)
**Goal**: the docs describe the overview page (FR-006).
**Dependencies**: Depends on WP01

T005 Export guide: replace "Known limit" and amend the index form (WP02)
T006 ADR-0059 addendum for #238 (WP02)
T007 CHANGELOG [Unreleased] Fixed entry for #238 (WP02)
