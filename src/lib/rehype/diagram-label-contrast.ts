/**
 * Label contrast on author fills (#369 item 2). A build-time rehype pass that runs
 * AFTER `sentinelThemeRewrite`, so every themed colour is already a
 * `var(--dk-diagram-*)` and every literal colour left in a diagram is one the
 * author wrote.
 *
 * The defect: a node whose fill the author fixed (a Mermaid `classDef`/`style`
 * `fill:`, a PlantUML ArchiMate layer colour) keeps that fill in both page themes,
 * while its label takes the themed `--dk-diagram-node-text`, which turns light in
 * dark mode. Light text on a pale fill vanishes.
 *
 * The rule: where a shape's fill is a literal colour AND its label colour is themed
 * (unset, or a `var(--dk-diagram-*)`), the label is pinned to black or white,
 * whichever contrasts more with that fill. Either choice clears 4.58:1 for any
 * fill, so WCAG 1.4.3 holds in both themes. A label colour the author set is the
 * author's choice and is left alone; a themed fill keeps its themed label.
 *
 * Two shapes reach this pass:
 *   - Mermaid: a hast `<svg>` (inline strategy). `g.node` and `g.cluster` groups.
 *   - PlantUML: one `raw` HTML string from `astro-plantuml`. Each
 *     `<g class="entity" …>…</g>` block is edited in place; every other byte of the
 *     string is left as it was.
 */

/** Minimal structural hast node — enough to walk a diagram SVG. */
export interface LabelHastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: LabelHastNode[];
  value?: string;
}

const BLACK = '#000000';
const WHITE = '#ffffff';

/** Parse `#rgb`, `#rrggbb` or `rgb()/rgba()` to 0–255 channels; anything else
 * (a `var()`, a named colour, `none`, a gradient `url()`) is not a literal fill. */
export function parseLiteralColour(value: string): [number, number, number] | null {
  const v = value.trim().replace(/\s*!important$/i, '');
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(v);
  if (rgb) {
    // A mostly transparent fill shows the page through it: not a fixed backdrop.
    if (rgb[4] !== undefined && parseFloat(rgb[4]) / (rgb[4].endsWith('%') ? 100 : 1) < 0.5) return null;
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  return null;
}

/** WCAG 2.x relative luminance of 0–255 channels. */
function luminance([r, g, b]: readonly number[]): number {
  const ch = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Black or white, whichever contrasts more with `fill` (ties go to black). */
export function labelColourFor(fill: readonly number[]): string {
  const l = luminance(fill);
  const onBlack = (l + 0.05) / 0.05;
  const onWhite = 1.05 / (l + 0.05);
  return onBlack >= onWhite ? BLACK : WHITE;
}

/** The value of one declaration in an inline `style` string, or undefined. */
function styleValue(style: string, prop: string): string | undefined {
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  return re.exec(style)?.[1]?.trim();
}

/** A label colour is themed when unset or drawn from a diagram token. */
const isThemedColour = (value: string | undefined): boolean =>
  value === undefined || /^var\(--dk-diagram-/i.test(value.replace(/\s*!important$/i, ''));

const classes = (node: LabelHastNode): string[] => {
  const c = node.properties?.className;
  return Array.isArray(c) ? c.map(String) : typeof c === 'string' ? c.split(/\s+/) : [];
};
const styleOf = (node: LabelHastNode): string => {
  const s = node.properties?.style;
  return typeof s === 'string' ? s : '';
};
const elementChildren = (node: LabelHastNode): LabelHastNode[] =>
  (node.children ?? []).filter((c) => c.type === 'element');

const SHAPES = new Set(['rect', 'polygon', 'path', 'circle', 'ellipse']);

/** The literal fill of a Mermaid node/cluster's own shape (its first shape child). */
function shapeFill(group: LabelHastNode): [number, number, number] | null {
  for (const child of elementChildren(group)) {
    if (child.tagName === 'g' && classes(child).includes('label')) continue;
    // Some shapes (cylinder, hexagon) are wrapped in a bare `<g>`.
    const shape = child.tagName === 'g' ? elementChildren(child).find((c) => SHAPES.has(c.tagName ?? '')) : child;
    if (!shape || !SHAPES.has(shape.tagName ?? '')) continue;
    const fromStyle = styleValue(styleOf(shape), 'fill');
    const fromAttr = typeof shape.properties?.fill === 'string' ? (shape.properties.fill as string) : undefined;
    const fill = fromStyle ?? fromAttr;
    return fill === undefined ? null : parseLiteralColour(fill);
  }
  return null;
}

/** Every element in `root`, depth-first. Mermaid draws nodes beside clusters (in `g.nodes`,
 * not inside `g.cluster`), so a group's descendants are its own shape and label. */
function* descendants(root: LabelHastNode): Generator<LabelHastNode> {
  for (const child of elementChildren(root)) {
    yield child;
    yield* descendants(child);
  }
}

/** Pin the label colour of one Mermaid node or cluster group, if the rule applies. */
function fixMermaidGroup(group: LabelHastNode): void {
  const fill = shapeFill(group);
  if (!fill) return;
  // The label: a `.nodeLabel` span (node and cluster labels alike) inside the group.
  const all = [...descendants(group)];
  const labels = all.filter((n) => classes(n).includes('nodeLabel'));
  if (labels.length === 0) return;
  // An author colour shows on the label group, its div, or the span itself.
  const carriers = all.filter(
    (n) => (n.tagName === 'g' && classes(n).includes('label')) || n.tagName === 'div' || classes(n).includes('nodeLabel'),
  );
  const authored = carriers.some((n) => !isThemedColour(styleValue(styleOf(n), 'color')));
  if (authored) return;
  const colour = labelColourFor(fill);
  for (const label of labels) {
    const kept = styleOf(label)
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d !== '' && !/^color\s*:/i.test(d));
    kept.push(`color:${colour}!important`);
    label.properties = { ...label.properties, style: kept.join(';') };
  }
}

/** Walk one Mermaid `<svg>` and fix every node and cluster group. */
function fixMermaidSvg(svg: LabelHastNode): void {
  const walk = (node: LabelHastNode): void => {
    if (node.tagName === 'g') {
      const c = classes(node);
      if (c.includes('node') || c.includes('cluster')) fixMermaidGroup(node);
    }
    for (const child of elementChildren(node)) walk(child);
  };
  walk(svg);
}

/** One PlantUML entity block: `<g class="entity" …>…</g>` with no nested group. */
const ENTITY_BLOCK = /<g\b[^>]*\bclass="entity"[^>]*>(?:(?!<g\b)[\s\S])*?<\/g>/g;
const FIRST_SHAPE_FILL = /<(?:rect|polygon|path|ellipse|circle)\b[^>]*?\sfill="([^"]+)"/;
const THEMED_TEXT_FILL = /(<text\b[^>]*?\sfill=")(var\(--dk-diagram-[a-z-]+\))(")/g;

/** Pin the label colour inside each PlantUML entity whose shape has a literal fill. */
export function fixPlantumlRaw(html: string): string {
  return html.replace(ENTITY_BLOCK, (block) => {
    const fillAttr = FIRST_SHAPE_FILL.exec(block)?.[1];
    const fill = fillAttr === undefined ? null : parseLiteralColour(fillAttr);
    if (!fill) return block;
    const colour = labelColourFor(fill);
    return block.replace(THEMED_TEXT_FILL, (_m, pre: string, _v: string, post: string) => `${pre}${colour}${post}`);
  });
}

/**
 * The rehype plugin. Mermaid `<svg>` elements are found by their `aria-roledescription`
 * (Mermaid sets it on every diagram root); PlantUML arrives as a `raw` node whose
 * HTML carries `<g class="entity"`.
 */
export default function diagramLabelContrast() {
  return function transformer(tree: LabelHastNode): void {
    const walk = (node: LabelHastNode): void => {
      if (node.type === 'raw' && typeof node.value === 'string' && node.value.includes('class="entity"')) {
        node.value = fixPlantumlRaw(node.value);
        return;
      }
      if (node.type === 'element' && node.tagName === 'svg' && node.properties?.ariaRoleDescription !== undefined) {
        fixMermaidSvg(node);
        return;
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}
