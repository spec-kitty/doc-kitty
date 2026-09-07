/**
 * `plantumlMeta` — the remark half of the PlantUML metadata → accessible-figure
 * seam (#13 WP02, FR-006/007/008; the twin of {@link ./diagram-meta}). For every
 * `lang === 'plantuml'` code node it:
 *   1. parses the leading `' key: value` block (closed set) and strips it,
 *   2. injects the `skinparam` sentinel preamble so the server renders the SVG in
 *      the six `--dk-diagram-*` sentinel colours (surfaced later to the shared
 *      `sentinelThemeRewrite`), and
 *   3. stashes the caption fields + the accessible name/description on
 *      `file.data.dkPlantuml` for the rehype figure wrapper
 *      ({@link ../rehype/diagram-figure} builds the shared `<figure>` from them).
 *
 * All string work is delegated to `plantuml-meta.internal.ts` (Astro-free, unit
 * tested); this wrapper only walks the tree and moves data onto `file.data`.
 *
 * Ordering: this runs BEFORE `astro-plantuml`'s own remark plugin (which replaces
 * the still-`code` plantuml node with the rendered `<figure><svg>…` HTML) — so
 * the skinparam preamble is present when the server renders, and the metadata is
 * stripped before it would otherwise appear as literal comments in the SVG.
 *
 * Cross-pass key: figures are stashed as an ARRAY in document order. The remark
 * pass appends one entry per plantuml fence top-to-bottom; the rehype pass counts
 * the rendered plantuml raw nodes in the same order and reads the matching index
 * — the same document-order correlation the Mermaid twin uses.
 *
 * Build-only: PlantUML has no client renderer, so this plugin is registered ONLY
 * in the BUILD branch (config.ts). In client / diagrams-off mode a ```plantuml
 * fence is left entirely untouched (a plain code block) — C-004.
 */
import {
  parsePlantumlMeta,
  injectSkinparam,
  plantumlFigureFields,
  type DiagramMeta,
  type FigureFields,
} from './plantuml-meta.internal.js';

/** The stash entry the rehype figure wrapper reads per plantuml diagram: the
 * caption fields PLUS the accessible name/description for the injected SVG
 * `<title>`/`<desc>` (the caption `FigureFields` deliberately excludes `title`,
 * which is the accessible NAME only — so it rides here separately). */
export interface PlantumlFigure extends FigureFields {
  /** Accessible name: `title`, or `description` when `title` is absent. */
  name?: string;
  /** Accessible description: `description` when present. */
  desc?: string;
}

/** Minimal structural mdast node — enough to find plantuml fences and recurse. */
interface MdastNode {
  type: string;
  lang?: string | null;
  value?: string;
  children?: MdastNode[];
  [key: string]: unknown;
}

/** The subset of the remark VFile this plugin reads and writes. */
interface PlantumlVFile {
  data?: {
    dkPlantuml?: PlantumlFigure[];
    [key: string]: unknown;
  };
}

/** Project the stash entry from the parsed metadata. */
function toStashEntry(fields: DiagramMeta): PlantumlFigure {
  const entry: PlantumlFigure = plantumlFigureFields(fields);
  const name = fields.title ?? fields.description;
  if (name !== undefined) entry.name = name;
  if (fields.description !== undefined) entry.desc = fields.description;
  return entry;
}

/** Visit every `lang === 'plantuml'` code node, in document order. */
function eachPlantuml(node: MdastNode, visit: (node: MdastNode) => void): void {
  if (node.type === 'code' && node.lang === 'plantuml') {
    visit(node);
    return; // code nodes are leaves — no children to descend into.
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) eachPlantuml(child, visit);
  }
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function plantumlMeta() {
  return function transformer(tree: MdastNode, file: PlantumlVFile): void {
    const figures: PlantumlFigure[] = [];

    eachPlantuml(tree, (node) => {
      const { fields, strippedCode } = parsePlantumlMeta(node.value ?? '');
      node.value = injectSkinparam(strippedCode);
      figures.push(toStashEntry(fields));
    });

    if (figures.length > 0) {
      file.data = file.data ?? {};
      file.data.dkPlantuml = figures;
    }
  };
}
