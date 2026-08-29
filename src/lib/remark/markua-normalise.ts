/**
 * `markuaNormalise` — the mdast half of the Markua block-detection seam
 * (ADR-0030, contract `normaliser-block-detection.md`; FR-001/FR-004/FR-012).
 * It compiles Markua line-prefix runs (`A>` asides and the `B> C> D> E> I> Q> T>
 * W> X>` callout shorthands) and `{aside}` / `{blurb, class: …}` wrappers into
 * `remark-directive` `containerDirective` nodes for WP04 / Starlight to render.
 *
 * All recognition/grouping lives in `markua-normalise.internal.ts` as a pure,
 * Astro-free line-level state machine (vitest-covered). This wrapper only:
 *   1. reconstructs a line stream from the parsed mdast — paragraph text for
 *      candidate lines, a sentinel placeholder for every OPAQUE node (a fenced
 *      `code`, a real `blockquote`, a heading, a list, …), with a blank line
 *      between nodes so a run never bleeds across the original blank-line break;
 *   2. runs the state machine over that stream; and
 *   3. renders the resulting blocks back to mdast, re-parsing raw text with the
 *      pinned `remark-parse` + `remark-gfm` and substituting each placeholder
 *      with its original node object (so a fenced block or blockquote is kept
 *      byte-for-byte, never re-serialised).
 *
 * Fence/blockquote safety "falls out for free" here (research D-02): CommonMark
 * already parsed a fenced `>` into a `code` node and a real `> quote` into a
 * `blockquote` node, so they arrive as OPAQUE placeholders and are never
 * candidates — the load-bearing fence-suppression logic is proven on the pure
 * state machine (`fence-suppresses-line-prefix`, `unterminated-fence-at-EOF`).
 *
 * DORMANT: this plugin is registered by nobody in this work package — WP08 wires
 * it into `config.ts`. A page with no line-prefix line and no wrapper marker is
 * returned UNCHANGED (the pre-scan guard below), so the corpus stays
 * byte-identical (FR-011, NFR-001). No attribute-list (`{key: value}`) parsing
 * happens here — that is WP08; an attribute-list paragraph is simply left as the
 * emitted container's immediate predecessor.
 *
 * No new dependency: the tree walk is hand-rolled (no `unist-util-visit`) and
 * the inner-Markdown compile reuses the already-pinned `unified` /
 * `remark-parse` / `remark-gfm` (research supply-chain).
 */
import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import {
  classifyLine,
  normaliseDocument,
  type NormBlock,
} from './markua-normalise.internal.js';

/** Minimal structural mdast node — enough to walk children and read text. */
interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  [key: string]: unknown;
}

/** An mdast `root` whose children this plugin rewrites in place. */
interface MdastRoot extends MdastNode {
  type: 'root';
  children: MdastNode[];
}

// A `remark-directive` @4 / `mdast-util-directive` @3.1 container node. WP04 and
// Starlight's `remarkAsides` consume these by `name`.
interface ContainerDirective extends MdastNode {
  type: 'containerDirective';
  name: string;
  attributes: Record<string, string>;
  children: MdastNode[];
}

// A sentinel wrapping an opaque node's stored index. `\uE000` is a Private-Use
// code point that does not occur in documentation source, so the placeholder
// line can never be mistaken for a marker (it classifies as `ordinary`) and
// never collides with author text; placeholders are matched and swapped for
// their stored node before any re-parse, so the sentinel never reaches a parser.
const PH_OPEN = '\uE000dk-markua-node:';
const PH_CLOSE = '\uE000';
const PLACEHOLDER_RE = /^\uE000dk-markua-node:(\d+)\uE000$/;

/**
 * Fence an `inlineCode` value back to a `` `code` `` span that round-trips: widen
 * the backtick run past the longest run inside the value, and pad a space when the
 * value abuts a backtick so re-parsing recovers the exact code text.
 */
function serialiseInlineCode(value: string): string {
  const runs = value.match(/`+/g);
  const longest = runs ? Math.max(...runs.map((r) => r.length)) : 0;
  const fence = '`'.repeat(longest + 1);
  const pad = /^`|`$/.test(value) ? ' ' : '';
  return `${fence}${pad}${value}${pad}${fence}`;
}

/**
 * FAITHFULLY serialise a paragraph's inline children back to their Markdown SOURCE
 * (integration defect D1/D2, fixed here). The state machine needs the marker lines
 * as text, and the container body it hands to `renderRaw` is RE-PARSED — so a
 * text-ONLY walk (the previous implementation) destroyed every inline construct in
 * a marker-bearing body: `T> …a **mapped** icon (`fa-lightbulb`)` collapsed to
 * plain text (no `<strong>`/`<code>`), a link kept only its label (href dropped),
 * and an image soft-adjacent to `{/aside}` vanished entirely (no text descendant).
 *
 * The re-serialisation ESCAPES markdown-active characters in author `text` so the
 * body re-parse reproduces the literal source: text that carried a `\*`/`\_`/`\[`
 * in the source arrives unescaped from the first parse, and re-emitting it raw would
 * spuriously re-parse as emphasis / a link (integration defect FIX 1). Escaping the
 * author text is SAFE for marker detection: the marker prefix (`T>`, `{/aside}`) is a
 * structural whole-line/prefix token the classifier keys on (`^[A-Z]>(\s|$)` and a
 * trimmed brace-equality for `{aside}`/`{blurb}`) — it is the FIRST token on the line
 * and is detected/stripped structurally, never by parsing emphasis. The escaped
 * metachars (`* _ [ ] `` ` `` and `\`) are none of `A`–`Z`, `>`, or the brace
 * markers, so the prefix survives verbatim while the body regains fidelity. Inline
 * WRAPPERS (emphasis/strong/delete/link/image/inlineCode) contribute their canonical
 * delimiters unescaped, which is exactly what the body re-parse needs.
 */
function serialiseInlineChildren(nodes: MdastNode[]): string {
  let out = '';
  for (const n of nodes) out += serialiseInlineNode(n);
  return out;
}

/**
 * Backslash-escape the markdown-active characters in a literal `text` value so a
 * re-parse reproduces the text VERBATIM (no spurious `<em>`/`<a>`). The set is the
 * inline-active punctuation `\ * _ [ ] `` ` ``; the backslash is in the character
 * class and each source char is visited once, so there is no double-escaping.
 */
function escapeInlineText(value: string): string {
  return value.replace(/[\\*_`[\]]/g, '\\$&');
}

/**
 * Render a link/image destination. Wrap it in `<…>` when it carries whitespace or
 * unbalanced parentheses (the mdast-util-to-markdown convention) so the URL survives
 * a re-parse instead of being truncated at the first space or stray `)`.
 */
function serialiseUrl(url: string): string {
  if (url === '') return '';
  let depth = 0;
  let unbalanced = false;
  for (const ch of url) {
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) unbalanced = true;
    }
  }
  if (depth !== 0) unbalanced = true;
  return /\s/.test(url) || unbalanced ? `<${url}>` : url;
}

function serialiseInlineNode(n: MdastNode): string {
  switch (n.type) {
    case 'text':
      return escapeInlineText(n.value ?? '');
    case 'inlineCode':
      return serialiseInlineCode(n.value ?? '');
    case 'break':
      return '\n';
    case 'strong':
      return `**${serialiseInlineChildren(n.children ?? [])}**`;
    case 'emphasis':
      return `*${serialiseInlineChildren(n.children ?? [])}*`;
    case 'delete':
      return `~~${serialiseInlineChildren(n.children ?? [])}~~`;
    case 'link': {
      // The label round-trips via child serialisation (text children already
      // escape a literal `]`, so the label brackets stay balanced); the URL is
      // angle-wrapped when needed so spaces/parens survive.
      const label = serialiseInlineChildren(n.children ?? []);
      const title = typeof n.title === 'string' && n.title.length > 0 ? ` "${n.title}"` : '';
      return `[${label}](${serialiseUrl((n.url as string) ?? '')}${title})`;
    }
    case 'image': {
      // `alt` is a raw string (no children), so escape a literal `]` here to keep
      // the label brackets balanced; the URL is angle-wrapped when needed.
      const alt = escapeInlineText((n.alt as string) ?? '');
      const title = typeof n.title === 'string' && n.title.length > 0 ? ` "${n.title}"` : '';
      return `![${alt}](${serialiseUrl((n.url as string) ?? '')}${title})`;
    }
    case 'footnoteReference': {
      // Round-trip the reference token `[^id]` instead of dropping it (the default
      // branch had no children/value → ''), so it survives re-parse as its literal.
      const id = String(n.identifier ?? n.label ?? '');
      return `[^${id}]`;
    }
    case 'linkReference': {
      // Round-trip `[label][ref]` (or the shortcut/collapsed form) instead of
      // flattening to the bare label text.
      const label = serialiseInlineChildren(n.children ?? []);
      const ref = String(n.identifier ?? n.label ?? '');
      if (n.referenceType === 'shortcut') return `[${label}]`;
      if (n.referenceType === 'collapsed') return `[${label}][]`;
      return `[${label}][${ref}]`;
    }
    case 'html':
      return n.value ?? '';
    default:
      // Any other inline node (footnote, …): recurse so nested text still
      // survives; a leaf with a value contributes it verbatim.
      if (Array.isArray(n.children)) return serialiseInlineChildren(n.children);
      return n.value ?? '';
  }
}

/**
 * Reconstruct a paragraph's source text. Markua markers (`A>`, `{aside}`) are
 * plain text on the leading `text` run; inline markup round-trips to its Markdown
 * source via {@link serialiseInlineChildren} so a marker-bearing body re-parses
 * back to the identical inline tree (link/image/emphasis/strong/inlineCode). This
 * recovers the marker lines the state machine needs AND preserves the body markup.
 */
function reconstructParagraphText(node: MdastNode): string {
  return serialiseInlineChildren(node.children ?? []);
}

/**
 * Whether a single paragraph carries a Markua MARKER line — a line-prefix run
 * (`A>`…), a wrapper open/close (`{aside}` / `{/blurb}`). This is the predicate
 * that decides a paragraph is a CANDIDATE for conversion; a paragraph with none
 * (ordinary prose, a lone image, a link/emphasis/inlineCode run, a bare
 * `{alt: …}` attribute list) is NOT a candidate and is preserved verbatim.
 * Mirrors the contract: "only Markua line-prefix and wrapper-marker paragraphs
 * are ever candidates for conversion" (`normaliser-block-detection.md`).
 */
function paragraphBearsMarker(node: MdastNode): boolean {
  let insideFence = false;
  for (const line of reconstructParagraphText(node).split('\n')) {
    const kind = classifyLine(line, insideFence);
    if (kind === 'fence-toggle') insideFence = !insideFence;
    else if (kind === 'line-prefix' || kind === 'wrapper-open' || kind === 'wrapper-close') {
      return true;
    }
  }
  return false;
}

/** Whether any root-level paragraph carries a Markua marker worth processing. */
function hasMarkuaMarker(children: MdastNode[]): boolean {
  for (const node of children) {
    if (node.type === 'paragraph' && paragraphBearsMarker(node)) return true;
  }
  return false;
}

/**
 * Flatten root children into a line stream plus the opaque-node table. A
 * `paragraph` THAT BEARS A MARKER contributes its reconstructed lines
 * (candidates for the state machine); EVERY OTHER node — a non-paragraph
 * (code/blockquote/heading/list/image-block/…) AND a paragraph with no Markua
 * marker (ordinary prose, a lone image, a link/emphasis/inlineCode run, a bare
 * `{alt: …}` attribute list) — contributes one placeholder line referencing the
 * stored ORIGINAL node, so it is re-emitted byte-for-byte and never re-parsed.
 * A blank line is inserted between nodes so a line-prefix run cannot span the
 * original blank-line paragraph break.
 *
 * Preserving non-marker paragraphs as opaque is load-bearing (integration
 * defect D1/D2, fixed here): the previous reconstruct-to-text-and-reparse path
 * dropped lone `image` nodes (no text descendants → empty reconstruction) and
 * flattened inline links/emphasis/`inlineCode` on ANY page that also carried a
 * callout/aside marker. The reconstruction is now confined to the paragraphs the
 * contract actually targets — the marker-bearing ones.
 */
function buildLineStream(children: MdastNode[]): { lines: string[]; opaque: MdastNode[] } {
  const lines: string[] = [];
  const opaque: MdastNode[] = [];
  children.forEach((node, index) => {
    if (index > 0) lines.push('');
    if (node.type === 'paragraph' && paragraphBearsMarker(node)) {
      lines.push(...reconstructParagraphText(node).split('\n'));
    } else {
      const id = opaque.length;
      opaque.push(node);
      lines.push(`${PH_OPEN}${id}${PH_CLOSE}`);
    }
  });
  return { lines, opaque };
}

/** Render normalised blocks back to mdast nodes, resolving placeholders. */
function renderBlocks(
  blocks: NormBlock[],
  opaque: MdastNode[],
  processor: Processor,
): MdastNode[] {
  const out: MdastNode[] = [];
  for (const block of blocks) {
    if (block.kind === 'raw') {
      out.push(...renderRaw(block.lines, opaque, processor));
    } else {
      const container: ContainerDirective = {
        type: 'containerDirective',
        name: block.directiveName,
        attributes: {},
        children: renderBlocks(block.children, opaque, processor),
      };
      out.push(container);
    }
  }
  return out;
}

/**
 * Render a raw block: parse contiguous text segments to mdast, and drop each
 * stored opaque node back in at its placeholder (never re-serialising it).
 */
function renderRaw(lines: string[], opaque: MdastNode[], processor: Processor): MdastNode[] {
  const out: MdastNode[] = [];
  let buffer: string[] = [];

  const flush = (): void => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (text.length === 0) return;
    const parsed = processor.runSync(processor.parse(text)) as unknown as MdastRoot;
    out.push(...parsed.children);
  };

  for (const line of lines) {
    const m = PLACEHOLDER_RE.exec(line);
    if (m) {
      flush();
      out.push(opaque[Number(m[1])]);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function markuaNormalise() {
  // One reusable inner-Markdown compiler: the pinned parse substrate, no
  // smartypants/directive (the container names are constructed directly).
  const processor = unified().use(remarkParse).use(remarkGfm) as unknown as Processor;

  return function transformer(tree: MdastRoot): void {
    const children = tree.children;
    if (!Array.isArray(children) || !hasMarkuaMarker(children)) return; // byte-identical no-op

    const { lines, opaque } = buildLineStream(children);
    const blocks = normaliseDocument(lines);
    tree.children = renderBlocks(blocks, opaque, processor);
  };
}
