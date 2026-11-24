---
work_package_id: WP02
title: Hub data for every hub (#429)
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-004
- FR-005
- FR-016
- FR-017
- FR-018
- NFR-003
- NFR-005
- C-001
- C-002
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
subtasks:
- T005
- T007
- T008
- T009
- T010
- T011
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/integrations/route-shaping.ts
create_intent:
- src/tests/hub-data-every-hub.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/route-shaping.ts
- src/lib/route-shaping-module.d.ts
- src/lib/route-middleware.ts
- src/lib/openapi/route-middleware.ts
- src/lib/config.ts
- src/tests/hub-caps-data.test.ts
- src/tests/hub-data-every-hub.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP02 — Hub data for every hub (#429)

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

`virtual:doc-kitty/route-shaping` carries one entry for **every** published `kind: Hub` hub, in **every** sidebar mode, with its cap, count, children, `capped` and `pageSize`. The site option `hub.pageSize` is validated and threaded through. A `page` child under a paged hub fails the build. The sidebar output is unchanged.

- Requirements: FR-001, FR-002, FR-003 (site level), FR-004 (site level), FR-005 (data side), FR-016, FR-017 (data side), FR-018 (data side), NFR-003, NFR-005, C-001, C-002.
- Plan: IC-01. Research: R2, R4, R6, R8. Issue #429 acceptance:
  - Every hub has an entry, with or without toolkit sidebar shaping.
  - The sidebar output is unchanged.
  - The types are backward compatible.

## Shared context

- Mission documents: `kitty-specs/large-hubs-paged-hub-listing-01M84WYV/` (spec, plan, research, data-model, `contracts/`).
- Code: `src/lib/integrations/route-shaping.ts`: `directoryMetaInputs` (~line 90), `hubCaps` (~line 155), `routeShapingSource` (~line 207).
- `src/lib/route-middleware.ts` (lines 40–80), `src/lib/openapi/route-middleware.ts` (`dkHubOrder`), `src/lib/config.ts` (`SIDEBAR_KEYS` ~line 157, the sidebar option parser ~line 180, the routeShaping options ~line 829).
- WP01 delivered `resolveHubPageSize`, `isPagedHub`, the `HubCap` widening, frontmatter `hub_page_size` and section `hub.pageSize`.
- **Red first.** Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. Start with:

```bash
spec-kitty agent action implement WP02 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T005 — Site option `hub.pageSize` (`src/lib/config.ts`)

**Steps**:

1. Add a top-level `hub?: { pageSize?: number }` to `DocKittyOptions`, with JSDoc: "The paged hub listing (#342): the page size of every hub over its sidebar child cap; default 50. A section's `hub.pageSize` and a hub's `hub_page_size` frontmatter win over it."
2. Validate the option the way `sidebar` is parsed. Reject unknown keys under `hub`. A `pageSize` that is not a positive whole number throws `[dk-config] hub.pageSize must be a positive whole number`, and `hub` that is not a mapping throws `[dk-config] hub must be a mapping`.
3. **Thread it**: pass `pageSize` into the route-shaping integration options (`RouteShapingOptions.pageSize?`). Slice 1's WP01 was sent back for validating an option without threading it, so the test must prove the value reaches the generated module.

**Tests** (`src/tests/hub-data-every-hub.test.ts`):

- `defineDocKittyIntegrations` throws for `0`, `-1`, `1.5`, `"5"` and `hub: 1`.
- An unknown key under `hub` throws.
- `routeShapingSource({ ..., pageSize: 7 })` emits `pageSize: 7` on a hub with no section or hub setting.

### T007 — Read the pages in every sidebar mode; emit every hub

**Steps**:

1. In `routeShapingSource`, always compute `pages`, not only when `options.shapeSidebar` is on. Keep `directoryMeta` gated exactly as today: it must stay empty when the consumer supplies a sidebar, so their sidebar is untouched (C-004 of slice 1).
2. Turn `hubCaps(...)` into `hubData(...)` (keep a thin `hubCaps` name only if a test imports it). It emits an entry for **every** published `kind: Hub` hub with a non-root slug, sorted by folder (NFR-003), using the same selection and `composeHubChildren` call as today (C-001).
3. Keep the module key `hubCaps` in the generated data, so the consumers and the `route-shaping-module.d.ts` name stay stable, and update its doc comment. Before choosing between keeping and renaming the key, check `src/lib/route-shaping-module.d.ts` and every importer: `grep -rn "routeShaping.hubCaps\|hubCaps" src`.
4. Pass `pages` to the draft and unpublished filters exactly as today.

### T008 — `capped` and `pageSize` per hub

**Steps**:

- `capped = listed.length > cap`.
- `pageSize = resolveHubPageSize({ hub: hub.hubPageSize, section: sectionPageSize(dir), site: options.pageSize })`.
- Read `hub_page_size` in `directoryMetaInputs` next to `sidebar_child_cap`, accepting it only when `isChildCap`. The frontmatter gate (WP01) already fails an invalid value.
- `sectionPageSize` reads `registry.find(...).hub?.pageSize`, mirroring `sectionCap`.

**Tests** (`hub-caps-data.test.ts`, extend it):

- An uncapped hub now has an entry with `capped: false`. Update the slice-1 expectations that asserted "not emitted", and say in the test why the expectation changed (#429).
- A capped hub has `capped: true` and the same `cap`, `count` and `children` as before (FR-002).
- Page-size precedence: hub, then section, then site, then default.

### T009 — `page` collision (FR-016, research R8)

**Steps**: after computing a hub's entry, if `isPagedHub(entry)` and any child slug equals `${dir}/page`, throw:

```
[dk-hubs] hub "<dir>" is paged, but its child "<dir>/page" would collide with the paged listing URLs; rename the child or raise the hub's page size or cap
```

A sub-folder child whose slug is `<dir>/page` (a nested hub) counts too.

**Tests**:

- A paged hub with a `page` child throws, naming both the hub and the child.
- The same tree, with the cap raised so the hub is unpaged, does not throw (the positive control).
- A capped hub whose `pageSize` covers all its children has one page, so it is not paged and does not throw.

### T010 — Consumers use capped entries only

**Steps**:

- `route-middleware.ts`: build `hubCaps` from `routeShaping.hubCaps` filtered to `capped === true`. Treat entries without the flag as capped, for safety with a module generated before #429; document that. Everything downstream (`shapeSidebar`, `expandCappedGroups`, `dkHubOrder`) receives only capped hubs, so the sidebar and prev/next are unchanged (NFR-005).
- `openapi/route-middleware.ts`: check that it reads `dkHubOrder` only, which already carries the filtered map. Change it only if it reads the module directly.
- Update the type in `route-shaping-module.d.ts`.

**Tests**: a middleware-level unit test (find the existing `route-middleware` or `shapeSidebar` tests) with one capped and one uncapped hub. The uncapped hub's group is rendered as before, with all its children.

### T011 — Both sidebar modes, locale folders, goldens

**Tests** (`hub-data-every-hub.test.ts`):

- `routeShapingSource({ shapeSidebar: false, ... })` emits the same `hubCaps` entries as `shapeSidebar: true` for the same tree, and an empty `directoryMeta` (FR-017).
- A locale tree, `docs/fr/missions/README.md` (`kind: Hub`) with `fr/missions/*` children, gives its own entry keyed `fr/missions` (FR-018, research R6). A locale folder without its own hub index gives no entry.
- Two calls on one tree give byte-identical source (NFR-003).
- **Run the slice-1 build suite unchanged**: `src/tests/sidebar-child-cap-build.test.ts`, including the uncapped goldens in `fixtures/large-hub/golden/uncapped.json`, must pass with no golden edit (NFR-005). If it fails, the fix belongs in your code, not in the goldens.

## Definition of Done

- The generated module lists every published `kind: Hub` hub in both sidebar modes, with `capped` and `pageSize`.
- `hub.pageSize` is validated and threaded.
- The `page` collision fails with the exact message.
- The slice-1 unit and build suites pass with no expectation weakened. The "not emitted" expectations change only as T008 says, with the #429 rationale in the test.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green, with counts quoted in the hand-off.

## Risks

- Reading the pages in consumer-sidebar mode costs one more walk per build there. That is acceptable, because the walk is shared (`walkMarkdownPaths`). Note the cost in the hand-off.
- #426 deferred item 7 (`Hub.astro` reads `cwd/docs`) is out of scope. Do not "fix" it here.

## Reviewer guidance

- Diff the generated module for the example before and after this WP. Expect only the added entries and fields.
- Confirm that the slice-1 goldens were not touched.
