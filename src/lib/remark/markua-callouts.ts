/**
 * `markuaCallouts` — the single emission owner for Markua callouts (ADR-0030
 * D-03, contract `callout-mapping.md`; FR-002/FR-003/FR-004/FR-009). It walks the
 * normalised `containerDirective` nodes WP02 produced and resolves each to its
 * render target via the pure `markua-callouts.internal.ts` router:
 *
 *   - the four Starlight-mapped names (`tip`/`caution`/`danger`/`note`) with NO
 *     `{#id}`/`{icon:}` are LEFT untouched so Starlight's own `remarkAsides`
 *     (registered AFTER doc-kitty's plugins, `config.ts` — WP08) rebuilds them as
 *     native asides. doc-kitty emits no aside markup on that path — EXCEPT on a
 *     `kind: Presentation` page (T002, D5, C-COMPOSE-04): `DeckLayout.astro`
 *     never links Starlight's `starlight-aside` CSS, so a native aside would
 *     render unstyled on a slide. There, `forceTheme` routes even a bare mapped
 *     class through the theme path below;
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
import { isPresentationFile } from '../deck/is-presentation.js';

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

/**
 * The subset of the remark VFile this plugin reads (Astro injects `data.astro`)
 * to detect a deck (T002, D5) via {@link isPresentationFile}.
 */
interface MarkuaCalloutsVFile {
  data?: { astro?: { frontmatter?: { kind?: unknown } } };
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
 * The four Starlight-mapped variant names. On the FORCED-THEME path (decks) a
 * bare/untitled mapped callout must still convey its severity textually —
 * mirrors Starlight's own default-titled native aside — so this set gates the
 * default-title fallback in {@link emitThemeCallout} below.
 */
const STARLIGHT_MAPPED_VARIANTS: ReadonlySet<string> = new Set(['note', 'tip', 'caution', 'danger']);

/** `"caution"` → `"Caution"` (Starlight's own default aside title casing). */
function humanizeVariant(variant: string): string {
  return `${variant.charAt(0).toUpperCase()}${variant.slice(1)}`;
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
  forceTheme: boolean,
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
  // FIX 1 (a11y — WCAG 1.4.1 / NFR-001 / US1): off a deck, an untitled mapped
  // callout (note/tip/caution/danger) rides the NATIVE aside path instead
  // (`decideEmission`), which Starlight auto-titles ("Caution", …) — so this
  // branch never fires off-deck (NFR-002 byte-identical). On a deck the same
  // callout is FORCED through this theme path (D5/C-COMPOSE-04) and would
  // otherwise emit ONLY a coloured border with no title/label — severity
  // conveyed by colour alone. Give it the same default title Starlight would,
  // so the accent colour is reinforced by, never the sole conveyor of,
  // severity. Only the four Starlight-mapped names get this default; the six
  // theme-only variants (aside/discussion/question/exercise/center/generic)
  // have no Starlight default title to mirror and stay untitled when bare.
  if (title === undefined && forceTheme && STARLIGHT_MAPPED_VARIANTS.has(variant)) {
    title = humanizeVariant(variant);
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
  // T003 (NFR-001): the icon glyph is `aria-hidden` (FR-009, `icon-map.ts`), so
  // it never contributes accessible content — it cannot be "the sole accessible
  // content" the way a plain unlabelled `<img>` could. The compiled body and any
  // extracted/explicit title are near-always real, perceivable text, which is
  // sufficient without an extra label. The one genuinely empty case is a
  // deck-only artifact of T001: a wrapper whose slide boundary lands immediately
  // after its open marker (`{aside}` directly followed by `##`/`###`/`---`)
  // leaves NO body and NO title, so the `<aside>` would otherwise carry ZERO
  // accessible content. Name it from the variant in that case only — the
  // minimal fix, not a blanket label on every callout.
  if (title === undefined && bodyChildren.length === 0) {
    hProperties['aria-label'] = `${humanizeVariant(variant)} callout`;
  } else if (forceTheme && title !== undefined) {
    // FIX B (a11y/contract — NFR-001/US1): a rendered `<p class="dk-callout__title">`
    // is a SIBLING of the `<aside>`, never its accessible name — an aside with no
    // `aria-label`/`aria-labelledby` computes to role=generic, so "the visible
    // title supplies the accessible name" was a false a11y model. Gated STRICTLY
    // on `forceTheme` (never on `variant`) so off-deck stays byte-identical
    // (NFR-002): `forceTheme` is always `false` off a deck, so this branch never
    // fires there, whether the titled callout reached `emitThemeCallout` via the
    // native-mapped bare path (it wouldn't — that one takes `decideEmission`'s
    // OTHER, native branch) or via an explicit `{#id}`/`{icon:}` theme callout
    // (it does reach here, titled, but un-labelled — matching today's shipped
    // behaviour). On a deck every themed callout self-contains its markup (no
    // Starlight aside CSS, see module doc), so a titled one needs the SAME real
    // accessible name Starlight gives its own native asides: `aria-label` = the
    // title text (the mapped default title set just above, or an
    // explicit/extracted one) — mirroring Starlight's own named-aside pattern
    // instead of inventing a new one. This also resolves the prior inconsistency
    // where only the titleless-empty case was named.
    hProperties['aria-label'] = title;
  }

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
 *
 * `forceTheme` (T002, D5) is read once per page (from `isPresentationFile`) and
 * threaded to every directive unchanged — a deck callout NEVER takes the native
 * path, mapped or not (C-COMPOSE-04); off a deck it is always `false`, so the
 * routing is byte-identical to before T002.
 */
function mapDirective(node: ContainerDirective, forceTheme: boolean): void {
  const emission = decideEmission(node, forceTheme);
  if (emission.mode === 'native') {
    node.name = emission.starlightName; // idempotent; the node already carries it
    return;
  }
  emitThemeCallout(node, emission.variant, emission.id, emission.icon, forceTheme);
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 * A hand-rolled post-order-ish walk visits every `containerDirective`. We do NOT
 * descend into a directive we rewrote to the theme hast (its body was already the
 * compiled inner content — nested callouts inside were normalised as their own
 * directives by WP02 and are visited before the rewrite reshapes the parent),
 * but we DO recurse into other nodes to reach nested directives.
 *
 * Deck seam (T002, D5, C-COMPOSE-04): `isPresentationFile(file)` is read ONCE
 * here — never imported into the pure `markua-callouts.internal.ts` router — and
 * threaded into every `mapDirective` call as `forceTheme`, so a `kind:
 * Presentation` page always emits the self-contained `dk-callout` hast, never the
 * native `starlight-aside` (which `DeckLayout.astro` has no CSS for). Off a deck
 * `forceTheme` is `false`, so behaviour is byte-identical to before T002.
 */
export default function markuaCallouts() {
  return function transformer(tree: MdastLike, file?: MarkuaCalloutsVFile): void {
    const forceTheme = isPresentationFile(file);
    const walk = (node: MdastLike): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      // Depth-first: map inner directives before the parent is reshaped, so a
      // nested callout's body is emitted before its container's children move.
      for (const child of children) walk(child);
      for (const child of children) {
        if (isContainerDirective(child)) mapDirective(child, forceTheme);
      }
    };
    walk(tree);
  };
}
