/**
 * `deckSplit` — the single, guarded remark plugin that turns a
 * `kind: Presentation` deck's mdast into slide `<section>`s at build time
 * (ADR-0012, FR-001). It is registered GLOBALLY in the Astro markdown chain
 * (config.ts, after remark-gfm), so it runs for every Markdown page — the
 * frontmatter guard below is what keeps it a strict no-op everywhere else.
 *
 * Scope guard (C-005, load-bearing): the transform early-returns unless
 * `file.data.astro.frontmatter.kind === 'Presentation'`. Off a deck the tree is
 * untouched — a body `---` stays a `thematicBreak` and renders `<hr>`, comment
 * directives stay comments, `Note:` stays prose — so the entire documentation
 * corpus is byte-identical after this wiring lands.
 *
 * All grouping/directive/note logic lives in `deck-split.internal.ts` as pure,
 * Astro-free functions (unit-tested). This wrapper only applies the guard,
 * swaps in the produced children, and re-emits the pure pass's warnings through
 * `file.message` so unknown directives surface in the build log without failing
 * it (FR-008).
 *
 * Ordering: Astro strips frontmatter in the content layer BEFORE remark runs, so
 * a body `---` reaches this plugin as a `thematicBreak`, never confused with the
 * frontmatter fence. Registering after remark-gfm means headings and thematic
 * breaks are already parsed; running before `mdast-util-to-hast` means the
 * emitted `data.hName`/`data.hProperties` are honoured into real `<section>`s.
 */
import { splitDeck, type DeckFrontmatter, type MdRoot } from './deck-split.internal.js';

/** The subset of the remark VFile this plugin reads (Astro injects `data.astro`). */
interface DeckVFile {
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
  message(reason: string): unknown;
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function deckSplit() {
  return function transformer(tree: MdRoot, file: DeckVFile): void {
    const frontmatter = file.data?.astro?.frontmatter;
    // The whole plugin is a no-op off a deck — the scope guard (C-005).
    if (!frontmatter || frontmatter.kind !== 'Presentation') return;

    const { children, warnings } = splitDeck(tree, frontmatter as DeckFrontmatter);
    for (const warning of warnings) file.message(warning.message);
    tree.children = children as unknown as MdRoot['children'];
  };
}
