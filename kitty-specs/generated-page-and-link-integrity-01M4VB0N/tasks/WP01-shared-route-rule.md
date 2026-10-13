---
work_package_id: WP01
title: Shared route rule and one docs walk
dependencies: []
requirement_refs:
- FR-010
- NFR-001
- NFR-004
- C-002
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 80954e6a48fda6843a56e7f2970ca7994c00ae81
created_at: '2026-10-13T19:49:17.082698+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history: []
agent_profile: implementer-ivan
authoritative_surface: src/lib/
create_intent:
- src/lib/docs-walk.mjs
- src/tests/route-table.test.ts
execution_mode: code_change
owned_files:
- src/lib/vocabulary-core.mjs
- src/lib/docs-walk.mjs
- src/lib/metadata.ts
- src/lib/draft-publication.mjs
- src/lib/schema.ts
- src/lib/config.ts
- src/scripts/validate-frontmatter.mjs
- src/tests/route-table.test.ts
- src/tests/section-type-parity.test.ts
- src/tests/metadata.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP01 — Shared route rule and one docs walk

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Give the toolkit one pure rule that turns a docs file into its published route, and one walk of the docs tree behind it. Every later work package in this mission calls what you build here. Output for the example site and the consumer fixture must not change.

Requirements: FR-010, NFR-001, NFR-004, C-002. Plan: IC-01. Research: R1.

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

## Why this is needed

The file-to-route rule exists in several copies that disagree:

| Site | What it does | Collision-aware |
|---|---|---|
| `src/lib/metadata.ts:382,397` | private twin of `normalizeIndexBasenames` / `indexBasenamePattern` in `vocabulary-core.mjs:759,783` | n/a |
| `src/lib/metadata.ts:420` `readmeToIndexId` | entry path → slug | no |
| `src/lib/metadata.ts:458` `resolveIndexEntries` | path list → `{ ids, collisions }`; the loader's rule (`schema.ts:344`) | **yes** (canonical) |
| `src/lib/vocabulary-core.mjs:854` `detectIndexCollisions` | copy of the grouping loop above; used by `validate-frontmatter.mjs:627` | yes |
| `src/lib/draft-publication.mjs:307-310` inline in `draftRoutesOf` | draft file → route | **no** |
| `src/lib/config.ts:1425,1432` `directoryMetaInputs` | `isIndex` by slug comparison | **no** |
| `src/lib/gherkin/generate.mjs:135-152` `indexBasenames` / `hubBasename` | first index name | n/a |

"Collision" means a folder that holds two index-named files (for example `README.md` and `index.md`): the loader publishes one as the folder index and demotes the other to an ordinary page. The non-aware copies give both the folder route. Neither the example nor the consumer fixture has such a folder, which is why nothing is visibly wrong there.

The tree is also walked three ways: `walkMarkdownPaths` (`schema.ts:277-287`, private; skips `log.md`), `draftRoutesOf` (`draft-publication.mjs:286`), and `directoryMetaInputs` (`config.ts:1399`; also skips dot-folders and `_meta`).

## Subtasks

### T001 — Move the canonical rule

- Move `readmeToIndexId` and `resolveIndexEntries` verbatim into `src/lib/vocabulary-core.mjs`, JSDoc-typed, beside `normalizeIndexBasenames` and `isIndexPath`.
- `src/lib/metadata.ts` must keep exporting `readmeToIndexId`, `resolveIndexEntries`, `DEFAULT_INDEX_BASENAME` and the types `IndexBasenameOption(s)`, `IndexCollision`, `ResolveIndexEntriesResult`. `src/index.ts:26` does `export * from './lib/metadata.js'`, so these are public package surface; `schema.ts:42` re-exports `readmeToIndexId`; `index-basename.test.ts`, `section-type-parity.test.ts` and `metadata.test.ts` import by name.
- Delete the private `normalizeIndexBasenames` / `indexBasenamePattern` twin in `metadata.ts` and use the core ones. `indexBasenamePattern` (`vocabulary-core.mjs:783`) is not exported today; export it if `metadata.ts` still needs it after the move.
- Validation: `tsc` clean for the touched files; `metadata.test.ts` and `index-basename.test.ts` green unchanged.

### T002 — New pure functions (in `vocabulary-core.mjs`, fs-free)

```
routeOfSlug(slug) -> string                       // '' -> '/', else '/' + slug + '/'
generatedIndexBasename(indexBasename, { prefer }) -> string
buildRouteTable(paths, { indexBasename, unpublishedPaths }) -> { routes, collisions }
resolveRelativeDocLink(routes, sourcePath, href) -> string | null
```

- `generatedIndexBasename`: with no `prefer`, the first normalised index name. With `prefer: 'index'`, `index` when the normalised list contains it (compare case-insensitively), otherwise the first. Gherkin uses the first form, the glossary (WP03) the second. They differ on purpose: the example's glossary pages are committed as `index.md`.
- `buildRouteTable`: `paths` are docs-relative POSIX paths from the shared walk. Use `resolveIndexEntries` for ids, `routeOfSlug` for routes. Resolve ids over **all** paths first, then drop every path in `unpublishedPaths` (draft **file paths**, not routes); the order matters when a draft is one of two index files in a folder. `routes` is a plain object (`Record<string,string>`), keys inserted in code-unit sorted order (`compareCodeUnit` already lives in this file). No `Map`, `Set` or function may appear in the result: WP04 passes it through Astro's config digest, which serialises a `Map` as `{}`.
- `resolveRelativeDocLink`: returns `null` unless the href is relative (no scheme, not starting with `/` or `#`), its path part ends in `.md` or `.mdx`, the resolved target stays inside the docs root, and the target is a key of `routes`. Split off `?query` and `#fragment` first and append them unchanged to the route. URL-decode the path before lookup; lookup is case-sensitive. Resolve against the **directory of `sourcePath`** (never against a route). Encode each segment of the returned route with `encodeURI` semantics, because loader ids are verbatim paths and can hold spaces or capitals.
- See `data-model.md` for the invariants.

### T003 — One walk

- Hoist `walkMarkdownPaths` from `schema.ts` into a new `src/lib/docs-walk.mjs` (uses `node:fs`; keep `vocabulary-core.mjs` fs-free). Same behaviour as today: every `.md`/`.mdx`, skipping `log.md`. `schema.ts` imports it.
- This is the walk behind every route table. Do not change what `directoryMetaInputs` skips for its own sidebar purpose; only stop it deriving `isIndex` on its own (T004).

### T004 — Converge the copies

- `draftRoutesOf` (`draft-publication.mjs:286-313`): compute routes through `buildRouteTable` / `resolveIndexEntries` so it is collision-aware. It uses the shared walk and a table built with no `unpublishedPaths` (it needs the drafts' own routes). Its callers (`config.ts:267`, `check-redirect-coverage.mjs:418`, `assert-build-artifacts.mjs:1700`) must see the same result for the example.
- Export `unpublishedDraftPaths` from `draft-publication.mjs` for WP04 and WP05: it takes the docs root and the resolved publish setting (reuse whatever `draftRoutesOf` takes to decide what a draft is), and returns the docs-relative POSIX file paths of draft pages, or `[]` when drafts are published. Put its final signature in your hand-off; WP04 and WP05 call it by this name.
- `directoryMetaInputs` (`config.ts:1425,1432`): take `isIndex` from the shared rule.
- `detectIndexCollisions` (`vocabulary-core.mjs:854`): return `resolveIndexEntries(...).collisions`; keep the export and its shape for `validate-frontmatter.mjs:627`.
- Gherkin `hubBasename` (`src/lib/gherkin/generate.mjs:135-152`): call `generatedIndexBasename`. This file is owned by WP02; this is the one named out-of-map edit for this work package. Keep the `hubBasename` export, `gherkin-generate.test.ts` uses it.
- Leave these alone, they are a different concern or deferred: `glossaryTermUrl` (`glossary/resolve.ts:33`), `docsRootFromSignal` (`routes/shared.ts:46`), the slug-to-route joiners in `routes/rss.ts`, `routes/llms-txt.ts`, `layouts/Hub.astro`, `route-shaping.ts`, and `scripts/check-links.mjs` (WP05).

### T005 — Tests

- New `src/tests/route-table.test.ts`, small and behaviour-level:
  - agreement: for index names `undefined`, `'index'`, `['README','index']`, `['index','README']`, and a temp tree that includes one folder with both `README.md` and `index.md` **where one of the two is a draft**, the loader's ids (`resolveIndexEntries`), `buildRouteTable` routes, `draftRoutesOf` and the `isIndex` answer of `directoryMetaInputs` agree for every file. The draft in the collision folder is what makes this red before T004; without it the test proves nothing.
  - `generatedIndexBasename`: one small table over the same four settings, with and without `prefer: 'index'`, plus one row with `Index` in the list (case-insensitive match).
  - `resolveRelativeDocLink`: one table-driven case list covering leaf vs index source page, `README.md` target → section route, root README → `/`, fragment and query kept, encoded path, target outside root, non-page target, unpublished draft target, bare extensionless href, root-absolute href, external href.
  - `buildRouteTable` output is plain JSON with sorted keys (`JSON.parse(JSON.stringify(x))` deep-equals `x`; keys equal their sorted copy).
- `section-type-parity.test.ts:184-240` compares `metadata.ts` against the core as a two-arm guard. After T001 both arms are one implementation. Keep its literal expectations, remove the claim and the duplicated arm.
- Do not add tests for the moved functions beyond what exists.

## Definition of done

- One implementation of the index/route rule in `vocabulary-core.mjs`; no private twin left in `metadata.ts`; `draftRoutesOf`, `directoryMetaInputs`, `detectIndexCollisions` and `hubBasename` call it.
- `route-table.test.ts`, `metadata.test.ts`, `index-basename.test.ts`, `section-type-parity.test.ts`, `draft-publication.test.ts`, `gherkin-generate.test.ts` green.
- Typecheck clean (`cd src && ./node_modules/.bin/tsc --noEmit -p .` if a tsconfig is present there; otherwise report how you checked).
- No change to any file under `example/` or `tests/consumption/`.

## Risks and reviewer guidance

- Reviewer: check that `metadata.ts` still exports every name listed in T001, and that `buildRouteTable` cannot return a non-JSON value.
- Reviewer: revert T004's `draftRoutesOf` change and confirm the agreement test goes red.
- Output changes are allowed only for a folder with two index-named files and for a site that does not list `index`.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP01 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
