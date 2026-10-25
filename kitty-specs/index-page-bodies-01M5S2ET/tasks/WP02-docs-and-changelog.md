---
work_package_id: WP02
title: Docs and CHANGELOG (#238)
dependencies:
- WP01
requirement_refs:
- FR-006
- C-002
planning_base_branch: fix/index-page-bodies
merge_target_branch: fix/index-page-bodies
branch_strategy: Planning artifacts for this mission were generated on fix/index-page-bodies. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/index-page-bodies unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-index-page-bodies-01M5S2ET
base_commit: c2937bb438264ef8ce0a20e9741f7058c906a122
created_at: '2026-10-25T09:06:25.683790+00:00'
subtasks:
- T005
- T006
- T007
history:
- '2026-10-25: created by /spec-kitty.tasks'
agent_profile: curator-carla
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
model: sonnet
owned_files:
- docs/guides/export-okf-bundle.md
- docs/adr/0059-content-graph-and-okf-alignment.md
- CHANGELOG.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load the `curator-carla` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Make the docs describe the behaviour WP01 shipped (FR-006). A section README whose body is non-empty is exported as a sibling concept page at `<id>.md`, for example `guides/README.md`, and that page is listed first in the section's strict §8 `index.md`. An index with no body is unchanged.

Follow the charter writing policy:
- audience-oriented
- sentence-case headings
- one idea per sentence
- no filler

## Subtasks

### T005: `docs/guides/export-okf-bundle.md`

- Replace the "Known limit" section (~:110-113) with a short description of the overview page.
- Amend "Indexes take the OKF form" (~:92-95) so it says the index stays a §8 entry list, with the overview page as its first entry.

### T006: `docs/adr/0059-content-graph-and-okf-alignment.md`

The ADR is immutable, so add a NEW addendum for #238 and don't edit the accepted text or the #237 addendum. The addendum should:
- say that it supersedes the #237 addendum's item 5 ("Known limit") (~:278);
- record the decision: §8 is silent on prose, so `index.md` stays strict and the README body becomes a sibling concept page at `<id>.md`;
- state why `<id>.md` was chosen: it is collision-free and follows `indexBasename`;
- state that links to a README still resolve to the index.

### T007: `CHANGELOG.md`

Under `[Unreleased]` → `### Fixed`, add a bold impact-first lead with `(#238)`, then before → after.

## Definition of Done

- Docs are accurate against WP01's diff.
- markdownlint and Vale are clean, if they're available locally.
- One commit: `docs: describe exported section overview pages (#238)`.
