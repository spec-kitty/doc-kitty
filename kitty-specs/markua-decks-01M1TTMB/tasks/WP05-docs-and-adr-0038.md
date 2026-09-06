---
work_package_id: WP05
title: Docs of record & ADR-0038 — decks are Markua-capable (#47)
dependencies:
- WP04
requirement_refs:
- FR-010
planning_base_branch: feat/markua-decks
merge_target_branch: feat/markua-decks
branch_strategy: Planning artifacts for this mission were generated on feat/markua-decks. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/markua-decks unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
history:
- created by /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/
create_intent:
- docs/adr/0038-decks-markua-capable.md
- docs/changelog/2026-09-06-markua-decks.md
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- docs/architecture/markua.md
- docs/architecture/slide-decks.md
- docs/adr/0038-decks-markua-capable.md
- docs/changelog/2026-09-06-markua-decks.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load curator-carla` (role: implementer), or `spec-kitty agent profile show curator-carla` + `spec-kitty charter context --action implement --json`; apply and state what you applied. Discipline: DIRECTIVE_003 (decision documentation), DIRECTIVE_018 (doctrine versioning — supersede, don't silently contradict), writing-preferences (audience-oriented; avoid AI-writing pitfalls).

## Objective

Record decks as Markua-capable and supersede ADR-0030's option-(a) amendment. **Depends on WP04** (docs describe shipped, gated behaviour). Read `../spec.md` (FR-010, SC-005), `../plan.md` (IC-07), `../research.md` (all decisions), and the shipped code from WP01-WP04.

## Critical context (verify current content before editing)

- `docs/adr/0030-markua-preprocess-to-directive.md` — its "Amendment (2026-08-30, post-markua-hardening): deck scope resolved as (a) Markua-agnostic" is what this mission reverses. Do NOT delete it; ADR-0038 **supersedes** it and cross-references it.
- `docs/architecture/markua.md` (~`:197-205`) — the "Presentation pages (`kind: Presentation`) — decks are Markua-agnostic" bullet. Rewrite to describe deck-capability.
- `docs/architecture/slide-decks.md` (~`:53-60`) — the "Decks are currently Markua-agnostic" section. Rewrite.
- Latest ADR is `0037` — the new one is `docs/adr/0038-decks-markua-capable.md`. ADR index generation (ADR-0032, `docs/adr/README.md`) may regenerate from metadata — check whether it is generated (do not hand-maintain a generated index; run the generator/build if one exists).
- `validate:docs` enforces a changelog `description` ≤ 180 chars — keep the new changelog entry's description within that.

## Subtasks

### T017 — ADR-0038
**Steps**: Author `docs/adr/0038-decks-markua-capable.md` in the repo's ADR format. Status: Accepted, and explicitly **supersedes the ADR-0030 amendment (2026-08-30)**. Capture: the decision (decks Markua-capable, option b); the ordering choice (Markua before `deckSplit`, why not after — D1/D3); the forced `dk-callout` path on decks (D5); the hero-exclusion tag (D4); `markuaTocDemote` stays guarded (D6); consequences and the wrapper-cannot-cross-a-boundary constraint. Reference `#47`, PR #46/ADR-0030, and the mission contracts.
**Files**: `docs/adr/0038-decks-markua-capable.md`.

### T018 — `markua.md`
**Steps**: Replace the deck-agnostic bullet with the deck-capable description: the four content passes act on slides, `markuaTocDemote` stays guarded, callouts render as `dk-callout`, figures wrap body images but not the hero, wrappers cannot span a slide boundary. Link ADR-0038.
**Files**: `docs/architecture/markua.md`.

### T019 — `slide-decks.md`
**Steps**: Replace the "Decks are currently Markua-agnostic" section with a "Markua on slides" section describing what an author can write and the one constraint (no wrapper across a boundary). Link `markua.md` and ADR-0038. Update the cross-reference frontmatter if it lists ADR-0030 as the deck-Markua authority.
**Files**: `docs/architecture/slide-decks.md`.

### T020 — Changelog + ADR index
**Steps**: Add `docs/changelog/2026-09-06-markua-decks.md` (repo changelog format; `description` ≤ 180 chars) summarising the feature and closing #47. If the ADR index (`docs/adr/README.md`) is generated, run the generator/build so 0038 is registered; if hand-maintained, add the row.
**Files**: `docs/changelog/2026-09-06-markua-decks.md` (+ generated `docs/adr/README.md` only if a generator owns it — do not hand-edit a generated file; if `README.md` is generated it is out of `owned_files`, run the generator and note it).
**Validation**: `pnpm validate:docs` green.

## Branch Strategy

Planning/base branch: `feat/markua-decks`. Final merge target: `feat/markua-decks` (then a manual PR → `main`). Execution worktrees are allocated per computed lane from `lanes.json`; if no lane worktree is allocated, work directly on `feat/markua-decks`.

## Definition of Done

- ADR-0038 authored and supersedes the ADR-0030 amendment; `markua.md` + `slide-decks.md` no longer describe decks as Markua-agnostic (SC-005).
- Changelog entry present (≤180-char description); `pnpm validate:docs` green.
- Docs match shipped behaviour (WP01-WP04).

## Risks & reviewer guidance

- **Supersede, don't contradict**: reviewer confirms ADR-0030's amendment is left intact and ADR-0038 references it (DIRECTIVE_018).
- **Generated index**: don't hand-maintain a generated ADR index (per repo doctrine — generate section indexes from metadata). Confirm whether `docs/adr/README.md` is generated before editing.
- **Fidelity**: docs describe the SHIPPED constraint set (wrapper boundary, hero exclusion, forced callouts), not aspirational behaviour.
- Depends on WP04.
