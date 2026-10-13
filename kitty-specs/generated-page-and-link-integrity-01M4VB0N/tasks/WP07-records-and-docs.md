---
work_package_id: WP07
title: Decision record, adopter documentation and changelog
dependencies:
- WP02
- WP03
- WP04
- WP05
requirement_refs:
- FR-018
- FR-019
- C-001
- C-006
planning_base_branch: fix/generated-page-and-link-integrity
merge_target_branch: fix/generated-page-and-link-integrity
branch_strategy: Planning artifacts for this mission were generated on fix/generated-page-and-link-integrity. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/generated-page-and-link-integrity unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-generated-page-and-link-integrity-01M4VB0N
base_commit: 402d64c2faaef1ba78fcd1078b29fb4d5dbccafc
created_at: '2026-10-13T20:46:37.407238+00:00'
subtasks:
- T030
- T031
- T032
- T033
- T034
history: []
agent_profile: architect-alphonso
authoritative_surface: docs/
create_intent:
- docs/adr/0047-relative-markdown-links.md
- docs/adr/0048-generated-page-names-and-empty-sources.md
execution_mode: code_change
owned_files:
- docs/adr/0047-relative-markdown-links.md
- docs/adr/0048-generated-page-names-and-empty-sources.md
- docs/adr/README.md
- docs/architecture/gherkin-pages.md
- docs/architecture/glossary.md
- docs/guides/consumer-setup.md
- CHANGELOG.md
role: implementer
tags: []
tracker_refs: []
---
# WP07 — Decision record, adopter documentation and changelog

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`architect-alphonso`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Record the decision that reverses part of ADR-0037, and bring the adopter guide, the architecture pages and the changelog in line with what WP02 to WP05 shipped.

Requirements: FR-018, FR-019, C-001, C-006. Plan: IC-07.

Depends on WP02 to WP05: read their merged code and hand-offs first and document what was built, not what was planned. If the #131 work was cut (C-005), skip T030 (ADR-0048 then takes the number 0047) and the link and source-check parts of T032 and T033.

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

## Writing rules for this package

The charter's documentation policy applies: write for the reader named below, one idea per sentence, sentence-case headings, plain words, active voice. Avoid em-dash chains, rule-of-three padding, hedging and puffery. Lead with what changes for the reader. Every page keeps valid frontmatter (`title`, `description`, `doc_status`, `updated`, `type`, `kind`); bump `updated` on a page you change (but see T031 for ADRs).

## Subtasks

### T030 — ADR-0047 (new: `docs/adr/0047-relative-markdown-links.md`)

Reader: a maintainer deciding how links work, and an adopter wondering which link form to write.

- House format (read ADR-0046 and ADR-0037): frontmatter `title` (quoted), `description`, `doc_status: active`, `updated`, `type: ADR`, `kind: ADR`, `authors`, `related`; then H1, Status, Context, Decision, Consequences (Positive / Negative / Risks), Alternatives considered, References.
- It **amends** ADR-0037; follow the amending precedent of ADR-0038 (`:21-25`), which leaves ADR-0030 intact. State exactly which parts of ADR-0037 it amends: Decision 1 (`:69-78`, authored links are root-absolute routes), the rejection of Option A (`:195-200`), and the `check-links` paragraph (`:130-140`). State what stands: the base seam and the built-link gate's authority.
- Context to give: ADR-0037 rejected `.md`-relative authoring because Astro does not rewrite such links. That evidence still holds. It never weighed the toolkit doing the rewrite. Adoption showed the cost: 61 links rewritten by hand in the first consumer, and root-absolute routes do not work when the file is read on GitHub.
- Decision to record: both forms are accepted. The resolution rule (relative to the source file; `.md`/`.mdx` only; index names collapse; fragment and query kept; unresolvable links left as written so the built gate reports them). One rule shared by the build and the source check. Raw HTML anchors are not rewritten. The agent page API returns links as written.
- Consequences to record honestly, including: the source check now reports links it used to pass; a rename shows in the dev server only after a restart; `.mdx` coverage is by one test on a hand-built file, so the inheritance of the plugin list by `.mdx` pages is confirmed by reading the framework, not by a build.
- **Do not edit ADR-0037** (C-001). Not even a back-pointer.

### T031 — ADR-0048 and architecture pages

The charter says an accepted ADR is immutable; a change is a new or superseding ADR. Some older ADRs carry `## Update` notes, but that practice contradicts the charter and is not to be extended. **Do not edit ADR-0046 or ADR-0026.**

- New `docs/adr/0048-generated-page-names-and-empty-sources.md`, same house format and amending style as T030. It amends two statements: ADR-0026 (`:76-77`, glossary pages are written as `index.md`) and ADR-0046 (near `:116` and `:136`, the generator prunes pages it owns when sources yield none). Record: the glossary file-name rule (`index` when the site lists it, otherwise the first index name) and why it differs from the Gherkin hub's rule; the stop on an authored file at a target path; the guarded prune and why there is no ownership stamp on glossary pages; the stop on empty Gherkin sources with owned pages, the opt-out, and what stays unchanged (first run, partly empty set, check mode). Alternatives considered: warn only; fail in check mode only; an ownership stamp on glossary pages; always the first index name.
- `docs/architecture/gherkin-pages.md`: validation list `:93-99`, generation step 4 `:173-174`, flags `:313-315`, Limits `:370-383`. Describe the stop, the opt-out, and that `--check` is unchanged.
- `docs/architecture/glossary.md:86-88`: the file-name rule, the stop on an authored file at a target path, and the guarded prune (what is removed, what is kept with a warning).

### T032 — Consumer-setup guide (`docs/guides/consumer-setup.md`)

Reader: an adopter setting up or upgrading a site.

- Gherkin option table `:581-586` and behaviour bullets `:588-595`: add `allowEmpty`; say what the failure looks like and why it exists (an uninitialised submodule), and advise removing the setting once the pages are gone. CLI section `:611-634`: `--allow-empty`. The "turn it off" line `:634` stays accurate.
- `indexBasename` section `:170-181`: generated glossary pages follow the setting; no need to list `index` any more.
- Gates section `:466-481` and the caveat `:638-649`: replace the caveat that says the source check is not strict for a consumer tree. Describe both link forms, say that relative Markdown links are rewritten at build and work on GitHub, and document `--strict` and `--index-basename`. Say that index names are now given in three places (site config, content config, and this flag) and must agree, and that the command assumes `README,index` when the flag is absent. Say that a relative link to a file outside the docs tree is accepted without `--strict` and reported with it.
- Add an "Upgrading from 0.2.0" note: links already rewritten as site routes keep working and need no change; the source check may now report a relative link to a file that is not a page; a site that relied on empty sources pruning pages must set `allowEmpty`.
- Gate: `tests/consumption/scripts/assert-guide-no-internal-paths.mjs` forbids `src/scripts/` and `../src|lib|scripts` in the guide. Use the command names (`dockitty-check-links`, `dockitty-generate-feature-pages`).

### T033 — Changelog (`CHANGELOG.md`, `[Unreleased]`)

Match the existing entry style exactly: a bold lead sentence stating what changes for the adopter with the issue reference, then a short before-and-after. Keep any entries already under `[Unreleased]`.

- **Breaking**: the build stops on empty Gherkin sources when generated pages exist (#122), with the opt-out; the source link check now reports a relative Markdown link that does not lead to a published page (#131).
- **Added**: relative Markdown links between pages are rewritten to routes at build (#131); `gherkin.allowEmpty` / `--allow-empty`; `--strict` and `--index-basename` on the source check.
- **Fixed**: glossary pages are section indexes on the default index name, so the hub is at `/glossary/` and term links resolve (#129); stale generated glossary pages are removed on upgrade.
- Say the release is 0.3.0 because of the Breaking entries, in the same way 0.2.0's entry explains its number. Do not cut the release or change any version field.

### T034 — Index and gates

- `docs/adr/README.md` is generated and gated (`validate:adr-index`). Check that 0047 and 0048 are still free numbers when you start. Regenerate the index once, after T030 and T031: `node src/scripts/generate-adr-index.mjs`. Commit the result. Do not hand-edit it.
- Run what can run without a build, from the repository root, and include the output: `node src/scripts/validate-frontmatter.mjs` as the root `validate:docs` script invokes it (read `package.json` for the exact arguments; run the `node …` command directly, not through `pnpm`), `node src/scripts/check-links.mjs docs example/docs`, and the ADR index check. markdownlint and Vale run in CI.
- Root `docs/` is not built into the example site, so no example page count changes.

## Definition of done

- ADR-0047 and ADR-0048 exist in house format and name what they amend; no existing ADR file has a diff.
- Guide, two architecture pages and the changelog match the shipped behaviour.
- `docs/adr/README.md` regenerated; frontmatter validation and the source link check pass on `docs`.

## Risks and reviewer guidance

- Reviewer: `git diff main --stat -- docs/adr/` must show only the two new files and `README.md`.
- Reviewer: read the guide's new sections as an adopter who has not seen the code. Is each new failure explained with the way out?
- Reviewer: check every behaviour claim against the merged code of WP02 to WP05, not against the plan.

## Branch strategy

Planning artifacts were generated on `fix/generated-page-and-link-integrity`, which is also the merge target for this work package. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base branch by hand. Start with:

```bash
spec-kitty agent action implement WP07 --agent <name> --mission generated-page-and-link-integrity-01M4VB0N
```
