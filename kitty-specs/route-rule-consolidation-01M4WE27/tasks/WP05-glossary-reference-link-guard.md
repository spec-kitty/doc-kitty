---
work_package_id: WP05
title: Glossary autolinker skips reference-style link text
dependencies: []
requirement_refs:
- FR-011
- SC-004
- C-005
planning_base_branch: fix/route-rule-consolidation
merge_target_branch: fix/route-rule-consolidation
branch_strategy: Planning artifacts for this mission were generated on fix/route-rule-consolidation. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/route-rule-consolidation unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-route-rule-consolidation-01M4WE27
base_commit: 840de26a6f4004d83f0b9fdbea8b2434940d0e40
created_at: '2026-10-14T06:31:44.082690+00:00'
subtasks:
- T024
- T025
- T026
agent: claude
history:
- timestamp: '2026-10-14T06:16:49Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/remark/glossary-autolink.internal.ts
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/remark/glossary-autolink.internal.ts
- src/tests/glossary-autolink.test.ts
role: implementer
---
# WP05 — Glossary autolinker skips reference-style link text

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

A glossary term inside a reference-style link (`[term][ref]`, `[term][]`, `[term]`) or a link definition is left alone, as the autolinker already does for inline links. Pages never contain a link inside a link. The same term in plain text on the same page is still autolinked.

Requirements: FR-011, SC-004 (spec User Story 5, scenarios 1 and 2). Plan: IC-05. Operator decision 1: this work package has no dependency on the routing work and can run at any time.

## Why this is broken today

`src/lib/remark/glossary-autolink.internal.ts:70-78` `isGuardType` blocks `code`, `inlineCode`, `heading`, `link`, `dkMermaid`. mdast represents `[term][ref]` as a `linkReference` node (and `[ref]: url` as a `definition` node), neither of which is guarded, so `linkifyNode` (`:244`) descends into the reference's children and wraps the term in a second link (issue 139).

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

This work package touches no shared file and needs no out-of-map edit. It does not call `defineDocKittyIntegrations`.

## Subtasks

### T024 — Red first through the real Markdown processor

**Purpose**: show the nested link today, with a positive control on the same fixture.

**Steps**: in `src/tests/glossary-autolink.test.ts`, find how existing cases run the plugin (through the remark pipeline with a glossary fixture; reuse that helper). Add one fixture page:

```md
See [the term][ref] for details.

The term appears here in plain text.

[ref]: https://example.com/
```

(Use a real term from the test's glossary fixture in place of "the term".) Assert:

1. Inside the `linkReference` (or in the rendered HTML, inside the author's `<a>`), there is no glossary link: exactly one link wraps that text.
2. The plain-text occurrence in the next paragraph is autolinked (positive control on the same fixture).
3. Also the collapsed (`[term][]`) and shortcut (`[term]`) forms, each with its definition, in a parameterised case.

**Validation**: assertion 1 red today, assertion 2 green today. Keep the red output. Planning checked `example/docs/glossary-demo/*.md` for `[term][ref]` forms and found none, so no example output, glossary-build test or a11y baseline moves; re-run `grep -n '\]\[' example/docs/glossary-demo/*.md` and state the result in the hand-off.

**Edge cases**: the shortcut form `[term]` only becomes a `linkReference` when a matching definition exists; without one it is plain text and is autolinked, which is correct. Add that as a second positive control if cheap.

### T025 — Guard `linkReference` and `definition`

**Steps**: add `type === 'linkReference' || type === 'definition'` to `isGuardType`, with a one-line comment: reference links are links, and a link inside a link is invalid HTML and fails accessibility (FR-011, issue 139).

**Validation**: T024 green.

### T026 — First-per-section behaviour matches the inline-link case

**Purpose**: plan IC-05 risk.

**Steps**: the autolinker links only the first occurrence of a term per section. Check what happens today when the first occurrence is inside an inline link `[term](url)`: does a skipped occurrence consume the section's "first" slot? Write the answer down. Then make the reference-link case behave the same way (it will, if the guard is the only change, because guarded subtrees go through the same `blocked` path). Add one assertion that pins this shared behaviour for both link forms on one fixture (first occurrence in a link, second in plain text, same section), so the two forms cannot diverge.

**Validation**: inline-link and reference-link cases give the same result; revert T025 and watch the reference case fail.

## Test strategy

Strengthened only: `glossary-autolink.test.ts`. Every refusal (no nested link) is paired with the plain-text autolink on the same fixture. No snapshot of the HTML; assert link counts and the presence of the glossary link class/attribute the existing tests already use.

## Definition of Done

- `[term][ref]`, `[term][]`, `[term]` and definitions never receive a glossary link; plain text still does.
- Reference and inline links share first-per-section behaviour, pinned by one assertion.
- `glossary-autolink.test.ts` and any other `glossary-*.test.ts` you can run without a build are green; `tsc --noEmit` clean.
- Hand-off: tests table; the answer to the T026 question.

## Risks

- Very small change; the risk is a silently changed "first" count. T026 covers it.

## Reviewer guidance

- The change is the guard list plus tests; anything larger needs a reason.
- The positive control runs on the same fixture as the refusal.

## Branch Strategy

Planning base branch and merge target: `fix/route-rule-consolidation`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP05 --agent <name> --mission route-rule-consolidation-01M4WE27
```
