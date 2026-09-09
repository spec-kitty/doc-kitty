---
work_package_id: WP05
title: Chrome-behavior docs
dependencies:
- WP03
requirement_refs:
- FR-008
planning_base_branch: feat/collapsible-toc-rail
merge_target_branch: feat/collapsible-toc-rail
branch_strategy: Planning artifacts for this mission were generated on feat/collapsible-toc-rail. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/collapsible-toc-rail unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent:
- docs/architecture/collapsible-toc-rail.md
execution_mode: code_change
owned_files:
- docs/architecture/collapsible-toc-rail.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load scribe-sally` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_010 (spec fidelity), the docs convention (`docs/context/convention.md`), curated-not-wiki integrity.

## Objective

Briefly document the collapsible-rail chrome behavior in the toolkit architecture notes — behavior
only, no convention change (FR-008), plus the Starlight-internals upgrade tripwire.

Read first: `../plan.md` (IC-06), `../research.md` (D1 four-carrier-lock rationale), `../spec.md`, `docs/context/convention.md` (frontmatter convention). The implemented feature (WP01-WP03) is present.

## Subtasks

### T017 — `docs/architecture/collapsible-toc-rail.md`
A short note (type: Architecture, kind: Explanation, convention frontmatter incl. authors: stijn@sddevelopment.be): what the collapsible desktop TOC rail does (collapse/restore, recenter, persistence, desktop-only, mobile/left-nav untouched); WHY it is a client-augmentation island + pre-paint head script + token CSS rather than a PageSidebar override (the four-carrier lock, ADR-0013/0015); and an "Upgrade tripwire" subsection enumerating the depended-on Starlight internals (`.right-sidebar-container`, `.right-sidebar`, `.right-sidebar-panel`, `.main-pane`, the `[data-has-sidebar][data-has-toc] .main-pane` right-bias rule, the 72rem breakpoint) pinned to `@astrojs/starlight@0.32.6`, noting the Playwright gate is the tripwire on a Starlight bump.

### T018 — Convention validation
Run `pnpm validate` (or the frontmatter validator) against the docs root; the new note validates (warnings tolerated, no errors). Confirm links resolve.

## Definition of Done
- The note exists, is behavior-only (no convention/frontmatter/sections.yaml change), documents the lock rationale + the pinned Starlight selectors, and validates under the convention.

## Reviewer guidance
Confirm it does not introduce a convention change and that the Starlight-internals list matches what the code actually depends on (WP02 CSS).

## Branch Strategy
Planning + merge target: `feat/collapsible-toc-rail`. Depends on WP03. Worktrees per lanes.json. Implement with `spec-kitty agent action implement WP05 --agent claude`.
