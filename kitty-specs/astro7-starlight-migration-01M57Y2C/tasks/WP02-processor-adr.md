---
work_package_id: WP02
title: Processor ADR (#143)
dependencies:
- WP01
requirement_refs:
- FR-008
planning_base_branch: claude/ecstatic-mccarthy-pm655w
merge_target_branch: claude/ecstatic-mccarthy-pm655w
branch_strategy: Planning artifacts for this mission were generated on claude/ecstatic-mccarthy-pm655w. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into claude/ecstatic-mccarthy-pm655w unless the human explicitly redirects the landing branch.
subtasks:
- T008
- T009
history:
- at: '2026-10-18T17:00:00Z'
  lane: planned
  agent: claude
  action: created by /spec-kitty.tasks
agent_profile: architect-alphonso
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0060-keep-remark-rehype-on-unified-processor.md
execution_mode: planning_artifact
owned_files:
- docs/adr/0060-keep-remark-rehype-on-unified-processor.md
- docs/adr/README.md
role: architect
tags: []
tracker_refs: []
---
## ⚡ Do This First: Load Agent Profile

Load `/spk-charter-profile-load architect-alphonso` before anything else, then `spec-kitty charter context --action implement`.

## Branch Strategy

Planning base and merge target: `claude/ecstatic-mccarthy-pm655w`. The worktree
comes from `lanes.json`: `spec-kitty agent action implement WP02 --agent claude --mission astro7-starlight-migration-01M57Y2C`.

## Gate

Starts only after the operator's GO on WP01 (C-002). Read the WP01 research
note (`docs/architecture/research/astro7-starlight-041-migration-spike.md`)
first; it is the authoritative breakage list for this WP.

## Objective

Record the Markdown processor choice for Astro 7 as an Accepted ADR (FR-008).

### T008 — Write ADR-0060

Use `docs/adr/template.md`. Status **Accepted**. Content:
- Context: Astro 7 renders `.md` with Sätteri by default; Sätteri does not run
  remark/rehype; every DocKitty Markdown feature is a remark/rehype plugin
  (list them, from the spike's plugin-proof table).
- Decision: `markdown.processor: unified()` from `@astrojs/markdown-remark`.
- Evidence: the spike's #143 answer (does `updateConfig` from an integration
  still append plugins under `unified()`), with the deprecation warning text.
- Costs: deprecated `remarkPlugins`/`rehypePlugins` options; a second
  processor in the dependency tree; Markdown that third-party integrations
  render through Sätteri (e.g. `starlight-openapi` descriptions) skips our
  plugins (glossary links, link checks).
- Deferred: Sätteri port (#148), with the reopen trigger: Astro announcing
  removal of the deprecated options, or adopting a Sätteri-rendering
  integration whose Markdown needs our plugins (e.g. #140).
- Relates to ADR-0049 (PR #141). Do not edit accepted ADRs.

### T009 — Index

Run `node src/scripts/generate-adr-index.mjs` and `pnpm validate:adr-index`,
`pnpm validate:docs`, `pnpm validate:links`.

## Definition of Done

ADR Accepted, index regenerated, checks pass. The orchestrator links it from #119.
