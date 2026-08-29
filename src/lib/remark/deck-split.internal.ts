/**
 * Pure, Astro-free slide-splitting logic for `kind: Presentation` decks.
 *
 * `deck-split.ts` (the remark plugin) applies the frontmatter guard and then
 * delegates the whole tree transform to {@link splitDeck} here. Everything in
 * this module is a plain function over a structurally-typed mdast so it can be
 * unit-tested by vitest with no Astro, unified, or vfile runtime (FR-018 /
 * NFR-005). Warnings are RETURNED (never thrown, never logged here); the plugin
 * wrapper re-emits them via `file.message` so the build log carries them
 * (FR-008: unknown directives warn, do not fail).
 *
 * The emitted slide/aside nodes carry `data.hName` + `data.hProperties`, which
 * `mdast-util-to-hast` honours through its default unknown-node handler
 * (`applyData`): a `deckSection` renders `<section …>`, a `deckNote` renders
 * `<aside class="notes" data-pagefind-ignore>`. Content nodes keep their normal
 * mdast types and render as usual; a `.element` directive merges its attributes
 * onto the preceding block's own `data.hProperties`.
 *
 * Grouping (ADR-0012, deck-split-transform contract):
 *   - content before the first `##` → the **title slide** (synthesized from
 *     `title`/`description`/`hero_image`, always emitted so every deck opens on a
 *     titled slide — FR-003);
 *   - `##` (depth 2) → close current, open a new **horizontal** section;
 *   - `###` (depth 3) → convert the current section into a **stack** whose only
 *     children are inner `<section>`s: the accumulated content becomes inner #1,
 *     the `###` opens inner #2 (FR-002). A `###` before the first `##` converts
 *     the title slide the same way.
 *   - `thematicBreak` (`---`) → close current, open a **headingless** horizontal
 *     with an `aria-label` (`Slide N`); the `<hr>` node is consumed (FR-001);
 *   - `####`+ and any other node → stay INSIDE the current innermost slide.
 * Document order is preserved throughout (the no-JS linear fallback depends on
 * it — NFR-003).
 */

/** Minimal structural mdast node — enough for the grouping/directive logic. */
export interface MdNode {
  type: string;
  children?: MdNode[];
  value?: string;
  depth?: number;
  data?: MdData;
  [key: string]: unknown;
}

/** The `data` bag `mdast-util-to-hast` reads (`hName`/`hProperties`). */
export interface MdData {
  hName?: string;
  hProperties?: Record<string, unknown>;
  [key: string]: unknown;
}

/** An mdast `root` whose children this transform replaces. */
export interface MdRoot {
  type: 'root';
  children: MdNode[];
  [key: string]: unknown;
}

/** A slide `<section>` node (`deckSection`) or its inner stack sections. */
export interface DeckSection extends MdNode {
  type: 'deckSection';
  data: { hName: 'section'; hProperties: Record<string, unknown> };
  children: MdNode[];
}

/** The deck's frontmatter fields the title slide reads. */
export interface DeckFrontmatter {
  title?: string;
  description?: string;
  /** Page-hero image; the metadata contract shape is an object (ADR-0011). */
  hero_image?: { src?: string; alt?: string };
  kind?: string;
  [key: string]: unknown;
}

/** A non-fatal message the plugin re-emits via `file.message`. */
export interface SplitWarning {
  message: string;
  node?: MdNode;
}

/** The pure transform's result: the ordered slide sections + any warnings. */
export interface SplitResult {
  children: DeckSection[];
  warnings: SplitWarning[];
}

const SLIDE_RE = /^<!--\s*\.slide:\s*(.+?)\s*-->$/;
const ELEMENT_RE = /^<!--\s*\.element:\s*(.+?)\s*-->$/;
// Any `<!-- .word: … -->` directive shape — used to catch a misspelled directive
// NAME (e.g. `.slyde`) and warn rather than silently swallow it (FR-008).
const DIRECTIVE_RE = /^<!--\s*\.([\w-]+):\s*.*-->$/;
const NOTE_RE = /^Note:[ \t]?/;

// The directive attribute surface is an allowlist, and it is LOAD-BEARING: an
// attribute outside it is dropped (with a warning), not applied. This keeps the
// static deck output safe even for a semi-trusted deck author and for downstream
// toolkit consumers who sanitize their doc pages — the deck route is out-of-frame
// and its attributes are injected post-parse via `hProperties`, so a rehype
// sanitizer keyed on the HTML AST may not see them (security audit S-01). Reveal's
// real slide/element attributes are `data-*`/`aria-*` plus a few global HTML attrs.
const KNOWN_ATTR_PREFIX = /^(data-|aria-)/;
const KNOWN_BARE_ATTR = new Set([
  'class',
  'id',
  'style',
  'role',
  'hidden',
  'tabindex',
  'title',
  'lang',
  'dir',
]);

// Always-denied, regardless of the allowlist: `on*` event handlers are an XSS
// vector and never a legitimate deck attribute; reveal's remote-content
// background attributes pull off-origin content into a "self-contained" deck
// (security audit S-01/S-02). A local (relative) background image/video is fine.
const EVENT_HANDLER_RE = /^on/i;
const REMOTE_URL_RE = /^\s*(?:https?:)?\/\//i;

type AttrDisposition = 'apply' | 'deny' | 'unknown';

function attrDisposition(key: string, val: string): AttrDisposition {
  if (EVENT_HANDLER_RE.test(key)) return 'deny';
  if (key === 'data-background-iframe') return 'deny';
  if (
    (key === 'data-background-image' || key === 'data-background-video') &&
    REMOTE_URL_RE.test(val)
  ) {
    return 'deny';
  }
  if (KNOWN_ATTR_PREFIX.test(key) || KNOWN_BARE_ATTR.has(key)) return 'apply';
  return 'unknown';
}

/**
 * Merge parsed directive attributes onto `props`, enforcing the allowlist.
 * Denied (`on*` / remote-background) and unknown attributes are dropped with a
 * warning; known ones are applied (last-wins per key). Never throws.
 */
function applyAttrs(
  props: Record<string, unknown>,
  attrs: Record<string, string>,
  kind: 'slide' | 'element',
  node: MdNode,
  warnings: SplitWarning[],
): void {
  for (const [key, val] of Object.entries(attrs)) {
    const disposition = attrDisposition(key, val);
    if (disposition === 'deny') {
      warnings.push({ message: `Rejected unsafe .${kind} directive attribute "${key}"`, node });
      continue;
    }
    if (disposition === 'unknown') {
      warnings.push({ message: `Unknown .${kind} directive attribute "${key}" (dropped)`, node });
      continue;
    }
    props[key] = val;
  }
}

function section(
  hProperties: Record<string, unknown>,
  children: MdNode[],
): DeckSection {
  return { type: 'deckSection', data: { hName: 'section', hProperties }, children };
}

/** Synthesize the title-slide body from frontmatter (FR-003). */
function titleChildren(fm: DeckFrontmatter): MdNode[] {
  const kids: MdNode[] = [];
  if (typeof fm.title === 'string' && fm.title.length > 0) {
    kids.push({ type: 'heading', depth: 1, children: [{ type: 'text', value: fm.title }] });
  }
  // The `description` is page metadata only (DeckLayout emits `<meta name="description">`);
  // it is deliberately NOT synthesized into the title-slide body (FR-002). Do not push it
  // into the `.slides` region, the no-JS SSR body, or the Pagefind-indexed tree.
  // `hero_image` is an object `{ src, alt }` per the frozen metadata contract
  // (ADR-0011), not a string — read `.src`/`.alt` (fall back to the title for a11y).
  const heroSrc = fm.hero_image?.src;
  if (typeof heroSrc === 'string' && heroSrc.length > 0) {
    const heroAlt = fm.hero_image?.alt;
    kids.push({
      type: 'paragraph',
      children: [
        {
          type: 'image',
          url: heroSrc,
          alt:
            typeof heroAlt === 'string' && heroAlt.length > 0
              ? heroAlt
              : typeof fm.title === 'string'
                ? fm.title
                : '',
        },
      ],
    });
  }
  return kids;
}

/** Parse a directive body into `key="value"` / `key='value'` / bare-token attrs. */
function parseAttrs(body: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"|([:\w.-]+)\s*=\s*'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m[1] !== undefined) attrs[m[1]] = m[2];
    else if (m[3] !== undefined) attrs[m[3]] = m[4];
    else if (m[5] !== undefined) attrs[m[5]] = '';
  }
  return attrs;
}

function isHtml(node: MdNode): node is MdNode & { value: string } {
  return node.type === 'html' && typeof node.value === 'string';
}

function isNote(node: MdNode): boolean {
  if (node.type !== 'paragraph' || !node.children || node.children.length === 0) return false;
  const first = node.children[0];
  return first.type === 'text' && typeof first.value === 'string' && NOTE_RE.test(first.value);
}

/** Turn a `Note:` paragraph into an `<aside class="notes" data-pagefind-ignore>`. */
function makeNote(node: MdNode): MdNode {
  const kids: MdNode[] = (node.children ?? []).map((c) => ({ ...c }));
  const first = kids[0];
  if (first && first.type === 'text' && typeof first.value === 'string') {
    kids[0] = { ...first, value: first.value.replace(NOTE_RE, '') };
  }
  const paragraph: MdNode = { type: 'paragraph', children: kids };
  return {
    type: 'deckNote',
    data: {
      hName: 'aside',
      hProperties: { className: ['notes'], 'data-pagefind-ignore': '' },
    },
    children: [paragraph],
  };
}

/**
 * Split a `kind: Presentation` deck's mdast into slide sections.
 *
 * Pure: never mutates `root`, never throws, never logs. Returns the ordered
 * `deckSection` list plus any warnings for the plugin to surface.
 */
export function splitDeck(root: MdRoot, frontmatter: DeckFrontmatter): SplitResult {
  const warnings: SplitWarning[] = [];
  const sections: DeckSection[] = [];

  // `sections` is always in document order and `current()` is its last member,
  // so opening a section is a single push and the tree never needs re-walking.
  let stack = false; // is the current top-level section a vertical stack?
  let inner: DeckSection | null = null; // the open inner section when `stack`
  let lastBlock: MdNode | null = null; // `.element`'s preceding-sibling target
  // Count of NAVIGABLE slides created so far (title + every horizontal + every
  // inner beyond the stack's re-parented first). A headingless slide's fallback
  // `aria-label` is its navigation ordinal, so it must count inner slides — not
  // top-level sections, which undercounts once any stack exists (bug B-02).
  let navCount = 0;

  const current = (): DeckSection => sections[sections.length - 1];
  // The innermost open slide: the inner section inside a stack, else the top one.
  const slide = (): DeckSection => (stack && inner ? inner : current());

  const openHorizontal = (
    hProperties: Record<string, unknown>,
    initial: MdNode[],
  ): void => {
    sections.push(section(hProperties, [...initial]));
    stack = false;
    inner = null;
    navCount += 1; // a new navigable top-level slide
    lastBlock = initial.length > 0 ? initial[initial.length - 1] : null;
  };

  // `###`: ensure the current section is a stack, then open a fresh inner section.
  // On the FIRST conversion the section's accumulated content becomes inner #1 and
  // — crucially — inherits the section's authored `hProperties` (its `aria-label`
  // from a headingless `---`, and any `.slide` attributes), leaving the stack
  // WRAPPER clean. Otherwise the reader lands on inner #1 with no accessible name
  // (bug B-01) and a per-slide `.slide` background bleeds across the whole stack
  // (bug B-04).
  const openInner = (heading: MdNode): void => {
    if (!stack) {
      const cur = current();
      const firstInner = section({ ...cur.data.hProperties }, cur.children);
      cur.children = [firstInner];
      cur.data.hProperties = {};
      stack = true;
    }
    const nextInner = section({}, [heading]);
    current().children.push(nextInner);
    inner = nextInner;
    navCount += 1; // the `###` adds a new navigable inner slide
    lastBlock = heading;
  };

  const appendContent = (node: MdNode): void => {
    slide().children.push(node);
    lastBlock = node;
  };

  const applySlide = (node: MdNode): void => {
    const body = isHtml(node) ? (SLIDE_RE.exec(node.value.trim())?.[1] ?? '') : '';
    // Multiple `.slide` directives merge onto the innermost slide, last-wins.
    applyAttrs(slide().data.hProperties, parseAttrs(body), 'slide', node, warnings);
  };

  const applyElement = (node: MdNode): void => {
    if (!lastBlock) {
      warnings.push({
        message: '.element directive has no preceding sibling; skipped',
        node,
      });
      return;
    }
    const body = isHtml(node) ? (ELEMENT_RE.exec(node.value.trim())?.[1] ?? '') : '';
    const target = lastBlock;
    target.data ??= {};
    target.data.hProperties ??= {};
    applyAttrs(target.data.hProperties, parseAttrs(body), 'element', node, warnings);
  };

  // The title slide is always slide #1 (FR-003); pre-`##` content appends to it.
  // Its children are frontmatter-SYNTHESIZED, so they must not be a `.element`
  // target — reset `lastBlock` so a leading `.element` warns/skips (bug B-05).
  openHorizontal({}, titleChildren(frontmatter));
  lastBlock = null;

  for (const node of root.children) {
    if (isHtml(node) && SLIDE_RE.test(node.value.trim())) {
      applySlide(node); // consumed
      continue;
    }
    if (isHtml(node) && ELEMENT_RE.test(node.value.trim())) {
      applyElement(node); // consumed
      continue;
    }
    if (isHtml(node)) {
      // A `<!-- .word: … -->` directive whose name is neither `.slide` nor
      // `.element` is almost always an author typo (e.g. `.slyde`). Warn and
      // consume it so the intent isn't silently lost as inert markup (bug B-03 /
      // FR-008); other HTML comments/blocks fall through to content unchanged.
      const directive = DIRECTIVE_RE.exec(node.value.trim());
      if (directive) {
        warnings.push({ message: `Unknown deck directive ".${directive[1]}"`, node });
        continue;
      }
    }
    if (isNote(node)) {
      // A note is chrome, a direct child of its slide, and NOT a `.element`
      // target — do not advance `lastBlock`.
      slide().children.push(makeNote(node));
      continue;
    }
    if (node.type === 'thematicBreak') {
      // Headingless slide; the `<hr>` is consumed, an aria-label supplies the
      // accessible name every slide needs (FR-001 / NFR-001). `openHorizontal`
      // increments `navCount` first, so the label is this slide's true ordinal.
      openHorizontal({}, []);
      current().data.hProperties['aria-label'] = `Slide ${navCount}`;
      continue;
    }
    if (node.type === 'heading' && node.depth === 2) {
      openHorizontal({}, [node]);
      continue;
    }
    if (node.type === 'heading' && node.depth === 3) {
      openInner(node);
      continue;
    }
    // `####`+ and every other node stay inside the current innermost slide.
    appendContent(node);
  }

  return { children: sections, warnings };
}
