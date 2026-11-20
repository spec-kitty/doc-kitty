---
work_package_id: WP05
title: PDF CI lane, deploy and served surfaces
dependencies:
- WP04
requirement_refs:
- FR-024
- FR-025
- NFR-003
- C-001
- C-004
planning_base_branch: feat/print-pdf-output
merge_target_branch: feat/print-pdf-output
branch_strategy: Planning artifacts for this mission were generated on feat/print-pdf-output. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/print-pdf-output unless the human explicitly redirects the landing branch.
subtasks:
- T026
- T027
- T028
- T029
- T030
history:
- timestamp: '2026-11-20T18:20:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: .github/
create_intent:
- src/tests/pdf-workflows.test.ts
execution_mode: code_change
owned_files:
- src/lib/served-surfaces.ts
- src/lib/integrations/served-surfaces.ts
- src/scripts/assert-no-broken-links.mjs
- .github/workflows/ci.yml
- .github/workflows/deploy.yml
- src/tests/served-surfaces.test.ts
- src/tests/served-surfaces-build.test.ts
- src/tests/page-formats.test.ts
- src/tests/pdf-workflows.test.ts
role: implementer
tags: []
tracker_refs: []
---
# Work Package Prompt: WP05 – PDF CI lane, deploy and served surfaces

## ⚡ Do This First: Load Agent Profile

Before reading further or touching anything, load your assigned profile:

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run
  `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Branch Strategy

Planning branch, base and final merge target: `feat/print-pdf-output`. The mission topology is `single_branch`, so no lane worktree is allocated: implement in the repository root checkout on `feat/print-pdf-output`.

Implementation command:

```bash
spec-kitty agent action implement WP05 --agent claude --mission print-pdf-output-01M7X19V
```

## Objective

The PDFs are built and checked in an advisory lane and published on main (#396, #397). Requirements: FR-024, FR-025, NFR-003, C-004.

## Subtasks

### T026 Served surfaces

`ServedSurfaces.pdf: string[]` (from `pdfOptions()`: section ids + `site`), written at config time, never from `dist/pdf/`; the module doc says this one field is config-derived. Update `page-formats.test.ts` and `served-surfaces*.test.ts` fixtures.

### T027 Link check

`assert-no-broken-links.mjs`: a link to `<base>/pdf/<name>.pdf` is valid when `<dist>/print/manifest.json` lists `<name>`; any other missing `/pdf/` target stays broken. Unit-test both.

### T028 CI lane

Job `pdf` in `ci.yml`: `needs: [detect-changes, build-example]`, `if: needs.detect-changes.outputs.run_build_example == 'true'`, container `mcr.microsoft.com/playwright:v1.62.1-noble`, checkout, pnpm install, download `example-dist-nodrafts`, `SOURCE_DATE_EPOCH` from `git log -1 --format=%ct`, then `node src/scripts/dockitty-pdf.mjs --dist example/dist-nodrafts --base /doc-kitty`, `node src/scripts/assert-pdf-artifacts.mjs example/dist-nodrafts`, `node src/scripts/assert-pdf-determinism.mjs example/dist-nodrafts --base /doc-kitty`. Not added to `ci-ok`'s `needs` or `REQUIRED_LANES` (comment says advisory, joining is an operator decision). Record the lane's wall time from the first PR run in the PR body (NFR-003).

### T029 Deploy

In `deploy.yml` after "Build example site": `SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) node src/scripts/dockitty-pdf.mjs --dist example/dist --base /doc-kitty` then the PDF gate; a failure fails the job (no publish). Chromium is already installed by the composite.

### T030 Workflow tests

`src/tests/pdf-workflows.test.ts`: the `pdf` job exists with the path gate, consumes `example-dist-nodrafts`, is absent from `ci-ok` needs and from `REQUIRED_LANES`; deploy prints PDFs before the Pages upload. Run the existing workflow tests (`draft-publication-workflows`, `ci-ok-decision`) to prove no regression.

## Definition of Done

Workflow tests and `node --test .github/scripts/*.test.mjs` pass; YAML parses.
