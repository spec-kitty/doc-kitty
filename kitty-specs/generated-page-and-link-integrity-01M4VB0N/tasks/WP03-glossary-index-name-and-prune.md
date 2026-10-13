---
work_package_id: WP03
title: Glossary index file name and guarded prune
dependencies:
- WP01
- WP02
requirement_refs:
- FR-006
- FR-007
- FR-008
- FR-009
- NFR-002
- C-003
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: d00de441770b71ac4791f5cc4c1c6885a73e6ad3
created_at: '2026-10-13T20:07:14.002433+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/glossary/
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/glossary/generate.ts
- src/tests/glossary-generate.test.ts
- src/tests/glossary-codegen-guard.test.ts
- src/tests/glossary-config.test.ts
- src/tests/link-integrity.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP03 — Glossary index file name and guarded prune

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Write the generated glossary hub and context pages under a file name the site treats as a section index, and remove generated pages left under another index name without ever removing an authored page. Fixes #129.

Requirements: FR-006 to FR-009, NFR-002, C-003. Spec: User Story 2, scenarios 1 to 7. Plan: IC-03. Research: R7.

Depends on WP01 (`generatedIndexBasename`, `resolveIndexEntries`) and is sequenced after WP02 only because both edit `src/lib/config.ts`.

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

`generateGlossaryPages(index, outDocsDir)` (`src/lib/glossary/generate.ts:188`) always writes `<out>/glossary/index.md` (`:203-207`) and `<out>/glossary/<context.slug>/index.md` (`:209-214`). The default index name is `README` (`DEFAULT_INDEX_BASENAME`), so on a default site `isIndexPath('glossary/index.md')` is false: the hub routes at `/glossary/index/`, each context at `/glossary/<ctx>/index/`, the hub's relative links (`./<slug>/`, `:129`) resolve under `/glossary/index/`, the Hub layout lists no children (`hub-children.mjs:51` matches by parent slug), and every term link (`glossaryTermUrl`, `glossary/resolve.ts:33`) points at `/glossary/<ctx>/`, which does not exist. The example hides it by setting `indexBasename: ['README','index']`.

The generator never prunes and has no ownership marker; `glossary-codegen-guard.test.ts:79` asserts generated pages carry no `generated:` field, and that guard stays (C-003).

Fields the generator writes, in order. Hub: `title`, `description`, `kind: Hub`, `doc_status: active`. Context page: `title`, `description`, `kind: Glossary`, `glossary_context`, `doc_status: active`. Context folder names are `index.contexts.get(name).slug` (derived at `glossary/load.internal.ts:198-206`).

## Subtasks

### T011 — Red first

In `glossary-generate.test.ts`, add one case: generate into a temp docs dir with the default index name, list the written files, run them through `resolveIndexEntries` with the same setting, and expect ids `glossary` and `glossary/<slug>` for each context. Table-drive it over `undefined`, `'index'`, `['README','index']`, `['index','README']`, and assert the **file name** written in each row as well (`README.md`, `index.md`, `index.md`, `index.md`): the ids alone pass for a site listing both names whichever is chosen. It is red today for `undefined`. Keep the failing output.

### T012 — Thread the setting, pick the name

- `generateGlossaryPages` gains an index-name parameter. Target name: `generatedIndexBasename(indexBasename, { prefer: 'index' })` from `vocabulary-core.mjs` (so `index` when the site lists it, else the site's first index name).
- `src/lib/config.ts`: `glossaryIntegration(docsDir, base)` (`:1106`, generator call `:1120`, integration call site `:1819`) receives `indexBasename` and passes it on, as the Gherkin integration already does (`:1209-1226`, `:1827`). `config.ts` is owned by WP01; these edits are the named out-of-map edits for this work package.
- Do not give the new parameter a default of `README`: eleven path pins and three mocks call the generator with two arguments and expect `index.md`. Make it required and update the callers (T015).
- FR-009: for a site that lists `index` the bytes written must be identical to today. Do not reorder frontmatter or touch page bodies.

### T013 — Authored file at a target path

Before writing anything, for each target path (hub and each current context): if a file exists there and is not a generated page, throw. "Generated" here means T014's conditions 3 and 4 only (right `kind` for the position and exactly the generator's fields); condition 2 excludes the target name and must not be applied, or every second run would throw on the page the first run wrote. Name the file, say that the glossary generator writes this path, and that the author must move or remove it. Nothing is written or removed when this fires.

### T014 — Guarded prune

After a successful write, remove a file only when **all** of these hold:

1. Its path is exactly `glossary/<name>.md` or `glossary/<slug>/<name>.md` where `<slug>` is a current context slug.
2. `<name>` is one of the site's normalised index names or `index`, and is not the chosen target name. Compare names case-insensitively, and skip the file entirely if it is the same file as the one just written on a case-insensitive file system (compare real paths), or the fresh page is deleted.
3. Its frontmatter `kind` is `Hub` at the glossary root, or `Glossary` in a context folder.
4. Its frontmatter key set is exactly the generator's key set for that position (listed above). An authored page that adds any field is not a match.

Anything that matches 1 to 3 but not 4 is kept, with one warning that names the file and says why. Do not remove folders of contexts that no longer exist; that is out of scope. Use the existing frontmatter parser in the repo, not a new regex.

### T015 — Callers and pins

- Direct callers to update for the new parameter: `glossary-generate.test.ts` (11 path pins; pass `['README','index']`, the example's setting, so they keep expecting `index.md` and prove FR-009), `glossary-codegen-guard.test.ts:70-101`, `link-integrity.test.ts:194-195`. Mocks that destructure two arguments: `glossary-config.test.ts:52,193` (owned here); `deck-guard.test.ts`, `markua-attributes.test.ts`, `glossary-substrate-parity.test.ts` mock the module, so check whether they need any change and make only the minimal one (named out-of-map edits if so).
- New tests, one each: stop on an authored file at a target (tree unchanged afterwards); stale generated `index.md` removed on a `README` site; a hub-like page with an extra field kept with a warning. Add them to `glossary-generate.test.ts`. In the last one also place an authored page of another `kind` in a context folder and assert it is untouched (scenario 5).
- In `glossary-config.test.ts`, assert the mocked generator receives the site's configured `indexBasename` (the only proof of the `config.ts` pass-through; the default-setting fixtures cannot catch a dropped argument).
- `glossary-codegen-guard.test.ts:79` must stay green without weakening.

## Definition of done

- On a default-index-name site the generated glossary files map to routes `glossary` and `glossary/<slug>`.
- On a site listing `index`, output is byte-identical to before (the existing pins prove it).
- No file under `example/docs/glossary/` is added, renamed or removed (NFR-002). `git status` under `example/` is clean.
- `glossary-generate`, `glossary-codegen-guard`, `glossary-config`, `link-integrity` tests green.

## Risks and reviewer guidance

- The risk in this package is deleting an authored page. Reviewer: try to construct an authored page that the prune would remove (hub with the generator's exact four fields is, by rule, indistinguishable and is accepted as the bound; anything else must survive).
- Reviewer: confirm T013 runs before any write.
- `glossaryTermUrl` is not changed; it becomes correct once the files collapse.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP03 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
