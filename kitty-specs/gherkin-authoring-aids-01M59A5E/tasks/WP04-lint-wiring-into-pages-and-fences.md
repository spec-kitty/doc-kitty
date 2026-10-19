---
work_package_id: WP04
title: Lint wiring into pages and fences
dependencies:
- WP02
- WP03
requirement_refs:
- FR-009
- FR-011
- C-002
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: ab686d92b4427e22f59c124cc40bd36d12b6abf9
created_at: '2026-10-19T08:22:16.688207+00:00'
subtasks:
- T017
- T018
- T019
phase: 'Phase 2 - #196 wiring'
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/remark/gherkin-fence.ts
create_intent:
- src/tests/gherkin-lint-wiring.test.ts
execution_mode: code_change
model: ''
owned_files:
- src/lib/gherkin/render.mjs
- src/lib/remark/gherkin-fence.ts
- src/tests/gherkin-render.test.ts
- src/tests/gherkin-fence.test.ts
- src/tests/gherkin-lint-wiring.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP04 – Lint wiring into pages and fences

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## ⚠️ IMPORTANT: Review Feedback

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_ref` field in the event log (via `spec-kitty agent tasks status`).
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Report progress**: As you address each feedback item, record what you changed with `spec-kitty agent tasks add-history <WPID> --note "..."` (stored in the status event log).

---

## Review Feedback

*[If this WP was returned from review, the reviewer feedback reference appears in the status event log.]*

---

## Markdown Formatting

Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````js`, ````bash`

---

## Objectives & Success Criteria

Connect WP03's `lintSteps` to the two production surfaces chosen in D1:

1. **Generated pages**: `renderFeatureBody` calls it when `opts.lint` is set.
   WP02 already forwards `lint` from `generate.mjs`.
2. **In-page fences**: the fence stage calls it beside `warnDuplicates`, using
   the fence's line offset.

Includes and `gherkin raw` fences stay silent. The lint never changes output
bytes (FR-009).

**Done when** `gherkin-lint-wiring.test.ts` proves each surface through its
production entry point, with positive and negative pairs on shared fixtures, and
the whole suite is green.

## Context & Constraints

- Spec: FR-009, FR-011 and C-002; US2 scenarios 2 and 8.
- Contracts: `contracts/warnings.md` (fence lines are the host page plus the
  offset).
- The existing call sites:
  - `render.mjs:563-601`: `renderFeatureBody` calls `warnDuplicates(view, opts)`
    at the end. It is also called by includes, at
    `gherkin-fence.ts:631: renderFeatureBody(selection.document, { view,
    baseLevel, header, embed: true, inContainer, results })`. That call passes
    **no** `warn` and **no** `lint`, which is why includes stay silent.
  - `gherkin-fence.ts:520-540`: the fence path. It calls `hasMetadataTag(view)`,
    then `warnDuplicates(view, { file: page, warn, lineOffset: line -
    parsed.lineShift })`.
  - Fence options: the `GherkinFenceOptions` type in `gherkin-fence.ts`, built
    in `src/lib/integrations/gherkin.ts:266-276` (`fenceOptions`).
- `gherkin raw` fences never reach the structured path; confirm by reading how
  `raw` is detected, and pin it with a test.
- WP03 API: `compileRules(normalisedOption)` and `lintSteps(view, { rules, file,
  warn, lineOffset, language })`. Compile once per surface: per integration for
  pages, once per plugin instance for fences. Never compile per step.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP04 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T017 – `renderFeatureBody` calls the lint

- **Steps**:
  1. **Red first** in `gherkin-render.test.ts`, as a pair on one fixture:
     - `renderFeatureBody(doc, { file, warn, lint: <normalised true> })` on
       `When I click "Book"` calls `warn` once, with the contract text;
     - the same call without `lint` gives zero lint warnings;
     - the returned Markdown string is identical in both calls.
  2. Implement:
     - If `opts.lint` is set (WP01's normalised object, not `false`), compile
       the rules. Memoise per options object with a `WeakMap`, or accept
       pre-compiled rules. Prefer pre-compiling in `generate.mjs`'s caller if
       that stays inside WP02's forwarded value; otherwise memoise here.
     - Call `lintSteps(view, { rules, file: opts.file, warn: opts.warn,
       language: <document language> })` next to `warnDuplicates`.
- **Files**: `src/lib/gherkin/render.mjs`, `src/tests/gherkin-render.test.ts`.
- **Parallel?**: Yes, with T018.

### Subtask T018 – Fence stage calls the lint

- **Steps**:
  1. **Red first** in `gherkin-fence.test.ts`. Run the remark processor (the
     same harness the file already uses) with
     `gherkinFence({ ..., lint: { imperativeSteps: true } normalised })` on a
     page holding:
     - a fence with `When I click "Book"` on known lines, giving one warning
       whose `file:line` is the **host page** path and the absolute page line;
     - a `gherkin raw` fence with the same step, giving no warning;
     - a fence with `@dk:allow=imperative` on the scenario, giving no lint
       warning **and** no "metadata tags have no effect" warning (WP03 T012).
     Repeat with `lint` unset: zero lint warnings. That is the pair.
  2. Implement: add `lint?: NormalisedLint` to `GherkinFenceOptions`. Compile
     once in the plugin factory. Call `lintSteps` right after `warnDuplicates`,
     with the same `lineOffset` expression and the fence's language.
  3. **Out-of-map edit (recorded)**: in `src/lib/integrations/gherkin.ts`,
     `gherkinFenceIntegration`, add
     `...(opts.lint ? { lint: opts.lint } : {})` to `fenceOptions`. The file
     belongs to WP02; this one line is the only way to reach the fence stage.
     Record it with `spec-kitty agent tasks add-history WP04 --note
     "out-of-map: fenceOptions.lint in integrations/gherkin.ts (WP02-owned),
     one line, required to wire fences"`.
- **Files**: `src/lib/remark/gherkin-fence.ts`, `src/tests/gherkin-fence.test.ts`, and the one recorded line in `src/lib/integrations/gherkin.ts`.

### Subtask T019 – Production-path tests

- **Purpose**: Non-vacuity on the real entry points (tactic
  `acceptance-criteria-non-vacuity`).
- **Steps**: create `src/tests/gherkin-lint-wiring.test.ts` with:
  1. **Generated pages.** Call `generateFeaturePages` (the function the
     integration calls) on a temp fixture with `lint` on and with it off.
     - Assert: one warning with `features/x.feature:<line>` when on, none when
       off.
     - Assert: the written page bytes are identical between the runs (FR-009).
  2. **Integration.** Call `gherkinIntegration(...).hooks['astro:config:setup']`
     with a stub `logger`, and assert `logger.warn` received the lint line.
     This proves WP02's threading plus this WP's call.
  3. **Includes stay silent.** Add a page that includes (`::gherkin{src=…}`) a
     feature with an imperative step, with lint on. There is no lint warning
     for the included steps. In the same test, a fence on the same page with the
     same step **does** warn, which is the positive control.
  4. **CLI stays silent.** Run `generate-feature-pages.mjs --check` on the
     fixture. Stderr has no lint line (D1). Its existing behaviour is otherwise
     unchanged.

## Test Strategy

- `pnpm test -- gherkin-render gherkin-fence gherkin-lint-wiring gherkin-include`,
  then the full `pnpm test`.
- `pnpm validate:features`: no drift.
- Run the TypeScript typecheck the repo uses (`gherkin-fence.ts`).

## Risks & Mitigations

- **Double warnings.** A file that is both a source and a fence would be warned
  about in each surface. That is acceptable and consistent with
  `warnDuplicates`. Includes stay silent.
- **Cache-hit silence for fences in dev.** This is documented by WP08, not
  fixed.

## Review Guidance

- **Call sites**: the lint is called exactly where `warnDuplicates` is (two
  places), never in the include path.
- **Bytes**: unchanged with lint on.
- **Out-of-map edit**: exactly one line, and recorded in history.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP04 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP04 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
