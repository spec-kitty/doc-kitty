---
work_package_id: WP05
title: Source link check agrees with the build
dependencies:
- WP01
requirement_refs:
- FR-015
- FR-016
- FR-017
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 9df03cdcf1626d596814a236d268c6ed94cd76ce
created_at: '2026-10-13T20:00:09.821379+00:00'
subtasks:
- T021
- T022
- T023
- T024
- T025
history: []
agent_profile: node-norris
authoritative_surface: src/scripts/
create_intent: []
execution_mode: code_change
owned_files:
- src/scripts/check-links.mjs
- src/tests/check-links-tightened.test.ts
- src/tests/index-basename.test.ts
- src/tests/example-adopter.test.ts
- src/tests/draft-publication.test.ts
- src/tests/adr-referential-integrity.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP05 — Source link check agrees with the build

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`node-norris`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Make `dockitty-check-links` give the same answer as the build for relative Markdown links, on any docs tree and with no flag. Add `--strict` and `--index-basename`. Second half of #131.

Requirements: FR-015, FR-016, FR-017. Spec: User Story 4. Plan: IC-05. Research: R10. Contract: `contracts/public-surface.md` (CLI table).

Part of the severable #131 work (C-005). Depends on WP01 only: agreement with the build comes from calling the same `resolveRelativeDocLink` that WP04's plugin calls. It can run beside WP02 to WP04.

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

`src/scripts/check-links.mjs`:

- `:89` `INDEX_BASENAMES = ['README','index']`, hardcoded.
- `:98-104` `SITE_ROOTS = ['example/docs']`, matched by path suffix; `strict` (`:322`) is true only for that tree. So every consumer tree is non-strict.
- `:110` `INLINE_LINK` sees inline links only; reference definitions are not checked.
- `:133` `walk()` visits every `.md`/`.mdx`, including `log.md`.
- `:148,165,188` `resolvesToDoc`, `resolveDocFile`, `resolvesToDraft`: a relative link is resolved against the file system. A link to any existing file passes, whether or not it is a published page.
- `:253` root-absolute links are skipped; `:259-266` in strict mode a `.md`/`.mdx`-relative link is rejected outright; `:267-273` in strict mode a bare extensionless link is rejected; `:345-346` the draft-target check runs only when strict and drafts are off.

Result: on a consumer tree the check passes links that the built-link gate then fails, and on the example it rejects the link form WP04 now supports.

## Subtasks

### T021 — Red first

In `check-links-tightened.test.ts`, on a temp tree that is **not** `example/docs` and with no flag: a relative `.md` link to a page is accepted; a relative `.md` link to a file that exists but is not a page (one case for `log.md` and one for a draft with drafts off) is reported. The second is red today. Keep the failing output. `:39-110` of that file pins today's classifications; you will change them in T025.

### T022 — One rule

- For each scanned root, build a route table: shared walk (`src/lib/docs-walk.mjs`) + `buildRouteTable(paths, { indexBasename, unpublishedPaths })` from `vocabulary-core.mjs`. `unpublishedPaths` comes from WP01's helper using the draft setting the CLI already reads (`:280-300`, `draft-publication.mjs:228`).
- A relative link whose path ends in `.md`/`.mdx`: accepted exactly when `resolveRelativeDocLink` returns a route. This replaces the blanket rejection at `:259-266` and the draft lookup at `:184-191` for this link form, on every root, strict or not.
- When it does not resolve, report it with the reason: target missing; target is inside the docs tree but is not a page; target is an unpublished draft.
- **Targets outside the docs tree.** This repository's own `docs/` has 18 relative links to files outside it, in 9 files (`../README.md`, `../../AGENTS.md`, `../../CHANGELOG.md`, `kitty-specs/…`, `.kittify/charter/charter.md`). They are repository links, read on GitHub, and that tree is not built as a site. Rule: on a root that is not strict, a relative link to an **existing file outside the docs tree** is accepted, as today. On a strict root (the example, or any root with `--strict`) it is reported, because on a built site it is a broken link and the built-link gate would fail on it. One test for each side.
- Keep the file-system probing for `related:` frontmatter entries and for directory links. Keep skipping root-absolute links (`:253`).
- Do not copy any index-name or route logic into this file (C-002). Remove `INDEX_BASENAMES` as a constant; see T024 for the default.

### T023 — Reference definitions

Extend link extraction to `[label]: target` definitions (optional title, optional angle brackets). Check the target by the same rules as an inline link. Skip definitions inside fenced code blocks, as inline extraction already does. **Skip footnote definitions** (`[^label]: text`): the example and the fixture hold 228 of them, and a plain pattern would read the first word of each as a bare relative link. Two tests: a reference definition is checked; a footnote definition is ignored.

### T024 — Flags

- `--index-basename <name[,name…]>`: copy the parsing pattern at `src/scripts/generate-feature-pages.mjs:108`. When absent, keep today's effective list `README,index` so existing invocations behave as before; say in `--help` that a site should pass its own setting.
- `--strict`: applies the remaining strict rule (bare relative link with no extension is reported) to every root given. The example root stays strict without the flag, as today.
- Update the usage text. Tests, one each, in `check-links-tightened.test.ts`: a bare extensionless link on a non-example tree is reported only with `--strict`; a directory link to a folder whose index is `home.md` is accepted only with `--index-basename home`.
- Callers today: root `package.json:21` (`check-links.mjs docs example/docs`, run by CI as `pnpm validate:links`), `tests/consumption/scripts/run-consumption-test.mjs:414,418` (WP06 adds the flags there), `example-adopter.test.ts:74`, `draft-publication.test.ts:787-1054`. Do not edit the root `package.json` or the consumption scripts.

### T025 — Pins

- `check-links-tightened.test.ts:39-110`: the example's `.md`-relative classification flips from invalid to "valid when it resolves to a published page". Rewrite those cases to the new rule; keep the bare-link cases.
- `index-basename.test.ts:28` pins `resolvesToDoc`. If that export goes away, re-point the test at the behaviour through the CLI's exported check function; do not keep a dead export for a test.
- `example-adopter.test.ts:260` pins `check-links docs example/docs` at exit 0. This repository's own `docs/` links ADRs as `./NNNN-x.md`; they resolve and must stay accepted. Run that test; a failure here means a real regression in the rule or a genuinely broken link, so read which.
- `draft-publication.test.ts:787-1054` holds check-links cases for draft targets; they must still pass, through the new path.
- `adr-referential-integrity.test.ts` and `schema-validator-parity.test.ts` import `collectDanglingRelated` from this file; keep that export and both tests green.

## Definition of done

- No flag, any root: a relative Markdown link to a file inside the docs tree is accepted iff the build would rewrite it to a published page. With `--strict` or on a site root, the same holds for every relative Markdown link.
- `--strict` and `--index-basename` work and are documented in `--help`.
- The five owned test files are green, plus `route-table.test.ts`.
- `node src/scripts/check-links.mjs docs example/docs` exits 0 from the repository root (this one runs without a build; include its output in the hand-off).

## Risks and reviewer guidance

- This newly reports links that passed before (a `.md` link to a non-page). It is listed as Breaking in the changelog (WP07). Reviewer: confirm the message tells the adopter what to change.
- Reviewer: grep `check-links.mjs` for any remaining index-name literal or route derivation.
- The CLI walks more files than the route table holds (`log.md`): a link **from** `log.md` is still checked; a link **to** `log.md` is a non-page target.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP05 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
