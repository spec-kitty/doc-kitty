---
work_package_id: WP07
title: 'Remove deprecated surfaces (#183, #210)'
dependencies:
- WP01
requirement_refs:
- FR-012
- FR-013
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: 89582c756bbd7aae43d3683f31c01f3dd3567cc4
created_at: '2026-10-18T19:27:36.828876+00:00'
subtasks:
- T023
- T024
- T025
- T026
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: src/lib/
create_intent:
- src/tests/legacy-stamp-removal.test.ts
execution_mode: code_change
owned_files:
- src/lib/routes/scenario-index.ts
- src/lib/generator-stamp.mjs
- src/scripts/validate-frontmatter.mjs
- src/scripts/assert-build-artifacts.mjs
- src/tests/scenario-index.test.ts
- src/tests/legacy-stamp-removal.test.ts
- src/tests/gherkin-generate.test.ts
- src/tests/glossary-generate.test.ts
- src/tests/schema-validator-parity.test.ts
- src/tests/gherkin-codegen-guard.test.ts
- src/tests/fixtures/old-forms/**
- docs/architecture/gherkin-pages.md
role: implementer
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load implementer-ivan` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP07 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Retire the unversioned `doc-kitty/gherkin` name in the 0.4.0 breaking release
(FR-012, FR-013). Independent of the Astro bump; runs after GO.

### T023 — Red-first: scenarios API (#183)

In `src/tests/scenario-index.test.ts`, assert `generated_from` is absent and
`version` is the bumped value (see `contracts/scenarios-api-v-next.md`). Run:
it must fail.

### T024 — Remove `generated_from`

Drop it and `SCENARIO_INDEX_SOURCE_DEPRECATED` in
`src/lib/routes/scenario-index.ts`; bump the API `version`; drop the check in
`src/scripts/assert-build-artifacts.mjs`. Update
`docs/architecture/gherkin-pages.md`. Do not edit ADR-0059's accepted text;
add to its implementation notes only if that section is explicitly appendable,
otherwise note it in the changelog.

### T025 — Red-first: legacy stamps (#210)

New `src/tests/legacy-stamp-removal.test.ts`: a page carrying only a legacy
stamp must fail validation with a message telling the author to regenerate;
the `sha256:` `at` fallback must no longer be accepted. Must fail first.

### T026 — Remove legacy stamps

Drop `LEGACY_STAMPS`, `LEGACY_STAMP_BY_PRODUCER`, the legacy branch in
`isGeneratedStamp`, the `GENERATED_BY_STAMPS` alias, and the `sha256:`
fallback. Update tests that pinned legacy acceptance (judge each: stale →
re-pin to the new failure, not delete). Regenerate fixtures under
`src/tests/fixtures/` with the repo's generators if they carry legacy stamps.
Run `pnpm validate:docs`, `validate:example`, `validate:features`.

## Definition of Done

Both red-first tests green; no legacy acceptance left; docs updated. The
changelog entries are written in WP08 (hand over the wording).
