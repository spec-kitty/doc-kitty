---
work_package_id: WP09
title: Example pages and build-artifact assertions
dependencies:
- WP05
- WP06
- WP07
requirement_refs:
- FR-012
- NFR-003
planning_base_branch: feat/406-tom-classification
merge_target_branch: feat/406-tom-classification
branch_strategy: Planning artifacts for this mission were generated on feat/406-tom-classification. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/406-tom-classification unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
- T032
history:
- timestamp: '2026-11-22T13:10:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: example/docs/
create_intent:
- example/docs/architecture/audit-logging.md
- example/docs/context/incident-handling.md
execution_mode: code_change
owned_files:
- example/docs/architecture/audit-logging.md
- example/docs/context/incident-handling.md
- src/scripts/assert-build-artifacts.mjs
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP09 - Example pages and build-artifact assertions

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Exercise the feature end to end in the example build. Add one organisation-scope page and one system page that links to it (FR-012, US5), and make `assert-build-artifacts.mjs` check that the built graph, the page record and the OKF bundle carry the classification.

Requirements: FR-012, plus end-to-end evidence for FR-007, FR-008 and FR-009. Depends on: WP05, WP06, WP07.

## Branch strategy

- Planning branch and final merge target: `feat/406-tom-classification`. The worktree comes from `lanes.json`. Run `spec-kitty agent action implement WP09 --agent claude --mission tom-classification-measures-catalog-01M81M7T`.

## Context

- `example/docs/` is the worked example site. Check `example/docs/_meta/sections.yaml` and each section's README to confirm `architecture` and `context` are sections, and pick their `type`/`kind` conventions. If `context` is a poor fit for an organisation process page, choose a better existing section. Then **update `owned_files` in this prompt** and note it in the commit.
- The example has **no** `_meta/measures.yaml`, so it exercises the shipped default.
- `src/scripts/assert-build-artifacts.mjs` already has a content-graph block (~line 508). Add assertions next to it, and follow its `fail(...)` style.
- The OKF bundle: find where the example build writes it (`okf-export/integration.ts` and the example's astro config) and which path the assertions already read, if any.

## Subtasks

### T030: Organisation page

`example/docs/context/incident-handling.md` (or the chosen section): a short page, kind `How-To` or `Runbook` per the section's conventions, describing an invented incident-handling process for the example product. Frontmatter:

```yaml
tom_classification:
  - measure: availability-restoration
    scope: organisation
  - measure: accountability
    scope: organisation
    note: Every incident gets a named owner and a written review.
```

Write plain, short prose. Not legal advice; no policy text beyond a toy example.

### T031: System page

`example/docs/architecture/audit-logging.md`: explains the example's audit logging. Frontmatter:

```yaml
tom_classification:
  - events-logging
  - measure: storage-protection
    note: Log archives are encrypted at rest.
related:
  - context/incident-handling   # the slug form the example uses for related refs
```

It must not repeat the organisation measures (US5.2).

### T032: Artifact assertions

In `assert-build-artifacts.mjs`, after the existing content-graph checks:

- the node `catalog:measure:events-logging` exists with `kind: 'catalog'`, a `url` starting `https://w3id.org/dpv#` and `measure.nature === 'technical'`;
- an edge `architecture/audit-logging|classified-as|catalog:measure:events-logging` exists with `scope === 'system'`. Adjust the source id to the real bundle id;
- an edge from the incident page to `catalog:measure:accountability` has `scope === 'organisation'` and the note;
- a `related` edge runs from the audit page to the incident page, and the audit page has **no** `classified-as` edge to `accountability`;
- `/api/pages/architecture/audit-logging.json` (if the example mounts the page route, which it does; confirm) has `tom_classification[0].measure === 'events-logging'`, and a page without the field has no `tom_classification` key;
- the OKF concept document for the audit page contains `## Measures` and `Events logging`.

Run: `pnpm validate:example`, `pnpm validate:catalog`, `pnpm build`, `pnpm assert:artifacts`, then the e2e gates CI runs for the example (`pnpm build:test-dists` and `pnpm test:a11y --trace off`, if feasible in the container; otherwise record which were run).

## Definition of done

- Example builds; assertions pass; validate gates pass; lint clean; no suppressions.
- Prove the negative once by hand: temporarily misspell an id in the audit page, confirm `pnpm build` fails with a message naming `architecture/audit-logging` and the id (US2.1), then revert. Record the observed message in the commit body.

## Risks

- Adding pages changes sidebar, sitemap, `llms.txt` and search counts. Check whether any assertion or snapshot counts pages (grep the assert scripts and tests for fixed counts) and update the counts with a note.
- `mcp/tests/corpus/fixtures/example/` is a static snapshot. Do not regenerate it unless a test compares it to the live build.

## Reviewer guidance

- The two pages model link-not-copy; assertions check both scope values and the related edge.
