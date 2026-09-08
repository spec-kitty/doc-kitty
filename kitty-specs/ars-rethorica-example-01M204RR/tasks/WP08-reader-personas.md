---
work_package_id: WP08
title: Reader personas (audience surface)
dependencies:
- WP02
requirement_refs:
- FR-009
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T032
- T033
history:
- created by /spec-kitty.tasks
agent_profile: analyst-annie
authoritative_surface: example/docs/context/audience/
create_intent:
- example/docs/context/audience/rhetoric-student.md
- example/docs/context/audience/rhetoric-practitioner.md
execution_mode: code_change
owned_files:
- example/docs/context/audience/rhetoric-student.md
- example/docs/context/audience/rhetoric-practitioner.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load analyst-annie` (role: implementer). Apply identity/boundaries + charter directives (`spec-kitty charter context --action implement --json`); state which applied.

## Objective

The source manuscript carries no persona/audience metadata, so **construct** plausible reader personas from the intro's stated intent (modern readers of communication/persuasion/argument; classics-curious generalists) and wire them through the example's existing audience surface. Read `../spec.md` (FR-009), `../research.md`, and the existing shape at `example/docs/context/audience/example-persona.md` (kind: Persona, role/goals/responsibilities/hero_image) and `README.md` (the Audiences hub). Do NOT modify existing files there — new files only.

### T032 — `rhetoric-student.md`
`type: Context`, `kind: Persona`, `doc_status: active`, fields `role`, `goals` (list), `responsibilities` (list). A student of communication/rhetoric/argument who wants the classical source made navigable and glossed for a modern reader. Optional `hero_image` only if an asset exists — otherwise omit (alt is required when present). Body prose describing the reader (searchable content region). ≤180-char description, single H1.

### T033 — `rhetoric-practitioner.md`
Same shape. A working communicator/speechwriter/debater who mines Aristotle for persuasion technique and wants cross-referenced, footnoted primary text. Distinct role/goals from the student.

Note: the `audience:` references on the rhetoric content pages (WP03–06) point at `profile: rhetoric-student` (a soft, non-fatal reference — order-independent). These two slugs are the pre-agreed targets.

## Definition of Done
- Two active `kind: Persona` pages with role/goals/responsibilities; they appear on the Audiences hub; an `audience` reference from a rhetoric page resolves to one of them.
- `pnpm validate:example` green; build renders the persona pages.
- `spec-kitty agent tasks mark-status T032 T033 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm personas are concrete and distinct (not generic filler), `doc_status: active`, and that existing audience files are untouched. Each active persona counts as one published page for WP09's ratchet.
