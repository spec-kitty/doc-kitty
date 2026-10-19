---
work_package_id: WP07
title: Consumer docs and changelog
dependencies:
- WP02
- WP03
- WP04
- WP05
- WP06
requirement_refs:
- FR-007
- FR-015
- FR-016
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-layout-guards-decisions-01M59CGE
base_commit: c0c44e83d16524564c42ffb93c19c1c72eb633c8
created_at: '2026-10-19T08:37:41.553451+00:00'
subtasks:
- T036
- T037
- T038
- T039
phase: Phase 3 - Guards
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/guides/
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- docs/guides/consumer-setup.md
- docs/guides/adopting.md
- README.md
- CHANGELOG.md
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP07 – Consumer docs and changelog

## ⚡ Do This First: Load Agent Profile

Use the `/spk-charter-profile-load` skill to load the agent profile specified in the frontmatter (or any user-defined profile), and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `curator-carla`
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
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Tell consumers about the new 120rem default page cap and how to opt out (#205), and
record the whole mission in the changelog. When this WP is done:

- `docs/guides/consumer-setup.md` explains the cap: what it is, the 120rem default,
  the one-line opt-out, and why 120rem rather than 90rem. Every 720 px figure is
  corrected for the 960 px column (ADR-0053).
- `docs/guides/adopting.md` and `README.md` mention the cap and the default where a
  new adopter will see it.
- `CHANGELOG.md` has an `[Unreleased]` entry that matches the 0.4.0 entry's
  sections. It marks the default as 💥 Breaking, gives the opt-out line, and lists
  what was added and fixed, with issue numbers.
- The docs validators and Vale pass.

Requirements: FR-007 (docs part), FR-015 (stale figures), FR-016.

## Context & Constraints

- **Decision records**: ADR-0062 (default frame cap) and ADR-0061 (`Sidebar`
  carrier), both written in WP01.
- **Research figures** (`docs/architecture/research/layout-guards-and-decisions.md`,
  #205):
  - At 2560, uncapped, 512 px are empty on each side of the column on a rail page
    and 656 px on a page without a rail. With 120rem: 192 and 336.
  - A 90rem or 100rem cap leaves only 24 or 32 px beside the column at 2560 px on
    a rail page. Do not write that a cap below 117rem brings back a shift: that
    holds only for the anchored-column option the owner declined for #204.
  - 120rem leaves every layout at 1920 px and below unchanged.
- **Stale text found** (Dagmar):
  - `consumer-setup.md` line 442 says the column is "at most 720px";
  - lines 484 to 489 say "a 720px column centred in a 1984px pane";
  - line 448 gives a 90rem example.

  Re-read the section whole; line numbers may have moved.
- This repository has no separate getting-started guide. The entry points are
  `docs/guides/adopting.md` and `README.md`.
- **Changelog format**: read `CHANGELOG.md` lines 1 to 270. `## [Unreleased]` is at
  line 7; the 0.4.0 entry uses `### 💥 Breaking`, `### Added`, `### Changed`,
  `### Fixed` and `### Known limitations`. Match its bullet style, issue-link style
  and tone.
- **Writing rules** (`.kittify/charter/charter.md`, "Documentation policy"): plain
  language, one idea per sentence, sentence-case headings, no em-dash overuse, no
  puffery. Required frontmatter: `title`, `description` (50 to 180 characters),
  `doc_status`, `updated`. Bump `updated` on each page you change.
- What shipped (read the merged lanes' code before writing, so each claim is true):
  - WP02: the determinism guard over every machine surface (#201).
  - WP03: the `Sidebar` carrier and the reveal before first paint (#203).
  - WP04: the header fixture stamp, the carrier-free capture, and
    `pnpm fixture:stock-header` (#207).
  - WP05: the 120rem default (#205), the search aligned with the column (#216),
    toggle clearance (#217), and the band-width persona card (#206).
  - WP06: the no-sidebar recentre guard (#199) and the target-size guard (#202).
  - WP08: the published-sidebar lane (#200). It may land in parallel with this WP;
    describe it from its WP prompt and tell the reviewer to check it against WP08's
    final diff.
  - #204: the column shift between rail and no-rail pages is accepted and
    documented.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

```bash
spec-kitty agent action implement WP07 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T036 – Rewrite the consumer setup cap section; fix the 720 px figures

- **Steps**:
  1. Find the "Cap the page width" section (anchor `#cap-the-page-width`; keep the
     anchor, since the research note and issues link to it).
  2. Rewrite it to say:
     - The frame is capped at 120rem by default (since 0.5.0, ADR-0062).
     - To keep the frame full width: `:root { --dk-width-frame: 100%; }` in your
       theme's token sheet, or wherever the guide already says tokens go. Check the
       rest of the guide.
     - To set another cap, use any length or percentage. A much narrower cap, such
       as 90rem, leaves little space beside the column on very wide screens.
     - What the cap does not change: layouts at 1920 px and narrower.
  3. Fix every 720 px figure in the page: the column is 60rem (960 px) since
     ADR-0053. Recompute any worked example rather than guessing, using the research
     note's numbers or stating the formula.
  4. Replace the 90rem example with 120rem, or keep 90rem only as an "if you want it
     narrower" example, with the shift caveat.
- **Files**: `docs/guides/consumer-setup.md`

### Subtask T037 – Surface the cap in the adopting guide and the README

- **Steps**:
  1. In `docs/guides/adopting.md`, add one short paragraph or bullet where the guide
     covers layout or theming. If it has no such place, use the section about what
     an adopter gets out of the box. Say that the frame is capped at 120rem by
     default, and link the consumer setup section. One or two sentences.
  2. In `README.md`, add one line in the features or configuration list in the same
     spirit. Do not restructure the README.
  3. Check `adopting.md`'s description length: `validate:docs` already warns that it
     is 39 characters. Fix it to 50 to 180 characters while you are there (campsite
     rule, FR-015).
- **Parallel?**: Yes, with T036.

### Subtask T038 – Write the CHANGELOG `[Unreleased]` entry

- **Steps**: under `## [Unreleased]`, add:
  - `### 💥 Breaking`: the page frame is capped at 120rem by default (#205,
    ADR-0062). Sites wider than 1920 px see a centred frame. To keep full width, set
    `:root { --dk-width-frame: 100%; }`.
  - `### Added`, one bullet each:
    - the `Sidebar` carrier (sixth carrier, ADR-0061);
    - the published-sidebar a11y lane (#200);
    - the machine-surface determinism check (#201);
    - the explicit target-size check (#202);
    - the no-sidebar recentre check (#199);
    - the header fixture stamp and `pnpm fixture:stock-header` (#207).
  - `### Fixed`:
    - the sidebar jump on first visit (#203);
    - the header search out of line with the column (#216);
    - the column under the collapsed toggle from 1152 to 1295 px (#217);
    - the persona card leaving a large blank at wide widths (#206).
  - `### Changed`: the column shift between pages with and without a rail is now
    documented as intended (#204); the reveal script moved from `head` to the
    `Sidebar` carrier.

  Follow the existing entry's link format for issues and ADRs.
- **Notes**: Do not add a version number or date: the maintainer cuts 0.5.0.

### Recorded out-of-map edit (assigned by the orchestrator)

- `docs/architecture/markua.md` line 88 still says the carriers are "five since
  ADR-0044". Change it to six, citing ADR-0061. WP01 found this hit outside its
  files. Record the edit in your history note as an out-of-map change with this
  rationale.

### Subtask T039 – Run the docs validators

```bash
pnpm validate:docs
pnpm validate:links
pnpm exec markdownlint-cli2 "docs/**/*.md" "example/docs/**/*.md" README.md CHANGELOG.md
vale --minAlertLevel=error docs   # Vale 3.18.0, as pinned in .github/workflows/ci.yml; fetch to a scratch dir if missing
```

All must pass with no new warnings. Fixing the `adopting.md` description warning
reduces the count.

## Test Strategy

Docs only; the validators above are the tests.

## Risks & Mitigations

- **Describing behaviour that did not ship.** Read the merged code for each bullet.
- **Breaking an anchor** that the issues and the research note link to. Keep
  `#cap-the-page-width`.

## Review Guidance

- Every changelog bullet maps to merged code or a WP08 diff.
- The opt-out line is exact and appears in both the guide and the changelog.
- No 720 px figure remains in `consumer-setup.md`.
- The validators and Vale are clean.

## Progress & Status

- **Record a progress note**: `spec-kitty agent tasks add-history WP07 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP07 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
