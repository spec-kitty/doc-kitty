---
work_package_id: WP01
title: Guard Hub draft-exclusion (#53)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- NFR-001
- NFR-002
planning_base_branch: feat/test-guard-hardening
merge_target_branch: feat/test-guard-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/test-guard-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/test-guard-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
history:
- created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/
create_intent:
- src/lib/hub-children.mjs
- src/tests/hub-children.test.ts
execution_mode: code_change
owned_files:
- src/lib/hub-children.mjs
- src/layouts/Hub.astro
- src/tests/hub-children.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load frontend-freddy` (role: implementer). Apply its identity, boundaries, and the charter directives (`spec-kitty charter context --action implement --json`); state which you applied. This is DISCIPLINED_REFACTORING (behavior-preserving extraction) + DIRECTIVE_041 (a test that reds exactly when the contract breaks).

## Objective

Close #53: Hub's draft-exclusion (INV-1) is currently unguarded — `hub-adr-card.test.ts` replicates Hub's filter chain instead of exercising it, so deleting `isPublished` from `Hub.astro` leaves the suite green. Make Hub's child-selection a **pure importable unit** and add a **mutation-true** test. Read `../spec.md` (FR-001, FR-002, NFR-002; C-001, C-003), `../plan.md` (IC-01), `../research.md` (D1).

## Critical context (file:line)

- `src/layouts/Hub.astro`: builds `children` from `getCollection('docs')`, filters `parentOf(slug) === currentSlug && isPublished(entry.data)` inline, then sorts (section-rank; the ADR-kind group is number-ordered via `buildAdrHubCards` from `generate-adr-index.mjs`). `isPublished` = `metadata.ts` `(doc_status ?? 'draft') !== 'draft'`. `parentOf`/`slugFromEntryId`/`sectionRank`/`sectionOf` are already imported there.
- The render output must stay **byte-identical** on the current corpus (C-001) — this is a pure extraction, not a behavior change.
- Do NOT add an a11y visual snapshot or a full-build DOM assertion (C-003) — that touches the flaky lane #54 fixes. A node-only unit test on the extracted predicate is the guard.

## Subtasks

### T001 — Create `src/lib/hub-children.mjs`
Export `selectHubChildren(entries, currentSlug, order)` (pure, no fs/Astro): given the mapped entries (`{slug, data}`), the current hub slug, and the section `order`, return the filtered + sorted child list Hub currently computes inline — the `parentOf === currentSlug && isPublished(data)` filter and the section-rank→title sort. Keep the exact predicate + comparator semantics from `Hub.astro`. (The ADR-number re-ordering via `buildAdrHubCards` stays in `Hub.astro` applied to the ADR-kind group after selection, unless it factors cleanly here — preserve current behavior either way.)

### T002 — Wire `Hub.astro` to `selectHubChildren`
Import and call `selectHubChildren`; remove the now-duplicated inline filter/sort. Confirm the rendered hub markup is byte-identical on the current corpus (diff the built `example/dist` hub pages, or reason precisely + rely on the example-build/a11y gate).

### T003 — `src/tests/hub-children.test.ts` (the guard)
Unit-test the REAL `selectHubChildren`:
- a **draft numbered ADR** child and a **draft non-ADR** child are EXCLUDED;
- published children (incl. a published ADR) are KEPT and correctly ordered;
- (mutation-true) the assertions depend on the `isPublished` branch — removing it makes the draft appear and reds the test.

### T004 — Verify (mutation + gates)
`pnpm install --offline` in the lane worktree. Run `pnpm -C src test hub-children` (green). **Mutation check**: temporarily delete the `isPublished` clause in `selectHubChildren`, confirm `hub-children.test.ts` REDS, then restore. Run full `pnpm -C src test --no-file-parallelism`, `pnpm typecheck` (clear stray `example/dist*` first), `pnpm lint` — all green (NFR-001). State what ran locally vs CI.

## Definition of Done
- `selectHubChildren` is the single selection used by `Hub.astro` and the test; render byte-identical.
- `hub-children.test.ts` reds when `isPublished` is removed (mutation-verified) and proves draft exclusion + published retention.
- Full vitest + astro check + lint green (or CI-verified with a note).
- `spec-kitty agent tasks mark-status T001 T002 T003 T004 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm the test exercises the REAL predicate (imported `selectHubChildren`), not a replica, and personally re-run the mutation check (remove `isPublished` → red).
- Keep `Hub.astro` output byte-identical; keep the ADR-number ordering (buildAdrHubCards) wired; respect the Pagefind/search-coverage comment.
- Env: `pnpm install --offline` works in a lane worktree; never fake a run.
