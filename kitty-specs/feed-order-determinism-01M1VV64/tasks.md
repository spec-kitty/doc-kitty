# Tasks: Feed order determinism (#85)

**Mission**: `feed-order-determinism-01M1VV64` · **Branch**: `feat/feed-order-determinism` (direct-to-feat; PR to `main`, Closes #85)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/feed-order.md](./contracts/feed-order.md)

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | `rankForFeed`: add locale-independent ascending-slug tiebreak | WP01 | |
| T002 | `collectDocEntries`: sort adapted entries by slug (pure helper if needed for testability) | WP01 | |
| T003 | Unit test: deterministic-shuffle input ranks identically; fails without the tiebreak | WP01 | |
| T004 | Unit test for the collect-order contract (via the pure helper) | WP01 | |
| T005 | Verify: unit suite, tsc-vs-baseline, no dependency change, scope | WP01 | |

## Work Packages

### WP01 — Total feed comparator + slug-sorted collection + regression tests
- **Goal**: deterministic feed/collection ordering with a test that pins it.
- **Priority**: P1.
- **Requirements**: FR-001, FR-002, FR-003; NFR-001, NFR-002, NFR-003; C-001, C-002, C-003.
- **Independent test**: `pnpm test` green with the new tests; two clean builds hash-identical; pre/post diff confined to `rss.xml` order (orchestrator-run oracle).
- **Included subtasks**: T001–T005
- **Dependencies**: none
- **Prompt**: [tasks/WP01-feed-order-determinism.md](./tasks/WP01-feed-order-determinism.md)
- **Estimated size**: ~5 lines prod, ~40 lines test
- **Risks**: locale-dependent compare; `getCollection` has no pure seam (extract a helper).

## MVP
WP01 is the whole mission.
