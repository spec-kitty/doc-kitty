/**
 * `diagramFigure` — the rehype half of the diagram metadata → accessible-figure
 * seam (ADR-0023 decision 2, contract `diagram-meta-transform`; FR-004/013).
 * It wraps every `<pre class="mermaid">` produced by the fence transform in an
 * accessible `<figure>` + `<figcaption>` built from the caption fields the
 * remark pass ({@link ../remark/diagram-meta}) stashed on `file.data.dkDiagrams`:
 *
 * ```html
 * <figure class="dk-diagram" role="group">
 *   <pre class="mermaid">…source (accTitle/accDescr injected)…</pre>
 *   <figcaption class="dk-diagram__caption">
 *     <span class="dk-diagram__desc">{description}</span>
 *     <span class="dk-diagram__attr"><a href="{source}">{attribution}</a></span>
 *   </figcaption>
 * </figure>
 * ```
 *
 * - `attribution` links to `source` when a source is present, otherwise it is
 *   plain text.
 * - The `<figcaption>` is OMITTED entirely when there is neither a description
 *   nor an attribution — an empty-safe figure (a diagram with no metadata still
 *   gets wrapped, just without a caption).
 * - The inner SVG is NOT `aria-hidden`: the figure lives in the searchable
 *   content region and the SVG names itself via the injected `accTitle`/
 *   `accDescr` (Mermaid emits `<title>`/`<desc>` + aria on render).
 *
 * Cross-pass key: `<pre class="mermaid">` elements are matched to stashed
 * caption fields by DOCUMENT ORDER — the Nth mermaid pre reads
 * `file.data.dkDiagrams[N]` — mirroring the order the remark pass appended them.
 *
 * Standalone: registered by nobody in this work package (WP03 wires it), so the
 * built corpus is byte-identical until then.
 */
import type { FigureFields } from '../remark/diagram-meta.internal.js';

/** Minimal structural hast node — enough to find/replace mermaid `<pre>`s. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/** The subset of the rehype VFile this plugin reads. */
interface DiagramVFile {
  data?: {
    dkDiagrams?: FigureFields[];
    [key: string]: unknown;
  };
}

/** hast text node. */
const text = (value: string): HastNode => ({ type: 'text', value });

/** hast element node with the given tag, class, and children. */
function element(
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastNode {
  return { type: 'element', tagName, properties, children };
}

/** Read the hast `className` (array or string form) as a list of tokens. */
function classList(node: HastNode): string[] {
  const raw = node.properties?.className;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
  return [];
}

/** True for a `<pre class="mermaid">` element (the fence-transform output). */
function isMermaidPre(node: HastNode): boolean {
  return (
    node.type === 'element' &&
    node.tagName === 'pre' &&
    classList(node).includes('mermaid')
  );
}

/** Build the `<figcaption>` children (description span, then attribution span),
 * or `null` when neither field is present (so the caller omits the caption). */
function captionChildren(fields: FigureFields): HastNode[] | null {
  const children: HastNode[] = [];

  if (fields.description !== undefined) {
    children.push(
      element('span', { className: ['dk-diagram__desc'] }, [text(fields.description)]),
    );
  }

  if (fields.attribution !== undefined) {
    const attrInner: HastNode =
      fields.source !== undefined
        ? element('a', { href: fields.source }, [text(fields.attribution)])
        : text(fields.attribution);
    children.push(element('span', { className: ['dk-diagram__attr'] }, [attrInner]));
  }

  return children.length > 0 ? children : null;
}

/** Wrap a mermaid `<pre>` in the accessible `<figure>` (+ optional caption). */
function buildFigure(pre: HastNode, fields: FigureFields): HastNode {
  const children: HastNode[] = [pre];
  const caption = captionChildren(fields);
  if (caption) {
    children.push(element('figcaption', { className: ['dk-diagram__caption'] }, caption));
  }
  return element(
    'figure',
    { className: ['dk-diagram'], role: 'group' },
    children,
  );
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[], Root>`).
 */
export default function diagramFigure() {
  return function transformer(tree: HastNode, file: DiagramVFile): void {
    const diagrams = file.data?.dkDiagrams ?? [];
    let index = 0;

    const walk = (node: HastNode): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      for (let k = 0; k < children.length; k++) {
        const child = children[k];
        if (isMermaidPre(child)) {
          children[k] = buildFigure(child, diagrams[index] ?? {});
          index++;
          // Do not descend into the wrapped `<pre>` (it is a leaf we just moved).
        } else {
          walk(child);
        }
      }
    };

    walk(tree);
  };
}
