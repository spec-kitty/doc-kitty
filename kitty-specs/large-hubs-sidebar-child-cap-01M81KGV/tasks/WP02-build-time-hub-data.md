---
work_package_id: WP02
title: Build-time hub data
dependencies:
- WP01
requirement_refs:
- FR-004
- FR-009
- C-002
- C-003
- NFR-003
planning_base_branch: feat/341-sidebar-child-cap
merge_target_branch: feat/341-sidebar-child-cap
branch_strategy: Planning artifacts for this mission were generated on feat/341-sidebar-child-cap. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/341-sidebar-child-cap unless the human explicitly redirects the landing branch.
subtasks:
- T007
- T008
- T009
- T010
history:
- timestamp: '2026-11-23T00:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/route-shaping.ts
create_intent:
- src/tests/hub-caps-data.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/route-shaping.ts
- src/lib/route-shaping-module.d.ts
- src/tests/hub-caps-data.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP02 — Build-time hub data

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

The route-shaping integration computes, for each hub over its cap, the resolved cap, the child count and the ordered children, with the same selection the hub page uses, and serves them in `virtual:doc-kitty/route-shaping`. Requirements: FR-004, FR-009, C-003. Plan: IC-02.

## Shared context

- Mission documents: `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/cap-api.md`, `decisions/`.
- Stack: Node 22+, TypeScript 5 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42. Add, upgrade or remove no dependency.
- Red first: write each test, run it, see it fail for the right reason, then implement.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` clean with no suppressions.
- Branch strategy: planning base and merge target `feat/341-sidebar-child-cap`; the lane worktree comes from `lanes.json`.
- Implement with `spec-kitty agent action implement <WP> --agent claude --mission large-hubs-sidebar-child-cap-01M81KGV`.

## Subtasks

### T007 — Red first

`src/tests/hub-caps-data.test.ts`, on a temporary docs tree (write files under a tmp dir and pass it as `docsDir` with `process.cwd()` set, as existing route-shaping integration tests do):
- A hub with 6 children and `sidebar_child_cap: 5` is emitted with `count: 6`, `cap: 5` and children in `selectHubChildren` order (title, then slug), including a sub-folder as one child (its index slug), excluding a draft child.
- A hub with 5 children and cap 5 is not emitted.
- Section `sidebar.childCap` and site `childCap` apply when the hub sets nothing; most specific wins.
- A withheld draft (`state.unpublishedPaths`) is not counted.
- `label` is `sidebar.label` when set, else `title`.
- `cappedLabel` is serialised only when the site set it.
- Two calls emit identical module text (NFR-003).

### T008 — Page read

`directoryMetaInputs` (or a sibling reader over the same walk, so the files are read once) also returns `doc_status`, `sidebar_child_cap` and `sidebar.label` per page.

### T009 — Hub data

For each directory with an index page: children = `selectHubChildren(entries, dir, order)` over `{ slug, data: { title, doc_status } }`, where `order` comes from `sectionOrder(registry)`. Cap = `resolveChildCap({ hub: index frontmatter, section: registry entry for sectionOf(dir), site: options.childCap })`. Emit only when `count > cap`. Sort by dir (code unit).

### T010 — Module

`routeShapingSource` adds `hubCaps: [...]` and, when set, `cappedLabel`. `RouteShapingOptions` gains `childCap?`, `cappedLabel?`. `route-shaping-module.d.ts` gains the two fields, typed from `child-cap.ts`.

## Definition of done

T007 passes; existing route-shaping integration tests pass; lint and typecheck clean.
