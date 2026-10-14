---
work_package_id: WP06
title: Records and adopter docs
dependencies:
- WP05
requirement_refs:
- FR-007
- FR-013
- C-002
- C-006
- C-007
planning_base_branch: issue-156-gherkin-trim-and-fixes
merge_target_branch: issue-156-gherkin-trim-and-fixes
branch_strategy: Planning artifacts for this mission were generated on issue-156-gherkin-trim-and-fixes. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into issue-156-gherkin-trim-and-fixes unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-gherkin-trim-and-fixes-01M4X4YF
base_commit: 8cb25202995ec49bb7aa7f77e2aeab483a54246d
created_at: '2026-10-14T13:08:21.615805+00:00'
subtasks:
- T022
- T023
- T024
history: []
agent_profile: comms-cleo
authoritative_surface: docs/
create_intent:
- docs/adr/0054-gherkin-draft-hubs-titles-and-scenario-route.md
execution_mode: code_change
owned_files:
- docs/adr/0054-gherkin-draft-hubs-titles-and-scenario-route.md
- docs/adr/README.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
- docs/architecture/gherkin-pages.md
- docs/changelog/**
- CHANGELOG.md
role: communicator
tags: []
tracker_refs: []
---

# WP06 — Records and adopter docs

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned agent profile with the `/spk-charter-profile-load` skill, using the `agent_profile` value from this file's frontmatter (`comms-cleo`). Apply its boundaries and directives for the whole work package, and state in your hand-off which ones you applied.

## Objective

Record the changed decisions in a new ADR and update the adopter docs and changelog. ADR-0046 and ADR-0051 are not edited (C-002).

## Branch strategy

Planning artifacts were generated on `issue-156-gherkin-trim-and-fixes`; completed changes merge back into `issue-156-gherkin-trim-and-fixes`, which goes to `main` as one draft PR the operator merges. The execution worktree is allocated per computed lane from `lanes.json`; run `spec-kitty agent action implement <WP> --agent claude --mission gherkin-trim-and-fixes-01M4X4YF`.

## Shared context

- Read `spec.md`, `plan.md` (your IC), `research.md`, `data-model.md`, `contracts/public-surface.md` and `research/code-grounding.md` first.
- Node 22, pnpm, Vitest. No dependency change.
- In a lane worktree run `pnpm install --offline --frozen-lockfile` once; revert mode-only changes under `src/scripts/` with `git checkout -- src/scripts`. Run tests per file: `cd src && ./node_modules/.bin/vitest run tests/<file>`.
- Locate code by symbol, not line: earlier WPs edit the same files.
- Every commit carries `Co-Authored-By: Stijn Dejongh <stijn.dejongh@sddevelopment.be>`. No model identifier in commits.
- Terminology: "Mission" for the Spec Kitty work object; Gherkin "Feature" is a domain term.

## Subtasks

### T022 — ADR-0054

`docs/adr/0054-…`: status Accepted; amends ADR-0046 decision 3 (hub per directory; draft hub for a draft-only directory) and its "Known limit" risk, and decision 9's missing-route note (now a build error); records #123 (exact match + near-miss warning, and why not fail closed), #124 (generation independent of the draft setting, R3), #125 (`titles`, key form, `--titles`), #126 (build-end check, residual), with alternatives. Frontmatter per convention (`related` to 0046, 0051, 0026, architecture/gherkin-pages, guides/consumer-setup). Regenerate the index: `node src/scripts/generate-adr-index.mjs`.

### T023 — Guides and architecture

`docs/guides/consumer-setup.md`: only the Gherkin section (`titles` row in the key table and example, the hub sentence, `--titles` in the CLI example) and the step-5 scenario-route sentence (a missing route now fails the build). `docs/guides/authoring.md`: `@wip` / `@deprecated` are case-sensitive; a near miss warns; draft-only directories get a draft hub. `docs/architecture/gherkin-pages.md`: hub rule and the build-end check. Bump `updated` on each page.

### T024 — Changelog

Follow the repo's existing pattern (`docs/changelog/` entry and root `CHANGELOG.md`): adopter-visible changes (#123 warning, #124 draft hubs, #125 `titles` / `--titles`, #126 build failure). Mention that a site with generated pages and no mounted route now fails its build.

## Definition of done

- `pnpm validate:docs`, `pnpm validate:adr-index`, `pnpm validate:links`, markdownlint clean.

## Risks and reviewer guidance

- Sibling #153 edits other parts of consumer-setup.md: keep to the Gherkin section and the one step-5 sentence.
