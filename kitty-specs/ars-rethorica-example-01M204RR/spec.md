# Mission Specification: Example content from ars-rethorica

**Mission Branch**: `feat/ars-rethorica-example`
**Created**: 2026-09-08
**Status**: Draft
**Input**: Convert the open-license CC-BY-SA-4.0 Markua book `stijn-dejongh/ars-rethorica` (a revamp of the public-domain Freese translation of Aristotle's *Rhetoric*) into a realistic Markua-authored content showcase nested inside the existing `example/` docsite. Docsite/presentations content only — not a book/manuscript pipeline.

## Overview

The example docsite currently ships synthetic, self-referential content (the
convention dogfood). A prospective adopter browsing it sees the toolkit's
conventions but never sees the toolkit render *real writing*. This mission adds a
genuine content showcase — Book I of Aristotle's *Rhetoric*, converted from the
open-license `ars-rethorica` Markua manuscript — **nested inside the same example
site**, so an adopter can see custom sections, footnotes, callouts, a native
glossary, reader personas, and proper open-content attribution all working on
prose that was written to be read, not to demonstrate a feature.

The flagship convention-dogfood content stays canonical and untouched; the
rhetoric material is an additive showcase area carrying its own CC-BY-SA-4.0
license, kept separate from doc-kitty's MIT code license.

One reusable toolkit capability falls out of the conversion: **footnotes** become
a first-class, opt-in Markua-subset feature (the sixth), because the source prose
is footnote-dense and literal `[^^0_1]` markers would render as broken text.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Adopter reads a real, richly-formatted showcase page (Priority: P1)

A prospective doc-kitty adopter opens the example site and navigates into the
Rhetoric showcase. They land on Book I, Chapter 1 and read real translated prose
with scholarly footnotes rendered as proper footnote references and a
back-linked notes list, an editor's-note callout with an icon, and in-page
cross-references — none of it placeholder text.

**Why this priority**: This is the whole point of the mission — realistic content
rendered through the real pipeline. If only this ships, the site already
demonstrates the toolkit on genuine writing (an MVP showcase).

**Independent Test**: Build the example site and open a converted Book-I chapter;
confirm footnote references render as links to a back-linked notes section, the
`{blurb, icon: pencil}` editor's note renders as a callout with an icon, and no
literal Markua markers (`[^^`, `{blurb`, `{/blurb}`, `{pagebreak}`) appear in the
rendered HTML.

**Acceptance Scenarios**:

1. **Given** a converted chapter that uses `[^^0_1]` footnote markers and matching `[^^0_1]:` definitions, **When** the example site is built, **Then** each marker renders as a footnote reference linking to a numbered, back-linked notes list at the end of the page, and no literal `[^^` text remains.
2. **Given** a chapter containing a `{blurb, icon: pencil}` … `{/blurb}` editor's note, **When** the page renders, **Then** it appears as a doc-kitty callout with the mapped icon and an accessible name, identical to the shipped Markua callout behaviour.
3. **Given** a chapter that uses a book directive such as `{pagebreak}` or `{mainmatter}`, **When** the page renders, **Then** the directive is stripped (produces no visible artifact and no broken markup).

### User Story 2 - Adopter navigates the custom three-book section structure (Priority: P1)

The adopter uses the site navigation to move between the Introduction, the Book I
chapters, and the Book II / Book III landing pages, seeing that doc-kitty renders
a coherent, navigable documentation tree whose sections are *not* the canonical
twelve — a worked example of the ADR-0004 tolerated custom-section path.

**Why this priority**: The showcase's structural claim (custom sections render and
navigate cleanly) is as load-bearing as the page-level content claim; the two
together are the demonstrable value.

**Independent Test**: Build the site and confirm the Rhetoric showcase presents its
own section landing(s) with the three books, that Book I lists its chapters in
reading order, and that Book II and III each present a landing page, with all
in-site navigation links resolving.

**Acceptance Scenarios**:

1. **Given** the converted showcase, **When** the site builds, **Then** it exposes a Rhetoric showcase area with the three books as a custom section set distinct from the flagship example's canonical sections.
2. **Given** the reading order defined by the source `Book.md`, **When** the adopter views Book I, **Then** the fifteen chapters appear in that order with the Introduction and Preamble ahead of them.
3. **Given** Book II and Book III are not converted in full, **When** the adopter navigates to them, **Then** each shows a landing page that names the book and states the chapters are out of scope for this showcase (no dead links, no empty section).

### User Story 3 - Adopter sees who the content is for and where it came from (Priority: P2)

The adopter opens the showcase's audience/persona pages and its attribution, and
understands both the intended readers (constructed personas) and the open-content
provenance: the public-domain Freese translation via the Perseus Project, and the
CC-BY-SA-4.0 revamp.

**Why this priority**: Attribution is a licensing obligation (share-alike), and the
personas demonstrate the M3 audience surface on real content; important but the
page/section rendering (P1) is the core showcase.

**Independent Test**: Build the site and confirm the showcase carries at least one
active reader persona wired through the example audience surface, and a visible
attribution notice naming both the public-domain source translation and the
CC-BY-SA-4.0 revamp with the license.

**Acceptance Scenarios**:

1. **Given** the source manuscript carries no persona metadata, **When** the showcase ships, **Then** it includes one or more constructed reader personas as `kind: Persona` pages with role/goals/responsibilities, resolvable from the showcase's `audience` references.
2. **Given** the content is a CC-BY-SA-4.0 derivative of a public-domain translation, **When** any showcase page is read, **Then** the reader can reach an attribution/license statement crediting J.H. Freese (1926) / the Perseus Project–Tufts and the Stijn Dejongh CC-BY-SA-4.0 revamp, and stating the CC-BY-SA-4.0 license (distinct from doc-kitty's MIT code license).

### User Story 4 - Adopter uses the converted glossary (Priority: P2)

The adopter encounters an unfamiliar rhetoric term and finds it defined in the
showcase's glossary, which is rendered through doc-kitty's native glossary system
(not as a Markua definition list), dogfooding the M4 glossary feature on real
domain vocabulary.

**Why this priority**: Demonstrates the native glossary on genuine terms and
sidesteps the out-of-scope Markua definition-list gap; valuable but secondary to
the core reading experience.

**Independent Test**: Build the site and confirm the source Preamble Glossary terms
(e.g. Dialectic, Dicast, Enthymeme, Syllogism) exist as native glossary entries
surfaced through doc-kitty's glossary feature.

**Acceptance Scenarios**:

1. **Given** the source Preamble contains a definition-list Glossary, **When** the showcase ships, **Then** those terms are represented as native doc-kitty glossary entries rather than raw Markua definition lists.

### User Story 5 - Author uses footnotes on any page (Priority: P2)

An author (of any doc-kitty site, not just this showcase) writes Markua footnotes
(`[^^1]` markers with `[^^1]:` definitions) on an ordinary page with the Markua
preset enabled, and they render as proper footnotes — footnotes are now a
first-class opt-in Markua feature.

**Why this priority**: Turns a showcase necessity into a reusable, dogfooded toolkit
capability consistent with doc-kitty's "features are general" doctrine.

**Independent Test**: On a non-showcase test fixture page with the Markua preset on,
author `[^^1]` + `[^^1]:` and confirm rendered footnote reference + back-linked
definition; with the preset off (base CommonMark/GFM), confirm byte-identical
behaviour to before this mission (footnote pass is inert).

**Acceptance Scenarios**:

1. **Given** the Markua preset is enabled, **When** a page uses `[^^N]` markers and `[^^N]:` definitions, **Then** they render as standard footnote references and a back-linked notes list.
2. **Given** the Markua preset is disabled, **When** any page builds, **Then** rendered output is byte-identical to pre-mission behaviour (the footnote pass is a no-op).
3. **Given** a deck page (`kind: Presentation`), **When** it builds, **Then** the footnote pass no-ops on it (consistent with the other Markua passes' deck scoping).

### Edge Cases

- A footnote marker with no matching definition, or a definition with no marker: render the resolvable side and leave the unmatched side as harmless text; never break the build.
- An auto-title cross-reference `[#t](#anchor)` whose target is in a chapter not converted in this scope: the degraded plain-anchor link must have readable link text and must not produce an in-site broken link (target within scope) — cross-book targets resolve to the book landing or are given non-linking readable text.
- A callout using the source's `class: info` (vs. the map's `information`) or bare `icon: pencil` (vs. `fa-pencil`): normalise so it renders correctly rather than dropping.
- Inline code containing `>` or Markua-looking markers inside chapter prose (e.g. Greek in backticks) must not be misinterpreted as a callout/aside marker.
- Adding published showcase pages changes expected page/sitemap/index counts: the build-artifact assertion counts must be updated in lockstep (published-page ratchet).
- Content with straight vs. curly quotes and long em-dashes must survive conversion without mojibake.

## Requirements *(mandatory)*

### Functional Requirements

| ID | Title | User Story | Priority | Status |
|----|-------|------------|----------|--------|
| FR-001 | Book I content converted to docsite pages | As an adopter, I want the Introduction, Preamble, and all 15 Book-I chapters rendered as showcase pages so I can read real content through the toolkit. | High | Open |
| FR-002 | Nested showcase, flagship untouched | As an adopter, I want the Rhetoric material to live inside the existing example site as an additive showcase so the canonical convention example stays intact. | High | Open |
| FR-003 | Custom three-book section set | As an adopter, I want the three books presented as a custom section set (with Book II/III landings) so I see the tolerated custom-section path working and navigable. | High | Open |
| FR-004 | Footnotes as a first-class Markua feature | As an author, I want `[^^N]` footnotes to render as real footnotes on any Markua-enabled page so the showcase's notes read correctly and the capability is reusable. | High | Open |
| FR-005 | Editor's-note callouts with icon render | As an adopter, I want the `{blurb, icon: pencil}` editor's notes to render as doc-kitty callouts with icons so the annotation layer is visible and accessible. | High | Open |
| FR-006 | Book directives stripped | As an adopter, I want book-only directives (`{pagebreak}`, `{mainmatter}`, `{copyright}`, `{class: part}`) to degrade cleanly so no raw markup leaks into pages. | High | Open |
| FR-007 | Auto-title cross-references degrade to readable links | As an adopter, I want `[#t](#anchor)` cross-references converted to plain anchor links with readable text so in-content navigation works without the unsupported auto-title syntax. | Medium | Open |
| FR-008 | Glossary via native glossary system | As an adopter, I want the source Glossary terms rendered as native doc-kitty glossary entries so the M4 glossary is dogfooded on real vocabulary. | Medium | Open |
| FR-009 | Constructed reader personas wired to audience surface | As an adopter, I want constructed reader personas on the example audience surface so `audience` references in the showcase resolve to concrete reader pages. | Medium | Open |
| FR-010 | CC-BY-SA-4.0 attribution and license present | As an adopter (and to satisfy share-alike), I want a visible attribution/license notice crediting the public-domain source translation and the CC-BY-SA-4.0 revamp so provenance and license are clear. | High | Open |
| FR-011 | Callout class/icon aliases normalised | As an adopter, I want source aliases (`class: info`, bare `icon: pencil`) normalised so callouts render rather than silently drop. | Medium | Open |
| FR-012 | Feature page & roadmap updated on ship | As a maintainer, I want the feature page `doc_status` and the roadmap MoSCoW row updated when the showcase ships so project docs reflect reality. | Medium | Open |
| FR-013 | Footnote feature documented via ADR | As a maintainer, I want the footnote feature and its degradation rules captured in a light ADR so the decision and block-detection rules are traceable. | Medium | Open |

### Non-Functional Requirements

| ID | Title | Requirement | Category | Priority | Status |
|----|-------|-------------|----------|----------|--------|
| NFR-001 | Additive, byte-neutral when Markua off | With the Markua preset disabled, built output is byte-identical to pre-mission output (0 changed bytes) across the example build. | Compatibility | High | Open |
| NFR-002 | Accessibility clean | All new/converted showcase pages pass the project axe/a11y gate with 0 violations, including callout accessible names and footnote link semantics. | Accessibility | High | Open |
| NFR-003 | No broken links | The showcase introduces 0 broken internal links as measured by the project link-integrity gate (fail-closed). | Reliability | High | Open |
| NFR-004 | Authoring lint clean | New authored Markdown/Markua pages pass `markdownlint-cli2` and Vale with 0 errors (the doc-sanity gate CI runs). | Quality | High | Open |
| NFR-005 | Build & assertion gates green | Full gate suite (unit tests, example build, `assert:artifacts`, `assert:markua`, `validate:*`, `test:a11y`) passes; published-page ratchet counts updated so `assert:artifacts` matches actual page/sitemap/index totals. | Reliability | High | Open |
| NFR-006 | Deterministic output | Repeated builds of the showcase produce identical page/sitemap/feed ordering (no nondeterministic drift), consistent with the project's determinism gates. | Reliability | Medium | Open |

### Constraints

| ID | Title | Constraint | Category | Priority | Status |
|----|-------|------------|----------|----------|--------|
| C-001 | Docsite/presentations only — no book pipeline | The mission renders docsite (and, where relevant, presentation) content only; it does NOT build a book/manuscript/document pipeline (that competes with Leanpub and is explicitly out). | Technical | High | Open |
| C-002 | Share-alike licensing | Converted pages are a CC-BY-SA-4.0 derivative and must carry that license and attribute both the public-domain Freese/Perseus source and the Dejongh revamp; kept separate from doc-kitty's MIT code license. | Regulatory | High | Open |
| C-003 | Scope = Book I complete | Convert Introduction + Preamble/Glossary + all 15 Book-I chapters + Book II/III landing pages only; the remaining Book II/III chapters are out of scope for this mission. | Business | High | Open |
| C-004 | Markua stretch split fixed | Footnotes extended (first-class); def-list Glossary → native glossary; `[#t]` xrefs degraded; book directives stripped. Markua definition lists remain out of the subset. | Technical | High | Open |
| C-005 | Orchestrator owns commits; fresh subagents | All git commits are made by the orchestrator; sub-artifact drafting uses fresh subagents, never `subagent_type: fork`; CLI/governance commits squashed into one `docs(mission)` commit before rebase-merge. | Process | Medium | Open |

### Key Entities

- **Showcase page**: a converted docsite page derived from one source chapter/section, carrying doc-kitty frontmatter (title, kind, section/audience metadata) and Markua-rich body.
- **Book / Section**: one of the three books of *Rhetoric*; a custom section grouping under ADR-0004; Book I is fully populated, Book II/III are landing-only.
- **Footnote**: a Markua `[^^N]` reference + `[^^N]:` definition pair, rendered as a linked footnote reference and a back-linked notes entry.
- **Reader persona**: a constructed `kind: Persona` page (role, goals, responsibilities) representing an intended showcase reader, resolvable from `audience` references.
- **Glossary term**: a rhetoric term (e.g. Dialectic, Enthymeme) represented as a native doc-kitty glossary entry.
- **Attribution notice**: the license/credit statement (CC-BY-SA-4.0; Freese/Perseus + Dejongh revamp).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The example site builds with the showcase present and 0 build errors, exposing the Introduction, Preamble, and all 15 Book-I chapters plus Book II/III landings (≥18 showcase pages).
- **SC-002**: 0 literal Markua markers (`[^^`, `{blurb`, `{/blurb}`, `{pagebreak}`, `{mainmatter}`, `{class: part}`) appear in any rendered showcase HTML.
- **SC-003**: With the Markua preset disabled, the example build output is byte-identical to pre-mission output (0 changed bytes).
- **SC-004**: 0 accessibility violations and 0 broken internal links across the showcase, per the project a11y and link-integrity gates.
- **SC-005**: 0 `markdownlint-cli2` and 0 Vale errors on the new authored pages.
- **SC-006**: Every source Preamble Glossary term appears as a native glossary entry, and at least one active reader persona resolves from the showcase's audience references.
- **SC-007**: Every showcase page is reachable from a visible attribution/license notice naming both the public-domain source and the CC-BY-SA-4.0 revamp.

## Domain Language *(canonical terms)*

- **Showcase** (canonical) — the nested Rhetoric content area inside the example site. Avoid "the book", "the manuscript", "the second example" (there is one example site; this is an area within it).
- **Book I / II / III** — the three custom sections of *Rhetoric*. Avoid "part" (the source's `{class: part}` term maps to a doc-kitty section here).
- **Footnote feature** — the first-class opt-in Markua footnote capability. Avoid "endnote".
- **Native glossary** — doc-kitty's M4 glossary system. Avoid "definition list" (the source construct being converted away from).
- **Degrade / strip** — degrade = convert to a working readable fallback (`[#t]` xrefs); strip = remove with no artifact (book directives).
- **Revamp** — the Stijn Dejongh CC-BY-SA-4.0 edition. **Source translation** — the public-domain J.H. Freese (1926) translation via the Perseus Project.

## Assumptions

- The showcase lives under a dedicated tree inside `example/docs/` (e.g. `example/docs/rhetoric/`) with its own section set; exact path/slugs are an implementation detail resolved in planning.
- Conversion is a one-time transform producing vendored converted pages committed to the repo (no live submodule); a conversion script may accompany them but the shipped pages are the deliverable.
- Personas are constructed from the source's stated intent (modern readers of communication/persuasion/argument, classics-curious generalists); a small number (≈1–3) suffices to demonstrate the surface.
- `resources/` in the source is empty, so no source images are ported; any imagery is optional and out of the critical path.
- Footnotes are implemented by normalising `[^^N]`→`[^N]` to reuse the existing `remark-gfm` footnote support, keeping the blast radius small; exact wiring is a planning decision.
- The attribution/license may be surfaced via a dedicated showcase license page plus per-page frontmatter/footer reference; exact presentation resolved in planning.

## Out of Scope

- Any book/manuscript/document/PDF/ePub pipeline or Leanpub-style output (C-001).
- Book II and Book III chapter bodies (landing pages only, C-003).
- Markua definition lists, non-image resources (audio/video/math), quizzes, and document-settings blocks as general features.
- Auto-title cross-reference resolution as a real pipeline feature (degraded only, FR-007).
- Rewriting or restructuring the flagship convention-dogfood example content.
