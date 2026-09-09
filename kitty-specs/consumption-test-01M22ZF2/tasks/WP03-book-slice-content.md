---
work_package_id: WP03
title: Representative ars-rethorica book slice + attribution
dependencies:
- WP01
requirement_refs:
- FR-001
- FR-009
planning_base_branch: feat/release-0.1.0-consumption-readiness
merge_target_branch: feat/release-0.1.0-consumption-readiness
branch_strategy: Planning artifacts for this mission were generated on feat/release-0.1.0-consumption-readiness. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/release-0.1.0-consumption-readiness unless the human explicitly redirects the landing branch.
subtasks:
- T012
- T013
- T014
- T015
- T016
history:
- created by /spec-kitty.tasks
agent_profile: implementer-ivan
authoritative_surface: tests/consumption/consumer-fixture/
create_intent:
- tests/consumption/consumer-fixture/.gitignore
- tests/consumption/consumer-fixture/.contextive/definitions.yaml
- tests/consumption/consumer-fixture/docs/_meta/sections.yaml
- tests/consumption/consumer-fixture/docs/_meta/bibliography.yaml
execution_mode: code_change
owned_files:
- tests/consumption/consumer-fixture/docs/rhetoric/**
- tests/consumption/consumer-fixture/docs/context/**
- tests/consumption/consumer-fixture/docs/_meta/**
- tests/consumption/consumer-fixture/.contextive/**
- tests/consumption/consumer-fixture/.gitignore
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Before reading anything else, load your assigned profile via `/ad-hoc-profile-load implementer-ivan` (role: implementer). Apply its identity, boundaries, and charter directives (`spec-kitty charter context --action implement --json`); state which you applied. Relevant: DIRECTIVE_010 (spec fidelity), DIRECTIVE_024 (locality of change), and license discipline (C-005).

## Objective

Populate the fixture with a **representative slice** of the ars-rethorica book that
exercises Markua, the native glossary, personas, and per-kind layouts — with the
CC-BY-SA-4.0 attribution preserved — WITHOUT any PlantUML/Mermaid content (C-003).

Read first: `../research.md` (D6), `../plan.md` (IC-03), `../data-model.md` (E-03). The
source lives at `example/docs/rhetoric/**` and `example/docs/context/audience/**`.

## Subtasks

### T012 — Copy the rhetoric slice
Copy verbatim into `tests/consumption/consumer-fixture/docs/rhetoric/`:
`index.md`, `introduction.md`, `preamble.md`, `about-and-license.md`,
`book-one/index.md`, `book-one/chapter-01.md`, `chapter-02.md`, `chapter-03.md`. These
carry Markua (footnotes/callouts) and `glossary_context: rhetoric`. Do **not** copy
book-two/three or chapters 04–15.

### T013 — Copy personas
Copy `example/docs/context/audience/rhetoric-student.md` and
`rhetoric-practitioner.md` into `docs/context/audience/` (Persona kind → Persona layout).

### T014 — Glossary source + gitignore generated pages
Copy `example/.contextive/definitions.yaml` into the fixture, trimmed to the `rhetoric`
context (drop `shipping`/`hr`). Its presence is the on-switch for the glossary seam;
pages regenerate at build under `docs/glossary/**`. Add a fixture `.gitignore` ignoring
`toolkit.tgz`, `dist/`, `.astro/`, `node_modules/`, and generated `docs/glossary/`
(do NOT hand-edit generated glossary pages).

### T015 — Section registry + bibliography
`docs/_meta/sections.yaml`: register `rhetoric`, `context`, and `glossary` entries
(mirror the example's `rhetoric` entry incl. `type: Reference`). `docs/_meta/bibliography.yaml`:
include the two ids the slice's `external_references` cite (`freese-rhetoric-1926`,
`perseus-project`) — else the catalog/link gates warn.

### T016 — Attribution + supersede seed
Confirm `about-and-license.md` retains the CC-BY-SA-4.0 attribution (Freese 1926 /
Perseus) verbatim. Wire the slice into the sidebar/nav as needed and ensure WP01's seed
`docs/guides/*` placeholders don't collide (they may remain as a small guides section).
`type: Reference` produces a validator **warning**, not a failure — that is expected.

## Definition of Done
- Fixture build renders the rhetoric slice: Hub (rhetoric/book-one index), Explanation
  (chapters), Persona (audience), Glossary (generated) — all via toolkit per-kind layouts.
- Markua footnotes/callouts render in chapters; glossary autolink active (`glossary_context`).
- `about-and-license.md` attribution intact; bibliography ids resolve; generated glossary gitignored.
- No diagram fences anywhere in the slice (grep clean).

## Reviewer guidance
Grep the copied files for ```` ```mermaid ````/plantuml/puml — must be zero (C-003).
Confirm `external_references` ids exist in `_meta/bibliography.yaml`. Confirm attribution present.

## Branch Strategy
Planning branch and merge target: `feat/release-0.1.0-consumption-readiness`. Depends on
WP01. Execution worktrees per `lanes.json`. Implement with `spec-kitty agent action implement WP03 --agent claude`.
