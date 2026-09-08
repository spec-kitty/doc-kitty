---
title: "ADR-0041: Markua footnotes via remark-gfm identifier normalisation"
description: Render the source's double-caret `[^^N_M]` footnotes as clean GFM footnotes by normalising the id remark-gfm already parsed — no new dependency, inert when Markua is off.
doc_status: active
updated: 2026-09-08
type: ADR
kind: ADR
authors:
  - stijn@sddevelopment.be
related:
  - adr/0030-markua-preprocess-to-directive
  - adr/0038-decks-markua-capable
---

# ADR-0041: Markua footnotes via remark-gfm identifier normalisation

## Status

**Accepted** — 2026-09-08. Delivered by WP01 of the `ars-rethorica-example`
mission (footnotes as a first-class, opt-in Markua feature; FR-004, FR-013,
NFR-001). The source manuscript uses 364 markers / 182 definitions across Book I,
so footnote fidelity is load-bearing for the showcase.

## Context

Markua writes a footnote with a **double caret** — a reference marker `[^^N_M]`
in the prose and a definition line `[^^N_M]:` below (`N_M` is the source's
`section_note` numbering). doc-kitty had no footnote support: the pipeline's
Markua passes (`markua-normalise → markua-attributes → markua-callouts`,
ADR-0030) handle asides/callouts/attribute-lists, not footnotes.

GFM footnotes (`[^id]` / `[^id]:`) are already available: Astro/Starlight's
built-in `remark-gfm` (4.0.1, in `package.json`/lockfile) runs before every
doc-kitty remark pass and carries footnote support. The open question — whether
the double caret would break GFM's footnote token or merely land inside the
identifier — was load-bearing enough to gate the design behind a mandatory
de-risking spike (research D1, plan IC-01).

## The T001 de-risking spike

A scratch fixture (`Text[^^0_1] more.` + `[^^0_1]: A note.`, plus multi-ref,
unmatched, inline-code and plain-`[^x]` variants) was parsed with the pinned
`remark-parse` + `remark-gfm` and rendered to HTML, with the Markua preset on and
off. Findings:

- **GFM ALREADY pairs `[^^0_1]` with `[^^0_1]:`** at parse time, into a
  `footnoteReference` / `footnoteDefinition` pair whose `identifier` is the
  literal `^0_1` (the inner caret is kept as part of the label). Because
  `remark-gfm` runs regardless of the doc-kitty preset, footnotes therefore
  render **in both modes today**, even with `DK_MARKUA=off`.
- The reference renders as an **ordinal** (`1`, `2`, …), so **no caret leaks into
  visible text**. But the retained caret URL-encodes into every fragment
  id/href: `href="#user-content-fn-%5E0_1"`, `id="user-content-fn-%5E0_1"` — an
  ugly, non-portable anchor (`%5E` = `^`).
- An **unmatched reference** (no definition) is left by GFM as **literal text**
  (`See[^^9_9] here.`) — it is never a footnote node. An **orphan definition**
  IS a `footnoteDefinition` node but renders nowhere (remark-rehype drops unused
  definitions). A marker **inside inline code** stays `inlineCode`. A **plain
  `[^x]`** has identifier `x` (no leading caret).

This puts us in research D1's branch (a): GFM already pairs, so the pass's job is
**normalisation**, not enablement — and preset-off output must stay unchanged.

## Decision

1. **Reuse `remark-gfm`; add no dependency (DIRECTIVE_051).** GFM does the
   parsing and rendering. There is **zero** `package.json` / lockfile change.
2. **Normalise at the identifier level, not the text level.** Because GFM has
   already turned the double caret into footnote **nodes**, the new
   `markua-footnotes` pass walks the mdast tree and strips **one leading `^`**
   from the `identifier` (and mirrored `label`) of every `footnoteReference` /
   `footnoteDefinition` node. So `[^^0_1]` → clean id `0_1`
   (`#user-content-fn-0_1`), while pairing and GFM's document-order ordinal
   ordering are preserved (the strip is symmetric across ref and def).
   Operating on the parsed nodes sidesteps every inline-code / fenced-code
   corruption risk for free: GFM never makes a footnote node from a marker inside
   code, so the pass cannot touch it.
3. **`.ts` / `.internal.ts` split (DIRECTIVE_001).** All logic lives in the pure,
   Astro-free `markua-footnotes.internal.ts` (caret strip, node predicate,
   tree walk — no remark/unified/mdast/vfile/Astro imports, exhaustively
   vitest-covered). The thin `markua-footnotes.ts` only walks the mdast root
   Astro hands it, mirroring the sibling `markua-*` passes.
4. **Registration, gated by the preset.** Registered inside `markuaIntegration()`
   in `config.ts`, in the bare `remarkPlugins` array **after `markuaNormalise`,
   before `markuaAttributes`**, still gated by `markuaActive`. `markuaIntegration()`
   is only added when the `markua` preset is on, so **with `DK_MARKUA=off` the
   pass is never registered and is fully inert** — preset-off output is
   byte-identical to pre-mission (NFR-001). (GFM still renders footnotes off, with
   the retained `%5E` ids, exactly as before this feature; this pass changes
   nothing when off.)
5. **Deck scoping v1 — `guardDeck` (mirrors `markuaTocDemote`).** Footnotes are
   deck-agnostic in v1; slides get no footnote-apparatus grooming. The pass is
   registered `guardDeck(markuaFootnotes)`, so it no-ops on a `kind: Presentation`
   page (the deck keeps GFM's default footnote rendering). `guardDeck` chosen over
   an internal `isPresentationFile` delegation because the pass is a pure whole-
   tree normalisation with no deck-specific behaviour to add — matching the one
   other deck-agnostic Markua pass (`markuaTocDemote`, ADR-0038) and keeping deck
   knowledge a registration-site concern, never imported into a Markua transformer.

## The double-caret normalisation rule

For every GFM footnote node, remove exactly **one** leading `^` from its
`identifier` and `label`:

- matched `[^^N_M]` / `[^^N_M]:` → both sides lose the same caret → stay paired as
  `N_M`, ordinal ordering preserved, anchors clean;
- plain GFM `[^x]` → identifier `x`, no leading caret → **no-op** (pre-existing
  plain footnotes untouched);
- unmatched reference → not a footnote node → **untouched**, stays literal text;
- marker inside inline/fenced code → stays code → **untouched**.

## Degradation & totality (Behaviour 4; NFR-002 spirit)

Every input is valid output and nothing throws. Unmatched markers survive as
literal text, orphan definitions render nowhere, and the operation is a pure,
idempotent string strip over the two footnote fields. The `markua-footnotes-
malformed.md` draft fixture (an unmatched reference + an orphan definition) must
build to exit 0 — asserted by `assert:markua`.

## Consequences

### Positive

- Footnotes work as a first-class, reusable Markua feature with **no new
  dependency** and a minimal blast radius. Anchor ids are clean and portable.
- The load-bearing normalisation is a pure, exhaustively unit-tested function;
  the end-to-end test runs the real `remark-gfm` + plugin, so it cannot rot.

### Negative / notes

- Because GFM renders footnotes preset-off too, the preset-off portability
  evidence is **not** "footnote source stays literal" (the pre-spike guess) but
  "footnotes render via GFM with the un-normalised raw-caret id `%5E0_1`" — a
  stronger gate proving the pass is active on and byte-inert off. `assert:markua`
  encodes exactly this in both modes.
- Deck footnotes keep GFM's raw-caret anchors in v1 (deck-agnostic); a follow-up
  can revisit deck footnote grooming if needed.

## Alternatives considered

### Text/regex rewrite `[^^X]` → `[^X]` on paragraph source

The research fallback for the "GFM does not pair" branch. Rejected once the spike
proved GFM already pairs: a text rewrite would have to re-implement code-span and
fence suppression to avoid corrupting `[^^…]` inside code, all of which the
identifier-level approach gets for free from GFM's own parse.

### A micromark syntax extension for Markua footnotes

Heavy, and ADR-0030 reserves the bespoke-syntax option for later. Rejected in
favour of reusing GFM.

### Authoring plain GFM `[^N]` in the converted pages

Rejected — the showcase's purpose is to exercise *Markua* `[^^N_M]` syntax as a
first-class feature, per the confirmed mission decision.

## References

- Mission `ars-rethorica-example`: `spec.md` (FR-004, FR-013, NFR-001),
  `plan.md` (IC-01), `research.md` (D1), `contracts/footnote-feature.md`.
- ADR-0030 (Markua preprocess-to-directive seam); ADR-0038 (decks Markua-capable).
- `src/lib/remark/markua-footnotes.ts`, `src/lib/remark/markua-footnotes.internal.ts`,
  `src/lib/config.ts` (registration), `src/scripts/assert-markua-builds.mjs`
  (FR-004 both-modes gate), `src/tests/markua-footnotes.test.ts`.
