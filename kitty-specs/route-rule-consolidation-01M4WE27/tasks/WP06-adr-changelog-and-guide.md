---
work_package_id: WP06
title: ADR-0050, changelog and consumer guide
dependencies:
- WP01
- WP02
- WP03
- WP04
- WP05
requirement_refs:
- FR-012
- SC-005
- C-002
- C-003
- C-006
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: 1622f7e8fb6de858f5eee0e8e928e0f1b6a2f535
created_at: '2026-10-14T07:17:55.076548+00:00'
subtasks:
- T027
- T028
- T029
- T030
- T031
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/adr/0050-route-collisions-and-single-index-setting.md
create_intent:
- docs/adr/0050-route-collisions-and-single-index-setting.md
execution_mode: code_change
model: sonnet
owned_files:
- docs/adr/0050-route-collisions-and-single-index-setting.md
- docs/adr/README.md
- CHANGELOG.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
- docs/guides/migrating-to-charter.md
- docs/guides/draft-publication.md
- docs/architecture/glossary.md
- docs/architecture/gherkin-pages.md
role: implementer
---
# WP06 — ADR-0050, changelog and consumer guide

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`curator-carla`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Record the mission's decisions in a new ADR, and give adopters one upgrade pass to 0.3.0: changelog entries that say what they will see and what to do, and a consumer guide that shows the one place to set index names.

Requirements: FR-012, SC-005, C-002, C-003, C-006. Plan: IC-06. Write from the **merged behaviour** of WP01 to WP05 (read their hand-offs and the code on `fix/route-rule-consolidation`), not from the plan alone; where they differ, the code wins and you note it.

**Execution mode**: `CHANGELOG.md` is at the repository root, so this is a `code_change` work package even though it is documentation only.

**Communications review (C-006)**: you draft the changelog entries; `comms-cleo` reviews and rewrites them to lead with what the user sees, without internal jargon, before the PR is marked ready. Leave the entries in a state that makes that easy: one entry per change, plain sentences, no requirement ids or issue-only references in the lead sentence. Say in the hand-off that the comms-cleo pass is still due.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/route-rule-consolidation-01M4WE27/spec.md`, `plan.md` (your concern under "Implementation Concern Map"), `research.md` (spikes S1 to S4), `data-model.md`, `contracts/index-basename-config.md`, `contracts/check-links-index-names.md`, `contracts/collision-error.md`, `quickstart.md`. Operator decisions: `decisions/DM-*.md` (`_meta` excluded everywhere; flag comparison is order-insensitive; case-only route collisions fail).
- **Stack**: Node 24 in CI (package supports Node >= 20), TypeScript 5.9.3 and JSDoc-typed `.mjs`, Astro 5.18.2, Starlight 0.32.6, Vite 6.4.3 through Astro. Do not add, upgrade or remove a dependency (DIRECTIVE_051). If you believe one is needed, stop and report.
- **The shared route rule is the only authority (C-001).** Routes come from `routeOfSlug` / `buildRouteTable` / `resolveIndexEntries` in `src/lib/vocabulary-core.mjs`. Do not add a second rule anywhere.
- **Accepted ADRs are not edited (C-002).** Decisions go into the new ADR-0050 (WP06).

### Environment and tooling gotchas

- You work in a lane worktree that starts with no `node_modules`. Run `pnpm install --offline --frozen-lockfile` once at the worktree root. Never run `pnpm install` or `pnpm exec` in the main checkout: `pnpm exec` has install side effects. Run binaries directly.
- If `git status` shows mode-only changes under `src/scripts/` after installing, revert them with `git checkout -- src/scripts`.
- Run vitest from `src/` (where `vitest.config.ts` and `vitest.workspace.ts` live), one file at a time: `cd src && ./node_modules/.bin/vitest run tests/<file>.test.ts`. Typecheck: `cd src && ./node_modules/.bin/tsc --noEmit -p .` (`.mjs` is not type-checked; rely on tests for it).
- Build-level suites (`*-build-html.test.ts`) build the example site and need a PlantUML service locally; if one is not available, say so in the hand-off and leave them to CI rather than skipping them silently.
- Any test that calls `defineDocKittyIntegrations` now writes `process.env.DK_INDEX_BASENAME` (after WP01). Save the original value and restore it in `afterEach` (delete it if it was unset), as `src/tests/docs-root-cross-surface.test.ts:42-46` does for `DK_DOCS_ROOT`. The suite runs with `fileParallelism: false`, so a leaked value poisons the next file.
- Example-pin tests break when example output changes. Before you call a red pin a regression, read whether your change was meant to move it.
- In Markdown you write (comments in docs, ADR, changelog): never start a line with `#` followed by a number (markdownlint MD018 reads it as a heading). Write "issue 135" or put the reference mid-line.

### Test economy (read before writing any test)

DIRECTIVE_041 and the KEEP / RETIRE / SPLIT rubric (`development-assist-test-cleanup`) apply. Constraint C-005.

1. **Red first, through an existing entry point** (`buildRouteTable`, `docKittyDocsLoader`, `defineDocKittyIntegrations`, the `check-links` CLI, `generateFeaturePages`, the remark plugin, the route modules). Show the failing assertion before the fix; put the command and its output in the hand-off.
2. **Strengthen an existing test file before creating a new one.** A new file only where this prompt lists it in `create_intent`.
3. **Every refusal assertion has a positive control on the same fixture** (tactic `acceptance-criteria-non-vacuity`): the error case and the passing case differ by one file or one flag, so the test cannot pass because the fixture is broken.
4. **No shape pins.** Assert behaviour (route, exit code, the named paths in a message), not object layout or full message text. Assert the message names the files and the fix; do not snapshot it.
5. **Each new or changed test must fail when its fix is reverted.** Revert locally, watch it fail, restore.
6. A test that pins today's behaviour which this mission deliberately changes is **rewritten on purpose**, with a one-line comment naming the requirement that moved it. Never delete such a test silently; if you retire one, say why in the hand-off (RETIRE: duplicate of X / SPLIT: two behaviours in one).
7. **Hand-off table**: list every test file and case you added, changed or retired, with KEEP / RETIRE / SPLIT and the requirement it guards.

### Out-of-map edits

Stay inside `owned_files`. This prompt names the only allowed edits outside them, each with its reason. Record each one in the hand-off. Work packages WP01, WP02 and WP03 run strictly in sequence, so a named edit to a file another of them owns never races.

### Commits and style

Conventional Commits subjects (`fix(...)`, `feat(...)`, `test(...)`, `docs(...)`). Match the surrounding file; this codebase comments *why* a rule exists and which requirement it serves. If a commit hook fails for a reason unrelated to your change, report it; do not bypass it silently.

Docs-specific gotchas:

- Never start a Markdown line with `#` followed by a number (MD018). Write "issue 135" mid-sentence, or "(issue 135)".
- The ADR index (`docs/adr/README.md`) is **generated**: run `node src/scripts/generate-adr-index.mjs` from the repo root; never hand-edit it.
- ADR frontmatter `description` must be 50 to 180 characters. Copy the frontmatter shape from `docs/adr/0049-openapi-reference-via-existing-integration.md` and `docs/adr/template.md`.
- Accepted ADRs (0047, 0048, 0033, 0018) are **not edited** (C-002). ADR-0050 amends them by reference.
- The generated-indexes doctrine: section indexes are generated from metadata; do not hand-maintain lists.

## Subtasks

### T027 — ADR-0050

**Steps**: create `docs/adr/0050-route-collisions-and-single-index-setting.md`, status accepted, amending ADR-0047 and ADR-0048, referencing ADR-0033 (`indexBasename`) and ADR-0018 (`_meta`). The ADR also records, in its own text, that it supersedes in part ADR-0002 and ADR-0047 (index-name handling); those accepted ADRs are not edited. Sections: context (the three settings, the name-keyed grouping, issues 134 to 139), decision, consequences, alternatives (research S1 to S3 "alternatives considered"). Decisions to record:

1. Collisions are keyed by route, case-insensitively, drafts included; any collision is fatal in the build, the loader and `check-links --strict`; one message format (`contracts/collision-error.md`). No winner or demotion.
2. `index.feature` is rejected on any setting.
3. Index names are set once in `defineDocKittyIntegrations`; published via `DK_INDEX_BASENAME`; the loader reads it lazily; a disagreeing loader value or flag is an error; the flag comparison is order-insensitive and the config's order wins; the check's default is `README`; the check evaluates the site config with Vite `runnerImport`.
4. `_meta` folders at any depth and `_meta.md`/`.mdx` are excluded from the walk, loader, route table, link check and sidebar; catalog YAML unaffected.
5. Every address comes from `routeOfSlug`; a guard test enforces it.
6. Index-name matching stays case-insensitive.

**Validation**: description length 50 to 180; no MD018 lines; links to other ADRs resolve.

### T028 — Regenerate the ADR index

**Steps**: `node src/scripts/generate-adr-index.mjs`; commit the regenerated `docs/adr/README.md`. Do not edit it by hand.

### T029 — CHANGELOG `[Unreleased]`

**Steps**: in the root `CHANGELOG.md`, under the existing `[Unreleased]` "Breaking" section (0.3.0, C-003), add one entry each:

- Two files on one address stop the build and `check-links --strict` (what the message looks like, what to do).
- A `docKittyDocsLoader` `indexBasename` that differs from the integration's stops the build; remove it from the loader.
- A `--index-basename` flag that disagrees with the site config fails the check; the check's default is now `README`, the same as the build.
- Markdown under `_meta/` (or named `_meta.md`) is no longer published.
- A Gherkin `index.feature` is rejected.

Under "Fixed": feeds, `llms.txt`, related links, the Hub, the scenario index and the agent API list a folder's `index.md` at the folder address (issue 134); sidebar label with a draft index next to a published one (issue 138); no nested glossary link in reference-style links (issue 139).

Follow `quickstart.md` "Upgrading from 0.2.x" for the order and the adopter actions. Lead each entry with what the user sees.

### T030 — Consumer guide and architecture pages

**Steps**:

1. `docs/guides/consumer-setup.md`: set index names once in `defineDocKittyIntegrations`; loader without `indexBasename`; run the check with no flag and read its source line; what a collision message looks like. Passages to rewrite: `:170-221`, `:479-485`, `:536-540` (check-links default `README,index`, now `README` or the site config), `:683-696`.
2. `docs/guides/authoring.md:94`, `:134`, `:162`; `docs/guides/migrating-to-charter.md:81`; `docs/guides/draft-publication.md:224` (`--index-basename README,index`): bring each to the single setting. Run `grep -rn "README,index" docs/guides` afterwards: every remaining hit is a site config value, listed in the hand-off.
3. `docs/architecture/glossary.md` and `docs/architecture/gherkin-pages.md` (`:144-148`, `:419-422`): where they describe `indexBasename` in two places or the winner/demote rule, describe the single setting and fatal collisions, and link ADR-0050.
4. Do not edit accepted ADRs (0002, 0047, 0048) or dated `docs/changelog/*.md` entries. Grep `docs/` and `example/docs/` for `index-basename`, `indexBasename`, `demoted`, `wins as the section index` and list any other stale passages in the hand-off (fix those inside your owned files; report the rest).

### T031 — Docs gates

**Steps**: run the docs gates that do not need a build: `node src/scripts/check-links.mjs docs example/docs` (exit 0), the doc-sanity / markdownlint scripts in root `package.json` (run the scripts' binaries directly, not via `pnpm exec`), `adr-referential-integrity.test.ts` (`cd src && ./node_modules/.bin/vitest run tests/adr-referential-integrity.test.ts`).

**Validation**: all green; outputs in the hand-off.

## Test strategy

No new tests. The gates above are the checks. If `adr-referential-integrity.test.ts` or a doc-sanity test fails on the new ADR, fix the ADR, not the test.

## Definition of Done

- ADR-0050 accepted, indexed by the generator, amends 0047/0048 by reference only.
- Changelog Breaking and Fixed entries for every change in this mission, ready for the comms-cleo rewrite.
- Consumer guide and architecture pages describe one setting and fatal collisions.
- Docs gates green.
- Hand-off: list of edited files, gate outputs, "comms-cleo review pending" note.

## Risks

- Writing from the plan instead of the merged code; read the code.
- MD018 on issue numbers; hand-edited ADR index.

## Reviewer guidance

- Accepted ADRs untouched (`git diff --stat docs/adr/` shows only 0050 and README.md).
- Each Breaking entry has a "what to do".

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP06 --agent <name> --mission route-rule-consolidation-01M4WE27
```
