---
work_package_id: WP05
title: Clean-room proof + dogfood charter.yaml + consumption non-regression
dependencies:
- WP03
requirement_refs:
- NFR-001
- NFR-002
planning_base_branch: feat/documentation-charter
merge_target_branch: feat/documentation-charter
branch_strategy: Planning artifacts for this mission were generated on feat/documentation-charter. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/documentation-charter unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-documentation-charter-01M2FEXM
base_commit: 0162dcd63fa1d426012acaa99e1429f708bb98bf
created_at: '2026-09-14T10:05:56.211628+00:00'
subtasks:
- T023
- T024
- T025
- T026
- T027
history: []
agent_profile: implementer-ivan
authoritative_surface: tests/consumption/
create_intent:
- docs/_meta/charter.yaml
execution_mode: code_change
model: ''
owned_files:
- docs/_meta/charter.yaml
- tests/consumption/**
- .github/workflows/consumption-test.yml
role: implementer
tags: []
tracker_refs: []
---

# WP05 — Clean-room proof + dogfood charter.yaml + consumption non-regression

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Prove the two portability invariants: the charter resolves in a packed-tarball clean-room build with **zero Spec Kitty reference** (NFR-001), and the existing consumer does **not regress** (NFR-002) — while dogfooding by giving doc-kitty's own `docs/` tree a `_meta/charter.yaml`.

## Context

See `plan.md` IC-06, spec SC-003, and the existing consumption harness (`tests/consumption/consumer-fixture`, `consumption-gap.test.ts`, `scripts/`, `.github/workflows/consumption-test.yml`). This WP depends on WP03 because the clean-room assertion needs the full charter enforcement wired. Do NOT weaken the existing consumption assertions; add to them.

### Subtask T023: Dogfood `docs/_meta/charter.yaml`
**Purpose**: Prove the charter surface on doc-kitty's own tree (identical behavior).
**Steps**:
1. Author `docs/_meta/charter.yaml` mirroring the current `_meta/vocabulary.yaml` + `_meta/sections.yaml` exactly (per-axis).
2. Verify doc-kitty's own `validate:docs` / build produce identical governance (the legacy files remain for now; expect the one deprecation notice).
**Files**: `docs/_meta/charter.yaml` (new).
**Validation**: doc-kitty build/validate behavior unchanged vs pre-charter.

### Subtask T024: Consumer fixture authors a charter
**Purpose**: Exercise governance through the packed toolkit (US1).
**Steps**: In `tests/consumption/consumer-fixture`, add a `_meta/charter.yaml` that forbids a term, adds a `doc_status`, and relaxes a non-floor field; add pages exercising each.
**Files**: `tests/consumption/**`.
**Validation**: forbidden term fails; added status passes; relaxed field passes; `title`-less page fails.

### Subtask T025: Clean-room "zero Spec Kitty" assertion
**Purpose**: Lock NFR-001 with a guard that bites.
**Steps**: Extend the consumption test to assert the packed-tarball build contains no `spec-kitty` import/dependency and runs with no Spec Kitty on PATH; write the assertion so that introducing a Spec Kitty import would fail it.
**Files**: `tests/consumption/**`.
**Validation**: assertion passes now; a deliberate temporary import makes it fail (sanity-check, then revert).

### Subtask T026: Non-regression of existing consumer
**Purpose**: NFR-002.
**Steps**: Keep a legacy-only path in the harness (no charter file) and assert identical governance to today; ensure the consumption CI gate stays green with no new required tooling.
**Files**: `tests/consumption/**`, `.github/workflows/consumption-test.yml` (only if wiring is needed).
**Validation**: consumption-test workflow green; legacy-only behavior unchanged.

### Subtask T027: Record evidence
**Purpose**: Close the mission's portability proof.
**Steps**: Note the clean-room + non-regression results (SC-003) in the consumption test output / a short evidence note the reviewer can check.
**Files**: `tests/consumption/**`.
**Validation**: evidence present and reproducible.

## Definition of Done
- `docs/_meta/charter.yaml` dogfooded with identical behavior.
- Consumer fixture exercises forbidden-term / added-status / relaxed-field governance through the packed toolkit.
- Clean-room "zero Spec Kitty" guard bites; legacy-only non-regression asserted.
- Consumption-test CI green; each subtask `mark-status ... --status done`.

## Risks
- **Guard that doesn't bite** — verify the zero-SK assertion actually fails on a planted import before trusting it.
- **CI-only verification** — the packed-tarball build may only run in CI; if so, say the gate is CI-verified rather than claiming local green.
- **Deprecation notice** — dogfooding adds `charter.yaml` alongside legacy; expect (and allow) the one notice.

## Reviewer Guidance
Focus on: the zero-Spec-Kitty guard is real (bites on a planted import); existing consumption assertions strengthened not weakened; dogfood charter is behavior-identical; no new required adopter tooling.

Implement with: `spec-kitty agent action implement WP05 --agent claude`
