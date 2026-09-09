---
work_package_id: WP05
title: Fail-closed packaging-gap self-test (two-arm)
dependencies:
- WP01
requirement_refs:
- FR-006
- FR-007
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T021
- T022
- T023
history:
- created by /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: tests/consumption/
create_intent:
- tests/consumption/consumption-gap.test.ts
execution_mode: code_change
owned_files:
- tests/consumption/consumption-gap.test.ts
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load node-norris` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_043 (close the class by construction), DIRECTIVE_010 (spec fidelity), and the anti-scaffolding tactic (a test that can only pass is worthless).

## Objective

Prove — as a **two-arm** focused test — that omitting a statically-imported,
allowlisted toolkit file the fixture actually uses makes the consumption build fail
closed, WITHOUT leaving a standing red gate.

Read first: `../contracts/consumption-test-contract.md` (C-2 and C-4), `../research.md`
(favicon carve-out under Supply-chain / dispositions), `../data-model.md` (E-06, INV-15),
and the precedent `src/tests/redirect-coverage.test.ts` (crafted-fixture failure-mode pattern).

## Subtasks

### T021 — Positive control arm
In `tests/consumption/consumption-gap.test.ts`, build a **crafted copy** of the fixture
(temp dir), pack+install the toolkit, and assert the unmodified crafted fixture **builds
green**. This proves the harness is sound and not always-failing.

### T022 — Fail-closed arm
From the crafted copy, remove **one** file that is (a) genuinely imported by the fixture,
(b) actually present in the toolkit `files` allowlist, and (c) **statically imported**
(an `exports`-mapped `.ts`/`.astro`/`.css`) — e.g. a layout or a `routes` module the
pages import. Assert the build/orchestration **fails** with a message **naming that
specifier**. Do **NOT** pick `favicon.svg` — its warn-path does not fail the build
(that omission is covered by WP04's favicon-output check instead).

### T023 — Derivation + clean teardown
Derive the removed file programmatically from (real fixture imports ∩ the real packed
`files` list) so the test tracks reality — not a hand-invented path. Construct and tear
down the crafted fixture within the test (temp dirs), leaving **no** standing red gate
and not mutating the committed fixture.

## Definition of Done
- Both arms assert: positive control green; fail-closed arm red with an identifying message.
- The removed file is proven to be really-imported ∩ allowlisted ∩ statically-imported (not favicon).
- The test cleans up fully; running the suite twice is idempotent; no committed fixture mutated.

## Reviewer guidance
Confirm the test would go green even if the build were broken for an unrelated reason is
IMPOSSIBLE — i.e. the fail-closed assertion checks the specifier name, and the positive
control guards always-fail. Confirm no permanent red gate is introduced.

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP05 --agent claude`.
