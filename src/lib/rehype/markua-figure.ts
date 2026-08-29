/**
 * `markuaFigure` — the rehype half of the Markua image → accessible-figure seam
 * (contract `figure-render.md`; FR-005/FR-006, NFR-004/NFR-005, C-006). It
 * mirrors {@link ./diagram-figure.ts} (hand-rolled hast walk, no
 * `unist-util-visit`; the shared {@link safeHref} scheme allowlist) and rewrites
 * every Markua `![caption](src)` image into:
 *
 * ```html
 * <figure class="dk-figure {align-class} {extra-classes}" id="{#id?}">
 *   <img src="{src — kept intact}" alt="{alt}" title="{title?}" style="{sizing?}" />
 *   <figcaption class="dk-figure__caption">{caption}</figcaption>
 * </figure>
 * ```
 *
 * ## Ordering — load-bearing: this pass runs BEFORE `rehypeImages`
 *
 * Ground-truthed against `@astrojs/markdown-remark@6.3.11`, the rehype stage
 * order is: USER rehype plugins → `rehypeImages` → `rehypeHeadingIds` →
 * `rehypeRaw`. This is a **user** rehype plugin, so it runs **before**
 * `rehypeImages` — and that is REQUIRED, not merely acceptable:
 *
 * - This pass wraps the `<img>` **keeping `src` intact** and sets the
 *   markua-derived `alt`/`title`/`style` on the nested `<img>`; it never
 *   pre-optimises `src` or writes an `__ASTRO_IMAGE_` marker itself.
 * - `rehypeImages` (later) visits the nested `<img>`, matches its `src` against
 *   `localImagePaths`/`remoteImagePaths`, and **folds every `img.properties`
 *   entry** (all but `className`/`htmlFor`) into the `__ASTRO_IMAGE_`
 *   optimisation marker JSON. So `alt`/`title`/`style` survive the optimisation
 *   only because they are already present on the `<img>` when `rehypeImages`
 *   visits it. Wrapping *after* optimisation would fight the marker and lose
 *   them — the exact failure the WP10 `style="width:75%"` round-trip assertion
 *   guards. (WP08 registers this pass in the user rehype stage; WP10 flips the
 *   preset. Until then this pass is dormant and the corpus is byte-identical.)
 *
 * ## Local vs web `src`
 *
 * - A **local path** (`palm-trees.jpg`, `images/bar.png`) stays a plain local
 *   `<img src>` so `rehypeImages` / `astro:assets` optimise it page-relative —
 *   the native glob loader already resolves page-relative references (research
 *   D-05); this pass does not re-implement resolution.
 * - A **web `http(s)` URL** passes through as a plain `<img src>` (matched by
 *   `remoteImagePaths`, unoptimised unless configured).
 * - Every `src` is validated through the shared {@link safeHref} allowlist
 *   (`http:`/`https:`/`mailto:`/relative only); a rejected scheme
 *   (`javascript:`/`data:`) **degrades to readable text** and never reaches the
 *   DOM as an image source.
 *
 * ## Field sources (contract `figure-render.md` §Field sources)
 *
 * The `<img>` this pass consumes carries the Markua attributes WP08's
 * attribute-list plugin projected onto `hProperties` (→ hast `properties`).
 * **The hProperties key contract WP08 must satisfy** (documented here because
 * this pass is the reader):
 *
 * | Output            | Read from `img.properties`                                   |
 * |-------------------|--------------------------------------------------------------|
 * | caption           | `caption` (`{caption:}`) else `alt` (the bracket text)       |
 * | alt               | `markuaAlt` (`{alt:}`) else the empty-safe fallback `""`     |
 * | title             | `title` (`{title:}`)                                         |
 * | sizing → style    | `width` / `height` percentages → `style="width: 75%"`        |
 * | layout → class    | `align` = left\|right\|middle → `dk-figure--left/right/center`|
 * | extra classes     | `className` / `class` (`{class:}`) appended to the `<figure>`|
 * | figure id         | `id` (`{#id}` / `{id:}`)                                     |
 *
 * The **caption is the bracket text** of `![caption](src)` (the Markua
 * semantic — standard markdown places it on the `<img alt>`, which this pass
 * relocates to the `<figcaption>`); `alt` comes only from `{alt:}` (read from
 * the distinct `markuaAlt` key so it never clobbers the bracket text). Swapping
 * these two is the exact Markua-vs-Markdown semantic error US2 guards.
 *
 * The empty-safe alt fallback is `alt=""`: a captioned image needs no alt (the
 * caption names it, so a screen reader is not told the name twice); a
 * **captionless** image with no `{alt:}` also gets `alt=""` **plus a build
 * warning naming the file** — an accessibility nudge, never a build failure
 * (NFR-002/NFR-004). Unsupported attributes (`fullbleed`, `float`, `type`,
 * `format`, `column-widths`) are dropped upstream by WP08 and never reach here
 * (C-006, FR-012); this pass ignores anything it does not honour.
 *
 * Figure CSS is NOT owned here — the `dk-figure*` classes are styled in
 * `theme.css` by WP05.
 */
import { safeHref } from './diagram-figure.js';

/** Minimal structural hast node — enough to find/replace `<img>`s. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/** hast text node. */
const text = (value: string): HastNode => ({ type: 'text', value });

/** hast element node with the given tag, properties, and children. */
function element(
  tagName: string,
  properties: Record<string, unknown>,
  children: HastNode[],
): HastNode {
  return { type: 'element', tagName, properties, children };
}

/** Read a hast `className`/`class` value (array or whitespace string) as tokens. */
function classTokens(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

/** Coerce a hast property to a trimmed non-empty string, or `undefined`. */
function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** True for an `<img>` element node. */
function isImg(node: HastNode): boolean {
  return node.type === 'element' && node.tagName === 'img';
}

/** True for a `<p>` whose only element child is a single `<img>` (a block
 * Markua figure: `{attrs}` on its own line above `![caption](src)`), ignoring
 * whitespace-only text. Such a paragraph is unwrapped so the block `<figure>`
 * does not nest illegally inside a `<p>`. */
function loneImageParagraph(node: HastNode): HastNode | null {
  if (node.type !== 'element' || node.tagName !== 'p') return null;
  const kids = node.children ?? [];
  let img: HastNode | null = null;
  for (const kid of kids) {
    if (kid.type === 'text' && (kid.value ?? '').trim() === '') continue;
    if (isImg(kid) && img === null) {
      img = kid;
      continue;
    }
    return null; // any other content → not a lone-image paragraph.
  }
  return img;
}

const ALIGN_CLASS: Record<string, string> = {
  left: 'dk-figure--left',
  right: 'dk-figure--right',
  middle: 'dk-figure--center',
};

/**
 * Build the replacement node for a Markua `<img>`: the accessible `<figure>`,
 * or — when the `src` scheme is not allowlisted — a degraded readable text node
 * (the caption text, else empty) so a `javascript:`/`data:` URI never reaches
 * the DOM as an image source.
 */
function buildReplacement(img: HastNode): HastNode {
  const props = img.properties ?? {};

  // Caption is the bracket text ({caption:} overrides it); alt is {alt:} only.
  const caption = str(props.caption) ?? str(props.alt);
  const markuaAlt = typeof props.markuaAlt === 'string' ? props.markuaAlt : undefined;

  // safeHref: an un-allowlisted scheme degrades to readable text (never an <img>).
  const rawSrc = typeof props.src === 'string' ? props.src : '';
  const src = rawSrc.length > 0 ? safeHref(rawSrc) : undefined;
  if (src === undefined) {
    return text(caption ?? '');
  }

  // Empty-safe alt: {alt:} if given, else "". A captionless image with no
  // {alt:} also warns (naming the file) — a nudge, never a build failure.
  const alt = markuaAlt ?? '';
  if (markuaAlt === undefined && caption === undefined) {
    // Accessibility nudge — a warning, never a throw (NFR-002).
    console.warn(
      `[markua-figure] image "${src}" has no caption and no {alt:}; ` +
        `emitting alt="" — add {alt: "…"} for an accessible name.`,
    );
  }

  // Nested <img>: src kept INTACT, plus the markua-derived alt/title/style that
  // rehypeImages folds into __ASTRO_IMAGE_. No markua-internal keys leak.
  const imgProps: Record<string, unknown> = { src, alt };
  const title = str(props.title);
  if (title !== undefined) imgProps.title = title;

  const style: string[] = [];
  const width = str(props.width);
  const height = str(props.height);
  if (width !== undefined) style.push(`width: ${width}`);
  if (height !== undefined) style.push(`height: ${height}`);
  if (style.length > 0) imgProps.style = style.join('; ');

  const imgNode = element('img', imgProps, []);

  // Figure classes: dk-figure, the align class, then any {class:} extras.
  const figureClasses = ['dk-figure'];
  const align = str(props.align);
  if (align !== undefined && ALIGN_CLASS[align] !== undefined) {
    figureClasses.push(ALIGN_CLASS[align]);
  }
  figureClasses.push(...classTokens(props.className), ...classTokens(props.class));

  const figureProps: Record<string, unknown> = { className: figureClasses };
  const id = str(props.id);
  if (id !== undefined) figureProps.id = id;

  const children: HastNode[] = [imgNode];
  if (caption !== undefined) {
    children.push(
      element('figcaption', { className: ['dk-figure__caption'] }, [text(caption)]),
    );
  }

  return element('figure', figureProps, children);
}

/** The subset of the rehype VFile this plugin reads (Astro injects `data.astro`). */
interface MarkuaFigureFile {
  data?: { astro?: { frontmatter?: { kind?: unknown } } };
}

/**
 * Rehype plugin factory. Returns the transformer Astro runs over each page's
 * hast; assignable to Astro's `RehypePlugin` (a unified `Plugin<[], Root>`).
 *
 * Skips `kind: Presentation` (deck) pages: `deck-split` emits the deck's
 * `hero_image` as a Markdown `image` node carrying its own accessibility `alt`,
 * which is NOT authored Markua figure syntax. Wrapping it as a `dk-figure` would
 * relocate that `alt` to a `<figcaption>` and empty the `<img alt>` (dropped by
 * the image pipeline → an `image-alt` a11y violation), and add an unwanted caption
 * to the title slide. Decks have their own content pipeline; the Markua figure
 * seam is a docs-page construct. Mirrors the frontmatter guard in `deck-split`.
 */
export default function markuaFigure() {
  return function transformer(tree: HastNode, file?: MarkuaFigureFile): void {
    if (file?.data?.astro?.frontmatter?.kind === 'Presentation') return;
    const walk = (node: HastNode): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      for (let k = 0; k < children.length; k++) {
        const child = children[k];
        const loneImg = loneImageParagraph(child);
        if (loneImg !== null) {
          // Block figure: replace the whole <p> so <figure> is not nested in <p>.
          children[k] = buildReplacement(loneImg);
        } else if (isImg(child)) {
          children[k] = buildReplacement(child);
        } else {
          walk(child);
        }
      }
    };

    walk(tree);
  };
}
