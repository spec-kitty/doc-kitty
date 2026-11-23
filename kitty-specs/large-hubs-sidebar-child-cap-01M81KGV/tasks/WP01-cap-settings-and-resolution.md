---
work_package_id: WP01
title: Cap settings and resolution
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-006
- C-005
planning_base_branch: feat/341-sidebar-child-cap
merge_target_branch: feat/341-sidebar-child-cap
branch_strategy: Planning artifacts for this mission were generated on feat/341-sidebar-child-cap. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/341-sidebar-child-cap unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
- T004
- T005
- T006
history:
- timestamp: '2026-11-23T00:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/child-cap.ts
create_intent:
- src/lib/child-cap.ts
- src/tests/child-cap.test.ts
execution_mode: code_change
owned_files:
- src/lib/child-cap.ts
- src/lib/config.ts
- src/lib/chrome-options.ts
- src/lib/sections.ts
- src/lib/schema.ts
- src/scripts/validate-frontmatter.mjs
- src/lib/i18n-plugin.ts
- src/tests/child-cap.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP01 — Cap settings and resolution

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Every place a cap can be set is read and validated, and one pure module resolves a hub's cap, the producer hint and the capped-entry label. Requirements: FR-001, FR-002, FR-006, FR-008 (helper), FR-009 (exports). Plan: IC-01.

## Shared context

- Mission documents: `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/cap-api.md`, `decisions/`.
- Stack: Node 22+, TypeScript 5 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42. Add, upgrade or remove no dependency.
- Red first: write each test, run it, see it fail for the right reason, then implement.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` clean with no suppressions.
- Branch strategy: planning base and merge target `feat/341-sidebar-child-cap`; the lane worktree comes from `lanes.json`.
- Implement with `spec-kitty agent action implement <WP> --agent claude --mission large-hubs-sidebar-child-cap-01M81KGV`.

## Subtasks

### T001 — Red first

`src/tests/child-cap.test.ts`:
- `resolveChildCap`: each level wins over the less specific ones, set to different values; nothing set → 50.
- `cappedChildHidden(51, 50)` true, `(50, 50)` false.
- `resolveCappedLabel(200)` → `200 pages`; a translation (`locals.t` stub) wins over the default; the option wins over both; i18next echoing the key counts as no translation; `{count}` replaced everywhere it occurs.
- `defineDocKittyIntegrations({ sidebar: { childCap: 0 | -1 | 1.5 | '10' } })` throws `[dk-config] sidebar.childCap must be a positive whole number`; blank `cappedLabel` throws; the unknown-key message lists `childCap` and `cappedLabel`.
- `parseSectionRegistry` with `sidebar: { childCap: 0 }` throws naming the section; a valid value lands on the entry as `entry.sidebar = { childCap }`.
- Frontmatter: the docs schema keeps `sidebar_child_cap: 10` and rejects `0`; `validate-frontmatter` reports `sidebar_child_cap` that is not a positive integer.

### T002 — `src/lib/child-cap.ts`

Pure, fs-free. Exports exactly the contract in `contracts/cap-api.md`: `DEFAULT_CHILD_CAP`, `CAPPED_LABEL_KEY`, `CAPPED_ENTRY_LABEL`, `HubCap`, `HubCapMap`, `resolveChildCap`, `cappedChildHidden`, `resolveCappedLabel`, plus `isChildCap(value)` (positive safe integer) used by every validator so the rule has one definition.

### T003 — Site option

`config.ts` `DocKittySidebarOptions` gains `childCap?: number` and `cappedLabel?: string`; `splitSidebarOption` validates them with `isChildCap` and returns them. `RouteShapingOptions` (owned by WP02) receives them in WP02; here, expose them from `splitSidebarOption` and add them to the `routeShaping` options object in `defineDocKittyIntegrations` (the interface field is added in WP02; until then keep a local spread typed as the WP02 shape: coordinate by adding the two optional fields to `RouteShapingOptions` as a recorded out-of-map edit).

### T004 — Section setting

`SectionRegistryEntry.sidebar?: { childCap?: number }`; `normalizeSectionEntries` validates a `sidebar` mapping and its `childCap`. Unknown keys under `sidebar` are ignored (open shape, like the rest of the entry).

### T005 — Frontmatter

`schema.ts`: `sidebar_child_cap: z.number().int().positive().optional()` next to the other page-local fields, with a comment. `validate-frontmatter.mjs`: the same rule in its zod shape.

### T006 — UI string

`i18n-plugin.ts`: `SIDEBAR_UI_STRINGS` gains `[CAPPED_LABEL_KEY]: CAPPED_ENTRY_LABEL`.

## Definition of done

- All T001 tests pass; the existing config, sections, schema and i18n tests still pass.
- Lint and typecheck clean.

## Reviewer guidance

Check the validation messages name the setting and where it was set, and that `isChildCap` is the only definition of a valid cap.
