---
work_package_id: WP05
title: No report text in any built output
dependencies:
- WP02
requirement_refs:
- FR-005
- SC-004
- C-006
- NFR-007
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: 7c78636fbac54f61c5593976ea3e84e57213a4cb
created_at: '2026-10-14T19:42:09.798199+00:00'
subtasks:
- T023
- T024
- T025
- T026
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/scripts/assert-build-artifacts.mjs
execution_mode: code_change
lane: planned
mission_id: 01M4XVCM3XBX6BXHXDZFBPX7ZV
model: sonnet
owned_files:
- src/scripts/assert-build-artifacts.mjs
- src/lib/gherkin/results-overlay.mjs
role: implementer
wp_code: WP05
---
# WP05 — No report text in any built output

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`implementer-ivan`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Behaviour-change rules

- **Red first** through the existing entry points (the integration, the remark plugin, the build). Write the failing test, show it red, then implement.
- **Strengthen existing tests** before adding files (DIRECTIVE_041). Each new assertion has a paired positive control so it cannot pass vacuously (tactic acceptance-criteria-non-vacuity).
- Test files owned by a trim WP that you edit are named out-of-map edits: list them in the hand-off with the rationale. You always run after that trim WP, never concurrently.

## Objective

FR-005 / US2 (plan IC-05). Prove that failure messages, stack traces and attachments from a results report never reach any built file.

## Subtasks

- **T023** Out-of-map edit of `src/tests/gherkin-results-build.test.ts` (trim owner WP02, which you follow): give the fixture report message, stack and `text/plain` attachment sentinels; walk **every** text file in the out dir (including `.txt`, `.json`, `.xml`); assert no sentinel and no base64-encoded form of it. Paired control: the step status does appear.
- **T024** Red first: let the message through in `results-overlay.mjs` on purpose, show the test red, revert. Record the evidence.
- **T025** `assert-build-artifacts.mjs`: `GHERKIN_RESULTS_LEAKS` (`:1650`) is checked only against `GHERKIN_RESULTS_PAGES` HTML (`:1673-1676`). Write a sibling `textFilesUnder` (`.html`, `.txt`, `.json`, `.xml`) next to `htmlFilesUnder` (`:334`, keeps `.html` only; do not widen it) and run the leak loop over every text file in dist. The walk must cover the output kinds from `src/lib/routes/{llms-txt,agent-index,agent-page,bibliography,rss,scenario-index}.ts`, `api/scenarios.json` (`:202`), `api/pages/**.json` (`:1579`) and `sitemap*.xml` (`:1893`). Check that `example/reports/cucumber.ndjson` is never copied into dist (it sits outside `public/`); record the `find dist -name 'cucumber*'` output in the hand-off, because a copied report would fail the dist-wide walk on itself. Overlay entry for T024: `results-overlay.mjs:101` `overlayResults`.
- **T026** Hand-off: red/green evidence, out-of-map edit rationale.

Set `CI` explicitly (`CI: ''`) in every build you spawn in tests; GitHub Actions sets `CI=true` and WP06 makes that fail on a missing report.

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
