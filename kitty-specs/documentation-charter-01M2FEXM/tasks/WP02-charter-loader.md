---
work_package_id: WP02
title: Charter loader — _meta/charter.yaml, per-axis precedence, back-compat, effective projection
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-004
- FR-008
- FR-009
- FR-010
- FR-015
- C-006
- NFR-002
planning_base_branch: feat/documentation-charter
merge_target_branch: feat/documentation-charter
branch_strategy: Planning artifacts for this mission were generated on feat/documentation-charter. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/documentation-charter unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-documentation-charter-01M2FEXM
base_commit: 07daef5fb8f250745581ba76dca9d3fd7b97270a
created_at: '2026-09-14T09:07:05.912000+00:00'
subtasks:
- T006
- T007
- T008
- T009
- T010
history: []
agent_profile: node-norris
authoritative_surface: src/lib/vocabulary-loader.mjs
create_intent:
- src/lib/effective-charter.mjs
- src/tests/charter-loader.test.ts
execution_mode: code_change
model: ''
owned_files:
- src/lib/vocabulary-loader.mjs
- src/lib/effective-charter.mjs
- src/tests/charter-loader.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP02 — Charter loader: precedence, back-compat, effective projection

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Add the thin fs layer that reads `<docsRoot>/_meta/charter.yaml`, resolves it through WP01's `parseCharter`, applies **per-axis precedence** over the legacy `_meta/vocabulary.yaml` / `_meta/sections.yaml`, emits a deprecation notice when legacy files are present, **fails closed** on a malformed charter, and projects the **effective (resolved) charter** for verification.

## Context

See `plan.md` IC-02/IC-04, `data-model.md` (resolution rules), and `contracts/charter-resolution-contract.md` (C1, C2, C6). The loader mirrors the existing `loadVocabulary`/`loadSectionRegistry` ergonomics (`VOCABULARY_REGISTRY_RELPATH`, `SECTIONS_REGISTRY_RELPATH`). The single hardest requirement is **NFR-002**: a legacy-only consumer (no `charter.yaml`) must behave *exactly* as today.

Design decisions: **D-01** file `_meta/charter.yaml`; **D-02** per-axis ownership (charter-declared axis fully owns; charter-silent axis falls back to legacy/default); deprecation notice when legacy present; fail-closed on malformed.

### Subtask T006: `loadCharter(docsRoot)`
**Purpose**: Read and parse `<docsRoot>/_meta/charter.yaml` via `parseCharter`.
**Steps**:
1. Add `CHARTER_REGISTRY_RELPATH = path.join('_meta', 'charter.yaml')`.
2. `loadCharter(docsRoot)`: if file absent → return `null` (signal "no charter"); if present → `parseCharter(readFileSync(...), 'charter.yaml')`.
**Files**: `src/lib/vocabulary-loader.mjs` (modify).
**Validation**: absent → null; present+valid → ResolvedCharter.

### Subtask T007: Per-axis precedence + deprecation notice
**Purpose**: Deterministic merge of charter over legacy (FR-009).
**Steps**:
1. Add a `resolveGovernance(docsRoot)` entry: for each axis (types, kinds, statuses, sections, required_fields) take it from the charter if the charter declares it, else from the legacy loader (`loadVocabulary`/`loadSectionRegistry`), else canonical default.
2. Never partial-merge the SAME axis across charter+legacy.
3. If any legacy file exists, emit exactly one deprecation notice (stderr/console) referencing the migration guide — idempotent per build.
**Files**: `src/lib/vocabulary-loader.mjs` (modify).
**Validation**: charter-owns-axis wins; charter-silent-axis falls back; legacy-only unchanged.

### Subtask T008: Fail-closed on malformed charter
**Purpose**: Never silently drop governance (FR-010, C6).
**Steps**:
1. Catch parse/validation errors from `loadCharter` and rethrow with a message naming the file and offending key.
2. Ensure malformed → non-zero for the gate (WP03 surfaces it), not a swallowed default.
**Files**: `src/lib/vocabulary-loader.mjs` (modify).
**Validation**: malformed YAML / illegal axis → clear error, build fails.

### Subtask T009: Effective-charter projection (FR-015)
**Purpose**: Let an adopter see the resolved governance in force.
**Steps**:
1. New `src/lib/effective-charter.mjs`: `computeEffectiveCharter(docsRoot)` returning a plain, serializable object (resolved types/kinds/statuses/sections/requiredFields + `sourceMeta.{fromCharter,legacyPresent}`).
2. Keep it a pure projection of resolved state (no config UI, no new heavy tooling); reuse `resolveGovernance`.
**Files**: `src/lib/effective-charter.mjs` (new).
**Validation**: projection matches the resolved inputs for charter-only, legacy-only, and mixed cases.

### Subtask T010: Loader tests
**Purpose**: Lock precedence + back-compat + fail-closed + projection.
**Steps**: New `src/tests/charter-loader.test.ts` with fixtures: charter-only; legacy-only (asserts identical to pre-charter behavior); both-present (per-axis precedence); malformed (throws); effective projection shape.
**Files**: `src/tests/charter-loader.test.ts` (new).
**Validation**: `pnpm vitest run src/tests/charter-loader.test.ts` green.

## Definition of Done
- `loadCharter` + `resolveGovernance` + deprecation notice + fail-closed implemented.
- `effective-charter.mjs` projects resolved governance.
- Legacy-only path proven byte-equivalent in behavior (NFR-002).
- Tests green; each subtask `mark-status ... --status done`.

## Risks
- **N=2 regression** — the highest risk. Add an explicit legacy-only fixture asserting unchanged resolution.
- **Deprecation-notice spam** — must be one notice per build, not per file/page.
- **Thin-loader purity** — all fs stays here; no logic that belongs in the pure core.

## Reviewer Guidance
Focus on: legacy-only non-regression; precedence is per-axis (no silent partial merge); malformed truly fails closed; effective projection is faithful and side-effect-free.

Implement with: `spec-kitty agent action implement WP02 --agent claude`
