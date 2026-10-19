---
work_package_id: WP08
title: Decisions, documentation and changelog
dependencies:
- WP04
- WP06
- WP07
requirement_refs:
- FR-019
- C-005
- C-006
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: 3faf5fca6872360dce7112785556968f7e73916a
created_at: '2026-10-19T09:37:31.675933+00:00'
subtasks:
- T034
- T035
- T036
- T037
- T038
- T039
phase: Phase 5 - Documentation
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: architect-alphonso
authoritative_surface: docs/
create_intent:
- docs/adr/0061-gherkin-authoring-aids.md
- docs/adr/0062-specification-layout-and-draft-notice.md
execution_mode: code_change
model: ''
owned_files:
- docs/adr/0061-gherkin-authoring-aids.md
- docs/adr/0062-specification-layout-and-draft-notice.md
- docs/adr/README.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
- docs/architecture/gherkin-pages.md
- docs/architecture/theming.md
- CHANGELOG.md
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP08 – Decisions, documentation and changelog

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `architect-alphonso`
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

Record the decisions and document the shipped behaviour in the same PR
(charter: living documentation; FR-019):

- **ADR-0061 "Gherkin authoring aids"** covers #196 and #197. It amends ADR-0046
  (the `@dk:` contract: `allow` read at Rule and Scenario level; the lint
  follow-up closed) and ADR-0028 ("not inherited", for generated pages only).
- **ADR-0062 "Specification layout and draft notice"** covers #198. It adds a
  structural-kind layout under ADR-0011/0013/0015, reverses ADR-0046's "no new
  render code" consequence, sets the generic draft notice, and adds a fifth
  layout to #104's migration list.
- **Guides, architecture pages and CHANGELOG** updated.

**Done when** these pass: `pnpm validate:docs`, `pnpm validate:links`,
`pnpm validate:adr-index`, `pnpm validate:catalog`, and markdownlint on the
changed files. Run Vale too, if it is available locally (CI runs it at error
level).

## Context & Constraints

- Read first:
  - `docs/adr/template.md` and two recent ADRs (0054, 0055) for tone and
    structure;
  - `docs/adr/0046-gherkin-feature-pages.md` and `0028-glossary-frontmatter-fields.md`;
  - the research note `docs/architecture/research/gherkin-authoring-aids.md`
    (decision table D1–D13);
  - the mission `spec.md`, `plan.md` and `research.md` (R-01 to R-10), and
    `contracts/*`.
- **ADRs are immutable once accepted.** Do **not** edit 0046 or 0028. The new
  ADRs amend by reference ("Amends ADR-0046 §…").
- Confirm 0061 and 0062 are the next free numbers (`ls docs/adr`). If not, take
  the next free ones and adjust file names. That is a recorded out-of-map rename.
- The ADR index `docs/adr/README.md` is generated. Regenerate it with the
  repo's script (`node src/scripts/generate-adr-index.mjs`, see `package.json`
  `validate:adr-index`).
- Writing policy (charter): sentence-case headings, no AI-writing tells (em-dash
  overuse, rule-of-three padding, hedging, puffery), and one idea per sentence.
  Frontmatter carries `title`, `description` (50–180 characters), `doc_status`,
  `updated`, and `type` and `kind` where the convention expects them.
- Document what actually shipped. Read the merged code from WP01–WP07. If any
  behaviour differs from this prompt, the code wins; record the difference in
  the history.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP08 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T034 – ADR-0061 "Gherkin authoring aids"

- **Content**:
  - **Context**: the follow-up ADR-0046 promised; the repeated tags and the
    live "policy" collision.
  - **Decision**:
    - `gherkin.defaultGlossaryContext`: resolved at generation into
      frontmatter; longest-prefix match; tag over folder over none; empty tag
      falls through; CLI twin; build-only unknown-context warning (research
      R-02).
    - `gherkin.lint.imperativeSteps`: off by default; warn-only; one core; pages
      and fences; includes and raw fences silent; English only; the default
      phrase list; `verbs`, `extend` and `keywords`.
    - `@dk:allow=imperative`: the first `@dk:` key read below Feature level.
  - **Consequences**: positive, negative, risks. The negatives include the
    generator stamp ignoring config-only changes (pre-existing) and fence
    warnings lost on cache hits in dev.
  - **Alternatives**: Contextive `paths`; exact match; Vale; a CLI lint flag; a
    broad list.
  - **References**: #196, #197; the research note; ADR-0046, ADR-0028,
    ADR-0051, ADR-0054.

### Subtask T035 – ADR-0062 "Specification layout and draft notice"

- **Content**:
  - **Context**: tags and source invisible to readers; drafts look active; the
    TOC already lists scenarios.
  - **Decision**:
    - a base-kind layout with a header card (tags and source; source linked
      only for http(s));
    - the TOC stays the scenario list;
    - the results summary stays in the body (operator decision);
    - a generic draft notice in the page-title carrier for every kind;
    - tokens only;
    - the theme opt-out through the per-kind map.
  - **Consequences**: the HTML change on every draft page; #104 gains a fifth
    layout; feature pages join the geometry and axe lanes.
  - **Alternatives**: a TOC augmentation; a dedicated rail; Starlight `banner`
    or `draft`; a `PageTitle` kind branch.
  - **References**: #198 and #104, ADR-0011, ADR-0013, ADR-0015, ADR-0046,
    ADR-0055.

### Subtask T036 – ADR index

- **Steps**: regenerate `docs/adr/README.md` with the repo script. Run
  `pnpm validate:adr-index`.

### Subtask T037 – Guides

- **`docs/guides/consumer-setup.md`** (Gherkin section, around lines 808 on):
  - an options row for `defaultGlossaryContext`, with an example, the matching
    rule and precedence, the CLI flag, and the warnings;
  - an options row for `lint.imperativeSteps`, with its forms, defaults, scope
    and English-only note.
- **`docs/guides/authoring.md`**:
  - replace "Nothing checks for them yet" (around lines 315–317) with how to turn
    the check on;
  - list the default phrases (copy them from WP03's
    `DEFAULT_IMPERATIVE_PHRASES` JSDoc), the known-ambiguous verbs for
    `extend`, and `@dk:allow=imperative` with an example.
  - The "reads badly" example is a `gherkin raw` fence, so it never warns. Keep
    it that way.
- **Parallel?**: Yes.

### Subtask T038 – Architecture pages

- **`docs/architecture/gherkin-pages.md`**:
  - context resolution in "The mapping contract";
  - a short "Authoring lint" section: pipeline position, surfaces, the cache-hit
    limit;
  - the Specification layout in the relevant section;
  - in "Limits": the stamp ignores config-only frontmatter changes, and the lint
    is English only;
  - **fix the stale pointer** at line 664 (side finding): "until #113" names a
    closed, unrelated issue. Say that embedded steps are not glossary-linked,
    without the issue reference, or point to an open tracking issue if one
    exists.
- **`docs/architecture/theming.md`**: add `Specification` to the per-kind layout
  list, and the draft notice to the carrier description.
- **Parallel?**: Yes.

### Subtask T039 – CHANGELOG

- **Steps**: under `## [Unreleased]` in `CHANGELOG.md`, add entries in the
  file's existing style:
  - **Added**: the folder default glossary context (#197); the imperative-step
    lint (#196); `@dk:allow=imperative`; the Specification layout (#198); the
    draft notice on every draft page.
  - **Changed**: draft pages now show a notice; feature pages use the
    Specification layout by default.
  - **Example**: shipping tags replaced by the folder map.

## Test Strategy

- `pnpm validate:docs && pnpm validate:links && pnpm validate:adr-index && pnpm validate:catalog`
- `npx --no-install markdownlint-cli2 <changed files>`
- Vale at error level on the changed files, if installed.

## Risks & Mitigations

- **ADR number collision with concurrent work on main.** Re-check at implement
  time and before the PR.
- **Docs drift from code.** Read the merged code, not this prompt, when they
  differ.

## Review Guidance

- **ADRs**: no accepted ADR edited; the new ADRs state exactly what they amend.
- **Coverage**: every new option, flag, tag, warning and the layout is
  documented, with an example.
- **Side finding**: the stale "#113" pointer is fixed.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP08 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP08 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
