---
work_package_id: WP05
title: living-documentation sync
dependencies:
- WP02
- WP03
requirement_refs:
- FR-009
- FR-010
planning_base_branch: feat/post-markua-hardening
merge_target_branch: feat/post-markua-hardening
branch_strategy: Planning artifacts for this mission were generated on feat/post-markua-hardening. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/post-markua-hardening unless the human explicitly redirects the landing branch.
subtasks:
- T021
- T022
- T023
- T024
- T025
history:
- created by /spec-kitty.tasks 2026-08-30
agent_profile: curator-carla
authoritative_surface: docs/
create_intent: []
execution_mode: code_change
model: claude-sonnet-4-6
owned_files:
- docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md
- docs/adr/0030-markua-preprocess-to-directive.md
- docs/architecture/glossary.md
- docs/architecture/markua.md
- docs/architecture/slide-decks.md
- docs/architecture/research/markua-syntax-support.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load curator-carla` (role: implementer/curator) before anything else. Respect Common Docs governance (DIRECTIVE_042): docs carry lifecycle frontmatter; single-source; delete-stale.

## Objective

Sync every architecture doc whose claim the WP02/WP03 fixes change, in the same mission (DIRECTIVE_037). Amend existing ADRs — do **not** create a new one (a new ADR is warranted only if (b) is ever pursued).

Read `../contracts/invariant-contracts.md` §CDOC and `../research.md` §D-03/disposition 9 first. Depends on WP02+WP03 being implemented (docs describe the shipped guards).

## Subtasks

### T021 [P] — Re-derive parity claim
- `docs/adr/0025-glossary-on-this-page-block-and-remark-render-channel.md`: its Decision-2 "links cannot drift" claim is now enforced — add an **Enforcement** note pointing at the new `glossary-substrate-parity` guard (WP03).
- `docs/architecture/glossary.md` (~:96–108): update the twin narrative in lockstep.

### T022 [P] — Deck-scope decision (a)
- `docs/architecture/markua.md` **Limits**: state that decks (`kind: Presentation`) are Markua-agnostic — all five passes no-op on decks via the shared guard.
- `docs/architecture/slide-decks.md`: add the corresponding note.

### T023 [P] — ADR-0030 amendment
- `docs/adr/0030-markua-preprocess-to-directive.md` **Consequences**: record decision (a) (decks Markua-agnostic, registration-site guard) and add a pointer to the **(b) follow-up issue** (decks-Markua-capable — the orchestrator files it at consolidation; leave a stable placeholder/link).

### T024 [P] — Research-note scope breadcrumb
- `docs/architecture/research/markua-syntax-support.md` (~:311): the present-tense "supports … presentations" claim is falsified by (a) — add a scope breadcrumb clarifying decks are currently Markua-agnostic and (b) is deferred.

### T025 — Validate
- `pnpm validate:docs` green for the touched docs (frontmatter/lifecycle).

## Branch Strategy

Planning base: `feat/post-markua-hardening`. Final merge target: `main`. Per-lane worktree from `lanes.json`. Depends on WP02+WP03.

## Definition of Done

- CDOC satisfied: all six docs reflect the shipped guards/decision; ADR-0030 references the (b) follow-up with a stable placeholder.
- **FR-010 scope note**: this WP writes the *reference* to the (b) follow-up. The actual `gh issue create` for (b) is an **orchestrator action at post-merge consolidation** (it references the merged state), which then backfills the ADR-0030 pointer. Do not treat "issue filed" as this WP's blocker.
- `pnpm validate:docs` green.

## Reviewer guidance

Verify: (1) no new ADR created; (2) the parity claim in ADR-0025 + glossary.md points at the guard; (3) markua.md/slide-decks.md state (a) accurately; (4) the research note no longer reads as present-tense deck-Markua support; (5) lifecycle frontmatter intact.
