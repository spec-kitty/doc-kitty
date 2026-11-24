---
work_package_id: WP01
title: ADR-0085 and the kind lists
dependencies: []
requirement_refs:
- FR-004
- C-002
- C-004
planning_base_branch: feat/402-operating-model-templates
merge_target_branch: feat/402-operating-model-templates
branch_strategy: Planning artifacts for this mission were generated on feat/402-operating-model-templates. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/402-operating-model-templates unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
history:
- timestamp: '2026-11-23T22:30:23Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/
create_intent:
- docs/adr/0085-role-kind.md
execution_mode: planning_artifact
owned_files:
- docs/adr/0085-role-kind.md
- docs/context/convention.md
- docs/architecture/metadata-model.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP01 - ADR-0085 and the kind lists

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `scribe-sally`, or run `spec-kitty agent profile show scribe-sally`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Record the operator's ruling that `Role` is a new canonical kind, not a sub-use of `Persona`, as ADR-0085. Then add `Role` to the two docs pages that list the kinds.

Requirements: FR-004. Constraints:

- C-002: `Role` is the only vocabulary change; `Runbook` stays a type.
- C-004: the ADR number is 0085, allocated by the dispatcher. If 0085 turns out to be taken on `main`, stop and report; do not renumber.

## Branch strategy

- Planning branch and final merge target: `feat/402-operating-model-templates`.
- The execution worktree is allocated per computed lane from `lanes.json`. Run `spec-kitty agent action implement WP01 --agent claude --mission operating-model-templates-01M84X0R`. Never pick a base branch by hand.

## Context

- Precedent for appending a kind: `docs/adr/0067-schematic-pages-reference-a-schema.md` (Schematic) and ADR-0046 (Specification). Copy their frontmatter shape: `type: ADR`, `kind: ADR`, `authors: [process:doc-kitty]` and `related`, but with `doc_status: draft`, because the ADR is Proposed (precedent: ADR-0083).
- Persona fields: `docs/adr/0019-persona-attribute-fields.md`.
- Measures: `docs/adr/0080-tom-classification-field-and-measures-catalog.md`.
- Research: `docs/architecture/research/eu-dpa-compatibility.md`, § "Operating-model templates".
- Rules from AGENTS.md:
  - Add the ADR file, never the index row. `docs/adr/README.md` is regenerated; do not edit it.
  - The changelog fragment belongs to WP05, not here.
- Writing style (charter): sentence case, one idea per sentence, no puffery. Vale and markdownlint run in CI on `docs/**`.

## Subtasks

### T001 — Write ADR-0085: the Role kind

**File**: `docs/adr/0085-role-kind.md`, a new file of about 80 lines.

Write these sections:

1. **Status.** "**Proposed**, 2026-11-23." with `doc_status: draft` (precedent: ADR-0083). Cite the Decision Moments `01M84X1Q21P9HN21KNN9PFSNN6` and `01M84X1TXTTJM09B0G0YN2G9BM` as the basis of the decision content. Only the operator accepts the ADR itself (review cycle 1, B1).
2. **Context.**
   - Operating models need a page for an accountable function, such as a DPO, an incident owner or a change approver.
   - `Persona` (ADR-0019) describes a reader, so reusing it would blur the audience and the accountable function.
   - About half of the SCC TOM headings are organisational (cite ADR-0080 and the research).
3. **Decision.**
   - `Role` is appended to the canonical `KINDS`, which `src/lib/vocabulary-core.mjs` holds as the single source.
   - A `kind: Role` page requires `role` (a non-empty string) and `responsibilities` (a non-empty list of non-empty strings). The frontmatter gate enforces this, as it does for Persona. `goals` is optional.
   - Process pages name the roles they involve through `related`.
   - `Runbook` stays a `type` derived from `operations/runbooks/`; it is not a kind.
4. **Consequences.**
   - The kind is one entry in the shared vocabulary core. The gate reads it for the unknown-kind warning; the build schema keeps `kind` an open string.
   - An operating-model template for a role ships in the same mission.
   - A generated responsibility (RACI) matrix is a possible later step, out of scope here.
5. **Alternatives considered.**
   - A Persona sub-use with a marker field: rejected, because it conflates readers with accountable functions and the Persona rule requires `goals`.
   - A free `type` only: rejected, because kind drives layouts and validation.

Add `related` entries for `adr/0019-persona-attribute-fields`, `adr/0067-schematic-pages-reference-a-schema` and `adr/0080-tom-classification-field-and-measures-catalog`.

**Validation**:

- `pnpm validate:docs` passes;
- `pnpm validate:adr-ids` passes;
- `pnpm validate:links` resolves every link.

### T002 — Add Role to the kind list in `docs/context/convention.md`

Find where the kinds are listed (look for `User-Journey` or `Persona`). Add `Role` with a one-line meaning: "an accountable function (ADR-0085)". Keep the existing ordering convention, which is append order.

### T003 — Add Role to the kind list in `docs/architecture/metadata-model.md`

Do the same here. If the page has a table of kind-specific required fields, add a row: `Role` requires `role` and `responsibilities`.

## Definition of Done

- ADR-0085 exists, is Proposed (the operator accepts it) and links its related ADRs.
- Both kind lists include `Role`.
- `pnpm validate:docs`, `pnpm validate:links` and `pnpm validate:adr-ids` are green.
- `docs/adr/README.md` is untouched.

## Reviewer guidance

- Check that the ADR's decision matches the spec decisions exactly: Role is required to have `role` and `responsibilities`, and `goals` is optional.
- Check that there is no policy wording and no legal claims.
