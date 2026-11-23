---
work_package_id: WP05
title: Preset snippet, guide and changelog
dependencies:
- WP04
requirement_refs:
- FR-010
- FR-013
- NFR-005
- C-005
- C-006
- C-007
planning_base_branch: feat/402-operating-model-templates
merge_target_branch: feat/402-operating-model-templates
branch_strategy: Planning artifacts for this mission were generated on feat/402-operating-model-templates. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/402-operating-model-templates unless the human explicitly redirects the landing branch.
subtasks:
- T017
- T018
- T019
- T020
- T021
history:
- timestamp: '2026-11-23T22:30:23Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: docs/guides/
create_intent:
- src/lib/templates/operating-model/sections.snippet.yaml
- src/tests/operating-model-preset.test.ts
- docs/guides/operating-model.md
- docs/changelog/unreleased/402-operating-model-templates.md
execution_mode: code_change
owned_files:
- src/lib/templates/operating-model/sections.snippet.yaml
- src/tests/operating-model-preset.test.ts
- docs/guides/operating-model.md
- docs/guides/README.md
- docs/changelog/unreleased/402-operating-model-templates.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP05 - Preset snippet, guide and changelog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `implementer-ivan`, or run `spec-kitty agent profile show implementer-ivan`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Ship the opt-in `operating-model` section preset as a `sections.yaml` snippet, tested with the real registry loader, plus the "Documenting your operating model" guide and the changelog fragment.

Requirements: FR-010, FR-013; NFR-005; C-005, C-006, C-007. Depends on WP04, so that the guide documents the real flags.

## Branch strategy

- Planning branch and final merge target: `feat/402-operating-model-templates`.
- Run `spec-kitty agent action implement WP05 --agent claude --mission operating-model-templates-01M84X0R`.

## Context

- The registry format is in `docs/_meta/sections.yaml`; see the `operations` entry for the shape (`id`, `label`, `order`, `type`, `purpose`). The loader is `loadSectionRegistry` and its helpers; `validate-frontmatter.mjs` imports them, so find the module there.
- The fragment format is in `docs/changelog/unreleased/README.md`. Read it first. Never edit CHANGELOG.md.
- The existing guides list is in `docs/guides/README.md`.
- Writing style (charter): sentence case, one idea per sentence, no puffery. Vale and markdownlint run on `docs/**`.

## Subtasks

### T017 — Preset snippet and test

Create `src/lib/templates/operating-model/sections.snippet.yaml` with the entry from `data-model.md` (`order: 105`, `type: Operations`). Write the red test `src/tests/operating-model-preset.test.ts`, which checks:

1. Appending the snippet to a temp copy of a minimal registry loads without error through the real loader. The resolved type for `operating-model` is `Operations`.
2. The toolkit's own `docs/_meta/sections.yaml` and the default fallback map have no `operating-model` entry (C-005).
3. A rendered template under `operating-model/` passes the gate in a tree that has the snippet applied, now with the type checked. Positive control: the same page with `type: Guide` fails.

### T018 — Guide `docs/guides/operating-model.md`

Use `kind: How-To` and `type: Guide`. Cover:

- what an operating model is and how it relates to the organisational TOMs (link ADR-0080 and the research page);
- the opt-in preset, with the snippet shown and how to add it;
- `new-doc --template <id>`, with a table of the 12 ids, kinds and preset measures;
- `scaffold --preset operating-model`, including that existing files are never overwritten;
- the `Role` kind (link ADR-0085), and how process pages name roles through `related`;
- a notice, stated plainly: the templates are structure and prompts, not policy and not legal advice (C-006);
- RACI generation is not available yet (C-007).

### T019 — Guides list

Add one line for the new guide to `docs/guides/README.md`.

### T020 — Changelog fragment

Create `docs/changelog/unreleased/402-operating-model-templates.md` in the README's format, with section `Added`. It covers the Role kind (ADR-0085), the 12 templates, the two flags and the opt-in preset.

### T021 — Quickstart smoke and gates

- Run `kitty-specs/operating-model-templates-01M84X0R/quickstart.md`, steps 1 to 4, plus the optional snippet step, in a temp directory. Report the output.
- Run `pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:changelog` and markdownlint on the new docs.
- Run the full `pnpm test`.

## Definition of Done

- The preset test is red first, then green.
- All docs gates pass with 0 errors.
- The quickstart runs clean.
- `pnpm test` passes fully; report the counts.

## Reviewer guidance

- Check that the guide states no policy and makes no legal claim, and that the "not legal advice" notice is present.
- Check that the snippet is absent from the default registry.
