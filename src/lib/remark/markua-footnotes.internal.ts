/**
 * Pure, Astro-free footnote-identifier normaliser for the Markua footnote
 * feature (ADR-0041, contract `footnote-feature.md`; FR-004/FR-013/NFR-001).
 *
 * `markua-footnotes.ts` (the remark plugin) hands this module the parsed mdast
 * tree; nothing here imports remark, unified, mdast, hast, or vfile, so the
 * vitest matrix exercises the load-bearing correctness — caret stripping,
 * matched-pair symmetry, unmatched/plain totality — with zero build runtime. A
 * minimal structural node shape ({@link FootnoteNode}) is declared locally, the
 * same way `markua-normalise.internal.ts` keeps itself parser-agnostic.
 *
 * ## Why identifier-level, not text-level (the T001 spike outcome)
 * The source manuscript writes footnotes with a DOUBLE caret — a reference
 * `[^^N_M]` and a definition `[^^N_M]:`. The de-risking spike (T001, recorded in
 * ADR-0041) proved that Astro/Starlight's built-in `remark-gfm` (4.0.1) ALREADY
 * pairs `[^^0_1]` with `[^^0_1]:` at parse time, producing a `footnoteReference`
 * / `footnoteDefinition` pair whose `identifier` is the literal `^0_1` (the inner
 * caret is kept as part of the label). GFM renders the reference as an ordinal
 * (`1`, `2`, …), so no caret leaks into VISIBLE text — but the retained caret
 * URL-encodes into every fragment id/href (`#user-content-fn-%5E0_1`), an ugly,
 * non-portable anchor.
 *
 * So the normalisation is: strip ONE leading `^` from the `identifier` (and the
 * mirrored `label`) of every footnote node. Because GFM has already turned the
 * double caret into footnote NODES, the work is a symmetric identifier rewrite,
 * NOT a fragile text/regex rewrite — which sidesteps every inline-code / fenced-
 * code corruption risk for free: GFM never creates a footnote node from `[^^x]`
 * inside a code span (it stays `inlineCode`), and an unmatched reference with no
 * definition stays literal `text`; neither is a footnote node, so neither is
 * touched here.
 *
 * ## Totality (contract Behaviour 4; NFR-002 spirit)
 * Every input is valid output and nothing throws:
 *   - matched pair `[^^0_1]` / `[^^0_1]:` → both sides lose the SAME leading
 *     caret, so they stay paired (`0_1`) and GFM's ordinal ordering is preserved;
 *   - a plain GFM footnote `[^x]` has identifier `x` (no leading caret) → the
 *     strip is a no-op, so pre-existing plain footnotes are left byte-identical;
 *   - an unmatched reference is not a footnote node (GFM left it as text) → never
 *     seen here → stays harmless literal text;
 *   - an unmatched definition IS a `footnoteDefinition` node but renders nowhere
 *     (remark-rehype drops unused definitions), so normalising its dead
 *     identifier is harmless.
 */

/**
 * The minimal structural shape this module walks. Any parsed mdast node is
 * assignable to it; the module reads only `type`, `children`, and the two
 * footnote identifier fields, and mutates only the latter two in place.
 */
export interface FootnoteNode {
  type: string;
  identifier?: unknown;
  label?: unknown;
  children?: FootnoteNode[];
  [key: string]: unknown;
}

/** The two node types GFM emits for a footnote pair. */
const FOOTNOTE_NODE_TYPES: ReadonlySet<string> = new Set([
  'footnoteReference',
  'footnoteDefinition',
]);

/**
 * Strip a SINGLE leading `^` from a footnote identifier/label. Total: a value
 * with no leading caret (a plain GFM `[^x]`, or an already-normalised id) is
 * returned unchanged, and only ONE caret is removed so a deliberately
 * caret-prefixed inner label keeps its remaining carets.
 */
export function stripLeadingCaret(value: string): string {
  return value.startsWith('^') ? value.slice(1) : value;
}

/** Whether a node is a GFM footnote reference or definition. */
export function isFootnoteNode(node: FootnoteNode): boolean {
  return FOOTNOTE_NODE_TYPES.has(node.type);
}

/**
 * Normalise ONE footnote node's `identifier` and `label` in place, stripping a
 * leading caret from each string field. Returns `true` when it changed the node,
 * `false` otherwise (a plain footnote, or a non-footnote node). Never throws.
 */
export function normaliseFootnoteNode(node: FootnoteNode): boolean {
  if (!isFootnoteNode(node)) return false;
  let changed = false;
  if (typeof node.identifier === 'string') {
    const next = stripLeadingCaret(node.identifier);
    if (next !== node.identifier) {
      node.identifier = next;
      changed = true;
    }
  }
  if (typeof node.label === 'string') {
    const next = stripLeadingCaret(node.label);
    if (next !== node.label) {
      node.label = next;
      changed = true;
    }
  }
  return changed;
}

/**
 * Walk a parsed tree depth-first and normalise every footnote node's identifier
 * in place. Returns the count of nodes changed (0 ⇒ the tree carried no
 * double-caret footnote, so it is left byte-identical). Pure over structure,
 * hand-rolled walk (no `unist-util-visit`), never throws.
 */
export function normaliseFootnotes(tree: FootnoteNode): number {
  let count = 0;
  const walk = (node: FootnoteNode): void => {
    if (normaliseFootnoteNode(node)) count += 1;
    const children = node.children;
    if (Array.isArray(children)) {
      for (const child of children) walk(child);
    }
  };
  walk(tree);
  return count;
}
