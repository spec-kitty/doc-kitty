---
work_package_id: WP05
title: Agent API and llms.txt
dependencies:
- WP02
requirement_refs:
- FR-013
- FR-015
- SC-004
planning_base_branch: feat/342-paged-hub-listing
merge_target_branch: feat/342-paged-hub-listing
branch_strategy: Planning artifacts for this mission were generated on feat/342-paged-hub-listing. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/342-paged-hub-listing unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-large-hubs-paged-hub-listing-01M84WYV
base_commit: dc360cb98d9194598ad866623a375ff9bacc1b14
created_at: '2026-11-24T18:35:56.873624+00:00'
subtasks:
- T022
- T023
- T024
- T025
history:
- timestamp: '2026-11-24T16:00:00Z'
  agent: planner
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/routes/
create_intent:
- src/tests/agent-listing-records.test.ts
- src/tests/llms-paged-hubs.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/agent-index.ts
- src/lib/routes/agent-page.ts
- src/lib/routes/llms-txt.ts
- src/lib/routes/shared.ts
- src/tests/agent-listing-records.test.ts
- src/tests/llms-paged-hubs.test.ts
role: implementer
tags: []
tracker_refs: []
---
# WP05 — Agent API and llms.txt

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`implementer-ivan`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Every paged listing page appears exactly once in the agent API index, in a per-page agent JSON that lists its children, and in `llms.txt`. No child is listed twice because of paging. A site without paged hubs serves byte-identical surfaces.

- Requirements: FR-013, FR-015 (agent-API checks); SC-004.
- Plan: IC-04. Research: R5, the duplicate-entry rule the operator asked us to settle. Data model: the "Agent API listing record" and "llms.txt line" sections. Contract: `contracts/surfaces.md`.

## Shared context

- **The OpenAPI precedent** for synthetic, non-collection records:
  - `src/lib/routes/agent-index.ts`: `toOpenApiVersionRecord`, `~107–128`; the append block, `~300–328`; `count: pages.length`, `~342`.
  - `agent-page.ts`: `getStaticPaths` `~107–128` pushes the synthetic paths; `GET` `~134`.
  - `shared.ts`: `buildIdForBuild` and `openApiStampConfig`, `~262–280`. The build id folds the synthetic surface in, so the index and per-page stamps agree.
- `llms-txt.ts`: the section grouping loop (`~136–180`) writes `- [title](url)` lines; the OpenAPI block (`~183`).
- Route tests mock `astro:content` with `vi.hoisted` (see `src/tests/llms-section-order.test.ts`). Mock `virtual:doc-kitty/route-shaping` the same way, with `vi.mock('virtual:doc-kitty/route-shaping', () => ({ routeShaping: {...} }))`.
- WP01: `hubListingPages(hubCaps)` returns `{ hub, page, of, slug, children }` for pages ≥ 2. **Use it; do not recompute paging.**
- **Red first.** Before hand-off, run the full `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck`.

## Branch strategy

Planning base and final merge target: `feat/342-paged-hub-listing`. The lane worktree comes from `lanes.json`. This WP runs in parallel with WP03 and WP04. Start with:

```bash
spec-kitty agent action implement WP05 --agent <name> --mission large-hubs-paged-hub-listing-01M84WYV
```

## Subtasks

### T022 — Listing records in `/api/index.json` and the build id

**Steps**:

1. Add `toListingRecord(listingPage, hubEntry, site, base)`, giving a record with `kind: 'Listing'`, `slug`, `title` ("<Hub title>, page N", from the `dockitty.hub.pagination.title` default; the index is not localised), `url`, `listing_of` (the hub slug), `page`, `of` and the per-page API URL.
   - Reuse the existing field names for `url`, `title` and the API link; read `AgentRecordEntry` first.
   - Add only `listing_of`, `page` and `of`.
2. Append the listing records **after the docs records and before the OpenAPI records**, sorted as `hubListingPages` returns them. Do not rank them among the docs (research R5).
3. Records are gated by their hub's section: `feedsSurface(feeds, sectionOf(hub), 'agent')`. A hub whose section is not fed to the agent API adds no listing records.
4. `count` stays `pages.length`.
5. Fold the listing pages into the build id, the way OpenAPI is folded (`openApiStampConfig`). Add the paged slugs to the build-id input so a change of page size changes the build id. Keep the index and per-page stamps equal.

**Tests** (`src/tests/agent-listing-records.test.ts`):

- With one hub (`missions`, 120 children, cap 50, page size 50) the index ends its docs part with two listing records, `missions/page/2` and `/3`, carrying `listing_of: 'missions'`, `page` and `of: 3`.
- No child slug appears twice in the index.
- `count === pages.length`.
- A section not fed to the agent API gives no listing records.
- Changing the page size changes the build id, while the same input gives the same build id.

### T023 — Per-listing-page JSON (`/api/pages/<hub>/page/N.json`)

**Steps**: in `agent-page.ts`, `getStaticPaths` adds a path for each listing page, with props flagged as a listing (`{ listing: listingPage }`), as the OpenAPI branch does. `GET` returns the listing record plus `children: [{ slug, title, url }]` for that page's slice, taking titles from the collection entries and keeping the slice order. It carries the same build-id stamp as the other pages.

**Tests**: the per-page JSON for page 2 lists children 51–100 in hub order, and its stamp equals the index's. A site without paged hubs gets no listing paths.

### T024 — `llms.txt` lines

**Steps**: in the section loop, right after the line for a paged hub, add one line per listing page:

```
- [Missions, page 2](https://site/base/missions/page/2/): children 51–100 of 120
```

Use an en dash in the range, and take the same `feedsSurface(..., 'llms')` gate from the hub's section. The children's own lines are unchanged and appear once.

**Tests** (`src/tests/llms-paged-hubs.test.ts`): the listing lines follow the hub's line in order; every child line appears exactly once; and a site without paged hubs produces byte-identical output, compared with a snapshot taken before your change (record that snapshot red-first).

### T025 — Byte identity and gating sweep

- For a site with no paged hub (all hubs under their cap, or none), `/api/index.json`, the per-page JSON for a normal page, and `llms.txt` are byte-identical to before. That includes the build id, so fold the listing pages into its input only when there are any. Add a test.
- Run the existing `agent-api*.test.ts`, `llms-*.test.ts` and `openapi-agent-entries.test.ts` suites unchanged.

## Definition of Done

- Listing pages appear once in the index (with their per-page JSON) and once in `llms.txt`. Children appear once on each surface.
- Sites without paged hubs are byte-identical on every agent surface.
- `pnpm test` (both tiers plus mcp), `pnpm lint` and `pnpm typecheck` are green, with counts quoted.

## Risks

- **`buildId` drift.** If the index and per-page stamps disagree, the existing build-identity tests (`agent-api-build-identity.test.ts`) catch it. Keep them green.
- The MCP package (`mcp/`) reads the agent API. Check that its tests accept a `kind: 'Listing'` record; if the MCP client would break, say so in the hand-off rather than editing `mcp/`, which is outside this WP.

## Reviewer guidance

- Check the R5 rule on each surface: every URL once, children never repeated.
- Check that the listing records come after the docs records and before the OpenAPI records.
