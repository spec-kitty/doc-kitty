---
work_package_id: WP01
title: Fixture and red browser check
dependencies: []
requirement_refs:
- FR-005
- FR-006
- NFR-001
- NFR-002
- NFR-003
- SC-003
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts for this mission were generated on main. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into main unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5
base_commit: e1eca87e0e1a3eaf2f3ff406868c0449c5f4832c
created_at: '2026-11-21T22:11:46.561378+00:00'
subtasks:
- T001
- T002
- T003
- T004
history: []
agent_profile: frontend-freddy
authoritative_surface: tests/a11y/
create_intent:
- example/docs/architecture/diagram-contrast-fixture.md
- tests/a11y/diagram-legibility.spec.ts
- tests/a11y/helpers/legibility.ts
execution_mode: code_change
owned_files:
- example/docs/architecture/diagram-contrast-fixture.md
- tests/a11y/diagram-legibility.spec.ts
- tests/a11y/helpers/legibility.ts
- tests/a11y/routes.ts
role: implementer
tags: []
tracker_refs:
- spec-kitty/doc-kitty#369
- spec-kitty/doc-kitty#370
---

# WP01 — Fixture and red browser check

## ⚡ Do This First: Load Agent Profile

Load the assigned profile with `/spk-charter-profile-load frontend-freddy`
before reading anything else.

## Objective

Reproduce #369 item 2 and #370 on one example page, and add one Playwright
spec that measures every label and themed edge on it in both colour projects,
at 1280 px and 390 px. The spec is committed **red** before WP02 starts.

## Branch strategy

Planning branch: `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`;
final merge target: `main`. The worktree comes from `lanes.json`.

## Constraints

- Do not edit `playwright.config.ts`, `package.json` or any workflow (PR #405
  owns them, ruling R36). The a11y lane picks up a new spec through `testDir`.
- No new dependency.

## T001 — Fixture page

`example/docs/architecture/diagram-contrast-fixture.md`, frontmatter per the
convention (`title`, `description`, `doc_status: active`, `updated`, `type:
Architecture`, `kind: Reference`, `related`). Four diagrams:

1. Mermaid flowchart with long node, edge and subgraph labels (no author font).
2. The same shape with the consumer's init directive:
   `%%{init: {'theme':'base','themeVariables': {'fontFamily': 'Trebuchet MS, Verdana, Arial, sans-serif', 'fontSize': '14px'}}}%%`.
   This one clips on `main` (research R2).
3. Mermaid author fills: a pale fill with no `color`, a deep fill with no
   `color`, and a deep fill with `color:#ffffff`; one `linkStyle` author edge.
4. PlantUML ArchiMate (`archimate #Business …`, `#Application`, `#Technology`).

Prose follows the documentation policy (sentence-case headings, no filler).

## T002 — Legibility helper (`tests/a11y/helpers/legibility.ts`)

Measure from pixels (research R4):

1. In the page, collect every label (Mermaid `foreignObject` content, SVG
   `text`) and every themed edge (Mermaid `path.flowchart-link`, PlantUML
   `g.link > path`) inside `figure.dk-diagram svg`. Record foreground colour
   (computed `color` for HTML, `fill` for SVG text; `stroke` for edges), the
   label's box from a `Range` over its text, and 8 points along each edge.
   An edge whose stroke is not `var(--dk-diagram-edge)` (an author `linkStyle`)
   is reported as `authored` and not asserted.
2. Hide them all (`visibility:hidden`), take one full-page screenshot, restore.
3. Decode the PNG in a page canvas; the label backdrop is the most frequent
   pixel colour in its box, the edge backdrop is the pixel at each point.
4. WCAG relative-luminance contrast. Also report every `foreignObject` whose
   content `scrollWidth`/`scrollHeight` exceeds its box by more than 1 px.

## T003 — Spec (`tests/a11y/diagram-legibility.spec.ts`)

For each viewport width (1280, 390): `gotoInMode` the fixture, skip when
`renderModeOf` is `client` (the defects are build-only), wait for
`document.fonts.ready`, measure, then assert with messages naming the label:
labels ≥ 4.5:1, themed edges ≥ 3:1, zero overflow. Assert non-vacuity: at least
4 figures, at least 20 labels, at least 8 themed edges.

## T004 — Route and red proof

Add `diagramContrast` to `ROUTES` in `tests/a11y/routes.ts`. Build
(`DK_DIAGRAM_BUILD_RENDER=1 pnpm build:a11y` and the drafts-off dist), run the
spec, and record the red output in the commit message: dark-mode ArchiMate and
pale-fill labels below 4.5:1, three clipped labels.

## Definition of Done

- Spec red on `main` for the reasons above and for no other reason.
- `pnpm validate:example`, `pnpm validate:links` and lint pass.

## Reviewer guidance

Check the spec is not vacuous (counts asserted), that author edges are the only
exclusion, and that the backdrop is measured, not assumed.
