/**
 * `diagramMeta` — the remark half of the diagram metadata → accessible-figure
 * seam (ADR-0023 decision 2/3, contract `diagram-meta-transform`;
 * FR-003/004/005/013). For every `lang === 'mermaid'` code node it:
 *   1. parses the leading `%% key: value` block (closed set) and strips it,
 *   2. injects Mermaid `accTitle`/`accDescr` after the diagram-type declaration
 *      line so the client-rendered SVG names itself, and
 *   3. stashes the caption fields on `file.data.dkDiagrams` for the rehype pass
 *      ({@link ../rehype/diagram-figure} builds the `<figure>` from them).
 *
 * All string work is delegated to `diagram-meta.internal.ts` (Astro-free, unit
 * tested); this wrapper only walks the tree and moves data onto `file.data`.
 *
 * Cross-pass key: diagrams are stashed as an ARRAY in document order. The remark
 * pass appends one entry per mermaid fence as it visits them top-to-bottom; the
 * rehype pass counts `<pre class="mermaid">` in the same document order and
 * reads the matching index. Document order is the only key both mdast (which has
 * positions) and hast (which does not, after the fence transform) can compute,
 * so it is the stable correlation between the two passes.
 *
 * Standalone: this plugin is registered by nobody in this work package — WP03
 * wires it (and the rehype figure) into the markdown pipeline. Until then it is
 * never invoked, so the built documentation corpus is byte-identical.
 */
import {
  parseMeta,
  injectAccStatements,
  figureFields,
  type FigureFields,
} from './diagram-meta.internal.js';

/** Minimal structural mdast node — enough to find mermaid fences and recurse. */
interface MdastNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MdastNode[];
  [key: string]: unknown;
}

/** The subset of the remark VFile this plugin reads and writes. */
interface DiagramVFile {
  data?: {
    dkDiagrams?: FigureFields[];
    [key: string]: unknown;
  };
}

/** Visit every `lang === 'mermaid'` code node, in document order. */
function eachMermaid(node: MdastNode, visit: (node: MdastNode) => void): void {
  if (node.type === 'code' && node.lang === 'mermaid') {
    visit(node);
    return; // code nodes are leaves — no children to descend into.
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) eachMermaid(child, visit);
  }
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function diagramMeta() {
  return function transformer(tree: MdastNode, file: DiagramVFile): void {
    const diagrams: FigureFields[] = [];

    eachMermaid(tree, (node) => {
      const { fields, strippedCode } = parseMeta(node.value ?? '');
      node.value = injectAccStatements(strippedCode, fields);
      diagrams.push(figureFields(fields));
    });

    if (diagrams.length > 0) {
      file.data = file.data ?? {};
      file.data.dkDiagrams = diagrams;
    }
  };
}
