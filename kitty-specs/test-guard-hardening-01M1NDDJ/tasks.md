# Tasks: Test-Guard Hardening

**Mission**: test-guard-hardening-01M1NDDJ · **Branch**: `feat/test-guard-hardening`
**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md)

Two independent WPs, two parallel lanes. No dependencies between them. Either is its own MVP.

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|----|----------|
| T001 | Create `src/lib/hub-children.mjs` — `selectHubChildren` (published ∧ parent filter + sort), extracted from Hub.astro | WP01 | [P] |
| T002 | Wire `Hub.astro` to `selectHubChildren`; remove inline filter; render byte-identical | WP01 | [P] |
| T003 | `src/tests/hub-children.test.ts` — draft child (numbered ADR + non-ADR) excluded via real predicate; published kept; mutation-true | WP01 | [P] |
| T004 | Verify: mutation-check (remove `isPublished` → red), vitest + astro check + full gates green | WP01 | [P] |
| T005 | Edit `src/vitest.config.ts` — stop the two `astro build` suites racing (isolate or `fileParallelism:false`); confirm vitest 2.1.9 support | WP02 | [P] |
| T006 | Verify: full vitest deterministic across ≥2 consecutive runs; `example-adopter` + `glossary-build-warning` green; runtime bounded | WP02 | [P] |

Record completion with `spec-kitty agent tasks mark-status T00x --status done`.

## Work Packages

### WP01 — Guard Hub draft-exclusion (#53)
- **Goal**: Make Hub's child-selection a pure importable unit and add a mutation-true test so removing the draft-exclusion cannot ship green.
- **Priority**: P1. **Independent test**: remove `isPublished` from `selectHubChildren` → ≥1 test reds; a draft child is absent from the selection; published children remain.
- **Subtasks**: T001–T004. **Dependencies**: none.
- **Prompt**: `tasks/WP01-guard-hub-draft-exclusion.md`.

### WP02 — Remove CI vitest parallel-build flake (#54)
- **Goal**: Stop `example-adopter` + `glossary-build-warning` racing on concurrent `astro build` under vitest file-parallelism.
- **Priority**: P2. **Independent test**: full vitest suite passes deterministically across consecutive runs; CI runtime bounded.
- **Subtasks**: T005–T006. **Dependencies**: none (parallel with WP01).
- **Prompt**: `tasks/WP02-vitest-flake-isolation.md`.
