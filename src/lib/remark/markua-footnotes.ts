/**
 * `markuaFootnotes` — the Markua footnote pass (ADR-0041, contract
 * `footnote-feature.md`; FR-004/FR-013, NFR-001). It makes the source's
 * double-caret footnotes — a reference `[^^N_M]` and a definition `[^^N_M]:` —
 * render as clean GFM footnotes so a Markua-enabled page reads correctly and the
 * capability is reusable.
 *
 * ## Reuse remark-gfm, no new dependency (DIRECTIVE_051)
 * Astro/Starlight's built-in `remark-gfm` (4.0.1, already in `package.json`)
 * runs BEFORE every doc-kitty remark pass and already carries footnote support.
 * The T001 de-risking spike (recorded in ADR-0041) proved GFM ALREADY pairs
 * `[^^0_1]` with `[^^0_1]:` at parse time into a `footnoteReference` /
 * `footnoteDefinition` pair — but keeps the inner caret in the `identifier`
 * (`^0_1`), which URL-encodes into every fragment id/href as `%5E` (an ugly,
 * non-portable anchor). So this pass does NOT re-implement footnotes: it
 * NORMALISES the already-parsed footnote nodes, stripping the leading caret from
 * each identifier so anchors read `#user-content-fn-0_1`. All recognition/logic
 * lives in the pure, Astro-free `markua-footnotes.internal.ts` (vitest-covered);
 * this half only walks the mdast root Astro hands it.
 *
 * ## Byte-identical when the preset is off (NFR-001)
 * This plugin is registered ONLY inside `markuaIntegration()` (`config.ts`),
 * which Astro adds only when the `markua` preset is active. With `DK_MARKUA=off`
 * the integration — and therefore this pass — is never registered, so the pass
 * is inert and preset-off output is byte-identical to pre-mission. (GFM still
 * renders the footnotes preset-off, with the retained `%5E` ids, exactly as it
 * did before this feature — this pass changes nothing when off.)
 *
 * ## Deck scoping v1 (guardDeck, mirroring `markuaTocDemote`)
 * Footnotes are deck-agnostic in v1: slides get no footnote-apparatus grooming.
 * The pass is registered `guardDeck(markuaFootnotes)`, so it no-ops on a
 * `kind: Presentation` page (the deck keeps GFM's default footnote rendering).
 * This mirrors the sole other deck-agnostic Markua pass, `markuaTocDemote`, and
 * keeps deck-awareness a registration-site concern — this transformer never
 * imports a deck concept, matching the `deck-guard` boundary rule.
 *
 * ## Totality (contract Behaviour 4)
 * An unmatched reference is left by GFM as literal text (never a footnote node),
 * an unmatched definition renders nowhere, a `[^^…]` inside inline/fenced code
 * stays code, and a plain `[^x]` has no leading caret — so the normaliser touches
 * only genuine double-caret footnote nodes, never throws, and a page with no
 * such footnote is returned unchanged.
 */
import { normaliseFootnotes, type FootnoteNode } from './markua-footnotes.internal.js';

/** An mdast `root` whose footnote-node identifiers this plugin normalises. */
interface MdastRoot extends FootnoteNode {
  type: 'root';
  children: FootnoteNode[];
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast (after `remark-gfm` has created the footnote nodes); assignable to
 * Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function markuaFootnotes() {
  return function transformer(tree: MdastRoot): void {
    if (!tree || !Array.isArray(tree.children)) return; // defensive: byte-identical no-op
    normaliseFootnotes(tree);
  };
}
