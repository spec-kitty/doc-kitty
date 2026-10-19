---
work_package_id: WP01
title: Decision records and ADRs
dependencies: []
requirement_refs:
- FR-009
- FR-015
- SC-005
- C-002
planning_base_branch: feat/layout-guards-decisions
merge_target_branch: feat/layout-guards-decisions
branch_strategy: Planning artifacts for this mission were generated on feat/layout-guards-decisions. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/layout-guards-decisions unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
phase: Phase 1 - Foundation
history:
- at: '2026-10-19T06:40:32Z'
  actor: system
  action: Prompt generated via /spec-kitty.tasks
agent_profile: architect-alphonso
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0063-sidebar-carrier.md
- docs/adr/0064-default-frame-cap.md
execution_mode: planning_artifact
model: ''
owned_files:
- docs/adr/0063-sidebar-carrier.md
- docs/adr/0064-default-frame-cap.md
- docs/adr/README.md
- docs/architecture/collapsible-toc-rail.md
- docs/architecture/theming.md
- docs/architecture/starlight-integration.md
- kitty-specs/sidebar-frame-header-carrier-01M4T3CB/acceptance-matrix.json
- kitty-specs/sidebar-frame-header-carrier-01M4T3CB/spec.md
role: implementer
tags: []
task_type: implement
tracker_refs: []
---

# Work Package Prompt: WP01 – Decision records and ADRs

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
Use language identifiers in code blocks: ````python`,````bash`

---

## Objectives & Success Criteria

Record each owner decision where the next maintainer will look, before the code
that depends on it lands. When this WP is done:

- ADR-0063 records that `Sidebar` is the sixth carrier (#203). It amends the carrier
  lock of ADR-0013, ADR-0015 and ADR-0044.
- ADR-0064 records the 120rem default frame cap (#205) and supersedes ADR-0045
  decision 1. ADR-0045 itself is **not** edited (ADRs are immutable; see
  `.kittify/charter/charter.md`, "Amendment and exceptions").
- The rail architecture page records the accepted rail/no-rail column shift (#204)
  with its measured values, and the corrected Starlight tripwire.
- The theming page records the persona card decision (#206) and why centring was
  rejected.
- The earlier mission's records say how FR-010 is now proven, and where the reveal
  half of its NFR-005 went.
- Every row of the research note's "Decisions taken" table is cited from an ADR or an
  architecture page (SC-005).

Requirements: FR-009, FR-015 (docs part), SC-005, C-002.

## Context & Constraints

- **Source of truth for every decision**:
  `docs/architecture/research/layout-guards-and-decisions.md`, sections "Decisions
  taken", "Decisions" and "New findings". Quote its measured numbers; do not
  re-measure.
- Mission spec: `kitty-specs/layout-guards-decisions-01M59CGE/spec.md`
- Plan: `kitty-specs/layout-guards-decisions-01M59CGE/plan.md`, concern IC-01
- Research decisions D-01 to D-05: `kitty-specs/layout-guards-decisions-01M59CGE/research.md`
- **ADR template**: `docs/adr/template.md`, with frontmatter `type: ADR`, `kind: ADR`,
  `authors`, `related` and `doc_status`. Look at `docs/adr/0044-header-carrier.md`
  and `docs/adr/0045-frame-width-token.md` for the house style. They are short
  sections, one idea per sentence, sentence-case headings, and no em-dash padding.
- **Supersession convention**: the new ADR says what it supersedes in its Decision
  and in `related`; the old ADR keeps `## Status` "Accepted". ADR-0009 superseding
  part of ADR-0005 is the precedent, so read how ADR-0009 words it.
- **Docs rules** (`AGENTS.md`): the required frontmatter is `title`, `description`
  (50 to 180 characters), `doc_status` and `updated`. `type` and `kind` are optional
  but used on every ADR.
- These docs describe behaviour that WP03 and WP05 implement in the same mission PR.
  Write them for the shipped state.

## Branch Strategy

- **Strategy**: Planning artifacts were generated on feat/layout-guards-decisions; completed changes must merge back into feat/layout-guards-decisions.
- **Planning base branch**: feat/layout-guards-decisions
- **Merge target branch**: feat/layout-guards-decisions

> These fields are populated automatically by `spec-kitty agent mission finalize-tasks`.
> Execution worktrees are allocated per computed lane from `lanes.json`; do not pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP01 --agent claude --mission layout-guards-decisions-01M59CGE
```

## Subtasks & Detailed Guidance

### Subtask T001 – Write ADR-0063: `Sidebar` is the sixth carrier

- **Purpose**: The owner chose to inline the reveal script right after the sidebar
  markup (#203). Only a `Sidebar` component override can place it there, and the
  carrier map is locked at five. The lock is an ADR decision, so changing it needs
  an ADR.
- **Steps**:
  1. Run `ls docs/adr` and confirm 0063 is free. If another ADR took it, use the next
     free number and tell the orchestrator so ADR-0064's number moves too.
  2. Create `docs/adr/0063-sidebar-carrier.md` with:
     - **Context.** On a first visit the reveal ran on `DOMContentLoaded`, so the
       sidebar painted at the top and jumped later. Use the measured figures: about
       60 ms locally, about 2 s with a slow HTML tail, about 4 s with slow module
       scripts. Starlight 0.42 has no reveal of its own: `SidebarPersister` restores
       the scroll position only on in-session navigation, from an inline script
       after the tree. Upstream closed a reveal pull request
       (withastro/starlight#2012) in favour of persistence. Two options were
       weighed: a head-script `MutationObserver` with no new carrier, or an inline
       script after the sidebar markup.
     - **Decision.**
       - `Sidebar` becomes the sixth carrier. It renders Starlight's own
         `@astrojs/starlight/components/Sidebar.astro` unchanged and then emits the
         reveal as one inline script.
       - Because Starlight's `Sidebar` contains `SidebarPersister`, whose closing
         script restores the scroll position, anything emitted after it runs after
         the restore.
       - The head entry for the reveal script is removed.
       - The carrier map is fixed at six. The escape-hatch ordering stays: carriers
         are applied after consumer overrides.
     - **Consequences.**
       - The carrier lock in ADR-0013, ADR-0015 and ADR-0044 now reads "six".
       - The sidebar markup is Starlight's plus one script. A Starlight upgrade that
         changes `Sidebar` props must be re-checked: add it to the tripwire.
       - The reveal is measured at first paint, not through layout shift. The reveal
         half of the earlier mission's NFR-005 is replaced by this mission's NFR-005.
     - **Related**: `adr/0013-m1-chrome-substrate-single-layer`,
       `adr/0015-*` (find its exact slug), `adr/0044-header-carrier`,
       `architecture/collapsible-toc-rail`.
  3. Set `## Status` to `Accepted`. The owner decided on 2026-10-19; check the
     research note.
- **Files**: `docs/adr/0063-sidebar-carrier.md` (new, about 60 to 90 lines)
- **Parallel?**: Yes, with T002.
- **Notes**: Name the alternative that was declined and why the owner chose this one:
  exact placement and no timing assumption.

### Subtask T002 – Write ADR-0064: the frame is capped at 120rem by default

- **Purpose**: ADR-0045 decision 1 made full width the default and the cap opt-in.
  The owner reversed that for 0.5.0 (#205).
- **Steps**:
  1. Create `docs/adr/0064-default-frame-cap.md`.
  2. **Context.** At 2560 px, uncapped, there are 512 px of empty space on each side
     of the column on a rail page and 656 px on a page without a rail. The cost is
     the eye and pointer travel from the navigation to the text. Include the
     research note's cap table: none / 90rem / 100rem / 120rem.
  3. **Decision.**
     - `--dk-width-frame` defaults to `120rem`. The `@property` registration's
       initial value is `120rem` too, so an invalid value still gives the default.
     - A site keeps full width with `:root { --dk-width-frame: 100%; }`.
     - This supersedes ADR-0045 decision 1 only. Decisions 2 onward stand: the
       sidebar, header content and rail still follow a capped frame.
  4. **Why 120rem.**
     - It leaves every layout at 1920 px and narrower unchanged: the frame is
       1920 px.
     - A 90rem or 100rem cap leaves only 24 or 32 px beside the column at 2560 px
       on a rail page. That is why the docs no longer suggest 90rem. (The
       117rem threshold in the research applies only to the declined
       anchored-column option for #204; do not cite it as a reason.)
     - At 2560 px the margin on a rail page drops from 512 px to 192 px.
  5. **Consequences.**
     - It is a breaking visual change for every consumer above 1920 px, shipped in
       a 0.x minor release (0.5.0) with a changelog migration line.
     - The 2560 px geometry expectations move.
     - ADR-0045 keeps its status; this ADR records the supersession.
  6. `related`: `adr/0045-frame-width-token`, `adr/0053-reading-width`,
     `architecture/collapsible-toc-rail`, `guides/consumer-setup`.
- **Files**: `docs/adr/0064-default-frame-cap.md` (new, about 60 to 80 lines)
- **Parallel?**: Yes, with T001.

### Subtask T003 – Regenerate and check the ADR index; cross-link related ADRs

- **Steps**:
  1. Read the header of `src/scripts/generate-adr-index.mjs` for how it is run;
     `package.json` has `validate:adr-index` (`--check`). Run the generator without
     `--check` to rewrite `docs/adr/README.md`, then run
     `pnpm validate:adr-index`.
  2. Do not edit the text of ADR-0013, ADR-0015, ADR-0044 or ADR-0045. They are
     immutable; the new ADRs point back to them.
- **Files**: `docs/adr/README.md` (generated)
- **Validation**: `pnpm validate:adr-index` exits 0.

### Subtask T004 – Update the rail architecture page

- **Purpose**: #204 was decided as "accept and document"; FR-009 makes that a
  recorded decision. This page also carries the carrier list and the upgrade
  tripwire.
- **Steps** in `docs/architecture/collapsible-toc-rail.md`:
  1. **Add a section on the rail/no-rail shift.** State that it is accepted, with
     the table: column x on a rail page vs a page without one, at 1280, 1440, 1600,
     1920 and 2560, as measured in the research note. Then explain:
     - Stock Starlight shifts too.
     - 26 of the 68 framed example pages have no rail, because a near-empty outline
       drops it (FR-011 of the earlier mission).
     - Reserving the rail was rejected because it costs pages without a rail 30% of
       their reading width.
     - The header search now tracks the column (#216), so the column and the search
       move together.
  2. **Update the carrier list** (around lines 73 to 78 in the current file) from
     five to six. Add `Sidebar` and link ADR-0063.
  3. **Re-stamp the upgrade tripwire.** It currently says it was verified against
     `@astrojs/starlight@0.32.6` (around line 96). Change it to 0.42.6, and add
     `Sidebar` props and the persister element name to what an upgrade must
     re-check. Add "build the no-sidebar fixture page for real", from #199 option 1,
     as a tripwire item.
  4. **Collapsed state.** The column now ends at least 4 px before the toggle from
     72rem (#217): the collapsed pane is padded past the toggle below 84rem.
     Correct the paragraph that says the column is "capped and centred at every
     width from 72rem".
  5. **FR-010.** Replace "verified by simulation only" with: guarded by
     `tests/a11y/no-sidebar-recentre.spec.ts`, a DOM-derived simulation shown to
     match a real `StarlightPage hasSidebar:false` page at all ten measured points.
  6. Fix every remaining claim that Starlight has no cascade layers. 0.42 uses
     `@layer starlight.core`, and unlayered toolkit rules win by layer order.
- **Files**: `docs/architecture/collapsible-toc-rail.md`
- **Parallel?**: Yes, with T005 and T006.
- **Notes**: Bump `updated`. Keep the page's tone and heading style.

### Subtask T005 – Update the theming and Starlight integration pages

- **Steps**:
  1. In `docs/architecture/theming.md`:
     - Record the persona card decision (#206). The card is start-aligned with the
       column and as wide as the metadata band; its default width token
       `--dk-width-passport` now resolves to the band width (50rem); a site can
       still override it.
     - Record that centring was rejected: at 1920 px it put the card's title 329 px
       right of the prose below it, breaking the shared left edge. Stretching was
       rejected too: field values ran to about 120 characters a line.
     - Re-stamp any "Starlight 0.32" tripwire reference (around line 374) to 0.42.6.
     - List `--dk-width-frame`'s new default, 120rem, wherever the page lists width
       tokens.
  2. In `docs/architecture/starlight-integration.md`: wherever the five carriers are
     listed, make it six (add `Sidebar`, link ADR-0063), and note that the reveal
     script now ships from the `Sidebar` carrier, not from `head`.
  3. Run `grep -rn "five carriers\|fifth carrier\|0\.32" docs/architecture` and fix
     each hit in the three owned pages. A hit in an unowned page goes in your
     history note for the orchestrator.
- **Files**: `docs/architecture/theming.md`, `docs/architecture/starlight-integration.md`
- **Parallel?**: Yes.

### Subtask T006 – Amend the earlier mission's acceptance matrix and spec

- **Purpose**: `kitty-specs/sidebar-frame-header-carrier-01M4T3CB/` is the record
  readers follow from FR-010 and NFR-005. It must point at the new proof.
- **Steps**:
  1. In `acceptance-matrix.json`, find the FR-010 entry (`proof_type: code_review`,
     "runtime simulation by two reviewers at 1280 and 1920", "No committed test").
     Change it to name the committed test,
     `tests/a11y/no-sidebar-recentre.spec.ts`, and give the decision: #199,
     DOM-derived simulation, owner decision 2026-10-19. Keep the JSON valid and keep
     the existing key order and style. If a `proof_type` value fits better, such as
     `automated_test`, check the values other entries use and reuse one; do not
     invent one.
  2. In that mission's `spec.md`, the amendment at about line 230 says "Verified by
     simulation only". Add a dated note that FR-010 is now guarded by the test
     above (mission `layout-guards-decisions-01M59CGE`). Add a note on NFR-005 (line
     167) that its reveal half is replaced by
     `layout-guards-decisions-01M59CGE#NFR-005`, measured at first paint. Do not
     rewrite the original requirement text; append dated notes.
  3. Validate the JSON: `node -e "JSON.parse(require('fs').readFileSync('kitty-specs/sidebar-frame-header-carrier-01M4T3CB/acceptance-matrix.json','utf8'))"`.
- **Files**: the two files above
- **Parallel?**: Yes.

## Test Strategy

This WP ships documentation only. Run each check as CI does:

```bash
pnpm validate:docs
pnpm validate:adr-index
pnpm validate:links
pnpm exec markdownlint-cli2 "docs/**/*.md"
vale --minAlertLevel=error docs   # Vale 3.18.0, as pinned in .github/workflows/ci.yml
```

If Vale is not installed, fetch the pinned release into a scratch directory, the
same way `ci.yml` installs it. Do not add it to the repository.

## Risks & Mitigations

- **An ADR number collision** with a concurrently merged ADR. Re-check `docs/adr`
  right before committing.
- **Over-claiming.** The docs describe behaviour WP03 and WP05 deliver. Describe
  exactly what the spec's FRs say, nothing more, so a reviewer can check each claim
  against the code later.
- **Editing an accepted ADR by accident.** `git diff --stat docs/adr` must show only
  0063, 0064 and README.md.

## Review Guidance

- **SC-005**: every row of "Decisions taken" in the research note has a citation in
  ADR-0063, ADR-0064, `collapsible-toc-rail.md`, `theming.md` or the earlier
  mission's records. Reviewers tick them off one by one.
- ADR-0045, ADR-0044, ADR-0015 and ADR-0013 are byte-unchanged.
- The figures quoted match the research note exactly.
- All validators listed under Test Strategy pass.

## Progress & Status

Progress, history, and status all live in the status event log
(`status.events.jsonl`) — never in this prompt file. Do **not** hand-edit a
history section here.

- **Record a progress note**: `spec-kitty agent tasks add-history WP01 --note "<what you did>"`
- **Change WP status**: `spec-kitty agent tasks move-task WP01 --to <status>`
- **View history and status**: `spec-kitty agent tasks status`
