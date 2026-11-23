---
work_package_id: WP05
title: Documentation and dogfood
dependencies:
- WP04
requirement_refs:
- FR-010
- FR-011
planning_base_branch: feat/341-sidebar-child-cap
merge_target_branch: feat/341-sidebar-child-cap
branch_strategy: Planning artifacts for this mission were generated on feat/341-sidebar-child-cap. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/341-sidebar-child-cap unless the human explicitly redirects the landing branch.
subtasks:
- T021
- T022
- T023
- T024
history:
- timestamp: '2026-11-23T00:00:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: curator-carla
authoritative_surface: docs/guides/sidebar-child-cap.md
create_intent:
- docs/guides/sidebar-child-cap.md
- docs/changelog/unreleased/341-sidebar-child-cap.md
execution_mode: planning_artifact
owned_files:
- docs/guides/sidebar-child-cap.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
- docs/guides/README.md
- docs/plans/features/large-hubs.md
- docs/_meta/sections.yaml
- docs/changelog/unreleased/341-sidebar-child-cap.md
role: implementer
tags: []
tracker_refs: []
---
# WP05 — Documentation and dogfood

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`curator-carla`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Document the cap, keep this repo's ADR sidebar unchanged, record the measurements and add the changelog fragment. Requirements: FR-010, FR-011, NFR-004. Plan: IC-05.

## Shared context

- Mission documents: `kitty-specs/large-hubs-sidebar-child-cap-01M81KGV/spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/cap-api.md`, `decisions/`.
- Stack: Node 22+, TypeScript 5 and JSDoc-typed `.mjs`, Astro 7.4, Starlight 0.42. Add, upgrade or remove no dependency.
- Red first: write each test, run it, see it fail for the right reason, then implement.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test` clean with no suppressions.
- Branch strategy: planning base and merge target `feat/341-sidebar-child-cap`; the lane worktree comes from `lanes.json`.
- Implement with `spec-kitty agent action implement <WP> --agent claude --mission large-hubs-sidebar-child-cap-01M81KGV`.

## Subtasks

### T021 — Configuration guide

`docs/guides/sidebar-child-cap.md` (`kind: How-to`): what the cap does, the three settings and their order, the label and its UI string, the producer hint, what stays reachable (hub listing, sitemap, agent API), an example. Follow the charter's documentation policy (sentence-case headings, one idea per sentence, no AI tells). Link it from `docs/guides/README.md` if that page lists guides.

### T022 — Cross-references

`consumer-setup.md` "Sidebar groups": one paragraph and a link. `authoring.md`: `sidebar_child_cap` in the frontmatter list.

### T023 — Dogfood and measurements

`docs/_meta/sections.yaml`: `sidebar: { childCap: 100 }` on `adr` with a comment. `docs/plans/features/large-hubs.md`: a "Measurements" subsection under slice 1 with WP04's numbers, the date and the fixture shape; bump `updated`.

### T024 — Changelog

`docs/changelog/unreleased/341-sidebar-child-cap.md` per `docs/changelog/unreleased/README.md` (`section: Added`).

## Definition of done

`pnpm validate:docs`, `pnpm validate:links`, markdownlint and Vale clean; `pnpm validate:changelog` passes.
