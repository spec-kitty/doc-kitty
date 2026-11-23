---
work_package_id: WP03
title: Shaping, current marking and pagination
dependencies:
- WP02
requirement_refs:
- FR-003
- FR-005
- FR-007
- FR-008
- C-001
- C-004
- NFR-002
planning_base_branch: feat/341-sidebar-child-cap
merge_target_branch: feat/341-sidebar-child-cap
branch_strategy: Planning artifacts for this mission were generated on feat/341-sidebar-child-cap. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/341-sidebar-child-cap unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-large-hubs-sidebar-child-cap-01M81KGV
base_commit: 536c270053e410b6830008e128631f0c065c8b00
created_at: '2026-11-23T08:23:35.128049+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
history:
- timestamp: '2026-11-23T00:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/route-shaping.ts
create_intent:
- src/tests/sidebar-child-cap.test.ts
execution_mode: code_change
owned_files:
- src/lib/route-shaping.ts
- src/lib/route-middleware.ts
- src/tests/sidebar-child-cap.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP03 — Shaping, current marking and pagination

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

`shapeSidebar` shows a capped hub as its index link and one capped entry; the entry is current on descendants; prev/next follow hub order; relabelling and icons ignore the entry. Requirements: FR-003, FR-005, FR-007, FR-008 (pre-hidden tolerance), NFR-001, NFR-002. Plan: IC-03. Research: R1, R3, R4.

## Shared context

- Mission documents: `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/cap-api.md`, `decisions/`.
- Stack: Node 22+, TypeScript 5 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42. Add, upgrade or remove no dependency.
- Red first: write each test, run it, see it fail for the right reason, then implement.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` clean with no suppressions.
- Branch strategy: planning base and merge target `feat/341-sidebar-child-cap`; the lane worktree comes from `lanes.json`.
- Implement with `spec-kitty agent action implement <WP> --agent claude --mission large-hubs-sidebar-child-cap-01M81KGV`.

## Subtasks

### T011 — Red first

`src/tests/sidebar-child-cap.test.ts` (pure, on hand-built Starlight trees, base `/site`):
- A group for `missions` with index + 6 links, `hubCaps` `missions → { cap: 5, count: 6 }`: shaped entries are `[index, capped]`; capped href = index href; label `6 pages`; `dkCappedHub: 'missions'`.
- Same input without `hubCaps`: result deep-equals today's (call without the option).
- `currentSlug` = `missions/m3`: capped entry `isCurrent: true`; on `missions` itself: index current, capped not; on a nested `missions/sub/x`: capped current.
- Capped top-level section group (depth 0) and capped nested group.
- A nested capped hub inside a capped parent disappears with the parent's children.
- `expandCappedGroups` + `shapePagination`: on `missions/b` with hub order a, c, b (titles), prev = c, next = the first entry after the group; on the hub page, next = first child in hub order; on the last child, next = the entry after the group; author `prev: false` respected (`followsSidebar.prev` false keeps undefined).
- Pre-hidden: original tree has no `missions/*` children and no current link; `shapePagination` with the expanded tree re-derives both sides; with neither tree holding a current link, pagination is returned unchanged.
- `relabelledLinks` does not report the capped entry; `decorateSidebarIcons` leaves it without `dkIcon`.

### T012 — `shapeSidebar`

New options `hubCaps?: HubCapMap`, `cappedLabel?: (count) => string` (default `resolveCappedLabel(count)`), `currentSlug?: string`. In `shapeEntry`, after `ordered` is built and the label resolved: if `hubCaps.get(dir)` and the group holds its index link, replace `ordered` by `[index, capped]`. The capped entry is `{ type: 'link', label, href: index.href, isCurrent: currentSlug startsWith dir + '/', badge: undefined, attrs: {}, dkCappedHub: dir }`. The one-page-folder rule must not fire on a capped group. The index-label rule still applies.

### T013 — Pagination

`expandCappedGroups(shaped, hubCaps, base, currentSlug)`: copy of the tree where each capped group's capped entry is replaced by its children as links (`href = base + routeOfSlug(slug)` with Starlight's trailing-slash form, reusing the original tree's href when the child is present there), `isCurrent` on the current slug. `shapePagination`: when `at === -1` and `to !== -1`, return each side as `follows ? now : current`.

### T014 — Skip the capped entry

`flattenLinks` gets a variant that skips `dkCappedHub` links; `relabelledLinks`, `shapePagination` and `decorateSidebarIcons` use it.

### T015 — Middleware and exports

`route-middleware.ts`: build `hubCaps` map once at module scope; pass `hubCaps`, `currentSlug` (`slugFromEntryId(route.id)` or the route's id normalised as in `Hub.astro`), and `cappedLabel: (n) => resolveCappedLabel(n, routeShaping.cappedLabel, locals.t)`; when `hubCaps.size > 0`, pass `expandCappedGroups(sidebar, …)` as the shaped tree to `shapePagination`; otherwise the code path is unchanged. `route-shaping.ts` re-exports the WP01 API.

## Definition of done

T011 passes; every existing route-shaping test passes unchanged; lint and typecheck clean.

## Reviewer guidance

Look for any path that runs differently when `hubCaps` is empty: there must be none.
