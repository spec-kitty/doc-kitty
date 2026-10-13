---
work_package_id: WP06
title: Consumer proof on the default index name with both link forms
dependencies:
- WP03
- WP04
- WP05
requirement_refs:
- FR-020
- SC-002
- SC-003
- SC-004
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 09202ecadfd8653010115b26ac7756979815916a
created_at: '2026-10-13T20:46:12.009339+00:00'
subtasks:
- T026
- T027
- T028
- T029
history: []
agent_profile: implementer-ivan
authoritative_surface: tests/consumption/
create_intent: []
execution_mode: code_change
owned_files:
- tests/consumption/**
role: implementer
tags: []
tracker_refs: []
---
# WP06 — Consumer proof on the default index name with both link forms

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Prove the three fixes the way an adopter meets them: a small site built from the packaged toolkit, on the default index name, with the glossary on and pages linked in both forms.

Requirements: FR-020; success criteria SC-002, SC-003, SC-004. Plan: IC-06. Research: R9.

Depends on WP03, WP04 and WP05. If the #131 work is cut (C-005), only T026 and the glossary half of T028 apply.

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

**You cannot run this proof locally.** It installs a packed tarball and builds a site. CI's Consumption test workflow is the verifier, on the draft PR. Make the change so that it is reviewable by reading, and say plainly in the hand-off that it has not been run.

## State today

- `tests/consumption/consumer-fixture/astro.config.mjs:35-37` and `src/content.config.ts:20` set `indexBasename: ['README','index']`. Base is `/consumer-fixture`.
- Authored index files named `index.md`: `docs/rhetoric/index.md` and `docs/rhetoric/book-one/index.md`.
- The glossary is on (`.contextive/definitions.yaml`); `docs/glossary/` is gitignored (`.gitignore:18`). A stale local `docs/glossary/**/index.md` may exist on disk from earlier runs; it is not tracked. Do not commit it.
- Every cross-page link in the fixture is root-absolute, so nothing exercises the rewrite.
- `scripts/run-consumption-test.mjs:408-412` runs the checks; `:414,418` call the source check with `[DOCS_DIR]` only; `:439` runs the built-link gate with drafts off.
- `scripts/assert-consumer-surfaces.mjs:243` pins `/rhetoric/book-one/`. No script names an index file. `url-baseline.txt` lists URLs.

## Subtasks

### T026 — Default index name

- Remove the `indexBasename` setting from `astro.config.mjs` and `src/content.config.ts` (so the default `README` applies in both places).
- `git mv` `docs/rhetoric/index.md` → `docs/rhetoric/README.md` and `docs/rhetoric/book-one/index.md` → `docs/rhetoric/book-one/README.md`. Grep the fixture and `scripts/` for any reference to the old paths.
- Routes must not change: `url-baseline.txt` and the fixture lockfile stay byte-identical. If either would change, stop and report.

### T027 — Both link forms

Add links inside existing pages (do not add pages; that would move the URL baseline). Suggested: in `docs/guides/getting-started.md`, an inline link to a section index (`./README.md` or `../rhetoric/README.md`) and a reference-style link to a leaf page with a fragment (`../rhetoric/book-one/chapter-01.md#…`; use a heading that exists). Keep at least one existing root-absolute link so both forms are present.

Do **not** add a link to `draft-note.md` or to a non-page file: by design the rewrite leaves those as written and the drafts-off built-link gate at `:439` would fail. Those cases are covered by unit tests in WP04 and WP05.

### T028 — Assertions

In the existing assertion script that already reads built HTML (prefer `assert-consumer-surfaces.mjs`; do not add a new script):

- `/consumer-fixture/glossary/` exists as a page and links to each context; one term link in a built page targets `/consumer-fixture/glossary/<ctx>/` and that page exists (SC-002).
- The two links from T027 appear in the built page as `href="/consumer-fixture/…/"` with the fragment kept (SC-003).
- Fail with a message that names the page and the href found.

### T029 — Source check flags

`scripts/run-consumption-test.mjs:414,418`: pass `--strict --index-basename README`. With that, the source check and the built-link gate should agree on the fixture (SC-004); the run already executes both. The same script passes `--index-basename README,index` to the frontmatter validator at `:408-412`; change it to `README` to match the fixture.

## Definition of done

- Fixture on the default index name; two index files renamed; both link forms present.
- Assertions for the glossary routes and the rewritten hrefs added to an existing script.
- `url-baseline.txt` and the lockfile unchanged (`git diff --stat` shows neither).
- Hand-off states the proof was not run locally and lists what CI must show.

## Risks and reviewer guidance

- Reviewer: this package can only be verified by CI. Check the diff for a tracked file under `docs/glossary/` (must be none) and for any lockfile or baseline change (must be none).
- Accepted cost: the packaged proof no longer exercises a site with several index names; the example site does.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP06 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
