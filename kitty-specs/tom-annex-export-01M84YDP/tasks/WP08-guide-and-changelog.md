---
work_package_id: WP08
title: Guide, format reference and changelog
dependencies:
- WP01
- WP07
requirement_refs:
- FR-013
- FR-004
- NFR-003
- C-001
- SC-002
planning_base_branch: feat/401-tom-annex-export
merge_target_branch: feat/401-tom-annex-export
branch_strategy: Planning artifacts for this mission were generated on feat/401-tom-annex-export. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/401-tom-annex-export unless the human explicitly redirects the landing branch.
subtasks:
- T035
- T036
- T037
- T038
agent: claude
history:
- timestamp: '2026-11-23T21:18:04Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: docs/guides/tom-annex.md
create_intent:
- docs/guides/tom-annex.md
- docs/changelog/unreleased/401-tom-annex-export.md
execution_mode: planning_artifact
owned_files:
- docs/guides/tom-annex.md
- docs/changelog/unreleased/401-tom-annex-export.md
- docs/architecture/metadata-model.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP08 - Guide, format reference and changelog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `scribe-sally`, or run `spec-kitty agent profile show scribe-sally`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Document the evidence index so that:

- an auditor understands what it is and is not;
- a site owner can turn on the snapshot and the hub page;
- a **#404 implementer can build on the format without reading the code**
  (FR-013, NFR-003).

Every counsel-dependent statement is marked **⚖** (C-001).

Requirements: FR-013, FR-004, NFR-003, C-001. Depends on: WP01 (format) and WP07
(CLI). Start the format reference after WP01. Finish after WP07.

## Branch strategy

- The planning branch and final merge target are both `feat/401-tom-annex-export`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP08 --agent claude --mission tom-annex-export-01M84YDP`.

## Context

- Sources of truth:
  - `src/lib/tom-annex/tom-annex.schema.json` (shipped);
  - the constants in `src/lib/tom-annex/core.mjs`;
  - ADR-0080, ADR-0087;
  - `kitty-specs/tom-annex-export-01M84YDP/{spec.md,data-model.md,research.md}`;
  - `docs/architecture/research/eu-dpa-compatibility.md`.
- House style: read two existing guides in `docs/guides/` and match their
  frontmatter (`title`, `description` of 50–180 characters, `doc_status`,
  `updated`, `type`, `kind`, `authors`, `related`) and their tone.
  `pnpm validate:docs` enforces the frontmatter. Markdownlint runs in CI. Never
  start a wrapped line with `#`, or markdownlint reads it as a heading.
- Copy strings from the constants. **Never paraphrase the label.**

## Subtasks

### T035 — Guide page: what it is, what it is not

**Steps**:
1. Create `docs/guides/tom-annex.md`. It opens with a `> [!CAUTION]` block
   containing the label, the notice and "Not legal advice".
2. Explain:
   - who it is for (auditor, DPO, #404);
   - what it gathers: pages classified with `tom_classification`, per catalog
     measure, by scope;
   - the `uncovered` list;
   - that drafts never count;
   - that a site with no classified pages emits nothing.
3. Add a short "What this is not" section:
   - not the DPA annex;
   - not a record of processing;
   - not an SCC annex;
   - no claim of legal sufficiency.
4. Add a ⚖ section listing the three counsel items, verbatim from
   `TOM_ANNEX_COUNSEL`.

### T036 — Format reference and versioning (for #404)

**Steps**:
1. Add a "Format 1.x" section:
   - a field table for every key, in serialised order: type, rule and sort order (from `data-model.md`);
   - the key order;
   - the serialiser rule (two-space JSON and a final newline);
   - URLs are absolute;
   - `null` versus absent.
2. Add a "Versioning" section:
   - a rename or removal is a major bump;
   - an addition is a minor bump;
   - 1.0 includes the `generated` stamp (ADR-0087);
   - consumers must ignore unknown keys within the same major version;
   - point to the shipped schema path.
3. Add a "Stamp" section linking ADR-0087 and explaining each key, especially
   that `at` comes from input instants and is never the build clock.

### T037 — Opt-ins, CLI usage and Deferred

**Steps**:
1. Add a "Snapshot and hub page" section:
   - the CLI flags;
   - the `generate:tom-annex` / `validate:tom-annex` scripts;
   - the verdict table from ADR-0087 D3 with one-line remedies;
   - the "regenerate after a build" workflow, and why the check goes red after a
     content change.
2. Add a "Deferred" section listing:
   - the `file` scope type for the producer registry, which would amend ADR-0083
     D3 (the operator ruled to keep the snapshot recognised by its CLI path for
     now, 2026-11-23);
   - the shared organisation bundle (#404).

### T038 — Changelog fragment and cross-link

**Steps**:
1. Create `docs/changelog/unreleased/401-tom-annex-export.md` with
   `section: Features`. Check the allowed sections in
   `docs/changelog/unreleased/README.md`. Match the fragment style of the existing
   files there: one bold lead sentence, then what changed for a user. The label
   must appear.
2. Add one sentence and a link from the "Generated stamp" area of
   `docs/architecture/metadata-model.md` to the guide, noting the annex as the
   first build-derived artifact under ADR-0087 D5.
3. Run `pnpm validate:docs validate:links validate:changelog`, and run
   markdownlint on the changed files.

## Definition of Done

- [ ] The guide covers what it is and is not, the format 1.x reference with its versioning rule, the opt-ins, the verdicts and Deferred.
- [ ] The label and the ⚖ items are verbatim from the constants.
- [ ] The changelog fragment and the metadata-model cross-link are in place.
- [ ] `validate:docs`, `validate:links`, `validate:changelog` and markdownlint are all clean.

## Risks

- **Legal tone.** Have the reviewer read it specifically for any sentence that
  implies compliance.
- **Drift between the guide and the schema.** The field table must match the
  shipped schema key for key; the reviewer diffs them.

## Reviewer guidance

- Diff the field table against `tom-annex.schema.json`.
- Search the guide for "compliant", "satisfies", "meets Art." and "sufficient".
  Each hit must be negated or marked ⚖.
