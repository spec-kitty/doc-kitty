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
 * (unset, or a `var(--dk-diagram-*)`), the label is pinned to black or white.
 *   - An opaque fill: whichever contrasts more with it. That choice clears 4.58:1
 *     for any opaque fill, so WCAG 1.4.3 holds in both themes.
 *   - A translucent fill (`rgba()`/`#rrggbbaa` alpha, `fill-opacity`, `opacity`):
 *     the page shows through, so the fill a reader sees depends on the theme and the
 *     brand. Black text is weakest on the darkest possible backdrop and white text on
 *     the lightest, so a colour is chosen only if it clears 4.5:1 with the fill
 *     blended over pure black (for black) or pure white (for white): it then clears
 *     it over any page. When neither does, the label stays themed, following the
 *     page the fill is mostly showing.
 * A label colour the author set is the author's choice and is left alone; a themed
 * fill keeps its themed label.
 *
 * Edges follow the same idea (#369 item 1). An author can fix an edge colour, with
 * an `%%{init}%%` `lineColor` (a class rule for every edge and arrowhead) or a
 * `linkStyle` (one edge, with its own colour-suffixed arrowhead). A dark colour
 * vanishes on the dark page and a pale one on the light page. Each such edge keeps
 * its colour in a theme where it clears 3:1 against every surface it can sit on
 * there; otherwise an id-scoped rule gives it the themed `--dk-diagram-edge` in
 * that theme. Unlike a black or white label, an edge colour is mid-range, so its
 * worst backdrop is not black or white but the surface nearest its own luminance:
 * the check covers the whole range of each theme's surfaces (see
 * {@link EDGE_SURFACES}).
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

/** A literal colour: 0–255 channels and its alpha (0–1). */
export interface LiteralColour {
  rgb: [number, number, number];
  alpha: number;
}

/** An alpha or opacity value (`.5`, `0.5`, `50%`) as 0–1; undefined when absent. */
function parseAlpha(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const v = value.trim().replace(/\s*!important$/i, '');
  const n = parseFloat(v);
  if (Number.isNaN(n)) return undefined;
  return Math.min(1, Math.max(0, v.endsWith('%') ? n / 100 : n));
}

/** Parse `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or `rgb()/rgba()`; anything else
 * (a `var()`, a named colour, `none`, a gradient `url()`) is not a literal fill. */
export function parseLiteralColour(value: string): LiteralColour | null {
  const v = value.trim().replace(/\s*!important$/i, '');
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v);
  if (hex) {
    const h = hex[1].length <= 4 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { rgb: [r, g, b], alpha: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i.exec(v);
  if (rgb) {
    return { rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])], alpha: parseAlpha(rgb[4]) ?? 1 };
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

/** WCAG contrast of black and of white text against a colour of luminance `l`. */
const blackOn = (l: number): number => (l + 0.05) / 0.05;
const whiteOn = (l: number): number => 1.05 / (l + 0.05);

/** `rgb` at `alpha` composited over a backdrop channel value (0 or 255). */
const over = (rgb: readonly number[], alpha: number, backdrop: number): number[] =>
  rgb.map((c) => c * alpha + backdrop * (1 - alpha));

/** The WCAG 1.4.3 minimum for label text. */
const TEXT_MIN = 4.5;

/**
 * The label colour for a fill: black or white, or `null` to leave the label themed.
 * An opaque fill always gets whichever contrasts more (ties go to black). A
 * translucent one gets a colour only if it clears {@link TEXT_MIN} over every
 * backdrop: black is checked with the fill over pure black, white with the fill
 * over pure white, the worst case for each.
 */
export function labelColourFor(rgb: readonly number[], alpha = 1): string | null {
  if (alpha >= 1) {
    const l = luminance(rgb);
    return blackOn(l) >= whiteOn(l) ? BLACK : WHITE;
  }
  const black = blackOn(luminance(over(rgb, alpha, 0)));
  const white = whiteOn(luminance(over(rgb, alpha, 255)));
  if (black >= TEXT_MIN && black >= white) return BLACK;
  if (white >= TEXT_MIN) return WHITE;
  return null;
}

/** The fill a shape paints: its literal colour with every opacity that applies to it
 * folded into the alpha. `null` for a themed, missing or invisible fill. */
function effectiveFill(fill: string | undefined, ...opacities: Array<string | undefined>): LiteralColour | null {
  const colour = fill === undefined ? null : parseLiteralColour(fill);
  if (!colour) return null;
  const alpha = opacities.reduce((a, o) => a * (parseAlpha(o) ?? 1), colour.alpha);
  return alpha > 0 ? { rgb: colour.rgb, alpha } : null;
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
function shapeFill(group: LabelHastNode): LiteralColour | null {
  for (const child of elementChildren(group)) {
    if (child.tagName === 'g' && classes(child).includes('label')) continue;
    // Some shapes (cylinder, hexagon) are wrapped in a bare `<g>`.
    const shape = child.tagName === 'g' ? elementChildren(child).find((c) => SHAPES.has(c.tagName ?? '')) : child;
    if (!shape || !SHAPES.has(shape.tagName ?? '')) continue;
    const style = styleOf(shape);
    const attr = (name: string): string | undefined => {
      const v = shape.properties?.[name];
      return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
    };
    return effectiveFill(
      styleValue(style, 'fill') ?? attr('fill'),
      styleValue(style, 'fill-opacity') ?? attr('fillOpacity'),
      styleValue(style, 'opacity') ?? attr('opacity'),
    );
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
  const colour = labelColourFor(fill.rgb, fill.alpha);
  if (colour === null) return;
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
/** An id as a CSS identifier: every character outside `[A-Za-z0-9_-]`, a leading
 * digit, and a digit after a leading `-` are escaped (the subset of
 * `CSS.escape` an SVG id can need; Mermaid's own ids need none of it). */
export function cssEscapeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]|^\d|(?<=^-)\d|^-$/g, (c) =>
    /\d/.test(c) ? `\\${c.charCodeAt(0).toString(16)} ` : `\\${c}`,
  );
}

/** The WCAG 1.4.11 minimum for an edge (non-text). */
const EDGE_MIN = 3;

/**
 * The surfaces an edge can sit on, per theme: the page and a cluster (subgraph) fill,
 * from the toolkit defaults in `styles/theme.css` (`--dk-color-bg`,
 * `--dk-diagram-cluster-fill`). Each theme's backdrops are taken as a luminance
 * range: dark runs from pure black up to its lightest surface, light from its
 * darkest surface up to pure white. A brand that keeps its surfaces inside those
 * ranges (the bundled spec-kitty brand does; `diagram-label-contrast.test.ts` checks
 * both) is covered too; one that lightens a dark surface past it is not.
 */
export const EDGE_SURFACES = {
  dark: ['#131721', '#0e131c'],
  light: ['#ffffff', '#eef1f6'],
} as const;

/** The luminance range [low, high] of a theme's backdrops. */
function surfaceRange(theme: 'dark' | 'light'): [number, number] {
  const ls = EDGE_SURFACES[theme].map((hex) => luminance(parseLiteralColour(hex)!.rgb));
  return theme === 'dark' ? [0, Math.max(...ls)] : [Math.min(...ls), 1];
}

/** The 0–255 grey whose luminance is `l` (the inverse of the sRGB transfer). */
const greyOf = (l: number): number => {
  const s = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, s)) * 255);
};

/** WCAG contrast of two luminances. */
const contrastOf = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** The themes in which an edge colour falls under {@link EDGE_MIN} against some
 * backdrop in that theme's surface range. Backdrops are sampled across the range,
 * ends included, and a translucent stroke is composited over each. Contrast
 * depends only on luminance, so a grey of each backdrop luminance stands for it. */
export function edgeThemesToOverride(colour: string): Array<'dark' | 'light'> {
  const c = parseLiteralColour(colour);
  if (!c || c.alpha === 0) return [];
  const out: Array<'dark' | 'light'> = [];
  for (const theme of ['dark', 'light'] as const) {
    const [low, high] = surfaceRange(theme);
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const backdrop = low + ((high - low) * i) / steps;
      const seen = luminance(over(c.rgb, c.alpha, greyOf(backdrop)));
      if (contrastOf(seen, backdrop) < EDGE_MIN) {
        out.push(theme);
        break;
      }
    }
  }
  return out;
}

/** The literal colour of the first declaration of `prop` in a CSS rule body whose
 * selector `test` accepts, across an SVG's `<style>` text. */
function ruleColour(css: string, test: (selector: string) => boolean, ...props: string[]): string | undefined {
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!test(m[1])) continue;
    for (const prop of props) {
      const v = styleValue(m[2], prop);
      if (v !== undefined && parseLiteralColour(v)) return v;
    }
  }
  return undefined;
}

/** Give each author-coloured edge and arrowhead of one Mermaid `<svg>` the themed
 * edge colour in the theme where its own colour is unreadable. */
function fixMermaidEdges(svg: LabelHastNode): void {
  const styles = elementChildren(svg).filter((c) => c.tagName === 'style');
  const css = styles
    .flatMap((s) => s.children ?? [])
    .map((t) => (typeof t.value === 'string' ? t.value : ''))
    .join('');
  // An %%{init}%% lineColor reaches every edge and every shared arrowhead.
  const linkColour = ruleColour(css, (s) => s.includes('.flowchart-link'), 'stroke');
  const markerColour = ruleColour(css, (s) => /\.marker(?![\w-])/.test(s) && !s.includes('.cross'), 'fill', 'stroke');
  const rules: string[] = [];
  const override = (id: string, colour: string | undefined, decl: string, alsoChildren: boolean): void => {
    if (colour === undefined) return;
    for (const theme of edgeThemesToOverride(colour)) {
      const scope = `:root[data-theme='${theme}'] #${cssEscapeId(id)}`;
      rules.push(`${alsoChildren ? `${scope},${scope} *` : scope}{${decl}}`);
    }
  };
  const EDGE = 'stroke:var(--dk-diagram-edge)!important';
  const HEAD = 'fill:var(--dk-diagram-edge)!important;stroke:var(--dk-diagram-edge)!important';
  const walk = (node: LabelHastNode): void => {
    const id = node.properties?.id;
    if (typeof id === 'string') {
      if (node.tagName === 'path' && classes(node).includes('flowchart-link')) {
        // A linkStyle stroke is inline; otherwise the edge takes the class rule.
        override(id, styleValue(styleOf(node), 'stroke') ?? linkColour, EDGE, false);
      } else if (node.tagName === 'marker') {
        // A linkStyle edge gets its own arrowhead, its colour in the id (`…__d9731a`).
        const variant = /__([0-9a-f]{3,8})$/i.exec(id)?.[1];
        override(id, variant ? `#${variant}` : markerColour, HEAD, true);
      }
    }
    for (const child of elementChildren(node)) walk(child);
  };
  walk(svg);
  if (rules.length === 0) return;
  const text: LabelHastNode = { type: 'text', value: rules.join('') };
  if (styles[0]) styles[0].children = [...(styles[0].children ?? []), text];
  else svg.children = [{ type: 'element', tagName: 'style', properties: {}, children: [text] }, ...(svg.children ?? [])];
}

function fixMermaidSvg(svg: LabelHastNode): void {
  fixMermaidEdges(svg);
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
const FIRST_SHAPE = /<(?:rect|polygon|path|ellipse|circle)\b[^>]*>/;
const THEMED_TEXT_FILL = /(<text\b[^>]*?\sfill=")(var\(--dk-diagram-[a-z-]+\))(")/g;

/** Pin the label colour inside each PlantUML entity whose shape has a literal fill. */
export function fixPlantumlRaw(html: string): string {
  return html.replace(ENTITY_BLOCK, (block) => {
    const tag = FIRST_SHAPE.exec(block)?.[0] ?? '';
    const attr = (name: string): string | undefined => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
    const style = attr('style') ?? '';
    const fill = effectiveFill(
      styleValue(style, 'fill') ?? attr('fill'),
      styleValue(style, 'fill-opacity') ?? attr('fill-opacity'),
      styleValue(style, 'opacity') ?? attr('opacity'),
    );
    if (!fill) return block;
    const colour = labelColourFor(fill.rgb, fill.alpha);
    if (colour === null) return block;
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
