---
work_package_id: WP01
title: 'ADR-0086: the sub-processor catalog'
dependencies: []
requirement_refs:
- FR-014
- C-002
- C-004
- C-006
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
subtasks:
- T001
- T002
- T003
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: architect-alphonso
role: implementer
agent: claude
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0086-subprocessor-catalog.md
execution_mode: planning_artifact
owned_files:
- docs/adr/0086-subprocessor-catalog.md
- docs/adr/README.md
tags: []
tracker_refs: []
---

# Work Package Prompt: WP01 - ADR-0086: the sub-processor catalog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `architect-alphonso`, or run `spec-kitty agent profile show architect-alphonso`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Write ADR-0086, which records the optional sub-processor catalog for issue #403.
The ADR is **Proposed**. Only the operator accepts ADRs, so do not mark it Accepted.

Requirements: FR-014, C-002, C-004, C-006. Depends on: none.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- The worktree comes from `lanes.json`.
- Run `spec-kitty agent action implement WP01 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

Read before writing:

- `kitty-specs/subprocessor-catalog-01M84X07/{spec.md,plan.md,research.md,data-model.md,contracts/*.md}`. Every decision below is already made there. The ADR records those decisions and does not reopen them.
- `docs/adr/0080-tom-classification-field-and-measures-catalog.md`. Copy its structure and tone. Its "Out of this decision" section names this catalog as a follow-up.
- `docs/adr/0018-citation-catalog-collections.md`, the catalog pattern.
- `docs/adr/template.md`, the required frontmatter and headings.
- ADR numbers: **0086 is allocated to this mission** by the dispatcher. 0085 belongs to #402, and 0087 is the generated-section contract (#359, PR #445). Do not take another number.

## Subtasks

### T001 — Write `docs/adr/0086-subprocessor-catalog.md`

**Frontmatter.** Mirror ADR-0080:
- `title: "ADR-0086: A sub-processor catalog"`
- a one-sentence `description`
- `doc_status: active`
- `updated` with today's date
- `type: ADR`, `kind: ADR`
- `authors: [process:claude-code]`
- `related:`
  - `adr/0018-citation-catalog-collections`
  - `adr/0080-tom-classification-field-and-measures-catalog`
  - `architecture/research/eu-dpa-compatibility`
  - Add `adr/0087-generated-section-contract` **only if** that file exists on your base. Otherwise `validate:links` fails. Mention ADR-0087 in prose instead.

**Body sections**:

1. **Caution box.** Use the same not-legal-advice block as ADR-0080, naming ⚖ counsel items.
2. **Status.** "Proposed. Awaiting operator acceptance." List the ⚖ items:
   - the field set;
   - whether a feed satisfies a contract's notice terms;
   - the treatment of the `EU` code (research R-03).
3. **Context.**
   - Name the sources: GDPR Art. 28(2) and 28(4), 2021/915 Annex IV and Clause 7.7 Option 2 (advance notice), and 2021/914 Annex III.
   - Today the list lives as prose, so nothing validates, exports or announces it.
4. **Decision.** Number each item.
   1. Add an optional `docs/_meta/subprocessors.yaml`, following the ADR-0018 pattern. An absent file means no outputs and no errors. The toolkit ships **no** default records.
   2. Record fields: reproduce the data-model table, which puts `location` as ISO 3166-1 alpha-2 codes plus `location_note`. State that unknown fields are errors, and why (R-06).
   3. References: `external_references` reuses the page shape and the bibliography and tool catalogs. `tom_classification` reuses the ADR-0080 shape and the effective measures catalog. Both fail hard.
   4. One validation core is shared by the build-free gate and the build. The build fails at `astro:config:setup` with one aggregate error (R-01, R-02).
   5. Outputs:
      - `api/subprocessors.json` (records and `changes`);
      - `subprocessors.xml` (RSS);
      - links from `api/index.json` through served-surface detection.
      No output depends on the build clock. A future `since`/`until` is the advance-notice mechanism (R-04).
   6. The generated list page follows ADR-0087 and ships only after it merges (C-004).
5. **Out of this decision.** These become follow-up issues:
   - a transfer-mechanism field;
   - derivation from changelog fragments;
   - merging with an organisation catalog;
   - an Atom variant of the feed.
6. **Consequences.**
   - Positive: one validated source, discoverable by agents.
   - Negative: one more catalog contract to maintain, and an embedded ISO list to keep current.
   - Risks: readers may treat the feed as legal notice, so the guide warns about it.
7. **Alternatives considered.** Cover:
   - free-text `location`;
   - changelog-fragment derivation;
   - lazy route validation;
   - a dependency for ISO codes.

Write in the repo's plain style: short sentences, British spelling where the repo
uses it, and no marketing tone.

### T002 — Regenerate the ADR index

- Run `node src/scripts/generate-adr-index.mjs`. Do not hand-edit the table.
- Confirm that only the new ADR-0086 row was added to `docs/adr/README.md`.

### T003 — Validate

Run each of these and fix anything that fails:

```bash
pnpm validate:adr-index && pnpm validate:adr-ids && pnpm validate:docs && pnpm validate:links
```

## Definition of Done

- `docs/adr/0086-subprocessor-catalog.md` exists with status **Proposed** and every decision above.
- The ADR index is regenerated, and all four validators pass.
- The ADR marks ⚖ items and makes no claim of legal sufficiency.
- Full `pnpm test` passes before hand-off (operator rule).

## Reviewer guidance

- Check every decision against spec.md, plan.md and research.md. The ADR must not introduce new behaviour.
- Check the status is Proposed and the number is 0086.
- Check `related` holds no dangling ids.
