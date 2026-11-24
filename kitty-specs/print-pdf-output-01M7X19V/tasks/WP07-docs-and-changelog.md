---
work_package_id: WP07
title: Documentation and changelog
dependencies:
- WP06
requirement_refs:
- FR-010
- FR-027
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T034
- T035
- T036
- T037
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent:
- docs/guides/printing-and-pdf.md
execution_mode: planning_artifact
owned_files:
- docs/guides/printing-and-pdf.md
- docs/guides/README.md
- docs/architecture/section-registry.md
- docs/architecture/ci-cd-pipeline.md
- docs/ops/ci-cd.md
- docs/migrations/**
- docs/changelog/unreleased/**
- docs/guides/consumer-setup.md
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP07 – Documentation and changelog

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:
- Use the `/spk-charter-profile-load` skill with `scribe-sally`, or run
  `spec-kitty agent profile show scribe-sally`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP07 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

Living documentation for everything this mission ships (#391, #382, #396, #379). Requirements: FR-010, FR-027.

## Subtasks

### T034 Guide

`docs/guides/printing-and-pdf.md`, `kind: How-To`: what prints and what does not; dark prints light (hook + fallback, brand CSS-token limit); theme overrides (`print.css` selectors, `@page` paper size, link URL suffix off); section PDFs and the whole-site PDF (config, `pdf` key, exclusions floor, appendix, `dockitty-pdf`, determinism, CI and deploy); the print control. Link from the guides index.

### T035 Reference docs

Configuration reference (`pdf` option, `printControl`), `docs/architecture/section-registry.md` (`pdf` key), a migration note (no breaking change; new reserved `/print/` route and `/pdf/` URLs; `site` reserved).

### T036 CI/CD docs

`docs/architecture/ci-cd-pipeline.md` and `docs/ops/ci-cd.md`: the advisory `pdf` lane, deploy step, how it joins `ci-ok` later.

### T037 Changelog fragments

`docs/changelog/unreleased/378-print-layer.md`, `380-section-and-site-pdf.md`, `379-print-control.md` (format per `docs/changelog/unreleased/README.md`).

## Definition of Done

`pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog`, markdownlint on changed files pass.
