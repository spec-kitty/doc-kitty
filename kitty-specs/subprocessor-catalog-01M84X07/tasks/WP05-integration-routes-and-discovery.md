---
work_package_id: WP05
title: Integration, routes and agent discovery
dependencies:
- WP03
- WP04
requirement_refs:
- FR-009
- FR-010
- FR-012
- FR-013
- NFR-001
- NFR-002
- SC-002
- SC-004
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-subprocessor-catalog-01M84X07
base_commit: a3387ed42011f427a137f216480637ccffa7e8a1
created_at: '2026-11-25T09:33:16.735718+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
- T023
agent: claude
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: src/lib/integrations/
create_intent:
- src/lib/integrations/subprocessors.ts
- src/lib/routes/subprocessors-api-injected.ts
- src/lib/routes/subprocessors-feed-injected.ts
- src/tests/subprocessors-integration.test.ts
- src/tests/subprocessors-parity.test.ts
- src/tests/subprocessors-build.test.ts
execution_mode: code_change
owned_files:
- src/lib/integrations/subprocessors.ts
- src/lib/routes/subprocessors-api-injected.ts
- src/lib/routes/subprocessors-feed-injected.ts
- src/lib/config.ts
- src/lib/served-surfaces.ts
- src/lib/contract.ts
- src/lib/routes/agent-index.ts
- src/package.json
- src/tests/subprocessors-integration.test.ts
- src/tests/subprocessors-parity.test.ts
- src/tests/subprocessors-build.test.ts
- src/tests/served-surfaces.test.ts
- src/tests/served-surfaces-build.test.ts
- src/tests/fixtures/subprocessors-site/**
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 - Integration, routes and agent discovery

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Wire the catalog into the build:

- **New integration.** `doc-kitty:subprocessors` runs at `astro:config:setup`. It:
  - calls WP02's `checkSubprocessorCatalog` once;
  - **throws one aggregate error** on problems (operator decision `01M8545YJX3DY4G3DEYX81G49Y`);
  - otherwise injects `/api/subprocessors.json` and `/subprocessors.xml`, but only when the file exists.
- **Discovery.** Served-surface detection sees the two routes, and the agent index links them.

Requirements: FR-009, FR-010, FR-012, FR-013, NFR-001, NFR-002. Depends on: WP03 and WP04.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- Run `spec-kitty agent action implement WP05 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

Read these first:

- **`src/lib/integrations/gherkin.ts`.** The precedent for a file-gated integration:
  - options passed to an injected route through a **virtual module** (`updateConfig({ vite: { plugins: [...] } })`);
  - `injectRoute({ pattern, entrypoint, prerender: true })`;
  - the `hasOwnScenarioIndexPage` skip when a site mounts its own route;
  - one log line;
  - `addWatchFile`.
- **`src/lib/routes/scenario-index-injected.ts`** and the `./routes/*-injected` entries in `src/package.json` `exports`. Injected entrypoints are **package exports**, so a consuming site resolves them.
- **Discovery.** `src/lib/served-surfaces.ts` (`SURFACE_ROUTES`), `src/lib/integrations/served-surfaces.ts`, `src/lib/routes/agent-index.ts` (`indexLinks`, `DeclaredSurfaces`) and `src/lib/contract.ts` (`IndexLinks`).
- **Registration.** `src/lib/config.ts`, around line 900, where the integration list is assembled. Note the ordering comment around `servedSurfacesIntegration`: detection must run after route injection.
- **Contract.** `contracts/subprocessors-api.contract.md`, the "Agent index additions" section.
- **Renderers.** WP04's `renderSubprocessorsApi` and `renderSubprocessorsFeed`. Routes call these and add nothing.
- **Red first.**

## Subtasks

### T018 — Red-first integration tests (`src/tests/subprocessors-integration.test.ts`)

Unit-test the integration hook with a fake `injectRoute`, `updateConfig`, `logger` and `addWatchFile`. Copy how any existing integration unit test fakes the hook context; grep `src/tests` for `astro:config:setup`.

- **No file** (`fixtures/subprocessors/absent` from WP02, or a new `fixtures/subprocessors-site/none`): `injectRoute` is **not** called, nothing throws, and no log noise appears.
- **Valid file:** `injectRoute` is called exactly twice, with `/api/subprocessors.json` and `/subprocessors.xml`, both `prerender: true`, and with the package-export entrypoints. `addWatchFile` gets the catalog path. This is the positive control for the no-file case, on the same harness.
- **Invalid file:** it throws one `Error`. The message starts with `[dk-subprocessors] invalid sub-processor catalog:` and contains every problem line, one per line. `injectRoute` is not called.
- **Site-owned route:** with `src/pages/api/subprocessors.json.ts` present in a fixture `srcDir`, the API route is not injected, the feed still is, and one info line explains the skip. Mirror `hasOwnScenarioIndexPage`, and do the same for `src/pages/subprocessors.xml.*`.

### T019 — Integration, entrypoints, exports

**`src/lib/integrations/subprocessors.ts`**:

- Export `subprocessorsIntegration(docsDir, siteTitle)`.
- In `astro:config:setup`:
  1. `checkSubprocessorCatalog(path.resolve(root, docsDir), <docs-root-relative label>)`.
  2. If it is not present, return.
  3. Throw on problems.
  4. Otherwise expose `{ normalised, changes, siteTitle }` through a virtual module, `virtual:doc-kitty/subprocessors`.
  5. Inject the routes.

  Serialise only plain data into the virtual module (`JSON.stringify`).

**Injected entrypoints** (`src/lib/routes/subprocessors-api-injected.ts`, `-feed-injected.ts`):

- Each `export const GET: APIRoute = ({ site }) => new Response(render…(data, { site, … }), { headers: { 'Content-Type': … } })`.
- Content types: `application/json; charset=utf-8` and `application/rss+xml; charset=utf-8`. Match what the existing `api/*.json` and `rss.xml` routes send.
- Add a `declare module 'virtual:doc-kitty/subprocessors'` type, wherever the gherkin virtual module is declared.

**`src/package.json` exports.** Add `./routes/subprocessors-api-injected` and `./routes/subprocessors-feed-injected`.

### T020 — Register in `config.ts`

- Add `subprocessorsIntegration(docsDir, title)` to the integration list **before** `servedSurfacesIntegration`, so detection sees the injected routes.
- It is always added, because it is file-gated internally; there is no option.
- Add a short comment that names ADR-0086 and explains why there is no option.

### T021 — Served surfaces and index links

- **`served-surfaces.ts`.** Add `subprocessors: '/api/subprocessors.json'` and `subprocessorFeed: '/subprocessors.xml'` to `SURFACE_ROUTES`.
- **`contract.ts`.** Add the optional `subprocessors?: AgentLink` and `subprocessorFeed?: AgentLink` to `IndexLinks`, with doc comments ("present only when the catalog exists").
- **`agent-index.ts`.**
  - Add both to `DeclaredSurfaces`, defaulting to `surfaces?.subprocessors ?? false`. The default is **false**: unlike rss, no file means no route.
  - Emit both in `indexLinks` when declared.
  - The index `version` stays `"3"`.
- **Existing tests.** `src/tests/served-surfaces.test.ts` and `served-surfaces-build.test.ts` deep-equal the surface map. Add the two keys (`false` for those fixtures). This is the only change to those files.
- **MCP.** Run the mcp test tier. If the MCP package validates `_links` strictly, it must still pass.

### T022 — Parity test (`src/tests/subprocessors-parity.test.ts`) — NFR-002

For **at least 8** invalid fixtures (reuse WP02's invalid fixture dirs):

- Take the build's error from the integration hook: catch the throw and split the lines after the header.
- Take the gate's problems from `validateRoot` in `src/scripts/validate-catalog.mjs`.
- Assert both are equal after stripping the `<source>` prefix, which the contract allows to differ: docs-root-relative versus repo-relative.
- Include the valid fixture as the positive control: both are empty.

### T023 — Fixture-site build test (`src/tests/subprocessors-build.test.ts`)

Use the chrome fixture harness that `served-surfaces-build.test.ts` uses (`buildChromeFixture`). Copy its structure and its `BUILD_TIMEOUT`.

- **Without a catalog.**
  - The build passes.
  - There is no `dist/api/subprocessors.json` and no `dist/subprocessors.xml`.
  - `dist/api/index.json` has no `_links.subprocessors`.
- **With a catalog.** Write a valid `docs/_meta/subprocessors.yaml` into the fixture through the harness's file overlay mechanism.
  - Both files exist, and their bytes equal WP04's renderers applied to the same input.
  - The index links both URLs.
- **Byte-stability (NFR-001).**
  - Build twice with the catalog, the second time with `FAKETIME` or a `DK_*` clock override if the harness supports one.
  - If it doesn't, compare two builds and rely on WP04's clock test, and say so in a comment.
  - Assert the two files are byte-identical across the builds.

Keep the build count low: at most three builds in this file.

## Definition of Done

- The tests were written first and now pass, including the parity test across at least 8 fixtures.
- A site without the catalog produces the same `dist/` file list as before. Assert this in T023 by diffing the file list against a no-catalog baseline.
- The agent index links appear only when served, and the contract version is unchanged.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Risks

- **Ordering in `config.ts`.** If `servedSurfacesIntegration` runs first, the links never appear. T023 catches this.
- **Virtual-module typing.** Follow the gherkin declaration exactly, or `tsc` may fail in the consumer typecheck lane.
- **Dev mode.** A **new** catalog file is picked up only on restart, which is the same documented limit as gherkin. Note it in the integration doc comment.

## Reviewer guidance

- Check that the throw happens before any route is injected.
- Check there is no rendering logic in the routes.
- Check the parity test compares real build output against real gate output.
- Check the no-file build has no new files.
