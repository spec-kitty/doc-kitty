---
work_package_id: WP03
title: Enforcement wiring + Astro parity twin + SECTION_ORDER reconciliation
dependencies:
- WP01
- WP02
requirement_refs:
- FR-005
- FR-006
- FR-007
- NFR-003
- NFR-004
- NFR-005
- NFR-006
planning_base_branch: feat/documentation-charter
merge_target_branch: feat/documentation-charter
branch_strategy: Planning artifacts for this mission were generated on feat/documentation-charter. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/documentation-charter unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-documentation-charter-01M2FEXM
base_commit: 2d0568ea970e4d35824e52cf2c45fcf963eeee4f
created_at: '2026-09-14T09:26:15.541441+00:00'
subtasks:
- T011
- T012
- T013
- T014
- T015
- T016
- T017
history: []
agent_profile: implementer-ivan
authoritative_surface: src/
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- src/scripts/validate-frontmatter.mjs
- src/lib/sections.ts
- src/lib/schema.ts
- src/lib/metadata.ts
- src/tests/vocabulary-resolver.test.ts
- src/tests/vocabulary-single-source.test.ts
- src/tests/section-type-parity.test.ts
- src/tests/schema-validator-parity.test.ts
- src/tests/metadata.test.ts
- src/tests/metadata-sections.test.ts
- src/tests/sections.test.ts
- src/tests/section-rename.test.ts
- src/tests/llms-section-order.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP03 — Enforcement wiring + Astro parity twin + SECTION_ORDER reconciliation

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `implementer-ivan`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Make the resolved charter actually govern: wire the bare-Node gate (`validate-frontmatter.mjs`) and the Astro-side twin (`sections.ts`, `schema.ts`, `metadata.ts`) to consume charter-resolved statuses and required-field policy, reconcile the frozen `SECTION_ORDER` fallback to fallback-only, and keep the resolved-vocabulary **parity guards** green.

## Context

See `plan.md` IC-03 and `contracts/charter-resolution-contract.md` (C4, C5, C7, C8). WP01 defines the resolver; WP02 supplies `resolveGovernance(docsRoot)`. This WP consumes them on BOTH twins — the Astro-side (`.ts`) and bare-Node (`.mjs`) — so the parity guard (`vocabulary-single-source.test.ts`, `section-type-parity.test.ts`, `schema-validator-parity.test.ts`) stays green. Warn-not-fail posture is retained (spec C-001): unknown-but-legal statuses warn, forbidden types fail, required-floor missing fails.

### Subtask T011: Gate consumes resolved statuses + required policy
**Purpose**: `validate-frontmatter.mjs` validates against `legalStatuses` and the required-field policy.
**Steps**:
1. Replace the fixed `z.enum(STATUSES)` path with validation against `resolveGovernance(docsRoot).legalStatuses` (canonical ∪ added); unknown-and-not-added → warn.
2. Make required-field requiredness consult `requiredFields` (title floor always enforced).
3. Surface a malformed-charter error (from WP02) as a hard gate failure.
**Files**: `src/scripts/validate-frontmatter.mjs`.
**Validation**: added status passes; relaxed field passes; missing `title` fails; malformed charter fails.

### Subtask T012: Astro schema twin (`schema.ts`)
**Purpose**: Keep the site-side status enum charter-aware.
**Steps**: Make the Astro content schema's status validation consult the same resolved `legalStatuses` (or accept canonical ∪ added) so the build side matches the gate. Preserve existing `DOC_TYPES`/`KINDS` behavior.
**Files**: `src/lib/schema.ts`.
**Validation**: `schema-validator-parity.test.ts` green.

### Subtask T013: `sections.ts` mirror
**Purpose**: Astro-side section/registry resolution mirrors the charter.
**Steps**: Ensure `sections.ts` resolves sections through the charter-aware path (charter → legacy registry → default), matching the bare-Node resolution.
**Files**: `src/lib/sections.ts`.
**Validation**: `section-type-parity.test.ts`, `sections.test.ts` green.

### Subtask T014: SECTION_ORDER reconciliation (`metadata.ts`)
**Purpose**: One source of truth for order; frozen list is fallback-only (FR-007).
**Steps**: Make the frozen `SECTION_ORDER` the last-resort fallback used only when no charter/registry order is present; charter/registry order wins otherwise.
**Files**: `src/lib/metadata.ts`.
**Validation**: registry order wins when present; bare consumer still gets canonical order; `metadata.test.ts`, `metadata-sections.test.ts`, `llms-section-order.test.ts` green.

### Subtask T015: Parity guards
**Purpose**: Astro-side == bare-Node for the new axes.
**Steps**: Extend `vocabulary-single-source.test.ts` and `section-type-parity.test.ts` to cover statuses + required-field resolution across both twins.
**Files**: those two test files.
**Validation**: parity tests green.

### Subtask T016: Update affected tests
**Purpose**: Keep the suite honest.
**Steps**: Update `vocabulary-resolver.test.ts`, `section-rename.test.ts` and any assertions changed by charter-aware resolution.
**Files**: those test files.
**Validation**: `pnpm vitest run` green for the touched files.

### Subtask T017: Full gate green (verification)
**Purpose**: Prove no regression (NFR-005).
**Steps**: Run `validate:docs`, `validate:example`, `validate:catalog`, `validate:links`, `validate:adr-index`, the vitest suite, and (if runnable) `test:a11y`; fix fallout within owned files. If the local environment cannot run a gate (see repo hazard notes on node_modules), record which gate CI must be the verifier for.
**Files**: n/a (verification).
**Validation**: gates green locally or explicitly deferred-to-CI with rationale.

## Definition of Done
- Gate + Astro twin consume charter-resolved statuses & required-field policy; SECTION_ORDER is fallback-only.
- All parity guards green; OKF invariant preserved (non-empty resolved `type`).
- Warn-not-fail posture retained; malformed charter fails the gate.
- Each subtask `mark-status ... --status done`.

## Risks
- **Twin drift** — the #1 risk: a new axis added to one side only breaks parity. Change both `.ts` and `.mjs` together.
- **OKF** — never emit an empty resolved `type`.
- **Local gate breakage** — if root `node_modules` is unusable, treat CI as verifier and say so (do not fake green).

## Reviewer Guidance
Focus on: parity (both twins changed together), warn-vs-fail routing unchanged except the intended knobs, SECTION_ORDER truly fallback-only, no OKF regression, no scope-creep into a strictness engine.

Implement with: `spec-kitty agent action implement WP03 --agent claude`
