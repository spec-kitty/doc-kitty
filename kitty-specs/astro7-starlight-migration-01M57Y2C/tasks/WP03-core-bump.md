---
work_package_id: WP03
title: Core bump and unified() wiring (#119)
dependencies:
- WP02
requirement_refs:
- FR-009
- FR-010
- NFR-003
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: 59ae0a0a3680c713036261ab1dc02c42968a306f
created_at: '2026-10-18T19:02:54.897813+00:00'
subtasks:
- T010
- T011
- T012
- T013
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: frontend-freddy
authoritative_surface: src/lib/
create_intent: []
execution_mode: code_change
owned_files:
- src/package.json
- example/package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- src/lib/config.ts
- src/lib/integrations/**
- src/lib/schema.ts
- src/lib/docs-index.ts
- src/lib/sitemap-order.ts
- src/lib/favicon.ts
- src/lib/manifest.ts
- src/index.ts
- example/astro.config.mjs
- tests/consumption/consumer-fixture/package.json
- tests/consumption/consumer-fixture/astro.config.mjs
- tests/consumption/consumer-fixture/pnpm-lock.yaml
role: implementer
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load frontend-freddy` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP03 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Land the dependency bump and the `unified()` wiring as the first commit of the
#119/#144/#145 line (FR-009, FR-010). The build may still be red after this WP
for reasons owned by WP04/WP05; record which.

### T010 — Versions and peer ranges

Exact versions from the spike's supply-chain table. `src/package.json`: peer
`astro >=7.0.2 <8`, `@astrojs/starlight >=0.41.0 <0.42.0` (or the range the
spike justifies), add `@astrojs/markdown-remark` as a peer and devDependency.
`example/package.json` and the consumer fixture likewise. Regenerate
`pnpm-lock.yaml` with `pnpm install`; CI uses `--frozen-lockfile`.

### T011 — `unified()` wiring

Set `markdown: { processor: unified() }` in the config the toolkit produces.
Keep plugin registration via `updateConfig` in
`src/lib/integrations/markdown-pipeline.ts` unless the spike showed it fails
(then follow ADR-0060's evidence). Keep plugin order identical; the existing
order comments in `config.ts` explain why.

### T012 — Content loader / Zod

Apply the spike's loader findings (`docKittyDocsLoader`, `src/lib/schema.ts`,
Zod major). Red-first: the existing loader tests must fail on the bump before
the fix, then pass.

### T013 — Build hooks

Sitemap-order, favicon, manifest per spike findings. #188: adapt the
root-canonical rewrite to Starlight 0.41's head merge; keep or strengthen the
existing #188 test (FR-010).

## Tests

Run the vitest files that cover each touched module plus the example build.
Record commands and counts.

## Definition of Done

One reviewable commit (or a small series) titled for #119; plugin order
unchanged; loader and hook tests green.
