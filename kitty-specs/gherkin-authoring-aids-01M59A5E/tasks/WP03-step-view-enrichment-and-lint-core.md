---
work_package_id: WP03
title: Step view enrichment and imperative-step lint core
dependencies: []
requirement_refs:
- FR-008
- FR-009
- FR-010
- FR-012
- FR-013
- C-002
- NFR-002
- NFR-006
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 2e8fc15271c5297224e434b2e5a99e76b54bf1b1
created_at: '2026-10-19T06:40:10.064938+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
phase: 'Phase 2 - #196 lint core'
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/gherkin/imperative.mjs
create_intent:
- src/lib/gherkin/imperative.mjs
- src/tests/gherkin-imperative.test.ts
execution_mode: code_change
model: ''
owned_files:
- src/lib/gherkin/view.mjs
- src/lib/gherkin/imperative.mjs
- src/tests/gherkin-view.test.ts
- src/tests/gherkin-imperative.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP03 – Step view enrichment and imperative-step lint core

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

Build the pure lint core for #196 and the view data it needs. The core module
is `src/lib/gherkin/imperative.mjs`, and it exports:

- `DEFAULT_IMPERATIVE_PHRASES`, the documented list;
- `compileRules(normalisedOption)`, which turns WP01's normalised option into
  compiled rules;
- `lintSteps(view, { rules, file, warn, lineOffset = 0, language })`, which
  emits one warning per offending step.

It has no I/O and no wiring. WP04 calls it from pages and fences.

**Done when**:

- `gherkin-imperative.test.ts` passes, including every acceptance scenario of
  US2 that does not involve wiring (1–7 and 9).
- `gherkin-view.test.ts` covers `line` and `keywordType`.
- The existing render and mdast goldens are unchanged. Run the whole suite.

## Context & Constraints

- Spec: FR-008, FR-009, FR-010, FR-012, FR-013, C-002, NFR-002 and NFR-006; US2
  scenarios; edge cases (inflections, quoted arguments, "clickstream").
- Contracts: `contracts/warnings.md` gives the exact warning texts.
  `data-model.md` covers StepView, ImperativeLintRules and Suppression.
- Research: R-04 (list and matcher), R-05 (keyword types) and R-06
  (suppression).
- Pre-spec research: `docs/architecture/research/gherkin-authoring-aids.md`,
  "Wording: what the default list should hold". The false-positive table there
  is the test corpus.
- Existing code:
  - `StepView` typedef: `src/lib/gherkin/view.mjs:83-92`
  - `stepView()` and `sectionView()`: around lines 265 and 305
  - `featureView()`: 329
  - `displayTags` and `hasMetadataTag`: 399–426
  - `warnDuplicates` (the shape to imitate): `render.mjs:520-545`
  - Steps from `@cucumber/gherkin` carry `keywordType`: `Context`, `Action`,
    `Outcome`, `Conjunction` or `Unknown`.
- The feature language is on the parsed document (`feature.language`). Fences
  pass `# language:` through `fragment.mjs:82-86`. Thread `language` in from the
  caller (`lintSteps` takes it explicitly), or read it from the view if you add
  a `language` field to `FeatureView`. Either is fine; document the choice.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP03 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T011 – `StepView.line` and `StepView.keywordType`

- **Purpose**: The lint needs a line and a resolved keyword type (R-05).
- **Steps**:
  1. **Red first.** In `gherkin-view.test.ts`, add cases:
     - `Given a / And b / When c / But d / Then e / * f` resolves to
       `context, context, action, action, outcome, outcome`.
     - A Background `Given x / And y` gives `context, context`.
     - A scenario starting with `And z` (nothing to inherit) gives `unknown`.
     - A Rule's scenarios behave the same.
     - Lines match the source lines.
  2. Add both fields in `stepView`. Resolve inheritance at section level, so the
     chain resets per section (Background, scenario, outline). Add both to the
     `StepView` typedef.
  3. Check the fields are **additive**: no renderer reads them. Run
     `pnpm test -- gherkin-render gherkin-mdast gherkin-fence gherkin-include`
     unchanged and green.
- **Files**: `src/lib/gherkin/view.mjs`, `src/tests/gherkin-view.test.ts`.

### Subtask T012 – `hasMetadataTag` ignores `@dk:allow`

- **Purpose**: An embedded fence carrying `@dk:allow=imperative` must not trigger
  "metadata tags have no effect" (spec edge case; R-06).
- **Steps**:
  1. **Red first**, as a pair on one fixture:
     - a view whose only `@dk:` tag is `@dk:allow=imperative` (feature or
       scenario) gives `hasMetadataTag === false`;
     - the same view plus `@dk:persona=x` gives `true`.
  2. Exclude tags starting with `@dk:allow=`, or exactly `@dk:allow`, in
     `hasMetadataTag` only. `displayTags` still hides every `@dk:*` tag.
- **Parallel?**: Yes.

### Subtask T013 – Default phrase list and compiler

- **Purpose**: A documented, conservative default (D2; R-04).
- **Steps**:
  1. Define `DEFAULT_IMPERATIVE_PHRASES` as data, not regex. Each entry has a
     head verb with its inflections and an optional required context. Cover:
     - `click` (and `double-click`, `right-click`), `tap`, `hover`, `scroll`,
       `drag`;
     - `fill in`, `fill out`;
     - `navigate to`;
     - `type … into` (only the verb shape, where a quoted argument or word is
       followed by `into`);
     - `press … button|key`;
     - `refresh|reload the page`;
     - `check|uncheck|tick … box|checkbox`;
     - `visit … page|url|link`.
  2. `compileRules(opt)`:
     - `opt` is WP01's normalised shape: `{ verbs?: string[], extend: string[],
       keywords: KeywordType[] }`.
     - `verbs`, when given, **replaces** the default list. `extend` is appended.
     - A user entry is a plain word or phrase. Compile it to a case-insensitive
       regex with word boundaries on both sides and `\s+` between words. Allow
       common inflections on the first word only: `s`, `es`, `ed`, `d`, `ing`,
       consonant doubling (`tap → tapped`) and silent-e drop
       (`type → typing`).
     - Never accept a raw regex from the user.
  3. Unit-test the compiler on its own: `click` matches "clicks", "clicked",
     "clicking" and "Click", and does not match "clickstream".
- **Files**: `src/lib/gherkin/imperative.mjs` (new), `src/tests/gherkin-imperative.test.ts` (new).

### Subtask T014 – Matcher, selector signal and language skip

- **Purpose**: Match only real step prose (FR-008, FR-013; edge cases).
- **Steps**:
  1. Build the match string from `step.segments`:
     - `text` segments verbatim;
     - `placeholder` segments as `<…>`;
     - `argument` segments as `"…"`.
     The verb inside `When I type "x" into "y"` is still visible, but argument
     *content* never matches a verb.
  2. **Selector signal.** Any `argument` segment whose value matches
     `^[#.][A-Za-z_-]` or contains both `[` and `=` produces the selector
     warning instead.
  3. Only steps whose resolved `keywordType` is in `rules.keywords` are checked.
     Doc strings, data tables, Examples cells and descriptions are never
     scanned.
  4. If `language` is set and is neither `en` nor `en-…`, return without
     warnings.
  5. Return or emit at most one warning per step. A verb match wins over a
     selector match. Document the choice.
- **Notes**: An outline step `When I <action> the form` must not match. The
  placeholder becomes `<…>`.

### Subtask T015 – Suppression, bad-value warning and warning text

- **Purpose**: `@dk:allow=imperative` scopes (FR-012; R-06) and the exact
  contract wording.
- **Steps**:
  1. Walk the view.
     - A Feature tag covers all steps.
     - A Rule tag covers that Rule's Background and scenarios.
     - A Scenario or Outline tag covers its own steps.
     - The Feature Background is covered only by a Feature tag.
  2. A tag `@dk:allow=<v>` with `v !== 'imperative'` at Rule or Scenario level
     warns: `${GHERKIN_LOG_PREFIX} ${file}:${line} unknown @dk:allow value "<v>"
     (expected imperative); ignored`.
     - Feature-level bad values are already warned by feature-core (WP01) on
       generated pages. Do not double-warn there. Fences do not run
       feature-core metadata, so decide and test which path warns for a fence.
     - The rule is one warning per bad tag, per surface.
  3. Warning text, verbatim from `contracts/warnings.md`. Use
     `GHERKIN_LOG_PREFIX` from where `render.mjs` imports it. The line is
     `step.line + lineOffset`.
- **Files**: `src/lib/gherkin/imperative.mjs`, `src/tests/gherkin-imperative.test.ts`.

### Subtask T016 – Lint core test suite

- **Purpose**: Non-vacuous coverage of US2 and NFR-002 and NFR-006.
- **Steps**: In `gherkin-imperative.test.ts`, parse real Gherkin text with the
  same parse helpers the view tests use, then call `lintSteps` with a recording
  `warn`. The cases:
  - **Flagged**: `When I click "Book"` gives exactly one warning naming
    `"click"`, with the right line.
  - **Clean** (same fixture, positive control): `When the shipper books the
    consignment` and `Given the customer enters a contract` give zero warnings.
  - **Selector**: `When I press "#book-button"` gives one warning (verb or
    selector, per T014's rule).
  - **Scope**:
    - default rules leave `Then I click …` unflagged;
    - `And I click …` after a `When` is flagged;
    - `keywords: ['outcome']` flips both.
  - **Dutch**: `# language: nl` with `Als ik klik op "Boek"` gives zero
    warnings, and the same steps in English give one. That is the pair.
  - **Placeholder**: `When I <action> the form` gives zero warnings.
  - **Suppression**:
    - a scenario tagged `@dk:allow=imperative` gives zero, and its untagged
      sibling still warns;
    - a Rule-level tag covers its scenarios;
    - a Feature-level tag covers all.
  - **Configuration**:
    - `{ extend: ['select'] }` flags `When I select "Rotterdam"`, and the
      defaults do not;
    - `{ verbs: ['tap'] }` does not flag `click` and does flag `tap`.
  - **Counter-examples**: every row of the research false-positive table that
    the narrow list excludes ("enters a contract", "select a plan", "submit the
    declaration", "the leave type", "press release", "the system navigates the
    route") gives zero warnings under defaults.
  - **Timing guard (NFR-006, lenient)**: lint the parsed example corpus
    (`example/features/**/*.feature`) 20 times. The time stays below a generous
    bound, for example under 5% of parse time measured in the same test, or an
    absolute ceiling with headroom. Keep it non-flaky.
  - **Example corpus**: the example's `.feature` files produce zero warnings
    with default rules. That is the NFR-002 early signal; WP07 asserts it
    end to end.

## Test Strategy

- **Red first** for every case. Record the failing run in a history note.
- `pnpm test -- gherkin-imperative gherkin-view`, then the full `pnpm test`.
  The render and mdast goldens must not change.
- Run the typecheck or lint the repo uses for `.mjs` with JSDoc types, if
  configured.

## Risks & Mitigations

- **Over-broad inflection rules** match unintended words. Mitigation: always
  anchor at word boundaries and test "clickstream" and "typewriter".
- **Wrong line arithmetic for fences.** Keep `lineOffset` semantics identical to
  `warnDuplicates`.

## Review Guidance

- **Purity**: no `console`, no file system, no globals; `warn` is the only
  output.
- **Matching**: argument content never matches a verb; placeholders never match.
- **Data**: the default list is data, documented in JSDoc so WP08 can copy it
  into the authoring guide.
- **Coverage**: each "no warning" test has a positive control on the same
  fixture.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP03 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP03 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
