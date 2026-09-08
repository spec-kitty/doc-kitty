---
work_package_id: WP03
title: Attribution + Introduction + Preamble
dependencies:
- WP02
requirement_refs:
- C-002
- FR-001
- FR-005
- FR-006
- FR-010
- FR-011
planning_base_branch: feat/ars-rethorica-example
merge_target_branch: feat/ars-rethorica-example
branch_strategy: Planning artifacts for this mission were generated on feat/ars-rethorica-example. During /spec-kitty.implement this WP may branch from a dependency-specific base, but completed changes must merge back into feat/ars-rethorica-example unless the human explicitly redirects the landing branch.
subtasks:
- T011
- T012
- T013
- T014
history:
- created by /spec-kitty.tasks
agent_profile: scribe-sally
authoritative_surface: example/docs/rhetoric/
create_intent:
- example/docs/rhetoric/about-and-license.md
- example/docs/rhetoric/introduction.md
- example/docs/rhetoric/preamble.md
execution_mode: code_change
owned_files:
- example/docs/_meta/bibliography.yaml
- example/docs/rhetoric/about-and-license.md
- example/docs/rhetoric/introduction.md
- example/docs/rhetoric/preamble.md
role: implementer
tags: []
tracker_refs: []
---

## ⚡ Do This First: Load Agent Profile

Load `/ad-hoc-profile-load scribe-sally` (role: implementer). Apply identity/boundaries + charter directives (`spec-kitty charter context --action implement --json`); state which applied. Relevant: DIRECTIVE_010 (fidelity), C-002 (share-alike licensing). Neutral, faithful conversion — do not editorialise the source.

## Objective

Author the attribution surface and convert the framing pages (Introduction, Preamble). Read `../spec.md` (FR-005/006/010/011, C-002), `../research.md` (D4, D6), `../contracts/conversion-transform.md`, and the source `../source-vendor/Introduction.md`, `BookOnePreamble.md`, `SOURCE-LICENSE.md`.

Attribution facts (research D6): there is **no per-page license frontmatter field** (adding one needs an ADR — out of scope). Use: a dedicated about/license page + `bibliography.yaml` records cited via `external_references` + a short in-body CC-BY-SA notice. Provenance: J.H. Freese (1926) public-domain translation via Perseus Project / Tufts (orig CC-BY-SA-3.0); Stijn Dejongh (2024) CC-BY-SA-4.0 revamp; notes Cope (1877), Ross (1959).

### T011 — `example/docs/_meta/bibliography.yaml`
Add records (CSL-JSON-lite, matching existing entries' shape): `freese-rhetoric-1926` (the Freese translation, container = Perseus Project, url `http://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0060`, authors Aristotle / trans. J.H. Freese, issued 1926) and a `perseus-project` source record. Validate with `pnpm validate:catalog`.

### T012 — `example/docs/rhetoric/about-and-license.md`
`kind: Explanation`, `type: Reference`, `doc_status: active`. State the CC-BY-SA-4.0 license plainly (distinct from doc-kitty's MIT code license), credit the public-domain Freese/Perseus source and the Dejongh revamp, and explain this is a docsite conversion (not the book). Cite via `external_references: [{type: biblio, id: freese-rhetoric-1926}]`. This is the target of every page's in-body CC-BY-SA link.

### T013 — Convert Introduction → `example/docs/rhetoric/introduction.md`
Convert `../source-vendor/Introduction.md` per the conversion contract:
- STRIP `{copyright}`, `{pagebreak}`.
- KEEP the `{blurb, class: info}` derivative-work notice → normalise `class: info` → `information` (FR-011) so it renders as a doc-kitty callout.
- Frontmatter: `kind: Explanation`, `type: Reference`, `doc_status: active`, `glossary_context: rhetoric`, `external_references: [{type: biblio, id: freese-rhetoric-1926}]`, ≤180-char description, one `#` H1.
- Add `<!-- markdownlint-disable -->` after frontmatter (Markua callout).
- Add a one-line CC-BY-SA notice linking `/rhetoric/about-and-license/`.
- Fix internal references to be root-absolute; external URLs stay as-is.

### T014 — Convert Preamble → `example/docs/rhetoric/preamble.md`
Convert `../source-vendor/BookOnePreamble.md`:
- STRIP `{pagebreak}`; KEEP the `{blurb, icon: pencil}` editor's-note callout(s) (icon maps via the icon-map; verify `pencil` resolves — normalise bare `icon: pencil` to the mapped form if needed, FR-011).
- **Extract the definition-list Glossary** (the `{#book-one-glossary}` section: Deliberative rhetoric, Dialectic, Dicast, Enthymeme, Epideictic rhetoric, Forensic rhetoric, Induction, Orator, Sophist, Syllogism). Do NOT keep the raw def-list. Replace it with a short paragraph linking the generated glossary at `/glossary/rhetoric/` (authored as Contextive data in WP07). Keep the `{#book-one-glossary}` anchor intent by pointing cross-refs there (WP04–06 degrade `[#t](#book-one-glossary)` to the glossary page).
- Same frontmatter conventions as T013 (+ `<!-- markdownlint-disable -->`, CC-BY-SA notice).

## Definition of Done
- bibliography records validate; about/license page states CC-BY-SA-4.0 + dual credit; intro + preamble render with callouts, no literal Markua markers, no def-list glossary.
- `pnpm validate:example`, `pnpm validate:catalog`, `pnpm validate:links` green; build renders the pages.
- `spec-kitty agent tasks mark-status T011 T012 T013 T014 --status done`.

## Risks / reviewer guidance
- Reviewer: confirm attribution credits BOTH the public-domain source and the revamp (C-002), the glossary is extracted (not embedded), callouts render (icon present), and prose is faithful/neutral (no invented content).
- Watch MD022/MD032 blank-line rules around headings/lists; single H1.
