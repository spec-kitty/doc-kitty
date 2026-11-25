---
work_package_id: WP06
title: Example content, assertions, guide and changelog
dependencies:
- WP01
- WP05
requirement_refs:
- FR-015
- FR-016
- C-001
- C-002
- NFR-004
planning_base_branch: feat/403-subprocessor-catalog
merge_target_branch: feat/403-subprocessor-catalog
branch_strategy: Planning artifacts for this mission were generated on feat/403-subprocessor-catalog. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/403-subprocessor-catalog unless the human explicitly redirects the landing branch.
base_branch: kitty/mission-subprocessor-catalog-01M84X07
base_commit: fc55d2b7e6d54f2684e377269e752abfc4e94ff1
created_at: '2026-11-25T11:16:45.193456+00:00'
subtasks:
- T024
- T025
- T026
- T027
- T028
agent: claude
history:
- timestamp: '2026-11-23T22:40:00Z'
  agent: claude
  action: Prompt generated via /spec-kitty.tasks
agent_profile: node-norris
authoritative_surface: example/docs/_meta/
create_intent:
- example/docs/_meta/subprocessors.yaml
- docs/changelog/unreleased/403-subprocessor-catalog.md
execution_mode: code_change
owned_files:
- example/docs/_meta/subprocessors.yaml
- src/scripts/assert-build-artifacts.mjs
- docs/guides/consumer-setup.md
- docs/changelog/unreleased/403-subprocessor-catalog.md
role: implementer
tags: []
tracker_refs: []
---

# Work Package Prompt: WP06 - Example content, assertions, guide and changelog

## ⚡ Do This First: Load Agent Profile

- Use the `/spk-charter-profile-load` skill with `node-norris`, or run `spec-kitty agent profile show node-norris`.
- Then load the action context: `spec-kitty charter context --action implement --json`.

## Objective

Show the feature end to end on the example site, pin it with build-artifact
assertions, and document it, ⚖ limits included.

Requirements: FR-015, FR-016, C-001, C-002, NFR-004. Depends on: WP01 (the ADR to link) and WP05.

## Branch strategy

- The planning branch and final merge target are both `feat/403-subprocessor-catalog`.
- Run `spec-kitty agent action implement WP06 --agent claude --mission subprocessor-catalog-01M84X07`.

## Context

- `kitty-specs/subprocessor-catalog-01M84X07/quickstart.md` is the reader journey the guide section follows.
- `docs/guides/consumer-setup.md` has a `## Measures catalog` section near line 864. The new `## Sub-processor catalog` section goes **right after it**, in the same voice.
- `src/scripts/assert-build-artifacts.mjs` is the example-build assertion script. Find how it locates `dist/` and reports failures (`fail(...)`), and add a block in the same style.
- For the changelog fragment format, copy `docs/changelog/unreleased/406-tom-classification.md` (frontmatter and headings) and run `pnpm validate:changelog`.
- **C-001.** Only the example site gets records, and they must be **obviously fictional**: invented names, and `.example` domains (RFC 2606).

## Subtasks

### T024 — `example/docs/_meta/subprocessors.yaml`

Add three fictional records:

- **`northwind-hosting`**:
  - current (`since: 2024-03-01`);
  - `location: [NL, DE]` plus a `location_note`;
  - `tom_classification` with two **real** default measure ids, one carrying a `note`; check `src/lib/measures-default.mjs`;
  - `external_references` with one inline `{url: https://northwind-hosting.example/dpa, title: …}`.
- **`fabrikam-mail`**:
  - future (`since: 2027-06-01`), the advance-notice example;
  - `location: [IE]`.
- **`contoso-analytics`**:
  - past (`since: 2023-01-10`, `until: 2025-09-30`);
  - `location: [US]`;
  - `location_note: Processing under the provider's transfer terms.` Keep it neutral, with no legal claim.

Put a header comment in the file:

```yaml
# Fictional example records. Not real companies or agreements.
```

Also name ADR-0086 and the guide section in the comment.

Do **not** add a bibliography entry; use an inline reference. That keeps
`example/docs/_meta/bibliography.yaml` out of this WP.

Run `pnpm validate:catalog`. The summary must report 3 sub-processor records.

### T025 — Artifact assertions

In `assert-build-artifacts.mjs`, add a block that checks the example `dist/`:

- **`api/subprocessors.json`.**
  - It exists and parses.
  - `count === 3`, and the ids appear in file order.
  - `changes` has 4 entries. The first is `fabrikam-mail` added on 2027-06-01, which is newest first.
- **`subprocessors.xml`.**
  - It exists.
  - It has exactly 4 `<item>`s.
  - It contains `Added: Fabrikam` (or the exact name) and `Removed: Contoso`.
  - It has no `lastBuildDate`.
- **`api/index.json`.** `_links.subprocessors.href` and `_links.subprocessorFeed.href` are present and base-aware.
- **Base-aware feed URLs.** If `findBaselessFeedUrls` in `assert-no-broken-links.mjs` only scans known feeds, check whether it needs to learn `subprocessors.xml`. If it does, that is a small out-of-map edit: note it in the hand-off with a one-line rationale.

### T026 — Guide section (`docs/guides/consumer-setup.md`)

Add `## Sub-processor catalog` after `## Measures catalog`. The section covers:

1. A not-legal-advice callout in the repo's callout syntax. ⚖ Counsel reviews the field set before anyone calls it DPA-ready.
2. What the file is, where it lives, and that it is optional. With no file there are no outputs.
3. A field table: the data model, with required fields marked.
4. A minimal YAML example, using the fictional `northwind-hosting`.
5. What the build publishes: the two URLs and the agent-index links.
6. **Announcing changes.** A future `since`/`until` puts the item in the feed on the next build. **⚖ Whether the feed satisfies your contract's notice terms is for your counsel.**
7. **Ending a provider.** Set `until`; don't delete the record.
8. Validation: `pnpm validate:catalog`, and that the build fails with one aggregate error.
9. Limits:
   - country codes are upper-case assigned alpha-2 only, so `EU` and `UK` are rejected (write `GB`);
   - no transfer-mechanism field yet;
   - a new file needs a dev-server restart.
10. A link to ADR-0086.

Run `pnpm validate:docs && pnpm validate:links`.

### T027 — Changelog fragment (`docs/changelog/unreleased/403-subprocessor-catalog.md`)

Cover:
- the catalog, the gate and build validation, `api/subprocessors.json`, `subprocessors.xml` and the index links;
- that the toolkit ships no records;
- a ⚖ note;
- that the generated list page follows in a later change.

Run `pnpm validate:changelog`.

### T028 — Full verification

```bash
pnpm build && node src/scripts/assert-build-artifacts.mjs   # or the repo's documented invocation
pnpm validate && pnpm validate:catalog && pnpm validate:links && pnpm validate:changelog
pnpm test
```

Fix anything red. Report the counts.

## Definition of Done

- The example site publishes three fictional records, four changes and both links. `assert-build-artifacts.mjs` pins them.
- The guide section exists, with the ⚖ notes and the ADR link.
- The changelog fragment validates.
- Full `pnpm test` passes (both tiers and mcp). Report the counts in the hand-off.

## Reviewer guidance

- Check that nothing looks like a real company or a real agreement.
- Check the guide makes no claim that the feed is legal notice.
- Check the assertions would fail if the feed or the API were missing. Remove the YAML locally once to prove it.
