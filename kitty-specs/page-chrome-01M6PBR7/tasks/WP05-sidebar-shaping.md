---
work_package_id: WP05
title: Sidebar collapse default and shaping markers
dependencies:
- WP01
requirement_refs:
- FR-005
- FR-006
- FR-008
- FR-010
- FR-011
- NFR-004
- SC-001
- SC-005
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: f624b1a6ea9d7962594ff7e62a1de411f6e9913c
created_at: '2026-11-06T09:52:18.799797+00:00'
subtasks:
- T017
- T018
- T019
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/route-shaping.ts
create_intent: []
execution_mode: code_change
owned_files:
- src/lib/route-shaping.ts
- src/lib/route-middleware.ts
- src/lib/integrations/route-shaping.ts
- src/tests/route-shaping.test.ts
- src/tests/sidebar-build-html.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 – Sidebar collapse default and shaping markers

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Generated sidebar groups start closed, except the current branch. An opt-out restores today's exact sidebar. Add the data markers the custom renderer needs, emitted only when a site uses it.

**Concern**: IC-04. **Requirements**: FR-005, FR-006, FR-008, FR-010, FR-011, NFR-004, SC-001, SC-005.
**Depends on**: WP01.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP05 --agent <name> --mission page-chrome-01M6PBR7
```

## Rules for every subtask

- **Read first**: [spec.md](../spec.md), [plan.md](../plan.md) and the contracts it links.
- **Non-vacuity** (tactic `acceptance-criteria-non-vacuity`): a test that asserts absence or no change needs a positive control on the same fixture, and must go through the production path. For a build-level claim, that means real built HTML.
- **Build suites** share `example/.astro`. WP11 registers every new build test named in this mission in the serialized `build` project in `src/vitest.workspace.ts`, so you shouldn't need to edit it.
- **Varying options**: use WP11's fixture config (`DK_TEST_OPTIONS`) and frozen fixture site. Don't edit `example/astro.config.mjs` for a test, and don't compare a build with itself.
- **No DOM test environment**: jsdom is forbidden here (`toc-rail-preference.test.ts:3`). Unit tests use stubs, and behaviour proofs go in Playwright.
- **Gates**: `pnpm assert:artifacts` is part of every code WP's definition of done.
- **Byte-sensitive templates**: Astro trims whitespace differently around `{expr}` and bare elements. Rebind components rather than wrapping existing positions in conditionals, as `MarkdownContent.astro` explains.
- **Changelog**: a user-visible change adds `docs/changelog/unreleased/<issue>-<slug>.md`, and never edits `CHANGELOG.md`.
- **Out-of-map edits**: only the small ones this prompt names, or others recorded with a one-line reason in the commit message.
- **Don't commit** `kitty-ops/` or the regenerated `example/docs/glossary/**` `generated.by` stamps.
- Record subtask progress with `spec-kitty agent tasks mark-status T001 --status done --mission page-chrome-01M6PBR7`.

## Subtasks

### T017: Collapse in shapeSidebar

Add `collapse?: boolean` to `ShapeSidebarOptions`. When true, `shapeEntry` sets `collapsed: true` on every returned group, including nested ones. Starlight's `SidebarSublist` already computes `open={hasCurrent || !collapsed}`, so the current branch opens by itself.

Pass `chromeOptions().sidebar.collapsed` through the route-shaping transport (`src/lib/integrations/route-shaping.ts`, `virtual:doc-kitty/route-shaping`) to the `shapeSidebar` call in `route-middleware.ts`. The middleware already skips shaping when the consumer supplied their own sidebar, so FR-010 holds.

**Idempotency**: `shapeSidebar` documents that shaping a shaped tree returns an equal tree. Keep that true.

**OpenAPI placeholders**: groups with `PLACEHOLDER_GROUP_PREFIX` are filled by later middleware. Check what `collapsed` does to them in `sidebar-build-html.test.ts`'s `isOpenApiGroup` paths and on `openapi.spec.ts`.

### T018: Markers for the custom renderer

Add `annotate?: boolean` to `ShapeSidebarOptions`, true only when title-as-index is on or an icon is authored. When true, and only then:

- A group's index link gets `attrs['data-dk-group-index'] = ''`.
- A group gets a `dkDir` property, the directory it represents. WP07 uses this to find its icon.

These must stay off otherwise, because `attrs` reach the HTML, and FR-006 needs identical bytes. `getSidebarHash` hashes only labels and hrefs, so `data-hash` can't detect this: rely on the full-fragment golden.

The index link stays in `entries`, because pagination flattens the sidebar (research R7). Icons authored anywhere set the transport flag: WP07 supplies that value, and this WP defaults it to `titleIsIndex` only. Add the option so WP07 needs a one-line change.

### T019: Tests

In `src/tests/route-shaping.test.ts` (hand-built trees):

- `collapse: true` sets every group, nested too; `collapse: false` leaves output deep-equal to today's. Keep a golden tree of today's output so a no-op can't pass.
- **FR-008**: index first with and without `annotate`, from a fixture whose source order has the index last. Extends the test at `route-shaping.test.ts:184`.
- **FR-011**: `relabelledLinks` and `restorePaginationTitles` give correct titles with `annotate` on, on a relabelled index.
- `annotate: false` adds no `attrs` and no `dkDir` (control: `annotate: true` adds them on the same tree).

In `src/tests/sidebar-build-html.test.ts` (built example), update the expected state, then add:

- **FR-005**: on a deep page, its ancestors are `<details open>` and every other group is closed, in static HTML. This is the current 16-of-20-open state flipping.
- **FR-006**: on WP11's frozen fixture, a `sidebar: { collapsed: false }` build's whole sidebar fragment and its CSS output equal WP11's pre-mission golden.
- **FR-010**: a fixture with a consumer-written array sidebar builds with its entries as written and no `collapsed` added, in the same suite as FR-005's positive check.

Update the Playwright suite for the new default, and record each edit:

- `tests/a11y/sidebar-reveal.spec.ts:173`: `target = 1881` becomes unreachable, because collapsing shrinks the pane's scroll height. Derive the target from the pane's maximum scroll, and keep the check that it differs from the centred position.
- `sidebar-membership.spec.ts` reads hrefs whatever their visibility, so it shouldn't need edits.
- `visual.spec.ts` sidebar baselines change. Don't regenerate them locally; they are handled once after lanes merge, by `update-a11y-baselines.yml` (see WP10).
- `sidebar-build-html.test.ts:70` misses links with an SVG before the `<span>`. Leave it, since icons stay out of the example. Add a changelog fragment, `docs/changelog/unreleased/290-sidebar-collapsed.md`, flagged as a changed default.

## Risks

- Existing tests assume open groups. Expected: change them in this WP, and don't weaken what they check.
- The reveal script scrolls to the current entry, which still works, since the current branch stays open. `sidebar-reveal.spec.ts` confirms it.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-005, FR-006, FR-008, FR-010, FR-011, NFR-004, SC-001, SC-005) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Check the FR-006 golden comes from before the change, and confirm `data-hash` is part of the comparison.

Check that tests fail without the change, not only that they pass with it.
