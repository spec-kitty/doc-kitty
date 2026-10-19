---
work_package_id: WP08
title: 0.4.0 release prep (#147)
dependencies:
- WP06
- WP07
requirement_refs:
- FR-014
- SC-003
- NFR-004
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-astro7-starlight-migration-01M57Y2C
base_commit: 63bf1a2e3e4e7e69b92532826545d535a97cb702
created_at: '2026-10-18T22:49:04.415570+00:00'
subtasks:
- T027
- T028
- T029
- T030
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/migrations/
create_intent:
- src/tests/compatibility-matrix.test.ts
- docs/migrations/README.md
- docs/migrations/0.3-to-0.4.md
execution_mode: code_change
owned_files:
- CHANGELOG.md
- docs/migrations/**
- docs/changelog/2026-10-*-astro7*.md
- src/tests/compatibility-matrix.test.ts
role: curator
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load curator-carla` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP08 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Make the branch release-ready for 0.4.0. **No tag, no publish** (C-003). FR-014, SC-003.

### T027 — Compatibility matrix

`src/tests/compatibility-matrix.test.ts` pins the peer ranges in
`src/package.json` (astro, Starlight, `@astrojs/markdown-remark`) so a change
is deliberate.

### T028 — Version and changelog

Set `src/package.json` `version` to `0.4.0` (out-of-map edit on a WP03 file;
rationale: release version). Follow the repo's release process (read
`.github/workflows/release.yml` and any RELEASE doc). Promote `[Unreleased]`
to `[0.4.0]` only if that is the repo's prep convention; otherwise keep
`[Unreleased]` and add entries. `💥 Breaking` entries: Astro 7 / Starlight
0.41 peers and `@astrojs/markdown-remark`; `generated_from` removal and
scenarios API version (#183); legacy stamps (#210). Keep the existing style
(bold lead sentence, before/now, what to do).

### T029 — Migration guide

`docs/migrations/` is a declared section in `docs/_meta/sections.yaml` but has
no directory yet: add `README.md` (section index, frontmatter) and
`0.3-to-0.4.md`: install steps, config changes, plugin notes for adopters who
append their own remark/rehype plugins, regenerate Gherkin/glossary pages,
scenarios API client changes, agent API v3 note already in `[Unreleased]`.
Validate with `pnpm validate:docs` and `pnpm validate:links`.

### T030 — Readiness

The consumer fixture installs the packed tarball with only the guide's steps.
List what the operator must do to cut the release.
