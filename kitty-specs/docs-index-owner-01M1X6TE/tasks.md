# Tasks: Docs-index neutral owner + Hub dedup (#90)
**Mission**: `docs-index-owner-01M1X6TE` · **Branch**: `feat/docs-index-owner` (direct-to-feat; PR to main, Closes #90)

## Subtask Index
| ID | Description | WP |
|----|-------------|----|
| T001 | New src/lib/docs-index.ts (move collectDocEntries+buildDocsIndex; opt-in body); DocEntry.body?:string | WP01 |
| T002 | Trim shared.ts; rewire 7 importers to docs-index.js | WP01 |
| T003 | Hub.astro → collectDocEntries({withBody:true}); drop inline copy | WP01 |
| T004 | Rewire collect-doc-entries-order.test.ts + withBody case; deck-slug comment | WP01 |
| T005 | Verify: build byte-identical, full suite, tsc baseline | WP01 |

## Work Packages
### WP01 — Docs-index neutral owner + Hub dedup
- **Goal**: one neutrally-owned docs-index module; Hub uses it. Byte-neutral.
- **Requirements**: FR-001..004, NFR-001/002, C-001/002/003.
- **Included subtasks**: T001–T005
- **Dependencies**: none
- **Prompt**: [tasks/WP01-docs-index-owner.md](./tasks/WP01-docs-index-owner.md)

## MVP
WP01 is the whole mission.
