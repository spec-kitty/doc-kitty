---
work_package_id: WP08
title: Living docs - metadata contract, content graph, consumer setup, authoring guide
dependencies:
- WP05
- WP06
- WP07
requirement_refs:
- FR-011
- SC-004
- C-003
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP runs in the lane worktree computed in lanes.json, and completed changes merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
agent: claude
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent: []
execution_mode: planning_artifact
owned_files:
- docs/architecture/metadata-model.md
- docs/architecture/content-graph.md
- docs/guides/consumer-setup.md
- docs/guides/authoring.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP08 - Living docs

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `scribe-sally`, or run `spec-kitty agent profile show scribe-sally`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Document what WP02–WP07 shipped, in the pages a consumer and an agent read. The charter's living-documentation rule says a behaviour change updates its docs in the same change. Describe what the code does; read the merged code in your lane base before writing.

Requirements: FR-011 (contract, configuration reference, guide; the glossary is in WP01). Depends on: WP05, WP06, WP07.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP08 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- Style (charter): sentence case headings, one idea per sentence, teach then link, no AI tells (no em-dash runs, no "seamless" or "robust"). Vale and markdownlint run in CI (`pnpm validate:docs`, the repo lint config).
- Every touched page: bump `updated`.
- Not legal advice: wherever the catalog is described, say that the default labels name public-legislation headings, that the classification marks evidence, and that it does not make a TOM description sufficient (spec OQ-3). One short caution callout per page at most. Use the `> [!CAUTION]` form the ADR uses.

## Subtasks

### T026: `docs/architecture/metadata-model.md`

- Add a `tom_classification` row to "The contract at a glance" table: optional, shape `[id | { measure, scope?, note? }]`, effect "content-graph `classified-as` edges, `/api/pages` record".
- Add a `## TOM classification` section after `## Citation catalog`. Cover: the shape with the ADR's YAML example; `scope` (`system` default, `organisation`, British spelling on purpose); `note`; the lowercase key and the gate warning on case variants; ids resolving against the measures catalog; and an unknown id being build-fatal and caught by `pnpm validate:catalog`. Explain why it is a field and not a `kind` (one sentence, link ADR-0080).
- Add ADR-0080 to the page's `## Decisions` list and to `related` frontmatter.

### T027: `docs/architecture/content-graph.md`

- `## Nodes`: describe the measure node (`catalog:measure:<id>`, `kind: catalog`, `title`, `url` = DPV IRI, `measure.nature`, `measure.frameworks`). Say it appears only when a published page uses the measure.
- `## Edges`: add `classified-as` (page to measure node; `note`; `scope` always written on this relation). Say the target is a catalog record, not a page (ADR-0080 decision 6).
- Mention that the OKF export renders these edges as a `## Measures` section.

### T028: `docs/guides/consumer-setup.md` (the configuration reference entry)

Add a `## Measures catalog` section near the other `_meta` files (search the page for `_meta/charter.yaml` and place it in the same area). Cover:

- what the file is, where it lives (`docs/_meta/measures.yaml`), and the record shape (`id`, `label`, `nature`, `frameworks`, `dpv?`) with a two-record example (one ISO/IEC 27001 Annex A style id);
- **replace, not merge**: when present it replaces the 17 shipped defaults wholesale, so copy the defaults you still want (where to find them: `node_modules/@spec-kitty/doc-toolkit/lib/measures.default.yaml`; check the published path in `src/package.json`);
- absent means the default, and a tree that never uses the field is unaffected;
- a malformed file fails the build and `pnpm validate:catalog`;
- licensing note: ids from paywalled standards are the consumer's to add under their own licence terms (ADR-0080 decision 4).

### T029: `docs/guides/authoring.md`

Add a short how-to section `## Classify the measures a page evidences`:

1. add `tom_classification`;
2. run `pnpm validate:catalog`;
3. **organisation measures are linked, not copied**: put the organisation-wide description on one page with `scope: organisation`, and have product pages list that page in `related`, not repeat the classification. Show a two-page YAML example.

Keep it under ~40 lines and link the metadata model for detail.

## Definition of done

- `pnpm validate:docs` and `pnpm validate:links` pass; markdownlint and Vale (as CI runs them) are clean.
- Every claim matches the shipped code (field names, message wording, file paths).

## Reviewer guidance

- Read each section against the code; flag anything that promises an export or rendering this mission does not ship (C-003).
