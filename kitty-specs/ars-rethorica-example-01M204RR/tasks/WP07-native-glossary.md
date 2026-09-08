---
work_package_id: WP07
title: Native glossary (rhetoric context)
dependencies:
- WP02
requirement_refs:
- FR-008
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T030
- T031
history:
- created by /spec-kitty.tasks
agent_profile: lexical-larry
authoritative_surface: example/.contextive/
create_intent: []
execution_mode: code_change
owned_files:
- example/.contextive/definitions.yaml
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load lexical-larry` (role: implementer). Apply identity/boundaries + charter directives (`spec-kitty charter context --action implement --json`); state which applied. Larry's authority is domain vocabulary — this is a terminology WP.

## Objective

Convert the source Preamble definition-list Glossary into a **native doc-kitty glossary** context (dogfoods M4; sidesteps the out-of-scope Markua definition-list gap). Read `../spec.md` (FR-008), `../research.md` (D4), the source `../source-vendor/BookOnePreamble.md` (the `{#book-one-glossary}` section), and the existing `example/.contextive/definitions.yaml` for shape.

Facts: the glossary source of truth is `example/.contextive/definitions.yaml` (Contextive format: `contexts[] → {name, domainVisionStatement?, terms[] {name, definition, aliases?, examples?, meta?}}`). The build **auto-generates** `example/docs/glossary/rhetoric/index.md` — do NOT hand-author that page. Content pages set `glossary_context: rhetoric` (done in WP03–06) so terms autolink.

### T030 — Add the `rhetoric` context to `definitions.yaml`
Append a `rhetoric` context (`domainVisionStatement`: a one-line framing, e.g. "The art of finding the available means of persuasion.") with ~10 terms drawn from the Preamble def-list, faithful to the source definitions: **Deliberative rhetoric, Dialectic, Dicast, Enthymeme, Epideictic rhetoric, Forensic rhetoric, Induction, Orator, Sophist, Syllogism**. Carry the source's parenthetical synonyms into `aliases` and the illustrative sentences (e.g. the syllogism examples) into `examples`. Keep definitions accurate to the source; do not editorialise. `meta` may cite the source where useful (URLs are scheme-checked, build-fatal if malformed).

### T031 — Verify generation + autolink
Build from a lane worktree (`pnpm install --offline`, `pnpm clean`, `pnpm --filter example build`). Confirm: `example/docs/glossary/rhetoric/index.md` is generated with all terms; the glossary appears under the Reference nav group; a rhetoric page carrying `glossary_context: rhetoric` autolinks at least one term (spot-check a chapter or the preamble once those land). Run `pnpm validate:example`. Note: this generated page counts as **one published page** for WP09's ratchet.

## Definition of Done
- `rhetoric` context added with the ~10 terms (aliases/examples where the source has them); YAML valid; build generates the glossary page; terms autolink on a `glossary_context: rhetoric` page.
- `spec-kitty agent tasks mark-status T030 T031 --status done`.

## Risks / reviewer guidance
- Reviewer (terminology lens): confirm definitions are faithful to the source and internally consistent; no drift from the ubiquitous rhetoric vocabulary; aliases don't collide across terms.
- Do not hand-edit the generated glossary page; only the YAML is the source of truth.
