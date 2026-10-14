---
work_package_id: WP01
title: Worked-example parity and the status-shorthand warning
dependencies: []
requirement_refs:
- FR-001
- FR-009
- C-005
- SC-001
- SC-005
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/gherkin/feature-core.mjs
create_intent:
- src/tests/gherkin-fixture-parity.test.ts
execution_mode: code_change
owned_files:
- src/lib/gherkin/feature-core.mjs
- src/tests/gherkin-feature-core.test.ts
- src/tests/gherkin-fixture-parity.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP01 — Worked-example parity and the status-shorthand warning

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Give `book-consignment.feature` one source of truth (#128) and make a case-only near miss of `@wip` / `@deprecated` warn (#123). Plan: IC-01, IC-02. Research: R1, R5.

## Branch strategy

Planning artifacts were generated on `issue-156-gherkin-trim-and-fixes`; completed changes merge back into `issue-156-gherkin-trim-and-fixes`, which goes to `main` as one draft PR the operator merges. The execution worktree is allocated per computed lane from `lanes.json`; run `spec-kitty agent action implement <WP> --agent claude --mission gherkin-trim-and-fixes-01M4X4YF`.

## Shared context

- Read `spec.md`, `plan.md` (your IC), `research.md`, `data-model.md`, `contracts/public-surface.md` and `research/code-grounding.md` first.
- Node 22, pnpm, Vitest. No dependency change.
- In a lane worktree run `pnpm install --offline --frozen-lockfile` once; revert mode-only changes under `src/scripts/` with `git checkout -- src/scripts`. Run tests per file: `cd src && ./node_modules/.bin/vitest run tests/<file>`.
- Locate code by symbol, not line: earlier WPs edit the same files.
- Every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifier in commits.
- Terminology: "Mission" for the Spec Kitty work object; Gherkin "Feature" is a domain term.

## Subtasks

### T001 — Parity test (#128)

New `src/tests/gherkin-fixture-parity.test.ts`: read `example/features/shipping/book-consignment.feature` as the source of truth and assert each copy byte-identical (`toBe`, so the diff shows): `src/tests/fixtures/gherkin/render/book-consignment.feature`, `src/tests/fixtures/gherkin/generate/site/features/shipping/book-consignment.feature`. One `it.each` row per copy, named after the copy, so a drift names it. A comment says why copies exist (unit fixtures stay independent of the example site) and that a change to the example means regenerating the goldens (`render/book-consignment.md`, `generate/expected/**`). Prove non-vacuity: append a byte to one copy, see that row red, revert.

### T002 — Remove the fourth, inline copy

`gherkin-feature-core.test.ts` inlines `EXAMPLE_FEATURE` and checks it only against its own hash (`'the inline fixture is the example source, byte-for-byte'`), an inert self-compare (DIRECTIVE_041). Read the render fixture file instead (now parity-guarded), keep the frontmatter golden assertion, and retire the self-hash test. Header comment updated.

### T003 — Red: near-miss rows (#123)

In `gherkin-feature-core.test.ts` (`§2 status precedence` describe), add rows through `parseMetadataTags`: `@WIP` → status `active`, tag `WIP` kept, one warning containing `@WIP` and `did you mean @wip`; `@Wip` the same; `@Deprecated` → status `active`, warning naming `@deprecated`; `@wip` + `@WIP` → `draft` and one warning; `@wip` alone → no warning. Commit the red test alone (it must fail on the current code for the warning assertions).

### T004 — Fix

In `parseMetadataTags`, non-`@dk:` branch: after the exact matches, if `name.toLowerCase()` is `@wip` or `@deprecated`, push the warning (contract text in `contracts/public-surface.md`, with `where(file, loc)`), then pass the tag through as an ordinary tag. Update the function's JSDoc rule list. Commit the fix; the rows go green.

## Definition of done

- Parity rows green; a planted byte in a copy turns its row red.
- Near-miss rows red on the old code (commit), green after the fix (commit).
- `gherkin-example.test.ts` still proves the example warning-free.

## Risks and reviewer guidance

- Keep matching exact: no case-folding of the status itself (Cucumber semantics).
- Reviewer: check the red commit precedes the fix commit.
