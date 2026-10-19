---
work_package_id: WP01
title: Gherkin option and metadata contract
dependencies: []
requirement_refs:
- FR-001
- FR-003
- FR-005
- FR-010
- FR-012
- C-003
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 92e4e9009e3234976c9b1cb094eebd85ee603e47
created_at: '2026-10-19T06:39:39.065508+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
phase: Phase 1 - Foundation
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/gherkin/
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- src/lib/gherkin/options.mjs
- src/lib/gherkin/feature-core.mjs
- src/scripts/generate-feature-pages.mjs
- src/tests/gherkin-options.test.ts
- src/tests/gherkin-feature-core.test.ts
- src/tests/gherkin-check-cli.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP01 – Gherkin option and metadata contract

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

Settle the configuration and metadata contract that every later package
consumes:

1. **`gherkin.defaultGlossaryContext`**, a page key, validated like
   `gherkin.titles`.
2. **`gherkin.lint.imperativeSteps`**, a non-page option key, validated and
   normalised.
3. **`--default-glossary-context <dir>=<ctx>`**, the CLI twin, so the FR-004a
   parity test stays green.
4. **`buildFrontmatter` precedence**: a non-empty tag wins, then the folder
   default passed in, then nothing. An empty tag falls through to the default.
5. **`allow`**, a known Feature-level `@dk:` key with value `imperative`.

**Done when** the three owned test suites hold new red-first cases that now
pass, `pnpm test` is green, and `pnpm validate:features` still exits 0.

## Context & Constraints

- Spec: `kitty-specs/gherkin-authoring-aids-01M59A5E/spec.md` (FR-001, FR-003,
  FR-005, FR-010, FR-012, C-003).
- Contracts: `contracts/gherkin-options.md` and `contracts/cli-flags.md`. Data
  model: `data-model.md` (FolderDefaultMap, ImperativeLintRules, Suppression).
- Research: R-01 (resolution point) and R-06 (suppression semantics).
- The precedent to copy is `gherkin.titles`. Its validation lives in
  `options.mjs` (`checkTitles`, `isRelativeDirKey` around lines 292–334); its
  CLI parser lives in `generate-feature-pages.mjs` (`parseTitles`, around lines
  228–253, and the `FLAG` map at 80–87).
- Options are strict. Unknown keys throw (`options.mjs:53-66, 380-388`).
  `GHERKIN_PAGES_KEYS` must equal the CLI `FLAG` keys, and
  `src/tests/gherkin-example.test.ts:125-131` enforces it. That file belongs to
  WP07; do not edit it. Adding the page key and the flag together keeps it green.
- This WP **does not** resolve folder defaults (that is WP02) and does not lint
  (WP03 and WP04). It only accepts, validates and passes values through.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

> These fields are populated automatically by `spec-kitty agent mission finalize-tasks`.
> Execution worktrees are allocated per computed lane from `lanes.json`.

Implement with:

```bash
spec-kitty agent action implement WP01 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T001 – Validate `gherkin.defaultGlossaryContext` (page key)

- **Purpose**: Accept and validate the folder map (FR-001, C-003).
- **Steps**:
  1. **Red first.** In `src/tests/gherkin-options.test.ts`, add cases:
     - `{ shipping: 'shipping', 'shipping/eu': 'customs' }` normalises to the
       same map.
     - Each of these throws with a `[dk-gherkin]` message naming the option:
       - the option set without `sources`;
       - a non-object value (array, string, `null`);
       - a key of `''`, `'/abs'`, `'../up'` or `'a\\b'`;
       - a blank value `'  '`;
       - a non-string value.
     - `__proto__` as a key is kept as an own enumerable property, not
       prototype pollution. Mirror the `titles` test for this.
  2. Add `defaultGlossaryContext` to `GHERKIN_PAGES_KEYS` and to the normalised
     page options. Reuse `isRelativeDirKey` and the `defineProperty` copy
     pattern from `checkTitles`. Factor a shared helper if it removes
     duplication cleanly; do not change `titles` behaviour.
  3. Keys are kept as written (case-sensitive, not slugged). Values are trimmed
     only for the blank check and stored as given.
- **Files**: `src/lib/gherkin/options.mjs`, `src/tests/gherkin-options.test.ts`.
- **Notes**: The error wording follows the existing `checkTitles` messages, so
  users see one style.

### Subtask T002 – Validate and normalise `gherkin.lint.imperativeSteps`

- **Purpose**: Accept the lint option without making it a page key (FR-008,
  FR-010, C-003).
- **Steps**:
  1. **Red first.** Add tests to `gherkin-options.test.ts`:
     - The option absent, or `lint: {}`, or `imperativeSteps: false`,
       normalises to "off" (`undefined` or `false`, whichever the existing
       style uses; be consistent).
     - `true` normalises to `{ verbs: undefined, extend: [], keywords:
       ['context', 'action'] }`.
     - `{ verbs: ['tap'] }` and `{ extend: ['select'] }` are accepted.
     - `{ keywords: ['outcome'] }` is accepted.
     - Each of these throws:
       - an unknown key under `lint`, or under `imperativeSteps`;
       - a non-array `verbs`;
       - a blank entry;
       - a keyword outside `context`, `action`, `outcome`;
       - `verbs: []` with no `extend` (an empty effective list).
  2. Add `lint` to `GHERKIN_OPTION_KEYS`, **not** `GHERKIN_PAGES_KEYS`, and
     validate it in `normalizeGherkinOptions`.
  3. Keep the normalised shape exactly as `data-model.md` states. WP03's
     `compileRules` consumes it: `verbs` is `undefined` (meaning "use the
     defaults") or a replacement list, and `extend` is appended to it.
- **Files**: `src/lib/gherkin/options.mjs`, `src/tests/gherkin-options.test.ts`.
- **Parallel?**: Yes, with T005.

### Subtask T003 – CLI flag `--default-glossary-context <dir>=<ctx>`

- **Purpose**: Keep `validate:features` byte-reproducible (FR-005) and the
  parity test green.
- **Steps**:
  1. **Red first.** In `src/tests/gherkin-check-cli.test.ts`, add cases:
     - Two `--default-glossary-context` values parse into the map.
     - A value with no `=` exits with the usage error code `--titles` uses.
     - A repeated `<dir>` is a usage error.
     - `__proto__` is kept as an own key.
  2. Add `defaultGlossaryContext: '--default-glossary-context'` to `FLAG`, a
     `parseDefaultGlossaryContext(values)` modelled on `parseTitles` (split on
     the first `=`), and the usage-block line. The header comment holds the
     usage text, which a test checks. Update it.
  3. Pass the parsed map into the options object exactly as `titles` is passed,
     so the shared validator from T001 runs.
- **Files**: `src/scripts/generate-feature-pages.mjs`, `src/tests/gherkin-check-cli.test.ts`.
- **Notes**: Do not add a lint flag (decision D1). Do not load the glossary in
  the CLI (research R-02).

### Subtask T004 – Context precedence in `buildFrontmatter`

- **Purpose**: Make feature-core the single resolution point (C-001, FR-003).
- **Steps**:
  1. **Red first.** In `src/tests/gherkin-feature-core.test.ts`, add cases
     (with the options you add):
     - `buildFrontmatter` with `@dk:context=customs` and folder default
       `shipping` gives `customs`.
     - No tag and default `shipping` gives `shipping`.
     - An empty `@dk:context=` and default `shipping` gives `shipping`, and the
       existing "has no value" warning is still emitted.
     - No tag and no default gives no `glossary_context` key. The bytes must be
       identical to today's output, so compare with an existing golden.
  2. Extend the `buildFrontmatter` options with `defaultGlossaryContext?:
     string` (the already-resolved value; WP02 does the lookup). Apply `meta.context
     ?? opts.defaultGlossaryContext`. Make sure an empty tag yields
     `meta.context === undefined` today; confirm by reading the parse path
     around `feature-core.mjs:298-300, 362-363`.
  3. Also return, or expose, the **origin** of the resolved context (`'tag'`,
     `'default'` or `undefined`). WP02's unknown-context warning needs it. Return
     it from the function that WP02 calls (`generate.mjs:319-330` calls
     `buildFrontmatter`). Choose the least invasive shape, for example a
     separate exported `resolveGlossaryContext(meta, folderDefault)` that
     `buildFrontmatter` uses and WP02 can call too. Document the choice in the
     JSDoc.
- **Files**: `src/lib/gherkin/feature-core.mjs`, `src/tests/gherkin-feature-core.test.ts`.

### Subtask T005 – `allow` as a known Feature-level `@dk:` key

- **Purpose**: Accept `@dk:allow=imperative` without the unknown-key warning
  (FR-012), as research R-06 describes.
- **Steps**:
  1. **Red first.** In `gherkin-feature-core.test.ts`, add cases:
     - A feature tagged `@dk:allow=imperative` produces no warning and **no
       frontmatter change** (`allow` never feeds frontmatter).
     - `@dk:allow=bogus` warns: `unknown @dk:allow value "bogus" (expected
       imperative); ignored`, with the existing `${PREFIX} ${loc}` prefix.
     - `@dk:allow=` warns with the existing "has no value" message.
     - Repeating `@dk:allow=imperative` produces no "repeated" warning (the key
       is not single-valued).
  2. Add `'allow'` to `METADATA_KEYS` (the did-you-mean pool) and keep it out of
     `SINGLE_VALUED`. Expose the parsed allow values on the parsed metadata
     object (for example `meta.allow: string[]`) for the lint to read later.
     Rule and Scenario tags are read by the lint core itself (WP03), not here.
- **Files**: `src/lib/gherkin/feature-core.mjs`, `src/tests/gherkin-feature-core.test.ts`.
- **Parallel?**: Yes, with T002.

## Test Strategy

- **Red first.** Commit or record each new test failing before the
  implementation. The reviewer checks the history note.
- **Commands**:
  - `pnpm test -- gherkin-options gherkin-feature-core gherkin-check-cli gherkin-example`
  - then the full `pnpm test`
  - `pnpm validate:features` must still exit 0 (no generated page changes in
    this WP)
  - `pnpm --filter @spec-kitty/doc-toolkit exec tsc --noEmit`, if the package
    has a typecheck script; otherwise the repo's lint command (`pnpm lint`, if
    present)
- **Non-vacuity**: every refusal test is paired with an accepted-shape test on
  the same fixture (FR-004 style).

## Risks & Mitigations

- **Parity test.** It breaks if T001 lands without T003. Implement them in one
  commit.
- **Golden drift.** It happens if `buildFrontmatter` changes key order when no
  context resolves. Keep the emission path untouched in that case.

## Review Guidance

- **Options**: `lint` is in `GHERKIN_OPTION_KEYS` and not in the page keys;
  `defaultGlossaryContext` is in `GHERKIN_PAGES_KEYS` and in `FLAG`.
- **Precedence**: an empty tag falls through to the default; a non-empty tag
  always wins.
- **`allow`**: never written to frontmatter; bad values warn but never throw.
- **Tests**: each refusal case has a positive control on the same fixture.

## Progress & Status

Progress, history, and status all live in the status event log
(`status.events.jsonl`). Do **not** hand-edit a history section here.

- **Record a progress note**: `spec-kitty agent tasks add-history WP01 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP01 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
