---
work_package_id: WP03
title: Governance ADRs & living docs
dependencies:
- WP01
- WP02
requirement_refs:
- FR-012
planning_base_branch: feat/adopter-loader-migration
merge_target_branch: feat/adopter-loader-migration
branch_strategy: Planning artifacts for this mission were generated on feat/adopter-loader-migration. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/adopter-loader-migration unless the human explicitly redirects the landing branch.
subtasks:
- T014
- T015
- T016
- T017
- T018
history:
- '2026-09-03: authored by /spec-kitty.tasks'
agent_profile: curator-carla
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0033-flexible-section-identity.md
- docs/adr/0034-redirect-coverage-gate.md
- docs/changelog/2026-09-03-adopter-loader-migration.md
execution_mode: code_change
model: claude-sonnet-5
owned_files:
- docs/adr/**
- docs/context/convention.md
- docs/guides/authoring.md
- docs/changelog/**
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

- Run `/ad-hoc-profile-load curator-carla` (role: implementer); adopt its identity and boundaries.
- Load doctrine: `spec-kitty charter context --action implement --json`.
- Then read this prompt.

## Objective

Record the governance shift this mission makes, and keep living docs true:

1. A **flexible-section-identity ADR** that **supersedes ADR-0002 in part** (README no longer the sole index basename) and **explicitly reverses ADR-0004's "adaptation is tolerated, not supported"** for `index.md` and section rename (now first-class supported).
2. A **greenfield redirect-coverage ADR** defining the primitive (baseline + emission + bare-Node target-aware gate).
3. Regenerate the ADR index; update `convention.md` and `authoring.md`; add the changelog entry.

## Context

- Spec C-007; charter §89-93 (ADRs immutable — new records, not edits). Depends on WP01/WP02 (the design is settled).
- ADR mechanics: read an existing ADR (e.g. `docs/adr/0031-vocabulary-override.md`) for the house format (frontmatter, `## Status`, `## Context`, `## Decision`, `## Consequences`). ADR numbers: use the next free numbers (verify `docs/adr/` — 0033/0034 suggested).
- The index is generated: `node src/scripts/generate-adr-index.mjs --write` rebuilds `docs/adr/README.md`; `--check` is the CI gate. **Do not hand-edit `docs/adr/README.md`.**

### Subtask T014 — Flexible-section-identity ADR

- Author `docs/adr/0033-flexible-section-identity.md` (verify the number). It must, in words: supersede ADR-0002 in part (basename configurable), and **reverse ADR-0004's tolerated-not-supported stance** for `index.md`/section-rename. Reference ADR-0002, ADR-0004, ADR-0029. Mark ADR-0002 as "Superseded in part" if the house style supports it.

### Subtask T015 — Redirect-coverage ADR

- Author `docs/adr/0034-redirect-coverage-gate.md` (verify the number): the redirect-map source of truth, the committed URL baseline, and the bare-Node target-aware coverage gate contract. Greenfield (no prior ADR).

### Subtask T016 — Regenerate ADR index

- Run `node src/scripts/generate-adr-index.mjs --write`; confirm `--check` is clean. Ensure the two new ADRs appear, number-ordered with Status/Date.

### Subtask T017 — Living docs

- Update `docs/context/convention.md` and `docs/guides/authoring.md` to document the `indexBasename` option, the registry `subtypes` field, and the redirect-coverage workflow. Keep sentence-case headings and audience-oriented prose (charter doc policy).

### Subtask T018 — Changelog

- Add `docs/changelog/2026-09-03-adopter-loader-migration.md` (match the existing entries' style): a bold impact-first lead per capability with `(#37)`/`(#48)`/`(#42)` refs, then before→after in plain language.

## Branch Strategy

- Base/merge target: `feat/adopter-loader-migration`. Enter the lane workspace from `lanes.json`; `spec-kitty agent action implement WP03 --agent <name>`.

## Definition of Done

- Two new ADRs authored; ADR index regenerated and `--check`-clean.
- `convention.md`/`authoring.md` updated; changelog entry added.
- doc-sanity green: markdownlint (budget for whole edited files), link/`related` integrity, terminology guard, Vale.

## Reviewer Guidance (opus)

- Confirm the ADR **states the ADR-0004 reversal in words** (paula's M4) — not a silent posture flip.
- Confirm `generate-adr-index.mjs --check` is clean (a stale README reds CI).
- Confirm the changelog leads with user impact, not internals, and names the symptom (index renames / dead URLs) each capability removes.

## Activity Log

- 2026-09-03T18:23:52Z – claude – shell_pid=79429 – WP03 implementation DONE and committed (7944c1c, docs/** only, kitty-specs/ untouched by this WP). T014-T018 all marked done. ADR-0033 (flexible section identity: indexBasename + registry subtypes; supersedes ADR-0002 in part; explicitly reverses ADR-0004's tolerated-not-supported stance in words) and ADR-0034 (greenfield redirect-coverage gate) authored; generate-adr-index.mjs --write then --check clean (isolated gray-matter install, cleaned up after -- repo node_modules is broken/absent per documented hazard); markdownlint-cli2 0 issues on all 7 edited/created docs files (isolated install, cleaned up after). convention.md + authoring.md updated; changelog added. BLOCKED on move-task --to for_review: the lane branch carries pre-existing kitty-specs/ commits (acceptance-matrix.json, issue-matrix.json, status.events.jsonl, status.json, tasks/WP01.../review-cycle-1.md) not made by this WP -- lane-hygiene guard refuses the transition. Per lane-hygiene doctrine I am NOT touching kitty-specs/ to fix this; coordination/orchestrator needs to clean the lane branch (git restore --source feat/adopter-loader-migration --staged --worktree -- kitty-specs/) before WP03 can move to for_review.
