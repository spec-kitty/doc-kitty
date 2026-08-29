/**
 * `markuaCallouts` — the single emission owner for Markua callouts (ADR-0030
 * D-03, contract `callout-mapping.md`; FR-002/FR-003/FR-004/FR-009). It walks the
 * normalised `containerDirective` nodes WP02 produced and resolves each to its
 * render target via the pure `markua-callouts.internal.ts` router:
 *
 *   - the four Starlight-mapped names (`tip`/`caution`/`danger`/`note`) with NO
 *     `{#id}`/`{icon:}` are LEFT untouched so Starlight's own `remarkAsides`
 *     (registered AFTER doc-kitty's plugins, `config.ts` — WP08) rebuilds them as
 *     native asides. doc-kitty emits no aside markup on that path;
 *
 *   - every theme class, and any mapped class carrying `{#id}`/`{icon:}` (the
 *     attribute tradeoff — `remarkAsides` discards attributes), is rewritten IN
 *     PLACE into the theme-callout hast
 *     `<aside class="dk-callout dk-callout--{variant}">` with an optional
 *     `dk-callout__icon` child, an optional `dk-callout__title`, and the compiled
 *     body under `dk-callout__body`.
 *
 * There is NO `Callout.astro` component: the Starlight `components` map is frozen
 * at four carriers (ADR-0013/0015) and doc-kitty has no directive→component seam,
 * so a component would be dead code / a split-brain second DOM copy. A remark
 * plugin injects specific HTML the ONE supported way — `data.hName`/`hProperties`
 * on the node plus `data.hChildren` for leaf children — which `mdast-util-to-hast`
 * applies (via `applyData`) as the element tag/props/children. This mirrors the
 * class scheme `rehype/diagram-figure.ts` pins for `<figure class="dk-diagram">`;
 * WP05 styles the emitted classes via the `--dk-callout-*` token family.
 *
 * No new dependency: the tree walk is hand-rolled (no `unist-util-visit`), like
 * the WP02 normaliser. DORMANT until WP08 registers this in `config.ts` (BEFORE
 * `remarkAsides`) and WP10 flips the preset — it wires into no pipeline here and
 * changes no rendering, so the corpus stays byte-identical. Build-time only; no
 * client JavaScript (NFR-005).
 */
import {
  decideEmission,
  extractLeadingHeadingTitle,
  type MdastLike,
} from './markua-callouts.internal.js';
import { iconGlyphSvg } from '../markua/icon-map.js';

/** A `remark-directive` container node (what WP02 emits and this plugin consumes). */
interface ContainerDirective extends MdastLike {
  type: 'containerDirective';
  name: string;
  attributes?: Record<string, string | undefined> | null;
  children: MdastLike[];
}

/** The `data` bag `mdast-util-to-hast` reads to override tag/props/children. */
interface HastData {
  hName?: string;
  hProperties?: Record<string, unknown>;
  hChildren?: MdastLike[];
}

/** A hast text node (used for leaf `hChildren`, never re-parsed). */
function text(value: string): MdastLike {
  return { type: 'text', value };
}

/**
 * Build one sub-element of the callout hast. `mdast-util-to-hast` applies
 * `data.hName`/`hProperties`/`hChildren` to ANY node via `applyData`, so the base
 * `type` is irrelevant to the output tag — we use `paragraph` (a handler-backed
 * type that runs `applyData`). Leaf children (icon/title) are passed as raw hast
 * via `hChildren`; the body keeps its mdast `children` so they compile normally.
 */
function subElement(
  tagName: string,
  className: string,
  opts: { hChildren?: MdastLike[]; children?: MdastLike[]; properties?: Record<string, unknown> },
): MdastLike {
  const data: HastData = {
    hName: tagName,
    hProperties: { className: [className], ...(opts.properties ?? {}) },
  };
  if (opts.hChildren !== undefined) data.hChildren = opts.hChildren;
  return { type: 'paragraph', data, children: opts.children ?? [] };
}

/**
 * Rewrite a directive IN PLACE into the theme-callout hast. Sets the outer
 * `<aside class="dk-callout dk-callout--{variant}">` via `hName`/`hProperties`
 * (with an optional `id`), and rebuilds the children as the optional icon span,
 * the optional title paragraph, and the `dk-callout__body` div wrapping the
 * compiled body. The directive `name` is neutralised to `dk-callout` so a mapped
 * fallback (e.g. `dk-callout--tip`) can never be re-grabbed by `remarkAsides`.
 */
function emitThemeCallout(
  node: ContainerDirective,
  variant: string,
  id: string | undefined,
  icon: string | undefined,
): void {
  const attrTitle =
    typeof node.attributes?.title === 'string' && node.attributes.title.trim().length > 0
      ? node.attributes.title.trim()
      : undefined;

  let bodyChildren: MdastLike[] = node.children ?? [];
  let title = attrTitle;
  if (title === undefined) {
    const extracted = extractLeadingHeadingTitle(bodyChildren);
    title = extracted.title;
    bodyChildren = extracted.body;
  }

  const children: MdastLike[] = [];
  if (icon !== undefined) {
    // Render the actual glyph (FR-009): the resolved Starlight icon's inline
    // `<svg>` markup, emitted as a hast `raw` node the pipeline's `rehype-raw`
    // parses. `data-icon` is kept as the greppable resolved-name discriminator.
    const glyph = iconGlyphSvg(icon);
    const iconChildren: MdastLike[] = glyph !== undefined ? [{ type: 'raw', value: glyph }] : [];
    children.push(
      subElement('span', 'dk-callout__icon', {
        hChildren: iconChildren,
        properties: { 'data-icon': icon },
      }),
    );
  }
  if (title !== undefined) {
    children.push(subElement('p', 'dk-callout__title', { hChildren: [text(title)] }));
  }
  children.push(subElement('div', 'dk-callout__body', { children: bodyChildren }));

  const hProperties: Record<string, unknown> = {
    className: ['dk-callout', `dk-callout--${variant}`],
  };
  if (id !== undefined) hProperties.id = id;

  node.name = 'dk-callout';
  node.data = { ...(node.data as HastData | undefined), hName: 'aside', hProperties };
  node.children = children;
}

/** True for a `remark-directive` container node. */
function isContainerDirective(node: MdastLike): node is ContainerDirective {
  return node.type === 'containerDirective' && typeof (node as ContainerDirective).name === 'string';
}

/**
 * Apply the routing to one directive. The native-aside path leaves the node for
 * `remarkAsides` (idempotently re-asserting the Starlight name); the theme path
 * rewrites it to the `dk-callout` hast. Totality: every directive resolves to
 * exactly one of these; nothing throws (FR-012, NFR-002).
 */
function mapDirective(node: ContainerDirective): void {
  const emission = decideEmission(node);
  if (emission.mode === 'native') {
    node.name = emission.starlightName; // idempotent; the node already carries it
    return;
  }
  emitThemeCallout(node, emission.variant, emission.id, emission.icon);
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 * A hand-rolled post-order-ish walk visits every `containerDirective`. We do NOT
 * descend into a directive we rewrote to the theme hast (its body was already the
 * compiled inner content — nested callouts inside were normalised as their own
 * directives by WP02 and are visited before the rewrite reshapes the parent),
 * but we DO recurse into other nodes to reach nested directives.
 */
export default function markuaCallouts() {
  return function transformer(tree: MdastLike): void {
    const walk = (node: MdastLike): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      // Depth-first: map inner directives before the parent is reshaped, so a
      // nested callout's body is emitted before its container's children move.
      for (const child of children) walk(child);
      for (const child of children) {
        if (isContainerDirective(child)) mapDirective(child);
      }
    };
    walk(tree);
  };
}
