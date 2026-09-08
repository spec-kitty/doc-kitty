---
work_package_id: WP04
title: Book I chapters 1–5
dependencies:
- WP03
requirement_refs:
- FR-001
- FR-005
- FR-006
- FR-007
- FR-011
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T015
- T016
- T017
- T018
- T019
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: example/docs/rhetoric/book-one/
create_intent:
- example/docs/rhetoric/book-one/chapter-01.md
- example/docs/rhetoric/book-one/chapter-02.md
- example/docs/rhetoric/book-one/chapter-03.md
- example/docs/rhetoric/book-one/chapter-04.md
- example/docs/rhetoric/book-one/chapter-05.md
execution_mode: code_change
owned_files:
- example/docs/rhetoric/book-one/chapter-01.md
- example/docs/rhetoric/book-one/chapter-02.md
- example/docs/rhetoric/book-one/chapter-03.md
- example/docs/rhetoric/book-one/chapter-04.md
- example/docs/rhetoric/book-one/chapter-05.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load scribe-sally` (role: implementer). Apply identity/boundaries + charter directives (`spec-kitty charter context --action implement --json`); state which applied. Neutral, faithful conversion — never invent or alter the source text.

## Objective

Convert Book I chapters 1–5 of Aristotle's *Rhetoric* into doc-kitty showcase pages. Read `../spec.md` (FR-001/005/006/007/011), `../contracts/conversion-transform.md` (**authoritative rules**), `../research.md` (D2, D5), and each source file under `../source-vendor/`. Chapters convert independently ([P]).

### Conversion rules (summary — full contract in contracts/conversion-transform.md)
- **KEEP & render**: `[^^N_M]` footnotes (WP01 feature), `{blurb, icon: pencil}` editor's-note callouts, `{#id}` explicit anchors.
- **STRIP** (no artifact): `{pagebreak}`, `{mainmatter}`, `{copyright}`.
- **DEGRADE** `[#t](#anchor)` → `[<readable title>](/rhetoric/<path>/#anchor)` (root-absolute; title from the target heading; cross-page targets like `#book-one-glossary` → `/glossary/rhetoric/`, and `#types-of-rhetoric`/`#intent`/`#motive`/`#epideictic-rethoric` → the owning chapter page + anchor).
- **NORMALISE** callout `class: info`→`information`; bare `icon: pencil` → mapped form (FR-011).
- **FRONTMATTER** each page: `title` (from the source `# Chapter N: …` heading), `kind: Explanation`, `type: Reference`, `doc_status: active`, `updated`, `description` (≤180 chars), `tags: [rhetoric, book-one]`, `glossary_context: rhetoric`, `external_references: [{type: biblio, id: freese-rhetoric-1926}]`, optional `audience: [{profile: rhetoric-student, guidance_text: ...}]`. One body `#` H1.
- Add `<!-- markdownlint-disable -->` after frontmatter. Add a one-line CC-BY-SA notice linking `/rhetoric/about-and-license/` (once per page, at the foot).
- Preserve curly quotes, em-dashes, and Greek backtick spans without mojibake. Footnote **definitions** (`[^^N_M]: …`) stay at the end of the page; remove the `{pagebreak}` that preceded them.

## Subtasks

### T015 — Convert chapter 1
Convert `../source-vendor/book1chapter1.md` → `example/docs/rhetoric/book-one/chapter-01.md` per `../contracts/conversion-transform.md`. Prev/next nav links root-absolute. `mark-status` when done.

### T016 — Convert chapter 2
Convert `../source-vendor/book1chapter2.md` → `example/docs/rhetoric/book-one/chapter-02.md` per `../contracts/conversion-transform.md`. Prev/next nav links root-absolute. `mark-status` when done.

### T017 — Convert chapter 3
Convert `../source-vendor/book1chapter3.md` → `example/docs/rhetoric/book-one/chapter-03.md` per `../contracts/conversion-transform.md`. Prev/next nav links root-absolute. `mark-status` when done.

### T018 — Convert chapter 4
Convert `../source-vendor/book1chapter4.md` → `example/docs/rhetoric/book-one/chapter-04.md` per `../contracts/conversion-transform.md`. Prev/next nav links root-absolute. `mark-status` when done.

### T019 — Convert chapter 5
Convert `../source-vendor/book1chapter5.md` → `example/docs/rhetoric/book-one/chapter-05.md` per `../contracts/conversion-transform.md`. Prev/next nav links root-absolute. `mark-status` when done.

## Definition of Done
- Each chapter renders footnotes (refs + notes list), callouts, degraded root-absolute xrefs; **0 literal Markua markers** in built HTML (SC-002); prev/next links resolve.
- `pnpm validate:example`, `pnpm validate:links`, `pnpm validate:catalog` green; `npx markdownlint-cli2` clean on new pages; `vale --minAlertLevel=error` clean.
- `spec-kitty agent tasks mark-status T015 T016 T017 T018 T019 --status done`.

## Risks / reviewer guidance
- Reviewer: spot-check faithfulness vs source (no dropped/added text); confirm no literal `{pagebreak}`/`[^^`/`[#t]` survives render; root-absolute links only; single H1.
- Build from a lane worktree (`pnpm install --offline`, `pnpm clean` first). Footnote rendering depends on WP01 in the base.
