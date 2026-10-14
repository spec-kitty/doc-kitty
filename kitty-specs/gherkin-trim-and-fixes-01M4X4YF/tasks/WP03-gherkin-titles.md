---
work_package_id: WP03
title: gherkin.titles hub titles
dependencies:
- WP02
requirement_refs:
- FR-004
- FR-005
- FR-006
- FR-007
- C-005
- SC-003
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-fixes-01M4X4YF
base_commit: e99e5c7db3ffc14aca4c84fd035609d8b1983069
created_at: '2026-10-14T12:33:07.488217+00:00'
subtasks:
- T009
- T010
- T011
- T012
- T013
- T014
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/gherkin/options.mjs
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/gherkin/options.mjs
- src/scripts/generate-feature-pages.mjs
- src/tests/gherkin-options.test.ts
- src/tests/gherkin-example.test.ts
- src/tests/gherkin-check-cli.test.ts
- package.json
- example/astro.config.mjs
- example/docs/behaviour/**
role: implementer
tags: []
tracker_refs: []
---

# WP03 — gherkin.titles hub titles

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Optional `gherkin.titles` map sets hub titles, validated once for CLI and integration; the example uses `hr: 'HR'` (#125). Plan: IC-04. Research: R3. Contract: `contracts/public-surface.md`.

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

### T009 — Red: option rows

`gherkin-options.test.ts` through `normalizeGherkinOptions` / `validateGherkinPages`: accepts `{ sources, titles: { hr: 'HR', 'shipping/edi': 'EDI messages' } }` and returns a copy; refuses `titles` that is an array, null or a string; keys `''`, `/hr`, `hr/`, `./hr`, `a/../b`, a backslash path, `C:/x`; blank or non-string values; `titles` without `sources` (message names `gherkin.titles` and `sources`). Commit red.

### T010 — Fix: options

Add `titles` to `GHERKIN_PAGES_KEYS` (so `GHERKIN_OPTION_KEYS` gets it); validate in `validateGherkinPages` (use `isRelativePosixPath` plus a per-segment check: no empty, `.` or `..` segment); return a fresh plain object only when given; extend the "only applies to generated pages" branch in `normalizeGherkinOptions`. Typedefs updated.

### T011 — Red + fix: planner (out-of-map: `generate.mjs`, owned by WP02, and `gherkin-generate.test.ts`)

`PlanOptions.titles`. When a directory is first seen, title = `titles[rawDir]` (raw source-relative path, `segments.slice(0, depth).join('/')`) else `humaniseDirectoryName`. Collect every raw directory path seen; after the loop, warn once per unknown key (contract text). Rows: title applied to hub title, H1, description and the parent's list line; nested key `shipping/edi`; unknown key warns; no `titles` unchanged output. Red commit, then fix.

### T012 — CLI and scripts

`generate-feature-pages.mjs`: `FLAG.titles = '--titles'`; `--titles <dir>=<title>` repeatable (split on the first `=`; a value without `=` is a usage error); pass through `validateGherkinPages`; header usage block updated. `gherkin-example.test.ts`: the FR-004a `valid` object gains `titles`; the mirror test compares `opts.titles` to the config's `gherkin.titles`. `package.json` `validate:features` and `generate:features` gain `--titles hr=HR`. One `gherkin-check-cli.test.ts` row: `--titles` reaches the plan (a check run with a matching title is clean, a different one reports `changed`).

### T013 — Integration (out-of-map: `src/lib/config.ts`)

Thread `titles` from the resolved option into `generateFeaturePages` in `gherkinIntegration`; add `titles?: Record<string, string>` to the `gherkin` option type and its doc comment.

### T014 — Example

`example/astro.config.mjs`: `titles: { hr: 'HR' }` (plain data literal; comment). `pnpm generate:features`; commit the regenerated `example/docs/behaviour/README.md` and `hr/README.md`. `pnpm validate:features` passes.

## Definition of done

- Red commits before fixes; all Gherkin suites green; `pnpm validate:features`, `pnpm lint`, `pnpm typecheck` pass.
- Example hub reads "HR".

## Risks and reviewer guidance

- `gherkin-example.test.ts` evaluates the config literal: keep `titles` a plain literal.
- The sidebar label changes from "Hr" to "HR": watch `tests/a11y/visual.spec.ts`.
