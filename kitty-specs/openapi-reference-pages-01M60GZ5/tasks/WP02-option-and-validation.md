---
work_package_id: WP02
title: The openapi option and fail-closed validation
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-007
- FR-010
- NFR-005
- NFR-006
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: 51d56c69734a6b7a62f2441b30c0c92c93b51375
created_at: '2026-10-29T07:36:30.136131+00:00'
subtasks:
- T005
- T006
- T007
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: implementer-ivan
authoritative_surface: src/lib/openapi/
create_intent:
- src/lib/openapi/peers.mjs
- src/lib/openapi/options.mjs
- src/tests/openapi-options.test.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/openapi/options.mjs
- src/lib/openapi/peers.mjs
- src/tests/openapi-options.test.ts
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `implementer-ivan` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Build the pure validation core and the peer loader that WP03 will wire into `config.ts`. WP03 owns `config.ts`. The option it will add is `openapi?: { section?: string; specs: ApiVersion[] }` on `DocKittyOptions` (`src/lib/config.ts:131`), validated eagerly in `defineDocKittyIntegrations` (`:431`), following the `gherkin` precedent (`:244`, `:451-466`). Export the JSDoc types so WP03 can reuse them. The shapes and rules are in `data-model.md` and `contracts/openapi-option.md`. Errors start with `[dk-openapi]` and name the entry by index and label, plus the file.

## Subtasks

**T005: Red-first tests** in `src/tests/openapi-options.test.ts`, one per case. Each test checks the exact message fragment:
- missing path;
- unreadable or empty file;
- not OpenAPI 3.0/3.1, including Swagger 2 (`swagger: "2.0"`) with a "3.x required" message;
- an external `$ref` (a multi-file document);
- duplicate labels, case-insensitive (`Main` and `main`);
- an unsafe label (outside `[a-z0-9._-]` after lower-casing);
- `released` missing, or not a boolean;
- an empty `specs`;
- an unsafe `section` (each `/`-separated segment follows the label rule), or a section equal to or under the reserved `api/` (the agent API).

The default section is `reference/api` (DM plan.routes.default-section).

Positive controls: a valid two-spec config normalises to the expected shape, and a valid 3.0 document passes.

**T006: Implement** `src/lib/openapi/options.mjs`, a pure JSDoc-typed module.
- It exports `normaliseOpenApiOptions(raw, { siteRoot })`, which returns `{ section, specs: [{ path, absPath, label, released, ext }] }` or throws.
- Parse YAML or JSON with the repo's existing YAML dependency. Do **not** import `starlight-openapi` here.
- Validation is a structural check: `openapi` is a string starting `3.0` or `3.1`, `info` and `paths` (or `webhooks`/`components`) are objects, and there is no external `$ref`. Deep schema validation stays with the renderer.
- Do NOT edit `config.ts`; WP03 wires the call.

**T007: The peer loader and the no-cost guard (FR-010).**
- Add `src/lib/openapi/peers.mjs` exporting `loadOpenApiPeers()`. It is the ONLY place the peers are loaded, and it loads them through a dynamic `import()`. When a peer is missing, it throws `[dk-openapi] install starlight-openapi@<pin> and @astrojs/markdown-satteri@<pin>`. Read the pins from `src/package.json` `peerDependencies`; test this with an import stub.
- Add a test that scans `src/lib/**` and finds no static `import` or `require` of either peer outside `peers.mjs`'s dynamic `import()`. WP03 adds the end-to-end test that no-option `defineDocKittyIntegrations` never calls the loader.

## Definition of Done

- All cases are red first and then green.
- The mutation check is noted: removing each guard turns its test red.
- Typecheck and lint pass, and `src/tests/package-runtime-deps.test.ts` passes.
- Complexity is ≤15.

## Reviewer guidance

- Check the messages name the entry and the file.
- Check there is no import of the peers on the no-option path.
- Check the label rule matches research R6 exactly.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP02 --agent claude --mission openapi-reference-pages-01M60GZ5`

## Environment

- In a fresh worktree, run `corepack pnpm install --frozen-lockfile` first; it takes about 1 s from the store.
- Unit tests: `cd src && ./node_modules/.bin/vitest run --project fast <files>`.
- Lint: `./node_modules/.bin/eslint <files>` from the worktree root.
- Typecheck: `corepack pnpm typecheck`.
- PlantUML is not available locally (the local config points at `127.0.0.1:8091`; CI runs a `plantuml` service). Build-suite reds caused only by that `ECONNREFUSED` are environmental; say so and do not "fix" them.
- Lane worktrees have no installed deps. Run the frozen install in EVERY lane worktree before any test.
- `--project fast` does not run the build-project tests. Run the integrated build suite once, and never in parallel with another vitest run, because they share `dist`.
- New branches and helpers get tests in the same commit. Cyclomatic complexity stays ≤15.
- Read `kitty-specs/openapi-reference-pages-01M60GZ5/{spec,plan,research,data-model}.md` and `contracts/openapi-option.md` before coding. Use the MAIN-checkout copy of this prompt if the worktree copy looks stale.
