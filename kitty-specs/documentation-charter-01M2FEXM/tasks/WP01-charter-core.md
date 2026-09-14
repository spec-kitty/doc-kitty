---
work_package_id: WP01
title: Charter core — statuses axis, required-field policy, parseCharter (fs-free)
dependencies: []
requirement_refs:
- FR-001
- FR-002
- FR-003
- FR-005
- FR-006
- C-004
- C-005
- NFR-004
- NFR-007
planning_base_branch: feat/documentation-charter
merge_target_branch: feat/documentation-charter
branch_strategy: Planning artifacts for this mission were generated on feat/documentation-charter. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/documentation-charter unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-documentation-charter-01M2FEXM
base_commit: ba017632d35f45d200672a7e77dfdbbf0698f6e9
created_at: '2026-09-14T08:52:05.728344+00:00'
subtasks:
- T001
- T002
- T003
- T004
- T005
history: []
agent_profile: node-norris
authoritative_surface: src/lib/vocabulary-core.mjs
create_intent: []
execution_mode: code_change
model: ''
owned_files:
- src/lib/vocabulary-core.mjs
- src/tests/vocabulary-core.test.ts
role: implementer
tags: []
tracker_refs: []
---

# WP01 — Charter core: statuses axis, required-field policy, parseCharter (fs-free)

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `node-norris`
- **Role**: `implementer`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Extend the fs-free pure core (`src/lib/vocabulary-core.mjs`) with two new governable axes — an **extend-only `statuses` axis** and a **required-field policy** — and unify all axes into a single `parseCharter(raw)` resolver, without breaking the module's PURITY CONTRACT (fs-free, Astro-free, JSDoc-const, no `.d.ts`).

## Context

This WP is the foundation of the Documentation Charter (see `plan.md` IC-01, `data-model.md`, and `contracts/charter-resolution-contract.md`). Today `parseVocabulary` resolves only `types`/`kinds`; `STATUSES` is a fixed `z.enum` with no override, and the required-field set is hardcoded downstream. WP02 (loader) and WP03 (enforcement/Astro twin) both build on the resolver shape defined here, so the returned contract must be stable and complete.

Key design decisions (from `research.md`):
- **D-03** statuses are extend-only; canonical `STATUSES` reserved and non-removable.
- **D-04** required fields configurable via a relaxation list; `title` is a hard floor.
- Reuse `parseVocabularyAxis` / `makeAxisResolver`; do NOT duplicate axis machinery.

### Subtask T001: Add extend-only `statuses` axis
**Purpose**: Let a consumer add lifecycle statuses while canonical values stay reserved.
**Steps**:
1. Add a `resolveStatus` axis built from `parseVocabularyAxis(data?.statuses?.add, 'statuses', source)` semantics, but constrained to **additive**: reject any `forbidden`/`aliases` that would remove/mask a canonical `STATUSES` value.
2. Expose `legalStatuses = [...STATUSES, ...added]` (dedup, deterministic order — canonical first, added appended, stable sort of added).
3. `resolveStatus(term)` → `legal | UNKNOWN` (UNKNOWN is a warn signal downstream, mirroring kinds).
**Files**: `src/lib/vocabulary-core.mjs` (modify).
**Validation**: adding `deprecated` makes it legal; canonical set always present.

### Subtask T002: Required-field policy (title floor)
**Purpose**: Configurable required frontmatter set with `title` never removable.
**Steps**:
1. Parse `data?.required_fields?.optional` (array of field names).
2. Compute `requiredFields = { required: CANONICAL_REQUIRED \ optional, floor: ['title'] }`; never remove `title` even if listed.
3. If `optional` includes `title`, throw a clear reserved-floor error (see T004).
**Files**: `src/lib/vocabulary-core.mjs` (modify).
**Validation**: relaxing `updated` drops it from required; relaxing `title` throws.

### Subtask T003: Unify into `parseCharter(raw)`
**Purpose**: One resolver returning the full `ResolvedCharter` shape (`data-model.md`).
**Steps**:
1. Add `export function parseCharter(raw, source = 'charter.yaml')` returning `{ resolveType, resolveKind, resolveStatus, legalStatuses, sections, requiredFields, sourceMeta }`.
2. `sections` here is the parsed section registry shape if present in the charter, else `null` (loader supplies legacy fallback in WP02).
3. Keep `parseVocabulary`/`identityVocabulary` working (back-compat) — `parseCharter` may delegate to them for the `types`/`kinds` axes.
**Files**: `src/lib/vocabulary-core.mjs` (modify).
**Validation**: `parseCharter('')` ≡ identity (defaults, empty file ok).

### Subtask T004: Reserved / floor guards (fail-closed)
**Purpose**: Deterministic, clearly-messaged rejection of illegal charters.
**Steps**:
1. Reserved-status guard: removing/forbidding/aliasing-away a canonical status → throw `charter.yaml: status "<x>" is reserved and cannot be removed`.
2. Floor guard: `title` in `required_fields.optional` → throw floor message.
3. Preserve existing axis guards (alias target not forbidden, term not both aliased & forbidden).
4. Unknown TOP-LEVEL keys → do not throw (forward-compat; a warn belongs to the loader/validator layer).
**Files**: `src/lib/vocabulary-core.mjs` (modify).
**Validation**: each illegal case throws with the documented message; unknown top-level key does not throw.

### Subtask T005: Unit tests
**Purpose**: Lock the resolver contract.
**Steps**: In `src/tests/vocabulary-core.test.ts` add cases: extend-only add legal; reserved-status removal rejected; title-floor rejected; identity on empty; `legalStatuses` deterministic; `requiredFields` computed. Keep existing tests green.
**Files**: `src/tests/vocabulary-core.test.ts` (modify).
**Validation**: `pnpm vitest run src/tests/vocabulary-core.test.ts` green.

## Definition of Done
- `parseCharter` exported and returns the full `ResolvedCharter` shape; `parseVocabulary`/`identityVocabulary` still exported and green.
- Extend-only statuses + required-field policy + reserved/floor guards implemented and unit-tested.
- PURITY CONTRACT intact: no fs/Astro imports, JSDoc-const literals, no `.d.ts`.
- Each subtask recorded via `spec-kitty agent tasks mark-status <Txxx> --status done`.

## Risks
- **Purity regression** — accidentally importing `node:fs`/Astro. Mitigation: keep all fs in WP02.
- **Type inference** — `legalStatuses` must stay a literal-friendly shape so WP03's `z.enum` twin works; keep JSDoc-const discipline.

## Reviewer Guidance
Focus on: extend-only invariant truly cannot remove a canonical status; `title` floor cannot be relaxed; determinism of `legalStatuses`; no purity break; back-compat of `parseVocabulary`.

Implement with: `spec-kitty agent action implement WP01 --agent claude`
