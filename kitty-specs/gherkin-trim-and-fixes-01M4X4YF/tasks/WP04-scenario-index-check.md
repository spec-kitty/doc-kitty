---
work_package_id: WP04
title: Advertised scenario index must exist
dependencies:
- WP03
requirement_refs:
- FR-008
- C-001
- C-005
- SC-004
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-fixes-01M4X4YF
base_commit: 1c3850859540dfccc88b8b926b313eae10d124b9
created_at: '2026-10-14T12:39:25.947928+00:00'
subtasks:
- T015
- T016
- T017
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/gherkin/scenario-index-check.mjs
create_intent:
- src/lib/gherkin/scenario-index-check.mjs
execution_mode: code_change
owned_files:
- src/lib/gherkin/scenario-index-check.mjs
- src/lib/config.ts
- src/tests/gherkin-integration.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP04 — Advertised scenario index must exist

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Fail the build when `llms.txt` advertises `/api/scenarios.json` but the output has no `api/scenarios.json` (#126 option 2). No injected route (C-001). Plan: IC-05. Research: R4.

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

### T015 — Red

`gherkin-integration.test.ts`: call the `doc-kitty:gherkin` integration's `astro:build:done` hook with `{ dir: pathToFileURL(<tmp>/) }` where `<tmp>/llms.txt` contains `Scenario index: https://x/api/scenarios.json` and no `api/scenarios.json`; expect it to throw `[dk-gherkin]` naming `/api/scenarios.json` and `src/pages/api/scenarios.json.ts`. Commit red (today the hook does not exist).

### T016 — Fix

New `src/lib/gherkin/scenario-index-check.mjs` (fs only, JSDoc): `checkScenarioIndexAdvertised(outDir)`; advertised = a line starting `Scenario index: ` in `<outDir>/llms.txt`; present = `<outDir>/api/scenarios.json` is a file. Throws the contract message (mention `scenarioIndexRoute()` and the consumer-setup guide step). In `config.ts` `gherkinIntegration` add `'astro:build:done': ({ dir }) => checkScenarioIndexAdvertised(fileURLToPath(dir))`; update its doc comment.

### T017 — Pass rows

Both present → no throw; neither → no throw; `llms.txt` without the line and no index → no throw.

## Definition of done

- Red commit before fix; `gherkin-integration.test.ts`, `config-invariants.test.ts` green; the example build (`pnpm build:a11y`) still passes; `pnpm assert:artifacts` passes.

## Risks and reviewer guidance

- Integration-name lists are pinned in four tests: do not add an integration.
- Residual (record in ADR): a site with frozen pages and no `gherkin` option is not checked.
