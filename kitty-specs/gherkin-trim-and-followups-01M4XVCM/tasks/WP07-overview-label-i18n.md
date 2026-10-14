---
work_package_id: WP07
title: Translatable Overview label and indexLabel option
dependencies:
- WP06
requirement_refs:
- FR-009
- FR-010
- SC-005
- NFR-006
- NFR-007
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: 991894e4bbb73c436d96f1631cce5ba6c1fad10d
created_at: '2026-10-14T20:06:43.202931+00:00'
subtasks:
- T033
- T034
- T035
- T036
- T037
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/route-shaping.ts
create_intent:
- src/lib/i18n-plugin.ts
execution_mode: code_change
model: sonnet
owned_files:
- src/lib/route-shaping.ts
- src/lib/route-middleware.ts
- src/lib/route-shaping-module.d.ts
- src/lib/i18n-plugin.ts
- src/tests/route-shaping.test.ts
- src/tests/sidebar-build-html.test.ts
role: implementer
---
# WP07 — Translatable Overview label and indexLabel option (#161)

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`frontend-freddy`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Behaviour-change rules

- **Red first** through the existing entry points (the integration, the remark plugin, the build). Write the failing test, show it red, then implement.
- **Strengthen existing tests** before adding files (DIRECTIVE_041). Each new assertion has a paired positive control so it cannot pass vacuously (tactic acceptance-criteria-non-vacuity).
- Test files owned by a trim WP that you edit are named out-of-map edits: list them in the hand-off with the rationale. You always run after that trim WP, never concurrently.

## Objective

FR-009/010 per `contracts/overview-label.md` (plan IC-07). The sidebar index label (`INDEX_ENTRY_LABEL = 'Overview'`, `src/lib/route-shaping.ts:155`) becomes the UI string `dockitty.sidebar.indexLabel`, registered by a DocKitty Starlight plugin through `config:setup` + `i18n:setup`/`injectTranslations`. A `defineDocKittyIntegrations({ sidebar: { indexLabel } })` option wins over the translation and reaches the middleware through `virtual:doc-kitty/route-shaping`. Prev/next links keep the page title (existing guard).

**Why WP06 is a dependency**: both edit `src/lib/config.ts` in different functions. WP06 owns it; your edits there (validate `sidebar.indexLabel`, append `doc-kitty:i18n` to `starlight.plugins` without replacing an adopter's plugins, add `indexLabel` to `routeShapingSource`) are a named out-of-map edit made after WP06 lands.

## Subtasks

- **T033** Red: `shapeSidebar` with `indexLabel: "Aperçu"` (ignored today). Default control stays "Overview".
- **T034** Starlight plugin in `src/lib/i18n-plugin.ts`; `en` default; a locale missing the key falls back to `en` (assert it).
- **T035** Middleware: stub `locals.t` returning a translation (red first); option-wins test (red first); prev/next keeps page title.
- **T036** config.ts out-of-map edit: option validation; virtual module field (`routeShapingSource`, `config.ts:~1759`; add `indexLabel` to `route-shaping-module.d.ts`). DocKitty registers no Starlight plugins today; adopter plugins arrive via `...overrides` (`config.ts:~2092`): append the DocKitty plugin after overrides, the way `routeMiddleware` is appended at `:~2097` (`starlight()` call at `:~2170`). Starlight 0.32.6 provides `i18n:setup` + `injectTranslations` (`example/node_modules/@astrojs/starlight/utils/plugins.ts:46,50,362`).
- **T036 (continued)** `route-shaping.ts:316` skips the swap when a sibling label equals `INDEX_ENTRY_LABEL`: compare against the **resolved** label instead; add a red-first test with a custom `indexLabel`. Update the tests pinning 'Overview' (`route-shaping.test.ts:182,183,231,232,289,351,380,391`, `sidebar-build-html.test.ts:150`) only where the label is no longer the default; default-path pins stay.
- **Out of scope**: `metadata.ts:181` `SECTION_LABEL[''] = 'Overview'` is the root section label, not the index entry label; it is a different rule and is not changed. State this in the hand-off.
- **T037** Example output unchanged (default still "Overview"); hand-off.

## Shared context (all work packages)

- **Mission documents**: `kitty-specs/gherkin-trim-and-followups-01M4XVCM/spec.md`, `plan.md` (Implementation Concern Map), `research.md`, `research/baseline.md`, `research/coverage-map.md`, `research/count-lines.mjs`, `data-model.md`, `contracts/*.md`, `quickstart.md`, `decisions/DM-*.md`.
- **Do not add, upgrade or remove a dependency** (DIRECTIVE_051). Stop and report if one seems needed.
- **Test economy (C-001, DIRECTIVE_041)**: strengthen existing tests before adding new ones; every new guard has a paired positive control (tactic acceptance-criteria-non-vacuity).
- **Frozen shared helpers**: `src/tests/helpers/*` and `tests/a11y/{mode,routes}.ts` are not edited by any WP.
- **Pinned baselines**: pinned a11y and example-output baselines must not change (NFR-006), except where FR-007/FR-009 intends it.

## Environment gotchas

- Run vitest from `src/` with `node_modules/.bin/vitest run <files>`. Do not use `pnpm exec` (it has install side effects). Run other bins directly too.
- If the default npm registry is unreachable, use `https://registry.npmjs.org/`.
- In markdown, never start a line with `#` followed by a digit (C-005; the doc sanity gate fails).
- The ADR index is generated: `node src/scripts/generate-adr-index.mjs`. Never edit it by hand.
- Example builds create directories relative to `example/`; delete any stray output dirs they leave before committing.
- PlantUML being absent locally is expected; related local reds are not yours. CI is the verifier.
- Commit only your owned files. A file outside `owned_files` is an out-of-map edit and must be named with a rationale in your hand-off.
