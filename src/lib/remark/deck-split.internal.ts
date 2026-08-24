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
  hero_image?: string;
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
const NOTE_RE = /^Note:[ \t]?/;

// Open vocabulary (ADR-0012 decision 3): reveal's slide/element attributes are
// overwhelmingly `data-*`/`aria-*` plus a small set of global HTML attributes.
// Anything outside this is likely an author typo → warn (never throw), but still
// apply it so a genuinely-new attribute is not silently dropped.
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

function isKnownAttr(key: string): boolean {
  return KNOWN_ATTR_PREFIX.test(key) || KNOWN_BARE_ATTR.has(key);
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
  if (typeof fm.description === 'string' && fm.description.length > 0) {
    kids.push({ type: 'paragraph', children: [{ type: 'text', value: fm.description }] });
  }
  if (typeof fm.hero_image === 'string' && fm.hero_image.length > 0) {
    kids.push({
      type: 'paragraph',
      children: [
        {
          type: 'image',
          url: fm.hero_image,
          alt: typeof fm.title === 'string' ? fm.title : '',
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
    lastBlock = initial.length > 0 ? initial[initial.length - 1] : null;
  };

  // `###`: ensure the current section is a stack (wrapping its existing content
  // as inner #1 on first conversion), then open a fresh inner section.
  const openInner = (heading: MdNode): void => {
    if (!stack) {
      const cur = current();
      const firstInner = section({}, cur.children);
      cur.children = [firstInner];
      stack = true;
    }
    const nextInner = section({}, [heading]);
    current().children.push(nextInner);
    inner = nextInner;
    lastBlock = heading;
  };

  const appendContent = (node: MdNode): void => {
    slide().children.push(node);
    lastBlock = node;
  };

  const applySlide = (node: MdNode): void => {
    const body = isHtml(node) ? (SLIDE_RE.exec(node.value.trim())?.[1] ?? '') : '';
    const attrs = parseAttrs(body);
    const props = slide().data.hProperties;
    for (const [key, val] of Object.entries(attrs)) {
      if (!isKnownAttr(key)) {
        warnings.push({ message: `Unknown .slide directive attribute "${key}"`, node });
      }
      props[key] = val; // multiple .slide directives merge, last-wins per key
    }
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
    const attrs = parseAttrs(body);
    const target = lastBlock;
    target.data ??= {};
    target.data.hProperties ??= {};
    const props = target.data.hProperties;
    for (const [key, val] of Object.entries(attrs)) {
      if (!isKnownAttr(key)) {
        warnings.push({ message: `Unknown .element directive attribute "${key}"`, node });
      }
      props[key] = val;
    }
  };

  // The title slide is always slide #1 (FR-003); pre-`##` content appends to it.
  openHorizontal({}, titleChildren(frontmatter));

  for (const node of root.children) {
    if (isHtml(node) && SLIDE_RE.test(node.value.trim())) {
      applySlide(node); // consumed
      continue;
    }
    if (isHtml(node) && ELEMENT_RE.test(node.value.trim())) {
      applyElement(node); // consumed
      continue;
    }
    if (isNote(node)) {
      // A note is chrome, a direct child of its slide, and NOT a `.element`
      // target — do not advance `lastBlock`.
      slide().children.push(makeNote(node));
      continue;
    }
    if (node.type === 'thematicBreak') {
      // Headingless slide; the `<hr>` is consumed, an aria-label supplies the
      // accessible name every slide needs (FR-001 / NFR-001).
      openHorizontal({ 'aria-label': `Slide ${sections.length + 1}` }, []);
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
