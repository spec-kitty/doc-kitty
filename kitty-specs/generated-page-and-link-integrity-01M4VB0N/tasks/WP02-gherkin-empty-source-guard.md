---
work_package_id: WP02
title: Gherkin empty-source guard and allowEmpty
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-004a
- FR-005
- C-004
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 6e6504f246daec28771b1666970b56bf3ddd1c44
created_at: '2026-10-13T19:59:44.586608+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/gherkin/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/gherkin/**
- src/scripts/generate-feature-pages.mjs
- src/tests/gherkin-generate.test.ts
- src/tests/gherkin-integration.test.ts
- src/tests/gherkin-check-cli.test.ts
- src/tests/gherkin-example.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP02 — Gherkin empty-source guard and allowEmpty

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

When the whole configured Gherkin source set yields no feature and generated pages exist, stop instead of deleting them. Add the opt-out `gherkin.allowEmpty` and the flag `--allow-empty`. Fixes #122.

Requirements: FR-001 to FR-005, FR-004a, C-004. Spec: User Story 1, scenarios 1 to 8. Plan: IC-02. Research: R8. Contract: `contracts/public-surface.md` (error message contract).

## Shared context

- **Mission documents** (read before coding): `kitty-specs/generated-page-and-link-integrity-01M4VB0N/spec.md`, `plan.md` (Design, File ownership, your concern under Implementation Concern Map), `research.md`, `data-model.md`, `contracts/public-surface.md`.
- **Stack**: Node 22, TypeScript 5.9 and plain `.mjs`, Astro ^5.2, Starlight ^0.32. Do not add, upgrade or remove any dependency. If you believe one is needed, stop and report.
- **Environment, important**: you work in a lane worktree, which starts with no `node_modules`. Run `pnpm install --offline --frozen-lockfile` once at the worktree root (the local pnpm store has everything; do not use the network and do not change the lockfile). Never run `pnpm install` or `pnpm exec` in the main checkout. Do not symlink `node_modules`. After installing, if `git status` shows mode-only changes under `src/scripts/`, revert them with `git checkout -- src/scripts`. Run tests one file at a time: `cd src && ./node_modules/.bin/vitest run tests/<file>`. Do not run a full site build (it needs a PlantUML server); CI verifies build-level gates.
- **Dependencies must be present before you start.** A lane can be cut without its dependencies' unmerged code. Check for the marker of each work package you depend on, and if one is missing, merge that dependency's lane branch into your worktree first: WP01 → `buildRouteTable` exported from `src/lib/vocabulary-core.mjs`; WP02 → `allowEmpty` in `src/lib/gherkin/options.mjs`; WP03 → `generatedIndexBasename` used in `src/lib/glossary/generate.ts`; WP04 → `src/lib/remark/relative-md-links.ts` exists; WP05 → `--strict` in `src/scripts/check-links.mjs`.
- **Line numbers** in this prompt are as of `main` at `27358fe`. Earlier work packages edit some of the same files, so locate code by symbol name, not by line.
- **Test economy** (charter DIRECTIVE_041): add a test only when it guards behaviour in the spec through an existing entry point and goes red when your fix is reverted. Strengthen an existing test before adding a new one. No test that pins code shape, no duplicate of an existing assertion. In your hand-off, give a table: each test added or changed, the regression it catches, and what already covered it.
- **Red first**: for each defect fix, show the failing assertion before the fix (command and output in the hand-off). Keep the test only if it earns its place under the rule above.
- **Out-of-map edits**: stay inside `owned_files`. A small edit elsewhere is acceptable only where this prompt names it; record it in the hand-off with one line of rationale.
- **Comments and style**: match the surrounding file. This codebase comments *why* a rule exists and which requirement it serves. `tsc` checks `.ts` only here (`src/tsconfig.json` includes `*.ts`; `.mjs` files are not error-checked unless they carry `@ts-check`), so rely on tests for `.mjs` changes. Typecheck with `cd src && ./node_modules/.bin/tsc --noEmit -p .`.
- **Commits**: Conventional Commits subject (`fix(...)`, `feat(...)`, `test(...)`, `docs(...)`). If the commit hook fails for a reason unrelated to your change, report it; do not bypass silently.

## Why this is broken today

`src/lib/gherkin/generate.mjs`, `generateFeaturePages` (`:511-560`), in order:

| Line | Step |
|---|---|
| `:513` | `planFeaturePages` (no writes) |
| `:514` | `scanOutputDir` |
| `:515` | symlinked-root throw |
| `:521` | authored-file throw |
| `:529-534` | **empty sources: warn only** |
| `:537-539` | path assertions |
| `:545-553` | first write |
| `:556-557` | unlink owned pages not in the plan, prune empty dirs |

With no feature files the plan is empty, so every owned page is unlinked. An uninitialised git submodule produces exactly this. A missing directory already throws (`load.mjs:204-208`), all-files-fail-to-parse already throws (`load.mjs:250`), and a `.feature` with no `Feature:` is skipped (`load.mjs:243-246`), so `model.files.length === 0` is the right definition of empty.

In scope at `:529`: `model`, `plan`, `owned` (only `.md` files stamped `generated.by`), `authored` (empty by then), `outDir`, `sources`, `warn`, `opts`. Nothing is written before `:545`.

## Subtasks

### T006 — Red first

`src/tests/gherkin-generate.test.ts:289-310` asserts today's behaviour and is the only pin of the warning text (`:303-305`). Rewrite it to expect: the call throws, the output tree is byte-for-byte what it was before the call (snapshot the file list and contents), and the message has the parts in T007. Run it and keep the failing output for the hand-off.

### T007 — The guard

Replace the `:529-534` block:

- `model.files.length === 0 && owned.length > 0 && allowEmpty !== true` → throw. The message must contain (see the contract): each configured source directory; the number of pages that would be removed; a sentence naming an uninitialised git submodule as the likely cause; `gherkin.allowEmpty: true` / `--allow-empty` as the deliberate way to remove the pages; and that removing the `gherkin` option keeps the pages frozen. Write it for an adopter reading a CI log. Match the existing `[dk-gherkin]` prefix convention.
- `model.files.length === 0 && owned.length > 0 && allowEmpty === true` → today's warning text unchanged, then prune as today.
- `model.files.length === 0 && owned.length === 0` → today's warning, nothing created (unchanged; `:312-318` test must stay green as is).
- Keep the authored-file check first; `gherkin-generate.test.ts:376-384` pins that order and must stay green unchanged.
- Whole-set emptiness only (C-004). One empty source among several is not this case.
- A source set holding only draft or `@wip` features, and a file that parses with no `Feature:`, need no new code or test: the first is not empty (pages are still generated, `generate.mjs:218-222`), the second is already skipped at load and so counts toward emptiness.

Add `allowEmpty` to the `GenerateOptions` typedef (`:120-125`) and the destructure (`:512`).

### T008 — Register the option (every place, or it is silently dropped)

`validateGherkinOptions` returns only the keys it destructures, so an unregistered key vanishes.

- `src/lib/gherkin/options.mjs`: `GherkinOptionsInput` typedef `:33-38`, `ValidatedGherkinOptions` `:43-48`, the `optionName` key union `:54`, destructure `:79-84`, return `:118-123`. Add a boolean check: any value other than `true`, `false` or `undefined` throws and names `gherkin.allowEmpty` (FR-004). No boolean validation exists to copy; follow the tone of the neighbouring messages. Do **not** add rejection of unknown keys; that is a separate issue.
- `gherkin-integration.test.ts:441` pins the validator's exact return. Decision: emit `allowEmpty` in the return only when it is `true`, so that pin holds.
- Export one list of the option keys from `options.mjs` (for example `GHERKIN_OPTION_KEYS`) and have the validator use it, so T010's parity check has something to read.
- `src/lib/config.ts`: `DocKittyOptions.gherkin` type `:182-203`, `ResolvedGherkinOptions` `:1165-1171`, pass-through in the hook `:1222-1231`. `config.ts` is owned by WP01; these three edits are the named out-of-map edits for this work package. The hook already rethrows, so a throw fails the build and `astro dev` startup.

### T009 — CLI flag

`src/scripts/generate-feature-pages.mjs`: usage header `:6-21`, `FLAG` map `:61-66`, `raw` `:92-101`, return-type JSDoc `:87-89`, return `:142-152`, `genOpts` `:171-180`. `--check` (`:115-118`) is the only boolean flag; copy its handling (`valued` is for value flags). Write mode exits 1 with the T007 message; with `--allow-empty` it exits 0. `--check` does not call `generateFeaturePages` (`:189-204`) and must behave exactly as today, with or without the flag: it already exits 1 and lists every page as stale when sources are empty and pages exist.

### T010 — Tests

Carry each scenario in the cheapest existing place:

| Spec scenario | Where |
|---|---|
| 1 build stops, message parts | the rewritten `gherkin-generate:289`; one hook-level case beside `gherkin-integration:273`, with a second arm where the site sets `allowEmpty: true` and the hook does not throw (this is the only proof of the `config.ts` pass-through) |
| 2 CLI write mode exits 1 | new case in the write-mode describe of `gherkin-check-cli` (`:111`, after `:127`) |
| 3 opt-out removes with a warning | the old `:289` assertions moved under `allowEmpty: true`; warning text pin unchanged |
| 4 no pages, empty sources | `gherkin-generate:312` unchanged |
| 5 one of two sources empty | one small new case in `gherkin-generate` |
| 6 check mode, with and without the flag | one new case in the `--check` describe of `gherkin-check-cli` |
| 7 wrong type rejected | one row in an `it.each` under the describe at `gherkin-integration:287` (the blocks are at `:291` and `:299`) |
| 8 flag only, exit 0 | same CLI case as scenario 2, second arm |
| FR-004a setting and flag in step | see below |

FR-004a: the existing parity test (`gherkin-example.test.ts:84-112`) compares hand-listed fields, so adding `allowEmpty` in one place only would stay green. Strengthen that block so both lists are read from the code (the exported key list from T008 and the CLI's `FLAG` map, exporting `FLAG` if needed) and compared, so a setting without a flag, or the reverse, fails. Confirm it goes red if you remove `allowEmpty` from `FLAG`.

## Definition of done

- Empty sources with owned pages stop the build and the CLI write mode; no page is removed; the message meets the contract.
- `allowEmpty: true` and `--allow-empty` restore warn-and-remove.
- The four Gherkin test files are green; `:312-318` and `:376-384` are unchanged.
- No change under `example/`. `example/features` is populated and CI runs only `--check` plus the example build, so the guard cannot trip there.

## Risks and reviewer guidance

- Reviewer: read the error message as an adopter would. Does it say what happened, why, and both ways out?
- Reviewer: confirm `allowEmpty` appears in all of: both typedefs and the key union in `options.mjs`, the three `config.ts` sites, `GenerateOptions`, and the five CLI sites.
- Under `allowJs`, `FLAG` and the `optionName` union must both gain the key or `FLAG[key]` fails typecheck.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP02 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
