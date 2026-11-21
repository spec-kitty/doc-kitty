---
work_package_id: WP02
title: Font pinning and author-fill label contrast
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- NFR-004
- C-002
- C-003
- C-004
- C-005
- SC-001
- SC-002
planning_base_branch: main
merge_target_branch: main
branch_strategy: Planning artifacts were generated on kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5, which merges into main. Execution worktrees are allocated per computed lane from lanes.json.
subtasks:
- T005
- T006
- T007
- T008
- T009
agent: claude
history: []
agent_profile: node-norris
authoritative_surface: src/lib/rehype/
create_intent:
- src/lib/rehype/diagram-label-contrast.ts
- src/tests/diagram-label-contrast.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/diagrams.ts
- src/lib/rehype/diagram-label-contrast.ts
- src/styles/dk-components.css
- src/tests/diagram-label-contrast.test.ts
- src/tests/diagram-preset.test.ts
role: implementer
tags: []
tracker_refs:
- spec-kitty/doc-kitty#369
- spec-kitty/doc-kitty#370
---

# WP02 — Font pinning and author-fill label contrast

## ⚡ Do This First: Load Agent Profile

Load the assigned profile with `/spk-charter-profile-load node-norris` before
reading anything else.

## Objective

Turn the WP01 spec green: Mermaid labels are measured and shown in one font
(#370), and a label on an author fill contrasts with that fill (#369 item 2).

## Branch strategy

Planning branch: `kitty/mission-diagram-dark-contrast-label-clipping-01M801Y5`;
final merge target: `main`. The worktree comes from `lanes.json`.

## Constraints

- Not `src/lib/config.ts`, `src/lib/theme.ts` or
  `src/lib/diagram/diagram-render.client.ts` (PR #405, ruling R36).
- No new dependency, no font file (C-003). The six-token sentinel contract
  stays as it is (C-005).

## T005 — Render-page font pin

In `src/lib/integrations/diagrams.ts`: export `DIAGRAM_LABEL_FONT_STACK =
'Arial, Helvetica, "Liberation Sans", Arimo, sans-serif'` and a render-page
stylesheet that sets it with `!important` on `svg foreignObject` and its
descendants. Hand it to `@beoe/rehype-mermaid` as `css` (a `data:text/css`
URL; `mermaid-isomorphic` loads it with `addStyleTag`). Add it to the
`withMermaidDiskCache` salt so cached renders measured in the old font are
invalidated.

## T006 — Display-side font pin

In `src/styles/dk-components.css`, apply the same stack with `!important` to
`foreignObject` content inside `.dk-diagram svg` and inside the lightbox copy
(`.dk-lightbox__content`). Comment why it must equal the render stylesheet.

## T007 — Mermaid author-fill pass

New `src/lib/rehype/diagram-label-contrast.ts`, a rehype plugin running after
`sentinelThemeRewrite`. For each `g.node` / `g.cluster` in a Mermaid `<svg>`:
the shape's fill comes from its inline `style` (`fill:#…`) or `fill` attribute;
a literal colour (not `var(…)`) is an author fill. If the label element
(`span.nodeLabel`, cluster label span) carries no author `color`, set
`color:<black|white>!important`, whichever contrasts more with the fill
(always ≥ 4.58:1). Parse `#rgb`, `#rrggbb`, `rgb()`; skip anything else.

## T008 — PlantUML author-fill pass

PlantUML reaches rehype as a `raw` node string. Within each
`<g class="entity" …>…</g>` block, read the first shape's literal `fill`; if it
is an author fill, replace `fill="var(--dk-diagram-node-text)"` on that block's
`<text>` elements with the contrast colour. Leave every other byte unchanged.

## T009 — Registration and tests

Register the pass after `sentinelThemeRewrite` and before `diagramFigure` in
the build branch. Unit tests: pale and deep fills, author colour kept, themed
fill untouched, cluster, PlantUML block, non-entity raw untouched, mid-grey
fill clears 4.5:1. Extend `diagram-preset.test.ts` for the `css` option and the
rehype order.

## Definition of Done

- `pnpm test`, `pnpm lint`, `pnpm typecheck` green.
- After a fresh build, the WP01 spec is green in both colour projects.

## Reviewer guidance

Revert each half (font pin; contrast pass) and confirm its own WP01 assertions
turn red.
