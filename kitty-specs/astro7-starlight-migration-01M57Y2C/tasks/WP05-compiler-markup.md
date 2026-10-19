---
work_package_id: WP05
title: Compiler-strictness markup fixes, build green (#145)
dependencies:
- WP04
requirement_refs:
- FR-009
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: 1064a75d463691838e4cf2683c43b825727c75b8
created_at: '2026-10-18T20:56:32.359310+00:00'
subtasks:
- T017
- T018
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/layouts/
create_intent: []
execution_mode: code_change
owned_files:
- src/layouts/**
- src/components/slots/**
- src/lib/deck/**
- src/lib/toc-rail/**
- src/lib/lightbox/**
role: implementer
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load frontend-freddy` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP05 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Fix markup the Rust compiler rejects, so the example and the consumer fixture
build green with all artifact gates (FR-009). Third commit on the line.

### T017 — Markup fixes

For each compiler error in the spike note: fix the markup at its source
(unclosed or misnested elements, invalid attribute syntax, stray expressions).
Never silence the compiler. If a fix lands outside this WP's owned files,
record a one-line rationale.

### T018 — Green

`pnpm clean && pnpm build`, the consumer fixture, `pnpm assert:artifacts`,
`assert-chrome-artifacts.mjs`, `assert:no-broken-links`, `assert:markua`,
vitest. All green except baselines owned by WP06 (list them).

## Definition of Done

Commit titled for #145; builds green; remaining red is only WP06 baselines.
