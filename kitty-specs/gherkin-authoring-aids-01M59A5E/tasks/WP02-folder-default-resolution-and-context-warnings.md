---
work_package_id: WP02
title: Folder default resolution and context warnings
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-004
- FR-006
- FR-007
- C-001
- NFR-001
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 285fc180d55f734d983f4f48bbbcef785ac18981
created_at: '2026-10-19T07:37:01.998295+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
phase: 'Phase 2 - #197 folder default'
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/gherkin/generate.mjs
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- src/lib/gherkin/generate.mjs
- src/lib/integrations/gherkin.ts
- src/lib/config.ts
- src/tests/gherkin-generate.test.ts
- src/tests/gherkin-integration.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP02 – Folder default resolution and context warnings

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

Make `gherkin.defaultGlossaryContext` actually set `glossary_context` on
generated pages, and add its two warnings. Also thread the `lint` option to the
renderer, so WP04 only has to consume it.

**Done when**:

- Generation on fixtures gives the expected context for each of these cases:
  mapped, nested (longest prefix), tagged override, empty tag, unmapped and
  partial-segment non-match.
- Exactly one warning is emitted per unused key, and exactly one per page with
  an unknown context (build path only).
- Pages in unmapped folders are byte-identical with the option on and off.
- The integration passes the map, the glossary context names and `lint`.

## Context & Constraints

- Spec: FR-001, FR-002, FR-004, FR-006, FR-007, C-001 and NFR-001; US1
  scenarios 1–8.
- Contracts: `contracts/warnings.md` (exact wording for the unused-key and
  unknown-context warnings). `data-model.md` defines the lookup algorithm.
- Research:
  - R-01: resolution stays in feature-core; generate only looks up and passes.
  - R-02: the CLI passes no `knownContexts`, so it does not check.
  - R-03: the warning wording.
- WP01 provides:
  - `defaultGlossaryContext` in the normalised page options;
  - `buildFrontmatter`'s `defaultGlossaryContext` option and the origin helper
    (read its JSDoc);
  - the CLI flag.
- Precedent: `titles` handling in `generate.mjs` (`sourceDirs`, and the
  unused-key warning around lines 370–379). Each `FeatureFile` has a POSIX,
  source-relative `relPath` (`load.mjs:62,154`).
- The integration entry is `src/lib/integrations/gherkin.ts:82-98`. The glossary
  loader is `loadGlossary(root)` from `src/lib/glossary/load.ts`. It returns
  `{ present: false }` or `{ present: true, index }`. Get the context names from
  the index, or the loaded contexts. Read `buildIndex` and `SharedTermIndex` in
  `load.internal.ts` and use what is exposed. Never re-parse the YAML.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP02 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T006 – Longest-prefix folder lookup

- **Purpose**: Find the folder default for each feature (FR-001, FR-002).
- **Steps**:
  1. **Red first.** In `src/tests/gherkin-generate.test.ts`, build a fixture
     tree (temp dir or existing fixture style) with:
     - `features/shipping/a.feature` (no tag)
     - `features/shipping/eu/b.feature` (no tag)
     - `features/shipping/tagged.feature` (`@dk:context=customs`)
     - `features/shipping/empty.feature` (`@dk:context=`)
     - `features/shipments/c.feature` (no tag)
     - `features/billing/d.feature` (no tag)

     Assert on the generated frontmatter with
     `{ shipping: 'shipping', ship: 'nope' }`, then add `'shipping/eu': 'customs'`:

     | File | Expected `glossary_context` |
     |---|---|
     | `a` | `shipping` |
     | `b` | `shipping`, then `customs` once the `shipping/eu` key is added |
     | `tagged` | `customs` |
     | `empty` | `shipping` |
     | `c` | none: `ship` must not match `shipments` |
     | `d` | none |
  2. Implement `folderDefault(relPath, map)`. Take the directory segments of
     `relPath`. Try the longest joined prefix first and walk up. Return
     `{ key, value }` or `undefined`. Compare whole segments only. Apply it per
     source (the same key space for every source, like `titles`).
  3. Pass the value into `buildFrontmatter` through WP01's option. Keep the
     lookup in `generate.mjs`; the precedence stays in feature-core.
- **Files**: `src/lib/gherkin/generate.mjs`, `src/tests/gherkin-generate.test.ts`.

### Subtask T007 – Unused-key warning

- **Purpose**: Make stale keys visible (FR-007).
- **Steps**:
  1. **Red first.** With the map `{ shipping: 'shipping', hr: 'hr', nowhere:
     'x' }` over a tree without `nowhere/`, expect exactly one warning, in the
     exact contract wording. Expect zero warnings when every key matches.
  2. A key "matches" when some source directory containing a feature equals the
     key or lies beneath it. That differs from `titles`' exact check, because
     the lookup inherits. Reuse the `sourceDirs` set the `titles` check builds.
     Sort the keys with `compareCodeUnit` for deterministic order.
- **Parallel?**: Yes, with T008 once T006 is in.

### Subtask T008 – Unknown-context warning

- **Purpose**: Catch typos in the map and in tags (FR-006; research R-03).
- **Steps**:
  1. **Red first.** With `knownContexts: new Set(['shipping', 'hr'])`:
     - A page resolving to `customs` from a tag emits one warning naming the
       file, `"customs"` and `the @dk:context tag`.
     - A page resolving to `peopel` from map key `hr` names `the
       gherkin.defaultGlossaryContext key "hr"`.
     - A page resolving to `shipping` emits nothing.
     - With `knownContexts` undefined, the same tree emits **no** unknown-context
       warning. This is the positive and negative pair on one fixture.
  2. Add an optional `knownContexts` to `generateFeaturePages` and
     `planFeaturePages` options. Check after resolution, once per page, through
     `warn`.
- **Notes**: The warning must not change the generated bytes.

### Subtask T009 – Thread the options through the integration and generator

- **Purpose**: Wire the production path (C-001; plumbing for WP04).
- **Steps**:
  1. In `src/lib/integrations/gherkin.ts` (`gherkinIntegration`):
     - pass `defaultGlossaryContext: opts.defaultGlossaryContext` to
       `generateFeaturePages`;
     - load the glossary with `loadGlossary(root)`, and when it is present, pass
       `knownContexts` as the set of context names.
  2. Make the resolved `lint` option reach `generateFeaturePages`. Today
     `src/lib/config.ts:660` calls `gherkinIntegration(gherkinPages, docsDir,
     indexBasename, gherkinOpts?.results)`: the page options and the full
     options are separate. Pass `gherkinOpts?.lint` the same way as `results`
     (a new parameter, or a small options object if that reads better), keeping
     the types honest.
  3. In `generate.mjs:332`, forward it:
     `renderFeatureBody(file.document, { file: sourceLabel, warn, lint: opts.lint })`.
     Until WP04 lands, `renderFeatureBody` ignores `lint`. That is intended.
  4. Do **not** touch `fenceOptions`; WP04 does that.
  5. **Red first** in `src/tests/gherkin-integration.test.ts`: a test that runs
     the integration's `astro:config:setup` with a stub logger, on a fixture
     with a glossary and a mapped folder. It asserts:
     - the generated page carries the context;
     - an unknown context produces a `logger.warn` call.
- **Files**: `src/lib/integrations/gherkin.ts`, `src/lib/gherkin/generate.mjs`, `src/tests/gherkin-integration.test.ts`.

### Subtask T010 – Dormancy and production-path tests

- **Purpose**: Prove NFR-001 and FR-004 non-vacuously.
- **Steps**:
  1. **Dormancy pair.** On one fixture, generate twice: with
     `defaultGlossaryContext` unset, and set to a map that does not cover
     `billing/`. Assert the `billing/` page bytes are equal. In the same test,
     assert a covered page *differs*. That is the positive control.
  2. **Example-corpus dormancy.** Run `generateFeaturePages` in plan or check
     mode on `example/` with the example's current options. The example config
     does not set the new option yet; WP07 does that. Expect zero changes.
     `pnpm validate:features` is the end-to-end form; run it.
- **Files**: `src/tests/gherkin-generate.test.ts`.

## Test Strategy

- `pnpm test -- gherkin-generate gherkin-integration`, then `pnpm test`, then
  `pnpm validate:features`.
- Run the typecheck the repo uses; `gherkin.ts` is TypeScript.
- Production path: at least one test drives `gherkinIntegration(...).hooks['astro:config:setup']`,
  not only the helper.

## Risks & Mitigations

- **Glossary loading on sites without a glossary.** `loadGlossary` returns
  `present: false`; then do not pass `knownContexts`. Test it, so a site without
  a glossary gets no warnings.
- **Determinism.** Iterate keys in sorted order; warnings must be stable.

## Review Guidance

- **Lookup**: matches whole segments, longest first; `ship` never matches
  `shipments`.
- **Unknown-context check**: absent in the CLI path, present in the integration.
- **Bytes**: unmapped pages are byte-identical; mapped pages change only in
  `glossary_context`.
- **`lint`**: reaches `renderFeatureBody` but has no effect yet.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP02 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP02 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
