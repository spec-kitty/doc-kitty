---
work_package_id: WP01
title: Config options and served-surface detection
dependencies:
- WP11
requirement_refs:
- C-007
- FR-002
- FR-009
planning_base_branch: feat/page-chrome
merge_target_branch: feat/page-chrome
branch_strategy: Planning artifacts for this mission were generated on feat/page-chrome. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/page-chrome unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-page-chrome-01M6PBR7
base_commit: a24d58429acc7dadec743dff33aa672c74348ed6
created_at: '2026-11-05T19:03:07.845264+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history:
- timestamp: '2026-11-05T18:06:14Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/
create_intent:
- src/lib/chrome-options.ts
- src/lib/served-surfaces.ts
- src/lib/integrations/served-surfaces.ts
- src/tests/chrome-options.test.ts
- src/tests/served-surfaces.test.ts
- src/tests/served-surfaces-build.test.ts
execution_mode: code_change
owned_files:
- src/lib/config.ts
- src/lib/internal-env.mjs
- src/lib/chrome-options.ts
- src/lib/served-surfaces.ts
- src/lib/integrations/served-surfaces.ts
- src/lib/routes/agent-index.ts
- src/tests/chrome-options.test.ts
- src/tests/served-surfaces.test.ts
- src/tests/served-surfaces-build.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP01 – Config options and served-surface detection

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

Adopt the profile's identity, boundaries and initialization for the rest of this WP.

## Objective

Add every consumer option this mission needs, in one place, and detect which surfaces a site serves from its resolved routes. Later work packages read these values and don't touch `config.ts` except where they say so.

**Concern**: IC-07 (detection half), and the config surface for all concerns. **Requirements**: FR-002, FR-009, C-007.
**Depends on**: WP11.

## Branch strategy

- **Planning base branch**: `feat/page-chrome`
- **Final merge target**: `feat/page-chrome`, which reaches `main` through a PR.
- Execution worktrees are allocated per computed lane from `lanes.json`. Don't pick a base branch by hand.

Implement with:

```bash
spec-kitty agent action implement WP01 --agent <name> --mission page-chrome-01M6PBR7
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

### T001: Add and validate the new options

Add the options from [contracts/config-options.md](../contracts/config-options.md) to `DocKittyOptions` in `src/lib/config.ts`: `sidebar.collapsed`, `sidebar.titleIsIndex`, `metadataBlocks`, `footer`, `pageFormats`, `repository`.

1. Extend `DocKittySidebarOptions` and `splitSidebarOption`. Unknown keys stay rejected.
2. Throw a `[dk-config]` error when `titleIsIndex` is set with `indexLabel` (FR-009), naming both keys.
3. Validate `repository`: `provider` is one of the three hosts, and `repo` and `branch` are non-empty. A partial object throws.
4. Validate `footer.machineEntryPoints` is `false` or `{ label: non-empty string }`.

Validation is eager, before any hook runs, like `resolveGherkinOptions`.

**Validate**: one test per rejection, each paired with an accepted value of the same key. A wrong message fails.

### T002: Publish resolved options through one reader

Write resolved options with `setInternalEnv` under a new `DK_CHROME_OPTIONS` handoff (JSON), following the pattern at `config.ts:576-611`. `setInternalEnv` throws on unknown names, so register this and `DK_SERVED_SURFACES` in `src/lib/internal-env.mjs`, including its table at line 11. `clearInternalEnv` must clear them too.

`src/lib/chrome-options.ts` exports `chromeOptions()`, which parses the value and applies the defaults: `sidebar.collapsed: true`, `titleIsIndex: false`, `metadataBlocks.collapsed: true`, `footer.machineEntryPoints` on, with label `Machine-readable`, `pageFormats.atom: true`, no `repository`.

It must not import `config.ts`, so `.astro` components and routes can use it. With the value unset, as under Vitest, it returns the defaults.

**Validate**: defaults with the env unset; a round trip from `defineDocKittyIntegrations`; a second config call in one process doesn't leak values from the first.

### T003: Pure detection table

`src/lib/served-surfaces.ts` exports:

- `detectServedSurfaces(patterns: string[]): ServedSurfaces`, a pure function over route patterns, using the table in [data-model.md](../data-model.md).
- `servedSurfaces(): ServedSurfaces | undefined`, reading the handoff. `undefined` means detection hasn't run, as when a route is called without the integration.

The patterns to match are exactly: `/llms.txt`, `/api/index.json`, `/api/pages/[...slug].json`, `/rss.xml`, `/api/bibliography.json`, `/api/scenarios.json`, `/api/content-graph.json` and `/api/pages/[...slug].atom.xml`. `sitemap` is true only when `config.site` is set, because `@astrojs/sitemap` logs "Skipping" and writes nothing without it. Pass that fact in as a second argument. `okf` is always true: its integration is always added, and the bundle has an `okf/index.md`.

A route at a non-standard path stays undetected. That is the documented limit.

**Validate**: table-driven, every surface present and absent. Include the patterns from the spike in [research.md](../research.md) R1.

### T004: The detection integration

`src/lib/integrations/served-surfaces.ts` exports an integration with an `astro:routes:resolved` hook. It writes `detectServedSurfaces(routes.map(r => r.pattern))` to the handoff. Append it unconditionally in `defineDocKittyIntegrations`, near `contentGraphIntegration` (`config.ts:900`).

The hook also fires again in dev when routes change, so it must overwrite, not merge. Filter out redirect routes.

**Validate** in `served-surfaces-build.test.ts`, with WP11's frozen fixture site: build it, assert the rendered output sees `rss` true. Then delete its `rss.xml.ts` and rebuild, the pattern in `exclude-folders-build.test.ts`, and assert `rss` is false while the other surfaces stay true. An env-guarded route won't work, since file routes resolve whatever the handler does. Also build once with no `site` and assert `sitemap` is false. Hook order is verified: `createRoutesList` fires this hook before `viteBuild`, and it fires again on dev restart. WP09 reuses this fixture for FR-003.

### T005: Agent index reads the same result

In `agentIndexRoute` (`src/lib/routes/agent-index.ts:60`), the defaults in `declared` come from `servedSurfaces()` when it is defined: `pages`, `rss`, `bibliography`, `scenarios`. Read it inside the handler, not in the route factory at line 62, because a factory value goes stale when dev rebuilds routes. An explicit `options.links` value still wins, and `mcp` stays opt-in.

When `servedSurfaces()` is `undefined`, today's defaults apply unchanged, so direct unit calls behave as before.

**Validate**: `_links.rss` is absent on the no-RSS fixture and present on the example. An explicit `links: { rss: true }` still emits it. Existing agent-index tests stay green without edits, which proves the `undefined` path. Add a changelog fragment, `docs/changelog/unreleased/290-served-surfaces.md`, noting `_links` no longer names an unmounted surface.

## Risks

- Hook ordering: the handoff must be written before any page renders. The spike showed the hook fires during the build, but not the order against rendering. T004 proves it end to end.
- `clearInternalEnv` runs first in `defineDocKittyIntegrations`, so a late hook must not depend on values cleared after it runs.

## Definition of done

- Every subtask's validation is met, and its results are in the commit or review notes.
- Every requirement in this WP (FR-002, FR-009, C-007) has a test or artifact that would fail without the change.
- `pnpm test` is green, and any `tests/a11y` spec this WP touches passes.
- A changelog fragment exists for user-visible behaviour, where this prompt asks for one.

## Reviewer guidance

Check that detection is the only source of served-surface truth. Grep for hard-coded surface lists outside the table.

Check that tests fail without the change, not only that they pass with it.
