---
work_package_id: WP07
title: Example site demonstration
dependencies:
- WP02
- WP04
requirement_refs:
- SC-001
- SC-002
- SC-005
- NFR-001
- NFR-002
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 6d0561aa1a492fedcca34aa85712a953c8267294
created_at: '2026-10-19T08:54:22.029770+00:00'
subtasks:
- T030
- T031
- T032
- T033
phase: Phase 4 - Demonstration
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: example/
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- example/astro.config.mjs
- package.json
- example/features/shipping/book-consignment.feature
- example/features/shipping/declare-customs.feature
- example/features/shipping/track-consignment.feature
- example/docs/behaviour/**
- src/tests/gherkin-example.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP07 – Example site demonstration

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

Make the example site the live demonstration (research R-09):

- `defaultGlossaryContext: { shipping: 'shipping', hr: 'hr' }`.
- `lint: { imperativeSteps: true }`, with zero warnings.
- The three shipping features drop their now-redundant `@dk:context=shipping`.
- `validate:features` mirrors the map with two flags.

This fixes the live "policy" collision on the HR page (SC-001).

**Done when**:

- `pnpm validate:features` exits 0.
- `gherkin-example.test.ts` proves:
  - the HR page has `glossary_context: "hr"`;
  - the shipping pages keep `"shipping"` with no tag in their sources;
  - the example corpus has zero imperative-step findings.
- The example build log has no unresolved-collision line for the HR page and no
  `[dk-gherkin]` lint line.

## Context & Constraints

- Spec: SC-001, SC-002, SC-005, NFR-001 and NFR-002; US1 independent test.
- `example/.contextive/definitions.yaml` defines contexts `shipping` (line 9)
  and `hr` (line 36). `policy` is defined in both, which is the collision.
- `example/astro.config.mjs` already sets `gherkin.sources` and `titles`
  (around lines 111–129). `package.json:24` holds
  `validate:features`: `node src/scripts/generate-feature-pages.mjs --root
  example --sources features --docs docs --section behaviour --titles hr=HR
  --check`.
- `src/tests/gherkin-example.test.ts:94-149` asserts that `validate:features`
  mirrors the example's options (FR-004a parity). Keep it passing; extend it.
- Regenerate pages **only** with the toolkit generator (the same script without
  `--check`, or an example build). Never hand-edit `example/docs/behaviour/**`.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP07 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T030 – Example config

- **Steps**:
  1. In `example/astro.config.mjs`, under `gherkin`, add:
     - `defaultGlossaryContext: { shipping: 'shipping', hr: 'hr' }`;
     - `lint: { imperativeSteps: true }`.
     Add a short comment for each, pointing at the consumer setup guide.
  2. Build the example once (`pnpm --filter example build`) and read the log for
     `[dk-gherkin]` lint lines. There must be none. If a step in the example is
     genuinely imperative, rewrite it declaratively, or tag it
     `@dk:allow=imperative` only if the example *wants* to show suppression.
     Prefer one deliberate, documented suppression demo over silently rewording.
     Record the choice.

### Subtask T031 – Drop the redundant tags and regenerate

- **Steps**:
  1. Remove `@dk:context=shipping` from the three shipping features. Keep every
     other tag.
  2. Regenerate the pages:
     `node src/scripts/generate-feature-pages.mjs --root example --sources features --docs docs --section behaviour --titles hr=HR --default-glossary-context shipping=shipping --default-glossary-context hr=hr`.
  3. Inspect the diff:
     - the shipping pages keep `glossary_context: "shipping"`;
     - the stamp's `content_hash` and `at` change because the source bytes
       changed, which is expected;
     - the HR page gains `glossary_context: "hr"`;
     - nothing else moves.

### Subtask T032 – `validate:features` flags

- **Steps**: append
  `--default-glossary-context shipping=shipping --default-glossary-context hr=hr`
  to the root `package.json` `validate:features` script. Run it: exit 0.

### Subtask T033 – Example assertions

- **Steps**:
  1. **Red first** in `gherkin-example.test.ts`. Write these before T030–T032
     land, so they fail first:
     - the committed `example/docs/behaviour/hr/request-leave.md` has
       `glossary_context: "hr"`;
     - each shipping page has `glossary_context: "shipping"`;
     - no `example/features/shipping/*.feature` contains `@dk:context`. That
       pair proves the folder default, not a tag, supplies it (SC-001).
     - Parity: the script's `--default-glossary-context` values equal the
       example's map. Extend the existing parity helper.
  2. **NFR-002 and SC-002**:
     - run the lint core (WP03 `compileRules` and `lintSteps`) with the example's
       normalised option over every example `.feature`, and over the in-page
       fences of `example/docs/**`, using whatever helper the fence tests
       expose. Assert zero warnings.
     - **Positive control in the same test**: lint a feature with the authoring
       guide's two "reads badly" steps (`When I click "#book-button"`, `And I
       fill in "size" with "12"`) and assert exactly two warnings (SC-002).

## Test Strategy

- `pnpm test -- gherkin-example`, the full `pnpm test`,
  `pnpm validate:features`, `pnpm --filter example build`,
  `pnpm assert:artifacts`.

## Risks & Mitigations

- **A stamp change on every regenerated page.** Only pages whose source or
  frontmatter changed should move. Review the diff before committing.
- **The HR glossary collision line persists.** Check that the page actually
  resolves `policy` to `hr` in the built HTML; the link target is under
  `/glossary/hr/`.

## Review Guidance

- **Generated pages**: no hand-edits; the regeneration command is in the
  history note.
- **SC-001**: proven by the tag-absent plus context-present pair.
- **NFR-002 and SC-002**: zero warnings on the corpus, two on the control.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP07 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP07 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
