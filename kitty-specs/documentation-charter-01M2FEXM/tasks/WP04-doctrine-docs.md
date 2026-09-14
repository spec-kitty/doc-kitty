---
work_package_id: WP04
title: Doctrine ADR, convention recast, consumer charter reference + migration guide
dependencies:
- WP02
requirement_refs:
- FR-011
- FR-012
- FR-013
- FR-014
- C-003
planning_base_branch: feat/documentation-charter
merge_target_branch: feat/documentation-charter
branch_strategy: Planning artifacts for this mission were generated on feat/documentation-charter. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/documentation-charter unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-documentation-charter-01M2FEXM
base_commit: 483ace8758529a1b11565d239667cf9e8ab01773
created_at: '2026-09-14T09:27:15.444430+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
history: []
agent_profile: curator-carla
authoritative_surface: docs/
create_intent:
- docs/adr/0042-native-documentation-charter.md
- docs/guides/migrating-to-charter.md
execution_mode: code_change
model: ''
owned_files:
- docs/adr/0042-native-documentation-charter.md
- docs/adr/README.md
- docs/context/convention.md
- docs/guides/consumer-setup.md
- docs/guides/migrating-to-charter.md
role: curator
tags: []
tracker_refs: []
---

# WP04 — Doctrine ADR, convention recast, adopter docs

## ⚡ Do This First: Load Agent Profile

Use the `/ad-hoc-profile-load` skill to load the agent profile specified in the frontmatter, and behave according to its guidance before parsing the rest of this prompt.

- **Profile**: `curator-carla`
- **Role**: `curator`
- **Agent/tool**: `claude`

If no profile is specified, run `spec-kitty agent profile list` and select the best match for this work package's `task_type` and `authoritative_surface`.

---

## Objective

Record the native-not-Spec-Kitty-engine decision as a new ADR, recast `docs/context/convention.md` as the charter's narrative companion (retiring the "will later be recast" promise), and give adopters a consumer-facing charter reference plus a behavior-preserving migration guide.

## Context

See `plan.md` IC-05, `research.md` D-06 (the fork), and `contracts/charter-resolution-contract.md`. This is documentation work whose claims must match the shipped behavior from WP01–WP03 — hence the `WP02` dependency and the guidance to finalize wording once resolver behavior is settled. Follow doc-kitty's own conventions: curated-not-wiki, one concern per file, honest status. Respect the writing doctrine (audience-oriented; avoid AI-writing tells).

### Subtask T018: New ADR — native documentation charter
**Purpose**: Durable rationale for the self-contained stance (FR-012, C-003).
**Steps**:
1. Create `docs/adr/0042-native-documentation-charter.md` (Accepted). State: doc-kitty's documentation charter is resolved by its own pure-core/fs-loader/gate triad with ZERO Spec Kitty runtime dependency; borrow the shape, not the engine; relate to (do not edit) ADR-0004; note the `_meta/charter.yaml` surface and the extend-only/floor invariants.
2. Full frontmatter per the metadata contract (title/description/doc_status/updated/type/kind/authors/related).
**Files**: new ADR.
**Validation**: `validate:docs` frontmatter passes; `validate:adr-index` sees the new ADR.

### Subtask T019: Recast `convention.md`
**Purpose**: Doc honesty (FR-013).
**Steps**: Remove the "will later be recast as a Spec Kitty charter/doctrine" hedge in the intro; state the convention IS the default doctrine pack, resolved natively; mark each governable dimension **fixed-doctrine** vs **consumer-overridable** and point to `_meta/charter.yaml`.
**Files**: `docs/context/convention.md`.
**Validation**: no recast promise remains; each dimension labeled; links resolve (`validate:links`).

### Subtask T020: Consumer charter reference
**Purpose**: Discoverability (FR-014).
**Steps**: Add a governance chapter to `docs/guides/consumer-setup.md` enumerating the charter dimensions (vocabulary, sections/IA, statuses extend-only, required-field floor), each with a minimal example and a link to the authoritative file.
**Files**: `docs/guides/consumer-setup.md`.
**Validation**: examples match `quickstart.md`; links resolve.

### Subtask T021: Migration guide
**Purpose**: Behavior-preserving legacy→charter path (FR-011).
**Steps**: Create `docs/guides/migrating-to-charter.md` from `quickstart.md` §3 — map `_meta/vocabulary.yaml` + `_meta/sections.yaml` into `_meta/charter.yaml`, note per-axis precedence and the deprecation notice, and the "delete legacy once green" step.
**Files**: new guide.
**Validation**: steps produce identical governance behavior; frontmatter valid.

### Subtask T022: ADR index + docs gates
**Purpose**: Keep generated indexes and gates green.
**Steps**: Regenerate/refresh `docs/adr/README.md` if it is the generated ADR index (per the generated-indexes doctrine — generate, don't hand-maintain); run `validate:adr-index` and `validate:docs`.
**Files**: `docs/adr/README.md`.
**Validation**: `validate:adr-index`, `validate:docs`, `validate:links` green.

## Definition of Done
- ADR-0042 created (Accepted), relating to ADR-0004 without editing it.
- `convention.md` recast; recast promise gone; dimensions labeled fixed vs overridable.
- Consumer charter reference + migration guide written and accurate to shipped behavior.
- ADR index + docs/links gates green; each subtask `mark-status ... --status done`.

## Risks
- **Doc drift** — claims must match WP01–WP03 behavior; finalize after those land.
- **ADR discipline** — don't edit Accepted ADR-0004 in place; number 0042 correctly.
- **Generated index** — regenerate, never hand-maintain the ADR index.

## Reviewer Guidance
Focus on: no residual recast promise; ADR relates-not-edits ADR-0004; every doc claim is true of the shipped charter; examples runnable; links resolve.

Implement with: `spec-kitty agent action implement WP04 --agent claude`
