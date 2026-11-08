---
work_package_id: WP02
title: Materialised spec list, extension points and shared helpers
dependencies:
- WP01
requirement_refs:
- C-007
- FR-006
- FR-007
- FR-008
- FR-023
- FR-028
planning_base_branch: feat/openapi-second-slice
merge_target_branch: feat/openapi-second-slice
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-second-slice. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-second-slice unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-second-slice-01M6WXJ4
base_commit: 6cdac7950d73961c6b4e1dbb11f03d781987fb26
created_at: '2026-11-08T10:45:19.952822+00:00'
subtasks:
- T007
- T008
- T009
- T010
- T011
- T012
history:
- timestamp: '2026-11-08T07:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
- timestamp: '2026-11-08T08:00:00Z'
  agent: claude
  action: Remediated per post-tasks squad rulings
agent_profile: node-norris
authoritative_surface: src/lib/openapi/
create_intent:
- src/lib/openapi/materialise.mjs
- src/lib/openapi/operations.mjs
- src/lib/openapi/summary.mjs
- src/lib/openapi/cache.mjs
- src/lib/openapi/limits.mjs
- src/tests/openapi-materialise.test.ts
- src/tests/openapi-summary.test.ts
execution_mode: code_change
owned_files:
- src/lib/openapi/options.mjs
- src/lib/openapi/materialise.mjs
- src/lib/openapi/operations.mjs
- src/lib/openapi/summary.mjs
- src/lib/openapi/cache.mjs
- src/lib/openapi/limits.mjs
- src/lib/openapi/adapters.ts
- src/lib/openapi/route-middleware.ts
- src/lib/integrations/openapi-publish.ts
- src/lib/integrations/served-surfaces.ts
- src/lib/config.ts
- src/lib/internal-env.mjs
- src/lib/served-surfaces.ts
- src/tests/openapi-options.test.ts
- src/tests/openapi-raw-document.test.ts
- src/tests/openapi-integration.test.ts
- src/tests/openapi-materialise.test.ts
- src/tests/openapi-summary.test.ts
- src/tests/served-surfaces.test.ts
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP02 - Materialised spec list, extension points and shared helpers

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Introduce `materialiseOpenApiSpecs()`, the extended publication and every extension point in the plan's parallel-edit registry, so WP03-WP12 each add at most one line to a WP02 file.

Requirements: FR-006, FR-007, FR-008, FR-023, FR-028, C-007. Depends on: WP01.

## Context

- Spec `kitty-specs/openapi-second-slice-01M6WXJ4/spec.md` (decisions final; trust model C-008; limits FR-028). Plan incl. the parallel-edit registry; research R1-R14; data-model; contracts (row ownership in `contracts/rejected-inputs.md`).
- Errors start `[dk-openapi]` naming spec version and cause; query strings redacted. A site without `openapi` must not change (arm A).
- Edits to WP02-owned seam files are limited to the one line the registry names; edits to WP01-owned tests are limited to flipping your own `[WPnn]` cases. Note each in the commit message.

## Subtasks

### T007: Red first

Write `tests/openapi-materialise.test.ts` cases titled `[WP02] ...` before any implementation and run them: they must fail because `materialiseOpenApiSpecs` does not exist and the publisher still re-reads the source. Record the red output in the commit message. Flip the matching `it.fails('[WP02] ...')` cases WP01 left in the seam test.

### T008: Static option schema

Full static shape of contracts/config-options.md in `normaliseOpenApiOptions`; file reads move out. Static rejection rows owned by WP02 (http, missing sha256, labelPattern, userinfo, archive glob absolute or with `..`).

### T009: materialise.mjs and specSources

Local self-contained file path: read once (size cap from `limits.mjs`, YAML `maxAliasCount` 100), structural check, sha256, `renderPath`. A `specSources` registry keyed `archive|remote|bundle|swagger2`; unregistered kinds throw `[dk-openapi] ... not supported`. Explicit specs keep config order (FR-023 explicit part).

### T010: operations.mjs, summary.mjs, cache.mjs, limits.mjs

Operations sorted path then uppercase method bytewise with renderer 0.27.0 slugs incl. duplicate suffix (C-007: a test compares against the renderer routes of ops-200). `summary.mjs`: `openApiSummaryMarkdown`, `flattenText`, `escapeMdLink`. `cache.mjs`: `writeCacheAtomic(dir, sha, ext, bytes)` unique temp in same dir + rename, refuses symlinks; `readCacheVerified` hashes before returning. `limits.mjs`: 10 MB, 30 s, alias 100, ref count/depth constants.

### T011: Publication and publisher

Extended `OpenApiPublication` (data-model); `toPublication` reads the list; virtual module carries operations and released. Publisher writes materialised bytes (no re-read; TOCTOU test mutates source after materialisation); prune warning text fixed (debrief bug 4); `openApiLlmsLines` stays exported for WP04.

### T012: Hooks and flags

In `adapters.ts`: `buildDoneHooks` run inside `openApiPlugin`'s inner integration after `openApiPublishHooks`; `devHandlers` in `astro:server:setup`; `pagePropsHooks` merged into the splice; `resolveOpenApiNav` returns `current.operationSlug`. In `config.ts`: `sitemapPredicates`. `openapi` served-surfaces flag passed through `servedSurfacesIntegration()`; false and unused when unset. Two-build compare green for raw docs and sidecars.

## Acceptance commands

Run from the repository root; each must exit 0.

```bash
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-materialise.test.ts tests/openapi-summary.test.ts tests/openapi-options.test.ts tests/openapi-raw-document.test.ts tests/openapi-integration.test.ts tests/served-surfaces.test.ts
pnpm --filter @spec-kitty/doc-toolkit exec vitest run tests/openapi-seam.test.ts  # WP02 rows green, two-build identical
( cd src && ./node_modules/.bin/vitest run --root ../tests/consumption openapi-optin.test.ts )
```

## Acceptance checks

- [ ] Published bytes equal config-time bytes after source mutation
- [ ] Every registry seam exists with a unit test
- [ ] Arm A green
- [ ] Red-first evidence in the first commit; own `[WPnn]` `it.fails` flipped
- [ ] `pnpm typecheck` and `pnpm lint` clean

## Branch Strategy

Final merge target: `feat/openapi-second-slice`. Worktrees per computed lane from `lanes.json`.

```bash
spec-kitty agent action implement WP02 --agent <name> --mission openapi-second-slice-01M6WXJ4
```

## Definition of Done

- Subtasks marked with `spec-kitty agent tasks mark-status`; acceptance commands green.

## Risks

config.ts and adapters.ts are shared; keep seams small.

## Reviewer guidance

- Each FR has a test that fails without the change.
- `[dk-openapi]` messages name version and cause.
- Two-build identity where output changes.
