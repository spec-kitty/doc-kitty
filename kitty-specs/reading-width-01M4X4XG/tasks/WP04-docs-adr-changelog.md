---
work_package_id: WP04
title: Documentation and release note
dependencies:
- WP02
requirement_refs:
- FR-008
- C-007
- SC-004
planning_base_branch: issue-154-reading-width
merge_target_branch: issue-154-reading-width
branch_strategy: Planning artifacts for this mission were generated on issue-154-reading-width. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-154-reading-width unless the human explicitly redirects the landing branch.
subtasks:
- T016
- T017
- T018
- T019
history:
- timestamp: '2026-10-14T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/architecture/theming.md
create_intent:
- docs/adr/0052-reading-width-and-wide-tables.md
execution_mode: code_change
owned_files:
- docs/architecture/theming.md
- docs/adr/0052-reading-width-and-wide-tables.md
- docs/adr/README.md
- CHANGELOG.md
role: implementer
tags: []
tracker_refs: []
---
# WP04 — Documentation and release note

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`curator-carla`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Tell site owners what changed and how to undo it, and record the decision.
Write from the merged behaviour of WP02 (read its diff), not from the plan
alone.

**Execution mode**: `CHANGELOG.md` is at the repository root, so this is a
`code_change` work package even though it is documentation only.

## Shared context (all work packages)

- **Mission documents** (read before coding): `kitty-specs/reading-width-01M4X4XG/spec.md`, `plan.md` (Implementation Concern Map), `research.md` (R1-R4), `research/code-grounding.md` (files, invariants, gates, measurements), `data-model.md`, `contracts/layout-contract.md`, `quickstart.md`. Decisions: `decisions/DM-*.md` (52rem default; tables only, capped).
- **Stack**: Node 22, pnpm via corepack, TypeScript 5, Astro 5.18.2, Starlight 0.32.6, Playwright 1.62.1. Do not add, upgrade or remove a dependency.
- **Sibling dispatches**: do not touch `src/lib/gherkin/**`, `src/tests/gherkin-*`, `docs/guides/consumer-setup.md`, the `src/lib/config.ts` doc comment, or anything in `src/lib/theme.ts` beyond the width lines in `DEFAULT_TOKENS`.
- **Gates are never loosened** (C-005). A ratchet moves only with recorded evidence. No new size or length ratchet gate.
- **Playwright locally**: build first (`pnpm build:a11y`), then `pnpm exec playwright test <spec> --project=light`. If the pinned headless shell is missing, point Playwright at `/opt/pw-browsers` (a symlink to the preinstalled build is enough); never run `playwright install`.
- **Terminology**: "Mission" for the Spec Kitty work object. Docs convention on any `docs/` page touched: `title`, `description`, `doc_status`, `updated` (bump it).
- **Commits**: Conventional Commits subjects; every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifiers.

## Subtasks

### T016 — ADR-0052

**Steps**: `docs/adr/0052-reading-width-and-wide-tables.md`, frontmatter shaped like `docs/adr/0045-frame-width-token.md` (`type: ADR`, `kind: ADR`, `description` 50-180 characters, `related` to adr/0045-frame-width-token, architecture/theming, architecture/collapsible-toc-rail). Status Accepted (2026-10-14). Context: the 45rem default, the measurements (research/code-grounding.md table), the squashed table. Decision: 52rem; tables only, direct children, from 72rem, centred, inside the pane, capped by `--dk-width-wide` (80rem). Consequences: visible on every site; restore line; opt-out; baselines moved; ADR-0045's 720px figures are of their time (do not edit ADR-0045). Alternatives: 56rem, 60rem, breakout grid, negative margins, rehype wrapper, growing diagrams and code. Then regenerate the index: `node src/scripts/generate-adr-index.mjs` (never hand-edit `docs/adr/README.md`).

### T017 — Theming page

**Steps**: `docs/architecture/theming.md`:
- Token table row "Layout widths": add `--dk-width-wide` and what it feeds.
- In the frame-width section, the "The rail keeps one width" bullet: column is at most `--dk-width-content` (52rem, 832px); 528 / 656 / 832px at 1152 / 1280 / 1600+.
- New subsection "Reading width and wide tables": the two tokens with defaults, what grows (direct-child tables from 72rem, centred, inside the pane, up to the cap), what does not (tables in lists or asides, diagrams, code), the restore line `:root { --dk-width-content: 45rem; }`, the opt-out `:root { --dk-width-wide: 0; }`, link to ADR-0052.
- Bump `updated`.

### T018 — Changelog

**Steps**: root `CHANGELOG.md`, `[Unreleased]` → `### Changed`: one entry leading with what a reader sees: the reading column is wider by default (52rem, was 45rem) and wide tables use the free space beside it on screens 72rem and wider; to keep the old width set `--dk-width-content: 45rem`; to keep tables in the column set `--dk-width-wide: 0`. Mention issue 154 mid-sentence (never start a line with `#` and a number).

### T019 — Docs gates

**Steps**: `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:adr-index`, `pnpm validate:catalog`; markdownlint and Vale if available locally (CI runs them). Record results.

## Definition of Done

- ADR-0052 accepted and indexed; theming page and changelog say the same thing as the code.
- All docs validators green.

## Risks

- ADR number collision with a sibling dispatch: renumber on merge if needed.
- Prose style: sentence-case headings, no em-dash runs, no filler (charter documentation policy).

## Reviewer guidance

Check the restore and opt-out lines are exact and match the token names in the code.

## Branch Strategy

Planning base branch and merge target: `issue-154-reading-width`. Execution worktrees are allocated per computed lane from `lanes.json`; do not choose a base by hand. Start with:

```bash
spec-kitty agent action implement WP04 --agent <name> --mission reading-width-01M4X4XG
```
