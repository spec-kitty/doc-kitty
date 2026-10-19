---
work_package_id: WP05
title: Draft notice on every draft page
dependencies: []
requirement_refs:
- FR-016
- NFR-005
- SC-003
planning_base_branch: feat/gherkin-authoring-aids
merge_target_branch: feat/gherkin-authoring-aids
branch_strategy: Planning artifacts for this mission were generated on feat/gherkin-authoring-aids. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/gherkin-authoring-aids unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-authoring-aids-01M59A5E
base_commit: c39bfb90cbd0f937d93fe9ee0ae922028230584c
created_at: '2026-10-19T06:40:42.868685+00:00'
subtasks:
- T020
- T021
- T022
- T023
phase: 'Phase 3 - #198 presentation'
history:
- at: '2026-10-19T06:13:13Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent:
- src/components/slots/DraftNotice.astro
- src/tests/draft-notice.test.ts
execution_mode: code_change
model: ''
owned_files:
- src/components/slots/DraftNotice.astro
- src/components/PageTitle.astro
- src/styles/dk-components.css
- src/scripts/assert-chrome-artifacts.mjs
- src/tests/draft-notice.test.ts
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP05 – Draft notice on every draft page

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `frontend-freddy`
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
Use language identifiers in code blocks: ````astro`, ````css`

---

## Objectives & Success Criteria

Every page whose `doc_status` is `draft`, of any `kind`, shows a visible text
notice that it is a draft (FR-016, D10). Today
`src/components/slots/MetadataBand.astro:11` and `PageTitle.astro`
(`showBand = isPublished(...)`) make draft pages render **no** band, so a draft
looks exactly like an active page.

**Done when**:

- The built example shows exactly one `.dk-draft-notice` on every draft page,
  including the `@wip` feature `/behaviour/shipping/track-consignment/`, and
  none on active pages.
- The notice CSS uses tokens only, and a test enforces it.
- The drafts-off build passes the artifact checks.

## Context & Constraints

- Spec: FR-016, NFR-003, NFR-005, SC-003; US3 scenario 3; edge case "Draft notice
  when drafts are not built".
- Contract: `contracts/specification-layout.md`, "Draft notice markup". Copy it
  exactly:

  ```html
  <p class="dk-draft-notice"><span class="sr-only">Document status: </span>Draft. This page is work in progress and may change.</p>
  ```

  It has no landmark role, no `role="alert"` and no `role="banner"`. Do not use
  Starlight's `draft` frontmatter or its `banner` (research R-07).
- Check which visually-hidden utility class the repo already uses (`sr-only`,
  `sl-sr-only` or a `dk-` one) and use that; do not invent another.
- `PageTitle.astro` (around lines 55–115) handles Persona pages specially
  (`isPersona` skips the hero, Default title and band). The notice must still
  render for a draft **Persona** page. Place it so both branches get it, and
  test a Persona draft if the example has one; otherwise unit-test the branch
  logic.
- Put the notice **outside** the `dk:metadata-band` slot wrapper. A theme that
  overrides the band slot must not remove the draft notice.
- Tokens: `--dk-color-warning`, `--dk-color-warning-bg`, `--dk-space-*`,
  `--dk-radius-md`, `--dk-text-sm`. Check the exact names in
  `src/styles/theme.css` and the brand `tokens.css`. No raw colours, no `--sl-*`,
  no bare lengths.
- Built-artifact checks live in per-concern modules that
  `assert-build-artifacts.mjs` imports. `assert-chrome-artifacts.mjs` is the
  chrome module (zero dependencies, string search) and is yours to extend. CI
  runs the artifact checks against `example/dist-nodrafts` as well
  (`.github/workflows/ci.yml:262`), where draft pages do not exist. Your checks
  must pass there.

## Branch Strategy

- **Strategy**: populated by finalize-tasks
- **Planning base branch**: feat/gherkin-authoring-aids
- **Merge target branch**: feat/gherkin-authoring-aids

Implement with:

```bash
spec-kitty agent action implement WP05 --agent claude --mission gherkin-authoring-aids-01M59A5E
```

## Subtasks & Detailed Guidance

### Subtask T020 – `DraftNotice.astro`

- **Steps**:
  1. Create `src/components/slots/DraftNotice.astro`, rendering the contract
     markup with no props. The caller decides whether to render it.
  2. Keep the copy in the component, so the text has one source.
- **Files**: `src/components/slots/DraftNotice.astro` (new).

### Subtask T021 – `PageTitle.astro` renders it for drafts

- **Steps**:
  1. Compute `isDraft = data.doc_status === 'draft'`. Read it exactly as the
     band logic reads `doc_status`.
  2. Render `<DraftNotice />` once, after the band position, outside the
     `dk:metadata-band` slot, for **every** kind including Persona.
  3. Leave everything else byte-identical for non-draft pages. A test or the
     artifact checks must show active pages are unchanged around the title.
- **Files**: `src/components/PageTitle.astro`.

### Subtask T022 – Token-only CSS and literal guard

- **Steps**:
  1. Add `.dk-draft-notice` rules to `src/styles/dk-components.css`:
     - a warning-tinted surface with a border or inline-start bar;
     - `padding` and `margin` from spacing tokens, radius from tokens;
     - text in the body colour, with enough contrast on the warning background
       in both themes (the axe lane checks it in WP06).
  2. **Red first**, in a new `src/tests/draft-notice.test.ts`:
     - read `dk-components.css` as text (like `layout-css-contract.test.ts`);
     - extract the `.dk-draft-notice` rules;
     - fail on any hex colour, `rgb(`, `hsl(`, named colour or bare length
       (`\b\d+(px|rem|em)\b`) outside `var(...)`;
     - **positive control in the same test**: assert at least one `var(--dk-`
       declaration exists in those rules, so an empty rule set cannot pass.
- **Parallel?**: Yes.

### Subtask T023 – Built-artifact assertions

- **Steps**:
  1. In `assert-chrome-artifacts.mjs`, add a check:
     - find the built draft pages (pages whose source has `doc_status: draft`,
       or scan HTML for the `noindex` marker drafts get; pick the robust
       signal);
     - **if any exist**, each has exactly one `class="dk-draft-notice"`;
     - a known active page (e.g. `/behaviour/shipping/book-consignment/`) has
       none;
     - if **no** draft pages exist (the drafts-off dist), assert no page has a
       notice, and pass.
  2. Fail with a precise message, in the style of the other checks.
  3. Run against a local build:
     - `pnpm --filter example build`, then `pnpm assert:artifacts`;
     - also the drafts-off build CI uses (see `ci.yml` near line 262 for the
       env var), then run the script on that dist.
- **Files**: `src/scripts/assert-chrome-artifacts.mjs`.

## Test Strategy

- **Red first** for the CSS guard and the artifact check. Remove the component
  call to show the check fails.
- `pnpm test -- draft-notice layout-css-contract`, the full `pnpm test`, the
  example build plus `pnpm assert:artifacts`, and the drafts-off build plus the
  script.
- The Playwright lanes run in WP06 (it adds the draft route). Optionally run
  `pnpm test:a11y` here for an early signal.

## Risks & Mitigations

- **Changed HTML on every draft page.** This was accepted (D10). Note it in the
  WP history for the CHANGELOG (WP08).
- **Visual baselines.** If a Playwright visual baseline covers a draft page,
  update it in WP06 or here, with a note.

## Review Guidance

- **Markup and copy**: match the contract exactly; no ARIA live or landmark
  roles.
- **Placement**: the notice survives a theme overriding `dk:metadata-band`, and
  renders on Persona drafts.
- **Drafts-off**: the drafts-off dist passes the checks.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP05 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP05 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
