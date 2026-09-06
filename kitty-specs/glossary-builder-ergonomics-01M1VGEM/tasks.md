# Tasks: Glossary builder ergonomics (#83)

**Mission**: `glossary-builder-ergonomics-01M1VGEM`
**Branch**: `feat/glossary-builder-ergonomics` (direct-to-feat; PR to `main`, Closes #83)
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

One work package. The four implementation concerns all touch the same three
glossary modules (IC-01/IC-02) or are one-line follow-throughs (IC-03/IC-04),
so splitting them would only create merge order for no parallelism.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Export the one subtree-text helper from `src/lib/glossary/link-node.ts`; pin strict-string leaf semantics | WP01 | |
| T002 | `glossary-autolink.internal.ts`: delete `textContent`, route `collectLinksUsed` + `seedFromExistingLinks` through the helper | WP01 | |
| T003 | `glossary-term.ts`: delete local `textOf`, route `transformDirective` through the helper | WP01 | |
| T004 | Add `[key: string]: unknown` to `GlossaryLinkNode`; drop both `as unknown as` casts; fix module docstring | WP01 | |
| T005 | Correct the assignability sentence in the #77/#79 contract `shared-link-node.md` | WP01 | |
| T006 | Optional: tighten `caretLeftProperty` assertions (px ≥ 8) in `tests/a11y/glossary.spec.ts` | WP01 | |
| T007 | Optional: correct the parity test header docstring (re-fork guard, not the aria-label net) | WP01 | |
| T008 | Verify: unit suite, tsc-vs-baseline, `as unknown as` count = 0, helper definitions = 1 | WP01 | |

## Work Packages

### WP01 — Consolidate text helper, tighten builder casts, fix contract wording

- **Goal**: one exported subtree-text helper used by all three call sites; the
  shared builder's return type assignable to both callers without any cast;
  the prior contract's wording true; two optional test-honesty nits. Zero
  output change.
- **Priority**: P1.
- **Requirements**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006; NFR-001,
  NFR-002, NFR-003, NFR-004; C-001, C-002, C-003, C-004.
- **Independent test**: `pnpm test` green; `tsc --noEmit -p src/tsconfig.json`
  shows no glossary/remark file and ≤ 30 errors; a fresh `example/dist` build
  hashes identically to the branch-start baseline (orchestrator-run).
- **Included subtasks**: T001–T008
- **Dependencies**: none
- **Prompt**: [tasks/WP01-consolidate-text-helper-and-casts.md](./tasks/WP01-consolidate-text-helper-and-casts.md)
- **Estimated size**: ~8 subtasks, ~−60 lines net
- **Risks**: the three concatenators differ on paper for non-mdast input;
  the consolidated helper must be the recursive, strict-string variant. Do not
  touch the sibling `MdastNode` interfaces in deck-split / diagram-meta.

## MVP

WP01 is the whole mission.
