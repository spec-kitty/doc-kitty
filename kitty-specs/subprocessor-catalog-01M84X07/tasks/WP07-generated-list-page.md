---
work_package_id: WP07
title: Generated sub-processor list page (blocked on PR #445)
dependencies:
- WP06
requirement_refs:
- FR-017
- C-004
- C-005
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
subtasks:
- T029
- T030
- T031
- T032
- T033
- T034
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
role: implementer
agent: claude
authoritative_surface: src/scripts/
create_intent:
- src/scripts/generate-subprocessor-page.mjs
- src/tests/subprocessor-page.test.ts
- example/docs/reference/subprocessors.md
- docs/changelog/unreleased/403-subprocessor-page.md
execution_mode: code_change
owned_files:
- src/scripts/generate-subprocessor-page.mjs
- src/tests/subprocessor-page.test.ts
- src/tests/fixtures/subprocessor-page/**
- example/docs/reference/subprocessors.md
- docs/changelog/unreleased/403-subprocessor-page.md
tags: []
tracker_refs: []
---

# Work Package Prompt: WP07 - Generated sub-processor list page (blocked on PR #445)

> **⛔ GATE (C-004): do not claim this WP until PR #445 (ADR-0087, the
> generated-section contract) has merged into `main`.** The operator accepted
> ADR-0087 on 2026-11-23. This WP builds on the contract as **merged**, not as
> drafted. If #445 is still open, stop and report "blocked on #445" to the
> dispatcher.

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Generate a human-readable page from the catalog that lists **current** and
**past** sub-processors in separate sections. It carries ADR-0087's `generated`
stamp and is covered by its `--check` drift gate.

Requirements: FR-017, C-004, C-005. Depends on: WP06, and PR #445 merged.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- Run `spec-kitty agent action implement WP07 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

- **ADR-0087 as merged** (`docs/adr/0087-generated-section-contract.md`). Read it fully, especially:
  - D1: the stamp is `by`, `at`, `source_digest` and `content_hash`. `makeStamp` and `serializeStamp` are the only writers.
  - D2: `source_digest` covers declared, committed inputs. Here the inputs are the catalog file and the generator configuration.
  - D3: the `--check` gate.
  - D4: ownership through the producer registry.
  - D5: how `at` is masked for byte-stable builds.
- **ADR-0083 and `src/lib/producers.mjs`.** The producer registry. Register a `subprocessors` producer there. That is a small out-of-map edit to `producers.mjs`; record a one-line rationale in the hand-off.
- **Generator precedents.**
  - `src/scripts/generate-feature-pages.mjs` and `src/lib/gherkin/*`: stamp handling.
  - `src/scripts/generate-adr-index.mjs`: the `--check` pattern.
- **Data.** WP02's `checkSubprocessorCatalog`.

## Subtasks

### T029 — Confirm the gate, rebase, re-read

1. Confirm #445 has merged: it appears on `main`'s log, or the GitHub PR shows merged.
2. Rebase the lane onto the latest `feat/403-subprocessor-catalog`, which by then includes `main` with ADR-0087.
3. Re-read the merged ADR-0087. If any decision differs from what this prompt assumes, follow the ADR and note the difference in the hand-off.

### T030 — Red-first tests (`src/tests/subprocessor-page.test.ts`)

- Given a fixture catalog, the generated Markdown has:
  - valid frontmatter, including a `title` and the `generated` stamp in D1 key order;
  - a "Current sub-processors" section and a "Past sub-processors" section;
  - one table row per record, with name, processing, location, responsibilities, since and until.
- **Current versus past** needs a reference date. Follow ADR-0087 D5 for what the date may be. **Never** use the raw build clock in a way that breaks byte-stable builds (C-005).
  - If the ADR allows no date, list records **with** `until` under "Past or ending", with their dates, and records without `until` under "Current or announced". Name this choice in the test.
- **Drift.**
  - `--check` passes on a fresh page.
  - It fails after the catalog changes.
  - It fails after a hand edit to the page body (the `content_hash` mismatch).
  - Each failure is paired with the passing positive control.
- The not-legal-advice callout appears at the top of the page.

### T031 — Generator (`src/scripts/generate-subprocessor-page.mjs`)

- Its CLI matches the sibling generators: `--root`, `--docs`, `--out` and `--check`.
- It reads the catalog through `checkSubprocessorCatalog` and exits 1 on problems.
- It writes the page with the stamp, using `makeStamp` and `serializeStamp`, never hand-built.
- It registers the producer in `producers.mjs`.
- **No catalog** means no page, and the generator removes a previously generated page it owns. Follow the ownership rules.

### T032 — The drift gate

- Add a `validate:subprocessor-page` script to the root `package.json` that runs the generator with `--check` for the example. This is a small out-of-map edit; note it.
- Or hook into an aggregate check, if ADR-0087 defines one.
- Generate `example/docs/reference/subprocessors.md`, or wherever the example's sections place reference pages; check `example/docs/_meta/sections.yaml`.

### T033 — Feed items link to the page

- Pass `itemLink` (WP04's option) from the integration when the page exists, so feed items point at the page and not at the API.
- This is a small out-of-map edit to `src/lib/integrations/subprocessors.ts`. Note the rationale.
- Update the T025 assertion if it checked the link.

### T034 — Docs

- Extend the WP06 guide section with how to generate and check the page. That is an out-of-map edit to `docs/guides/consumer-setup.md`; note it.
- Add `docs/changelog/unreleased/403-subprocessor-page.md`.

## Definition of Done

- PR #445 was merged before the claim, and the evidence is in the hand-off.
- The page is generated with the ADR-0087 stamp, and `--check` catches both catalog drift and hand edits.
- The current/past split complies with ADR-0087 D5 and does not break byte-stable builds.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Reviewer guidance

- Verify the gate evidence first.
- Check the stamp is written only through the shared serialiser.
- Check the out-of-map edits are minimal and each has a rationale.
