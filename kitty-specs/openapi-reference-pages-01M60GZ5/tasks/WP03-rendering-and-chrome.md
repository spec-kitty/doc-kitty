---
work_package_id: WP03
title: 'Render the reference pages: wiring, chrome, theming, a11y'
dependencies:
- WP02
requirement_refs:
- FR-002
- FR-003
- FR-004
- FR-005
- FR-009
- NFR-002
- NFR-003
planning_base_branch: feat/openapi-reference-pages
merge_target_branch: feat/openapi-reference-pages
branch_strategy: Planning artifacts for this mission were generated on feat/openapi-reference-pages. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/openapi-reference-pages unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-openapi-reference-pages-01M60GZ5
base_commit: 3548846f0318bc5b483e9011596b15a5acabcdd2
created_at: '2026-10-29T07:41:25.910034+00:00'
subtasks:
- T008
- T009
- T010
- T019
history:
- '2026-10-29: created by /spec-kitty.tasks'
agent_profile: frontend-freddy
authoritative_surface: src/lib/integrations/openapi.ts
create_intent:
- src/lib/integrations/openapi.ts
- src/components/OpenApiVersionNav.astro
- src/lib/openapi/adapters.ts
- src/lib/schema.ts
- src/tests/openapi-integration.test.ts
- tests/a11y/openapi.spec.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/config.ts
- src/lib/integrations/openapi.ts
- src/styles/dk-components.css
- src/components/OpenApiVersionNav.astro
- src/lib/openapi/adapters.ts
- src/lib/schema.ts
- src/tests/openapi-integration.test.ts
- tests/a11y/openapi.spec.ts
- tests/a11y/axe.spec.ts
- example/astro.config.mjs
role: implementer
tags: []
tracker_refs:
- '#244'
---

## ⚡ Do This First: Load Agent Profile

Load the `frontend-freddy` profile with the `/spk-charter-profile-load` skill before you read anything else.

## Objective

Wire `starlight-openapi`, through WP02's `loadOpenApiPeers()`, for each spec normalised by WP02's `normaliseOpenApiOptions`. The pages must render in the DocKitty frame with `--dk-*` theming, version links and the "unreleased" badge. You own `src/lib/config.ts`, so you also add the `openapi` option and call the validation eagerly. The class hooks, surfaces and CSP method from the WP01 spike are in ADR-0049's addendum and `research.md` R7; read them first.

## Spike facts (research.md R7) you must design for

- **Default section** is `reference/api`. `api/` is reserved for the agent API; reject it, and anything under it, as a section.
- **Description.** The plugin's pages carry only `title`, so the DocKitty docs schema rejects them. Add a description adapter in `src/lib/openapi/adapters.ts`: route-data middleware that supplies a description (from `info.description`/`summary`, or `"<label> API reference: <operation summary>"`), or a narrow schema exemption for API routes in `src/lib/schema.ts`. Prefer the middleware, and do not relax the schema for authored pages.
- **Stylesheet.** There is no switch to turn the plugin stylesheet off. Add a follow-on Starlight plugin (in `adapters.ts`) that removes `starlight-openapi/styles` from `customCss`, and test it.
- **Snippets off.** Set `snippets: { operation: false, requestBody: false, response: false }`. That leaves exactly 1 known inline script.
- **No slots.** The version links and the badge go in through route middleware or a wrapper component.
- **Hooks.** Style the `sl-openapi-*` classes and map the `--sl-openapi-*` custom properties to `--dk-*` tokens.

## Subtasks

**T008: Option and plugin wiring.**
- In `src/lib/config.ts`, add `openapi?` to `DocKittyOptions` (typed from WP02's JSDoc types) and call `normaliseOpenApiOptions` in `defineDocKittyIntegrations` only when the option is set.
- `starlight-openapi` is a **Starlight plugin**: register one entry per spec in the Starlight `plugins:` array (`config.ts:~611`), with `base: '<section>/<label>'` and the plugin's `styles` NOT loaded. Turn off any try-it or console switch (spike item 6).
- Add a sidebar group per version through the existing sidebar wiring (`splitSidebarOption`, `config.ts:~102-130`). It is generated, never hand-maintained.
- Route collisions with authored pages fail through the ADR-0050 formatter, naming both.
- Tests in `src/tests/openapi-integration.test.ts`:
  - no option means `loadOpenApiPeers` is never called (end-to-end FR-010 guard);
  - the option registers N plugin entries;
  - a collision fails.
- Configure both WP01 fixtures in `example/astro.config.mjs` (`v1` released, `main` unreleased).

**T009: Version links and badge.** On every API page, render a list of links to every configured version (none for a single version). On unreleased versions, render a visible text "unreleased" badge (not colour alone). Use the plugin's override or slot hooks, or `OpenApiVersionNav.astro`. All links go through `withBase`.

**T010: Theming** in `src/styles/dk-components.css`. Map the plugin markup hooks to `--dk-*` tokens, with no hard-coded colours or fonts. A test checks that a branding override reaches an API page in BOTH light and dark mode (FR-005).

**T019: Accessibility and static-only.**
- Add `tests/a11y/openapi.spec.ts`: axe in light and dark on one page per version, plus a JS-off check that operation text is present and no request to the spec is made (FR-009).
- Add API pages to `axe.spec.ts` if that is where the page list lives.
- Container baselines are regenerated by the CI "Update a11y baselines" workflow. The a11y requirement is only met when CI is green; report that rather than claiming it locally.

## Definition of Done

- Every FR in `refs` has a test that bites. For FR-009 and NFR-002, include a negative control: enabling the console switch makes the assert fail.
- Typecheck, lint and the fast suite pass.
- The integrated build suite has been run once.

## Reviewer guidance

- Look for the plugin stylesheet sneaking in, links missing `withBase`, and a static peer import.
- Check that the schema is not relaxed for authored pages.

## Branch Strategy

- Planning branch and final merge target: `feat/openapi-reference-pages` (the mission PR goes to `main`).
- Execution worktrees are allocated per computed lane from `lanes.json`. Do not pick a base branch by hand.
- Implement command: `spec-kitty agent action implement WP03 --agent claude --mission openapi-reference-pages-01M60GZ5`

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
