---
work_package_id: WP01
title: Document the diagrams option (#153)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-006
- FR-007
- NFR-001
- NFR-002
- NFR-003
planning_base_branch: issue-153-diagrams-option-docs
merge_target_branch: issue-153-diagrams-option-docs
branch_strategy: Planning artifacts for this mission were generated on issue-153-diagrams-option-docs. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-153-diagrams-option-docs unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
owned_files:
- docs/guides/consumer-setup.md
- src/lib/config.ts
- CHANGELOG.md
role: implementer
tags:
- documentation
tracker_refs:
- spec-kitty/doc-kitty#153
---

## Objective

Close #153. Read `../spec.md`, `../plan.md` (D-01..D-03) and
`../research/code-grounding.md`. Every statement you write must map to a cited
line in the grounding note.

## Subtasks

- **T001** Edit only the `diagrams?: boolean` TSDoc (`src/lib/config.ts:151-159`).
  First sentence: "`false` (default): diagram blocks are shown as code, not
  drawn." Keep the existing detail after it. Do not touch the `gherkin` comment.
- **T002** New `## Optional: Diagrams` section before
  `## Optional: Gherkin feature pages`. Cover: `true` vs omitted/`false`;
  build vs client mode and the auto-detect rule; `DK_DIAGRAM_BUILD_RENDER`
  values and the `client` recommendation for CI without Chromium; forced
  `build` does not fall back; Mermaid needs nothing; PlantUML needs build mode
  and `DK_PLANTUML_SERVER_URL` (self-hosted, `/svg/` suffix, never
  plantuml.com); a minimal config; links to `architecture/diagrams` and
  ADR-0040. Bump `updated` to 2026-10-14.
- **T003** Copy `example/` into the scratchpad inside the workspace, apply only
  the guide's config, add a Mermaid page, build with
  `DK_DIAGRAM_BUILD_RENDER=client`, assert `figure.dk-diagram` + `pre.mermaid`
  + the render script; rebuild with the option removed and assert a plain code
  block. Record commands and results in the review notes.
- **T004** CHANGELOG Unreleased → Added, docs entry linking the section.
- **T005** Run the five gates; record exact counts.

## Definition of done

FR-001..FR-007 met, five gates green, scratch build recorded.
