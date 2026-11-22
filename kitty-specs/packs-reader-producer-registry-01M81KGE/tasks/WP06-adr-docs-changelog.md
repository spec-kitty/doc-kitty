---
work_package_id: WP06
title: ADR-0083, docs and changelog
dependencies:
- WP01
- WP05
requirement_refs:
- FR-018
- C-003
- C-004
planning_base_branch: feat/330-packs-reader-producer-registry
merge_target_branch: feat/330-packs-reader-producer-registry
branch_strategy: Planning artifacts for this mission were generated on feat/330-packs-reader-producer-registry. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/330-packs-reader-producer-registry unless the human explicitly redirects the landing branch.
subtasks:
- T024
- T025
- T026
- T027
agent: claude
history:
- timestamp: '2026-11-22T12:40:00Z'
  agent: planner-priti
  action: Prompt generated via /spec-kitty.tasks
agent_profile: comms-cleo
authoritative_surface: docs/adr/
create_intent:
- docs/adr/0083-producer-registry-and-ownership-scopes.md
- docs/changelog/unreleased/330-packs-reader-producer-registry.md
execution_mode: planning_artifact
owned_files:
- docs/adr/0083-producer-registry-and-ownership-scopes.md
- docs/architecture/packs.md
- docs/architecture/generators.md
- docs/guides/consumer-setup.md
- docs/changelog/unreleased/330-packs-reader-producer-registry.md
role: communicator
---

# WP06 — ADR-0083, docs and changelog

## ⚡ Do This First: Load Agent Profile

Load the assigned profile before reading anything else: run `/spk-charter-profile-load comms-cleo`.

## Objective

Record the producer registry as a decision (FR-018, C-003) and bring the living
docs in line with what WP01 to WP05 built (charter: living documentation;
AGENTS.md: changelog fragment, ADR file without the index row).

## Branch strategy

Planning branch and final merge target: `feat/330-packs-reader-producer-registry`.
Run `spec-kitty agent action implement WP06 --agent claude --mission packs-reader-producer-registry-01M81KGE`.

## Writing rules (charter documentation policy)

Every page keeps `title`, `description` (50 to 180 characters), `doc_status`,
`updated`, `type`, `kind`. Sentence-case headings, one idea per sentence, no
em-dash runs, no puffery, no hedging, landings teach then link. Run
`pnpm validate:docs`, `pnpm validate:links`, `pnpm validate:adr-ids`,
`pnpm validate:changelog` and `pnpm exec markdownlint-cli2` on touched files.

## Subtasks

### T024 — ADR-0083 [P]

`docs/adr/0083-producer-registry-and-ownership-scopes.md`, status **Proposed**
(the operator accepts ADRs). Before writing, recheck the next free number on
`main` and open PRs (#405 holds 0081, #413 holds 0082); renumber if taken. Do
not edit `docs/adr/README.md`. Follow `docs/adr/template.md`.

Content:
- Context: ADR-0079 D6 asked for one registry; the gates hard-coded Gherkin and
  glossary; #338 (packs), #359 (generated-section contract) and #413 (missions,
  Ops) need to register producers.
- Decisions: (1) one registry in `src/lib/producers.mjs`; (2) two roles,
  ownership and provenance-only (scaffold); (3) two scope types, `section` (with
  an optional section and kinds) and `directories` (directories within one
  section); (4) recognition is stamp **and** scope, except the glossary, which
  keeps its path-and-kind rule (decision D2); (5) the frontmatter gate treats an
  unset section scope as any one top-level section, and callers that know the
  configured section narrow it with `producerScopes` (decision D1); (6) a
  generator's output scan is `scanProducerOutput`, generic over the producer;
  (7) how a later producer registers: an entry, its scope and its regenerate hint.
- Consequences, alternatives (keep per-producer special cases; evaluate site
  config in the gate; a stamp-only rule).
- `related`: `adr/0079-…`, `adr/0046-gherkin-feature-pages`, `architecture/generators`, `architecture/packs`.

### T025 — Architecture docs [P]

- `docs/architecture/packs.md`: replace the "Nothing on it is implemented yet"
  callout with what is built (reader, snapshot, classifier, option, CLI) and what
  is not yet (pages, #338). Update the Contract pinning section: tag
  `contract-packs-v0.1.0-rc.1`, commit `69ec326`, conformance cases copied as
  data (charter #559), `pnpm packs:sync-contract --ref`. Update `updated`.
- `docs/architecture/generators.md`: a section on the producer registry and
  ownership scopes, linking ADR-0083.

### T026 — Consumer setup [P]

`docs/guides/consumer-setup.md`: an "Optional: Kitty packs" section (after
"Optional: Gherkin feature pages" is fine) covering `packs.charterLock` and
`packs.contract` (what each does, the `[dk-packs]` errors, that pack pages
arrive with #338), and `dockitty-read-pack <dir> --json` with an example and the
exit codes.

### T027 — Changelog fragment [P]

`docs/changelog/unreleased/330-packs-reader-producer-registry.md`, following
`docs/changelog/unreleased/README.md` (`section: Added`). One entry: the pack
reader with the vendored packs contract, the `packs.charterLock` and
`packs.contract` options, `dockitty-read-pack`, and the producer registry.

## Definition of Done

- All doc gates above pass; the ADR number is free on `main` and open PRs.
