# Contract: Markua footnote feature (markua-footnotes)

## Modules
- `src/lib/remark/markua-footnotes.ts` — default-exported unified/remark plugin; imports
  `isPresentationFile` only here (never in `.internal`); reads nothing from Astro beyond the vfile.
- `src/lib/remark/markua-footnotes.internal.ts` — pure normaliser; MUST NOT import
  remark/unified/mdast/vfile/Astro. Exhaustively unit-tested.

## Registration
- Inside `markuaIntegration()` bare `remarkPlugins` array in `src/lib/config.ts`, gated by the
  `markua` preset, ordered **after `markuaNormalise`, before `markuaAttributes`**.
- Deck scoping v1: `guardDeck(markuaFootnotes)` (deck-agnostic no-op), mirroring `markuaTocDemote`.
  (Decision may flip to internal `isPresentationFile` delegation per the D1 spike.)

## Behaviour
1. When `markua` ON: `[^^N_M]` references and `[^^N_M]:` definitions render as GFM footnotes
   (reference link + back-linked notes list).
2. When `markua` OFF: output byte-identical to pre-mission (pass not registered / inert) — NFR-001.
3. On `kind: Presentation`: no-op.
4. Unmatched marker or definition: degrade to harmless inline text; build never throws (totality).
5. No new npm dependency (reuses remark-gfm 4.0.1).

## Gates
- `src/tests/markua-footnotes.test.ts`: end-to-end (`unified().use(remarkParse).use(remarkGfm).use(plugin)`)
  + pure `.internal` unit cases (matched/unmatched/nested/deck).
- `assert:markua` (`src/scripts/assert-markua-builds.mjs`): add a footnote assertion to the
  showcase fixture build + confirm preset-OFF portability leaves footnote source as literal.
- ADR `docs/adr/00NN-markua-footnotes.md`: records the reuse-remark-gfm decision, the double-caret
  normalisation rule, deck scoping, and degradation rules (FR-013).

## Spike precondition (D1)
Before implementation, confirm whether GFM already pairs `[^^0_1]`/`[^^0_1]:` (label `^0_1`) with
Markua OFF. The spike outcome sets whether the pass rewrites the double caret or only guarantees
pairing/ordering while preserving OFF byte-identity.
