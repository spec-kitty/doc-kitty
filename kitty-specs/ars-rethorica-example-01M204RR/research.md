# Phase 0 Research: Example content from ars-rethorica

Grounded by three read-only investigations of the live repo (pipeline, section/
glossary systems, gate suite) and a source-side census (`research-notes/source-census.md`).

## D1 — Footnote feature mechanism

**Decision**: Ship footnotes as a new opt-in Markua pass `markua-footnotes` that
normalises the source's `[^^N_M]` reference markers and `[^^N_M]:` definitions to
the syntax GFM footnotes consume, letting the already-registered `remark-gfm`
(Astro/Starlight built-in, 4.0.1) render the footnote references and back-linked
notes list. New module pair `src/lib/remark/markua-footnotes.ts` (thin,
remark-facing) + `markua-footnotes.internal.ts` (pure string/AST normaliser, no
remark/unified/Astro imports), matching the shipped `.ts`/`.internal.ts`
convention. Registered inside `markuaIntegration()`'s bare `remarkPlugins` array,
after `markuaNormalise` and before `markuaAttributes`.

**Rationale**: remark-gfm already carries footnote support, so no new dependency
and minimal blast radius (DIRECTIVE_051 clean). The pure `.internal` module keeps
the load-bearing normalisation exhaustively unit-testable.

**MANDATORY DE-RISKING SPIKE (blocks IC-01 design)**: GFM may already parse
`[^^0_1]` as a footnote whose label is `^0_1`, matching its `[^^0_1]:` definition —
in which case footnotes partly render *today* with Markua OFF, and the pass is a
normaliser/cleanup rather than an enabler. Before implementing, build a tiny
fixture containing `[^^0_1]` + `[^^0_1]:` and inspect rendered output in both
`markua` on/off builds. The spike outcome decides:
- If GFM already pairs them → the pass's job is to (a) guarantee correct pairing/
  ordering and (b) keep preset-OFF output *unchanged* (so the pass only acts when
  `markua` is on, preserving NFR-001 byte-identity). Confirm whether OFF output is
  already "correct enough" or shows the raw `^0_1` label.
- If GFM does **not** pair them (double caret breaks the token) → the pass rewrites
  `[^^X]`→`[^X]` so GFM then pairs them.
Either way the pass must be inert on preset-OFF (NFR-001) and no-op on decks.

**Deck scoping**: v1 treats footnotes as deck-agnostic → wrap `guardDeck(markuaFootnotes)`
at the registration site (mirrors `markuaTocDemote`); slides have no footnote
apparatus. Revisit deck footnotes as a follow-up if needed.

**Alternatives considered**: A micromark syntax extension (rejected — heavy,
ADR-0030 reserves option (a) for later); authoring GFM `[^N]` directly in the
converted pages (rejected — the showcase's purpose is to exercise *Markua*
footnote syntax as a first-class feature, per the confirmed decision).

## D2 — Book directives are stripped at conversion, not in the pipeline

**Decision**: Strip `{pagebreak}`, `{mainmatter}`, `{copyright}` during the
conversion transform (IC-02); do not add a pipeline strip pass. Map `{class: part}`
files (BookOne/Two/Three.md) to section **landing** pages rather than emitting the
directive.

**Rationale**: The pipeline already degrades unknown `{...}` lines to literal text
(`markua-attributes` returns null → literal paragraph). So `{pagebreak}` left in a
page would render as the literal string `{pagebreak}` — a visible artifact
violating SC-002. Since conversion is a transform we own, removing these lines at
conversion is simplest and keeps the pipeline unchanged. **This is why no
`strip-directives` pass is in scope** — adding one would be dead weight.

## D3 — Custom section wiring

**Decision**: Create `example/docs/rhetoric/` with `book-one/`, `book-two/`,
`book-three/` subfolders; register a single top-level entry in
`example/docs/_meta/sections.yaml`: `{id: rhetoric, label: Rhetoric, order: <45>,
type: Reference}` (order slotted between guides(40) and presentations(50); final
value chosen at implementation). Book subfolders nest automatically as Starlight
autogenerate sub-groups — no per-book registry entry. Section landings are
hand-authored `index.md` with `kind: Hub`.

**Rationale**: Registry-driven nav (ADR-0029); registering the top-level folder
gives a clean labelled/ordered sidebar group instead of the degraded auto-append.
A brand-new section is ADR-0004 *tolerated* (warns, never fails) — acceptable and
in fact the point of the showcase. `type: Reference` is a canonical DOC_TYPE, so
no custom-type warning; per-book `subtypes` are optional and omitted in v1.

**Open (implementation detail)**: exact `order` integer and whether to set a
section-default `type` vs per-page. Not user-facing; resolved in IC-03.

## D4 — Glossary via Contextive, not in-page definition lists

**Decision**: Convert the source Preamble definition-list Glossary into a new
`rhetoric` context in `example/.contextive/definitions.yaml` (~10 terms:
Deliberative rhetoric, Dialectic, Dicast, Enthymeme, Epideictic rhetoric, Forensic
rhetoric, Induction, Orator, Sophist, Syllogism — with aliases/examples from the
source). The build auto-generates `example/docs/glossary/rhetoric/index.md`
(`kind: Glossary`) — never hand-authored. Set `glossary_context: rhetoric` on the
rhetoric pages so terms autolink; the Preamble page links to the generated
glossary rather than embedding the list.

**Rationale**: The M4 glossary is the native, dogfooded mechanism and sidesteps
the out-of-scope Markua definition-list gap (C-004). The generated glossary page
counts as one published page (ratchet).

## D5 — Auto-title cross-reference degradation

**Decision**: Degrade the 5 `[#t](#anchor)` references to standard Markdown links
with explicit readable text pointing at **root-absolute** in-site routes with the
target anchor, e.g. `[the types of rhetoric](/rhetoric/book-one/chapter-01/#types-of-rhetoric)`.
Anchors are `{#id}`-set today and remain as heading/span ids via the supported ids
pass + `rehype-slug`. Cross-page targets (e.g. the glossary anchor) resolve to the
generated glossary page or the owning chapter.

**Rationale**: `[#t]` auto-title resolution is out of scope (FR-007, degrade-only).
Root-absolute links are the only content link form the link-integrity gate
accepts; the page portion is verified, and cross-page `#fragment` existence is
explicitly out of the broken-link gate's scope (so a minor anchor drift won't fail
CI, but we still target real ids). Link text is derived from the target heading
title at conversion.

## D6 — Attribution & licensing (no new frontmatter field)

**Decision**: (a) Author `example/docs/rhetoric/about-and-license.md` stating
CC-BY-SA-4.0 and crediting J.H. Freese (1926) / Perseus Project–Tufts (public
domain source, orig CC-BY-SA-3.0) and the Stijn Dejongh CC-BY-SA-4.0 revamp;
(b) add `bibliography.yaml` records for the source translation and cite them from
converted pages via `external_references: [{type: biblio, id: <key>}]`; (c) put a
one-line CC-BY-SA notice linking the about/license page in each chapter body (or
the book/hub landing).

**Rationale**: There is **no per-page license frontmatter field or component**, and
adding one would be an ADR-0009 field-addition — out of scope for a content
showcase. Body prose + `external_references` + bibliography is the native,
convention-consistent path and satisfies share-alike attribution (C-002, FR-010).

## D7 — Gate bookkeeping

**Decisions**:
- **Ratchet**: bump `EXPECTED_INDEX_ENTRY_COUNT` and `EXPECTED_SITEMAP_URL_COUNT`
  (both `31`) by the exact count of **non-draft** pages added (Intro, Preamble, 15
  chapters, rhetoric hub, 3 book landings, about/license, generated glossary page,
  each active persona). Drafts move neither. Final delta computed against the built
  tree in IC-07.
- **markdownlint**: Markua-bearing pages (footnotes, `{blurb}`, `{#id}`) get an
  inline `<!-- markdownlint-disable -->` after frontmatter, mirroring the existing
  `markua-showcase.md` fixture; `.markdownlintignore` is not honored under CI's
  explicit globs. Mind MD022/MD032 (blank lines) and MD025 (single body H1 — the
  frontmatter title is exempt; each page has exactly one `#` H1).
- **Vale**: keep prose free of error-level Hedges; run locally before pushing.
- **a11y**: opt ~2 representative rhetoric routes into `AXE_PAGES`
  (`tests/a11y/routes.ts`) — e.g. a chapter with footnotes + a `{blurb}` callout,
  and the rhetoric hub — so NFR-002 is meaningfully asserted (both light+dark). New
  pages are otherwise not scanned.
- **Links**: root-absolute routes only in all content; no `.md`-relative/bare-
  relative links (fail-closed).
- **Diagrams**: none planned in the showcase → no `DK_DIAGRAM_BUILD_RENDER` needed
  for correctness; still build clean under the standard example build.

## Supply-chain & adversarial evidence

- **Supply-chain (DIRECTIVE_051)**: No dependency added, upgraded, or removed. The
  footnote feature reuses `remark-gfm` 4.0.1 already in `package.json`/lockfile. No
  lifecycle-script surface change. **Disposition: no-op / not applicable.**
- **Adversarial evidence**: The load-bearing risk is the D1 footnote-mechanism
  assumption; it is explicitly gated behind a de-risking spike before
  implementation rather than asserted. A post-tasks adversarial squad (per the
  launch directive) will challenge the plan/tasks; contested findings will be
  recorded here as accepted / changed / deferred_with_rationale. No contested
  finding is silently dropped.
