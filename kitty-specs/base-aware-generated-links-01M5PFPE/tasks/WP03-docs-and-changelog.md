---
work_package_id: WP03
title: 'Docs and CHANGELOG for #236 and #237'
dependencies:
- WP01
- WP02
requirement_refs:
- FR-006
- C-003
planning_base_branch: fix/base-aware-generated-links
merge_target_branch: fix/base-aware-generated-links
branch_strategy: Planning artifacts for this mission were generated on fix/base-aware-generated-links. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into fix/base-aware-generated-links unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-base-aware-generated-links-01M5PFPE
base_commit: 26f6008f541770e80d03937e12de87700a52ef06
created_at: '2026-10-24T14:32:48.132280+00:00'
subtasks:
- T009
- T010
- T011
history:
- '2026-10-24: created by /spec-kitty.tasks'
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

Make the docs describe the shipped behaviour of WP01 and WP02 (FR-006). Follow the charter's writing policy:
- audience-oriented
- sentence-case headings
- one idea per sentence
- no puffery, hedging or em-dash overuse

Keep frontmatter `updated` current, as the date-validation gate requires.

## Subtasks

### T009: `docs/guides/export-okf-bundle.md`
- State that `--site-url` takes the site origin (`site`), and that the export adds `--base` itself. A URL that already includes the base is accepted.
- Describe how links are written in the bundle:
  - Links to another page's `.md` source become bundle paths.
  - Other site links become absolute URLs under `<site><base>`.
  - A `.md` link with no bundle page is left as written and reported as advisory.
- Name the known limit: section-index page bodies are not exported.

### T010: ADR-0059 addendum
- ADRs are immutable (C-003). Append a dated `## Addendum (2026-10-24): source-relative .md links and base-aware site URL` section after §Link form, or at the end, following any existing addendum convention in `docs/adr/`. Grep for `Addendum` to find it.
- Content: the `.md`-by-id rule, the unresolved-link policy, how the site URL is composed, and a reference to #237.

### T011: CHANGELOG
- Add to the root `CHANGELOG.md` (canonical) under `## [Unreleased]`, creating the heading if it is missing, using the repo's existing section style:
  - **Agent page records now give an absolute `source` (#236).** Before, on a based site, it was a site-relative path that 404'd. After, it equals `_links.self.href` and the index's `source`.
  - **OKF export links work on sites with a base (#237).** Before, links between pages and links to site files lost the base, or pointed one folder too deep. After, `.md` links become bundle paths, and other site links carry `<site><base>`.
- Run the docs sanity gates locally where possible: markdownlint, frontmatter validation, Vale, and link validation (see `package.json` scripts).

## Definition of Done
- The docs gates are green, and one commit `docs: describe base-aware agent source and OKF links (#236, #237)` ends with the attribution trailer.

Implement with `spec-kitty agent action implement WP03 --agent claude --mission base-aware-generated-links-01M5PFPE`.
