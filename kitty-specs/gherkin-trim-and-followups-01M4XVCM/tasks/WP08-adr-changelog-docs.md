---
work_package_id: WP08
title: ADR-0056, CHANGELOG and adopter docs
dependencies:
- WP04
- WP05
- WP06
- WP07
requirement_refs:
- FR-011
- FR-012
- C-003
- C-005
- NFR-001
- NFR-002
- NFR-007
planning_base_branch: chore/gherkin-trim-and-followups
merge_target_branch: chore/gherkin-trim-and-followups
branch_strategy: Planning artifacts for this mission were generated on chore/gherkin-trim-and-followups. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into chore/gherkin-trim-and-followups unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-followups-01M4XVCM
base_commit: fa0e78c7ec34fc9e14d44e1955144b9f9cb075c4
created_at: '2026-10-14T20:15:24.992566+00:00'
subtasks:
- T038
- T039
- T040
- T041
agent: claude
history:
- timestamp: '2026-10-14T20:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/adr/0056-gherkin-results-followups.md
create_intent:
- docs/adr/0056-gherkin-results-followups.md
- docs/changelog/2026-10-14-gherkin-trim-and-followups.md
execution_mode: code_change
lane: planned
mission_id: 01M4XVCM3XBX6BXHXDZFBPX7ZV
model: sonnet
owned_files:
- docs/adr/0056-gherkin-results-followups.md
- docs/adr/README.md
- CHANGELOG.md
- docs/guides/authoring.md
- docs/architecture/gherkin-pages.md
- docs/changelog/2026-10-14-gherkin-trim-and-followups.md
role: implementer
wp_code: WP08
---
# WP08 — ADR-0056, CHANGELOG and adopter docs

## Do This First: Load Agent Profile

Load your assigned profile with the `/spk-charter-profile-load` skill (`curator-carla`). Apply its boundaries and directives for the whole WP and state in your hand-off which ones you applied.

## Objective

FR-011, FR-012 (plan IC-08). Docs describe shipped behaviour, so read the merged code of WP05..WP07 first.

## Subtasks

- **T038** `docs/adr/0056-gherkin-results-followups.md` (Amends ADR-0055; ADR-0055 is **not** edited, C-003): zero-step scenarios show Not run; heading-order overlay without `generated.at`; report produced in CI not committed; missing report + CI and `required: false`; stale include note; hand-mounted route warning. Regenerate the index with `node src/scripts/generate-adr-index.mjs`.
- **T039** Root `CHANGELOG.md` `[Unreleased]` (canonical): user-focused entries under 1,200 characters; call out `required: false` for preview jobs; Overview label translation/option; the test trim as a maintainer note. Dated `docs/changelog/` entry mirrors it.
- **T040** Guides: `docs/guides/authoring.md:74-86` says the word "Overview" is "English only for now": replace with the translation key and option. `docs/guides/consumer-setup.md:786` results option table: add `required`; `:909` missing-report behaviour: describe the CI rule. Check `docs/architecture/collapsible-toc-rail.md:56` for the Overview label and update it to match. Results section of `docs/guides/authoring.md` and `docs/architecture/gherkin-pages.md` (CI behaviour, stale note, route warning); sidebar/i18n guidance for `dockitty.sidebar.indexLabel` and `sidebar.indexLabel`.
- **T041** Doc sanity gate passes; no line starts with `#` + digit; ADR reviewed against code. Run `node kitty-specs/gherkin-trim-and-followups-01M4XVCM/research/count-lines.mjs --json` on the integrated branch. Test lines must be ≤ 70% of 9,321 (≤ 6,524) and fixture lines ≤ 75% of 2,784 (≤ 2,088), else the WP is blocked. Rerun the full in-scope vitest command 3× and require median ≤ WP01 median × 1.10 (NFR-005). Record the numbers in the hand-off.

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
