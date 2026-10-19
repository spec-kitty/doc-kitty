---
work_package_id: WP04
title: Starlight overrides, config and CSS (#144)
dependencies:
- WP03
requirement_refs:
- FR-009
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: 87544862b23f7e86e07f2b2c32a16b81ee6f1c3c
created_at: '2026-10-18T19:59:40.128561+00:00'
subtasks:
- T014
- T015
- T016
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/components/
create_intent: []
execution_mode: code_change
owned_files:
- src/components/Head.astro
- src/components/Header.astro
- src/components/Footer.astro
- src/components/PageTitle.astro
- src/components/MarkdownContent.astro
- src/lib/route-middleware.ts
- src/lib/route-shaping.ts
- src/lib/theme.ts
- src/styles/**
- src/themes/**
role: implementer
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load frontend-freddy` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP04 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Adapt the five Starlight carriers, route middleware, Starlight config and CSS
to Starlight 0.41 (FR-009). Second commit on the line.

### T014 — Carriers

Head, Header, Footer, PageTitle, MarkdownContent: follow the 0.33–0.41
override API changes from the spike's audit (props, `Astro.locals.starlightRoute`,
slot names). Keep markup output equivalent unless the spike says Starlight's
own markup changed.

### T015 — Route middleware and config

`src/lib/route-middleware.ts`, `route-shaping.ts`: route-data API changes;
sidebar shaping; head merging. Starlight config keys renamed or removed.

### T016 — CSS cascade layers

Starlight's cascade layers change specificity. Put DocKitty theme CSS in the
right layer so overrides still win; verify visually in the example and with
the a11y suite (contrast).

## Tests

Header/sidebar/toc-rail vitest suites and the Playwright layout/visual specs.
Behaviour fixes red-first.

## Definition of Done

Commit titled for #144; carriers render; theme overrides still apply.
