---
work_package_id: WP06
title: Rebaseline gates (#146)
dependencies:
- WP05
requirement_refs:
- FR-011
- NFR-001
- NFR-002
- SC-004
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: ac5fe0b4c6b524a870fcc74ce2e222e554c1c820
created_at: '2026-10-18T21:40:23.369628+00:00'
subtasks:
- T019
- T020
- T021
- T022
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: tests/
create_intent: []
execution_mode: code_change
owned_files:
- tests/a11y/**
- src/tests/remark-version-pin.test.ts
- src/tests/example-adopter.test.ts
- example/url-baseline.txt
- tests/consumption/consumer-fixture/url-baseline.txt
- tests/consumption/*.test.ts
role: implementer
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load frontend-freddy` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP06 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Rebaseline every gate the new markup moves, each with a reason; fix
determinism at the cause (FR-011, NFR-001, NFR-002, SC-004).

### T019 — A11y and visual

Regenerate screenshots only for specs whose diff is explained by Starlight's
new markup. Review each diff image. The three known local drifts on `main` are
judged against CI, not rebaselined locally (use the
`update-a11y-baselines.yml` workflow if CI-rendered baselines are needed).
Zero new axe violations.

### T020 — Determinism

Two clean example builds; byte-compare the gated artifacts. If they differ,
find and fix the cause; never loosen the gate.

### T021 — Pins

`remark-version-pin.test.ts` and the remark-stack enumerator; example pins in
`example-adopter.test.ts`; URL baselines. One-line reason per change.

### T022 — Consumption test

Pack, install in the clean consumer fixture, build, run its tests on the new
peer ranges.

## Definition of Done

All gates green locally (minus documented env drift); a reason list for the
PR body; `ci-ok` green after push.
