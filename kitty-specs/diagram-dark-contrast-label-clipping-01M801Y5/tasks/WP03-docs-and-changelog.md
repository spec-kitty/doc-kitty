---
work_package_id: WP03
title: Docs, changelog and reporting
dependencies:
- WP02
requirement_refs:
- FR-007
- C-001
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this mission were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
subtasks:
- T010
- T011
- T012
history: []
agent_profile: curator-carla
authoritative_surface: docs/
create_intent:
- docs/changelog/unreleased/369-diagram-label-legibility.md
- docs/changelog/unreleased/370-diagram-label-font.md
execution_mode: planning_artifact
owned_files:
- docs/architecture/diagrams.md
- docs/changelog/unreleased/369-diagram-label-legibility.md
- docs/changelog/unreleased/370-diagram-label-font.md
role: implementer
tags: []
tracker_refs:
- spec-kitty/doc-kitty#369
- spec-kitty/doc-kitty#370
---

# WP03 — Docs, changelog and reporting

## ⚡ Do This First: Load Agent Profile

Load the assigned profile with `/spk-charter-profile-load curator-carla` before
reading anything else.

## Objective

Document the new behaviour for adopters and record the root causes.

## Branch strategy

Planning branch: `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`;
final merge target: `main`.

## T010 — Diagrams page

In `docs/architecture/diagrams.md`, add a short section: labels use one
Arial-metric font so they fit; a label on an author fill is black or white,
whichever contrasts more; an author label colour is kept; author edge colours
are the author's. Bump `updated`.

## T011 — Changelog fragment

`docs/changelog/unreleased/369-diagram-label-legibility.md` per
`docs/changelog/unreleased/README.md` (a `section:` key, entry as body). One
entry covering #369 and #370. `pnpm validate:changelog` passes.

## T012 — Root-cause note

Draft the root-cause comment for #369 (item 1 not reproduced, with evidence;
item 2 cause) and #370 (author font drops the label font rule). Report the
consumer finding (no `--dk-diagram-*` re-declaration on docs.spec-kitty.ai) to
the dispatcher; do not edit the consumer.

## Definition of Done

`pnpm validate:docs`, `pnpm validate:links` and `pnpm validate:changelog` pass;
Vale-clean prose.
