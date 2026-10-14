# Tasks: Slot-name validation and sidebar labels

**Mission**: `slot-validation-sidebar-labels-01M4X4YT`
**Branch**: planning and merge target `issue-114-112-slot-validation-sidebar-labels` (draft PR to `main`, operator merges)
**Inputs**: [spec.md](spec.md), [plan.md](plan.md), [research/code-grounding.md](research/code-grounding.md)

Two independent work packages, one per issue. They share no file, so they can
run in either order. The visual-baseline refresh happens once, after both land
on the branch (CI workflow, not a work package file).

```
WP01 (#114)   WP02 (#112)
```

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Tidy first: `DK_SLOT_NAMES` runtime list, `DkSlotName` derived from it | WP01 | |
| T002 | Red: config-level and `resolveTheme` tests for an unknown slot name | WP01 | |
| T003 | Green: reject unknown slot names in `mergeLayers` with the valid list | WP01 | |
| T004 | ADR for runtime slot validation; theming doc and manifest comment | WP01 | [P] |
| T005 | Red: widen built-sidebar checks; unit cases for collapse, relabel, pagination | WP02 | |
| T006 | Green: collapse one-page folder groups; relabel repeated index entries | WP02 | |
| T007 | Green: pagination keeps page titles | WP02 | |
| T008 | Example content: rhetoric `sidebar.order`, architecture page `sidebar.label` | WP02 | [P] |
| T009 | Authoring guide and changelog (both issues) | WP02 | [P] |

## WP01 — Reject unknown theme slot names (#114)

Requirements: FR-001, FR-002, FR-003, NFR-002, C-001. Prompt: [tasks/WP01-slot-name-validation.md](tasks/WP01-slot-name-validation.md).

- T001, T002, T003, T004

## WP02 — Sidebar labels for one-page folders and section indexes (#112)

Requirements: FR-004..FR-010, NFR-001, C-002..C-004. Prompt: [tasks/WP02-sidebar-labels.md](tasks/WP02-sidebar-labels.md).

- T005, T006, T007, T008, T009
