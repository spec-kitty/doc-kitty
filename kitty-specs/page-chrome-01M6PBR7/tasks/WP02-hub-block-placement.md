---
work_package_id: WP02
title: Hub child cards before metadata blocks
dependencies:
- WP11
requirement_refs:
- C-002
- FR-012
- FR-013
- SC-002
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: 7900f7d329598109019597de6e43b1efb0f210cb
created_at: '2026-11-05T19:03:15.747960+00:00'
subtasks:
- T006
- T007
- T008
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/MarkdownContent.astro
create_intent:
- src/tests/hub-block-order-build.test.ts
- docs/adr/0076-carrier-places-hub-blocks-after-layout.md
execution_mode: code_change
owned_files:
- src/components/MarkdownContent.astro
- src/tests/hub-block-order-build.test.ts
- docs/adr/0076-carrier-places-hub-blocks-after-layout.md
- example/docs/rhetoric/book-one/index.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 – Hub child cards before metadata blocks

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `frontend-freddy`, or run
  `spec-kitty agent profile show frontend-freddy`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

On a hub, render audience, body, child cards, then metadata blocks. Every other layout keeps its exact output.

**Concern**: IC-01. **Requirements**: FR-012, FR-013, C-002, SC-002.
**Depends on**: WP11.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP02 --agent <name> --mission page-chrome-01M6PBR7
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

### T006: Rebind after-content positions

In `src/components/MarkdownContent.astro`, keep the existing bare `<AfterRelated />` and `<AfterExternalRefs />` positions inside `<Layout>`, and add two more positions directly after `</Layout>`. The four components are chosen in the frontmatter:

```ts
const isHub = kind === 'Hub';
const InsideRelated = isHub ? EmptyFragment : AfterRelated;
const InsideRefs = isHub ? EmptyFragment : AfterExternalRefs;
const OutsideRelated = isHub ? AfterRelated : EmptyFragment;
const OutsideRefs = isHub ? AfterExternalRefs : EmptyFragment;
```

**Write them adjacent, with no whitespace**: `</Layout><OutsideRelated /><OutsideRefs />`. Compiling this template shows that bare positions on separate lines emit literal spaces, which would change every non-hub page and fail FR-013. Adjacent ones emit none.

Leave the named `<slot name="dk:related">` and `<slot name="dk:external-references">` inside the layout. Starlight passes only the default slot, and no provider exists in `src/` or `example/src/`, so they are empty in practice and need no special handling.

Update the header comment to describe the placement rule, and cite ADR-0076.

Don't edit `src/layouts/Hub.astro` or any other layout. The plan's point is that no layout gains a contract (research R2).

### T007: Prove the order, both ways

`src/tests/hub-block-order-build.test.ts` builds the example once and reads the HTML.

**Fixture content**: in `example/dist` today, both named hubs carry only `dk-panel--glossary`. Add `audience`, `related` and `external_references` to `example/docs/rhetoric/book-one/index.md`, so that hub carries all four blocks. This page is also SC-003's demonstrator. `behaviour/shipping/` is generated, so leave it, and assert only its glossary panel.

**Positive (FR-012)**: on `rhetoric/book-one/`, the order is audience, body, first `class="dk-hub"`, then every `dk-panel--related`, `dk-panel--external-references` and `dk-panel--glossary`. On `behaviour/shipping/`, `dk-hub` comes before `dk-panel--glossary`. Assert each panel exists, otherwise this passes vacuously, which is how #290's old check on the root and `adr/` hubs would have passed.

**Control (FR-013)**: a non-hub page in WP11's frozen fixture matches its pre-mission golden byte for byte, ignoring build ids. Assert that page has panels.

**A layout that places nothing (FR-013)**: a fixture theme registers a `Hub` layout that renders only `<slot />`. Its blocks still render.

**Hub with no children**: a fixture hub with an empty card list still renders its panels after the body.

**Guards (#290)**: `hub-adr-card.test.ts` and the INV-1 draft-exclusion guard stay green with no edits.

**Mutation check**: revert T006 locally and confirm the positive test goes red. Note the result in the commit message.

### T008: ADR-0076

Write `docs/adr/0076-carrier-places-hub-blocks-after-layout.md` with the repo's ADR frontmatter (see `docs/adr/0074-*.md`). Don't edit the index table in `docs/adr/README.md`.

- **Context**: cards come last because blocks share the layout's default slot. Themes can register layouts through the manifest.
- **Decision**: the carrier places a hub's blocks after the layout.
- **Alternatives**: a named slot in every layout (#290's likely approach), rejected because third-party layouts could silently drop blocks.
- **Consequences**: blocks sit outside a hub layout's DOM wrapper. `Hub.astro` has none today, but a theme's hub layout that wraps its content would see them outside that wrapper.

It relates to ADR-0017 (carrier-body blocks) without superseding it. Confirm `pnpm validate:adr-ids` passes, and that 0076 is still free against `main` and open PRs.

## Risks

- Astro's single-render rule for named slots, handled in T006.
- A theme's hub layout with a wrapper: recorded in the ADR. The spec-kitty theme overrides only `Persona`.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-012, FR-013, C-002, SC-002) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Diff a non-hub page's HTML from before and after this WP. It must be identical apart from build ids.

Check that tests fail without the change, not only that they pass with it.
