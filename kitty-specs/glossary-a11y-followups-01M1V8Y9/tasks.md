# Tasks: Glossary a11y follow-up cluster (#77/#78/#79)

**Mission**: `glossary-a11y-followups-01M1V8Y9`
**Branch**: `feat/glossary-a11y-followups` (direct-to-feat; PR to `main`)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contract**: [contracts/shared-link-node.md](./contracts/shared-link-node.md)

Two independent work packages (disjoint owned files). WP01 folds IC-01 + IC-02
(both live in the shared builder + its unit tests); WP02 is the IC-03 e2e guard.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Create `src/lib/glossary/link-node.ts` — the one shared builder (with aria-label) | WP01 | |
| T002 | Rewire `makeLinkNode` (glossary-autolink.internal.ts) to delegate; wrap surface→children | WP01 | |
| T003 | Rewire `glossaryLinkNode` (glossary-term.ts) to delegate | WP01 | |
| T004 | Extend cross-emitter parity test to assert the shared `aria-label` | WP01 | |
| T005 | Update per-builder golden tests (autolink + term) for `aria-label` | WP01 | |
| T006 | Update `docs/architecture/glossary.md` footprint section + ADR/changelog note | WP01 | |
| T007 | e2e: assert `data-placement="bottom"` + caret for a high term | WP02 | [P] |
| T008 | e2e: assert `data-placement="top"` flip for a low-in-viewport term | WP02 | [P] |
| T009 | e2e: assert caret-presence proxy; confirm count-pins unchanged | WP02 | [P] |

## Work Packages

### WP01 — Shared glossary link-node builder + AT-perceivable affordance

- **Goal**: Collapse the two byte-identical builders into one shared builder and
  add the `aria-label = "<visible text>, glossary term"` affordance there, so both
  emitters get it byte-identically. Update the parity + golden tests and the docs.
- **Priority**: P1 (the a11y affordance is the mission's flagged gap).
- **Requirements**: FR-001, FR-002, FR-003, FR-005; NFR-001, NFR-002, NFR-003, NFR-005; C-001, C-002, C-004.
- **Independent test**: `pnpm test` green (parity + golden updated); built demo HTML
  shows `aria-label` ending `", glossary term"` on term anchors, none on ordinary
  links; the re-derive parity guard needs no new exclusion.
- **Included subtasks**: T001, T002, T003, T004, T005, T006
- **Dependencies**: none
- **Prompt**: [tasks/WP01-shared-link-node-and-affordance.md](./tasks/WP01-shared-link-node-and-affordance.md)
- **Estimated size**: ~6 subtasks, ~360 lines
- **Risks**: two hand-rolled node interfaces (`MdNode` vs `MdastNode`); keep no
  `@types/mdast` dependency; aria-label must be an attribute (no counted text child)
  and lead with the exact visible text.

### WP02 — Popover placement + caret e2e regression guard

- **Goal**: Add e2e assertions in `tests/a11y/glossary.spec.ts` for `data-placement`
  (bottom for a high term, top for a viewport-flipped low term) and caret presence.
- **Priority**: P2 (coverage hardening; no production behaviour change).
- **Requirements**: FR-004.
- **Independent test**: `pnpm run test:a11y` green with the new assertions; existing
  count-pins unchanged.
- **Included subtasks**: T007, T008, T009
- **Dependencies**: none (independent of WP01; disjoint files)
- **Prompt**: [tasks/WP02-popover-placement-caret-e2e.md](./tasks/WP02-popover-placement-caret-e2e.md)
- **Estimated size**: ~3 subtasks, ~200 lines
- **Risks**: forcing a reliable upward flip needs a term low in the viewport
  (small viewport height / scroll a late term near the bottom); the caret is CSS
  pseudo-elements — assert observable proxies (`data-placement` +
  `--dk-glossary-caret-left`), not a caret element.

## MVP

WP01 alone delivers the mission's core value (the #77 a11y affordance). WP02 is
independent test hardening.
