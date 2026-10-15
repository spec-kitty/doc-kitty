# Tasks: One owner for DocKitty's internal process.env handoffs

Mission `internal-env-owner-01M4ZNK1`. Issue: #167. The work package prompts in `tasks/` are authoritative; this file is the index. Subtask completion is recorded with `spec-kitty agent tasks mark-status`, not by editing this file.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Red first: two-config lifecycle test in draft-publication.test.ts | WP01 | |
| T002 | Owner module `src/lib/internal-env.mjs` (names, list, clear/set/delete) | WP01 | |
| T003 | Re-export the names from their old definition sites | WP01 | |
| T004 | Wire clear-on-define and setup-time setters in config.ts | WP01 | |
| T005 | Gates: suites, eslint, tsc, node --check | WP01 | |
| T006 | Helper `restore-internal-env.ts` over INTERNAL_ENV_NAMES | WP02 | |
| T007 | Adopt the helper in every suite touching the five names | WP02 | |
| T008 | Delete `restore-index-env.ts` | WP02 | |
| T009 | Gates and proof that no assertion changed | WP02 | |
| T010 | ADR-0057 plus pointers from ADR-0050/0055/0056 | WP03 | |
| T011 | Consumer guide: internal names, never set by hand | WP03 | |
| T012 | CHANGELOG [Unreleased] Fixed entry | WP03 | |
| T013 | Byte-identical example build, link check, markdownlint | WP03 | |

## Work Packages

### WP01 — Owner module and lifecycle wiring
Prompt: `tasks/WP01-owner-module-and-wiring.md`. Dependencies: none.
T001 Red-first lifecycle test (WP01)
T002 Owner module (WP01)
T003 Re-exports (WP01)
T004 Lifecycle wiring (WP01)
T005 Gates (WP01)

### WP02 — One test restore helper for the internal handoffs
Prompt: `tasks/WP02-one-test-restore-helper.md`. Dependencies: WP01.
T006 Helper (WP02)
T007 Adoption (WP02)
T008 Retire old helper (WP02)
T009 Gates (WP02)

### WP03 — ADR-0057, consumer guide, CHANGELOG and byte-identical check
Prompt: `tasks/WP03-adr-guide-changelog.md`. Dependencies: WP01, WP02.
T010 ADR-0057 (WP03)
T011 Consumer guide (WP03)
T012 CHANGELOG (WP03)
T013 Byte-identical check (WP03)
