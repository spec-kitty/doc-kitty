/**
 * `markuaAttributes` — the attribute-list remark plugin (ADR-0030, contract
 * `attribute-list-plugin.md`; FR-005/FR-006/FR-007/FR-012, C-005). It attaches a
 * Markua `{…}` attribute list to its target and is the shared substrate for
 * figures (US2), crosslink ids (US3), and the `{class:}`/`{icon:}`/`{#id}` a
 * callout carries. The pure `{…}` grammar lives in
 * `markua-attributes.internal.ts` (vitest-covered, Astro-free); this half is the
 * hand-rolled mdast walk (no `unist-util-visit`, like the WP02 normaliser).
 *
 * Two positions are honoured:
 *
 *  - **Block form** — an attribute-list paragraph on its OWN line immediately
 *    above a block element. It attaches to the FOLLOWING block and the consumed
 *    attribute paragraph is removed from the tree (so it never renders as literal
 *    `{…}` text). Per-target honour (the rest is silently ignored, FR-012):
 *      · image (a lone `![…](…)` paragraph): `alt` → `hProperties.markuaAlt`
 *        (the distinct key WP07's figure rehype reads so it never clobbers the
 *        bracket-text caption), `caption`/`title`/`width`/`height`/`align`/`class`
 *        → the matching `hProperties` key, `id`/`#id` → `hProperties.id`;
 *      · heading / other bare block: `id`/`#id` only → `hProperties.id`;
 *      · container directive (a WP02 `{aside}`/`{blurb}`/callout): `id`/`class`/
 *        `icon` → the directive's `attributes` (the channel WP04's
 *        `markua-callouts` reads for the `{#id}`/`{class:}`/`{icon:}` tradeoff),
 *        so a `{class: warning}` above a `B>` folds onto the emitted block
 *        (three-way-equivalence) and a `{#note}` above an `{aside}` anchors it.
 *
 *  - **Inline span form** — `[text]{#id}` → `<span id="…">text</span>`; a bracket-
 *    less `word{#id}` wraps the immediately preceding token. Only `id`/`#id` is
 *    honoured on a span; any other key leaves the run as literal text.
 *
 * Total and local: a malformed `{…}` degrades to text and the plugin never throws
 * (FR-012, NFR-002); a page with no attribute list is unchanged (FR-011). DORMANT
 * until WP08 wires it into `config.ts` and WP10 flips the preset, so the corpus
 * stays byte-identical.
 */
import { parseAttrList, type AttrList } from './markua-attributes.internal.js';

/** Minimal structural mdast node — enough to walk children and read/write data. */
interface MdastNode {
  type: string;
  value?: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

interface MdastRoot extends MdastNode {
  type: 'root';
  children: MdastNode[];
}

/** A `remark-directive` container (what WP02 emits and WP04 consumes). */
interface ContainerDirective extends MdastNode {
  type: 'containerDirective';
  name: string;
  attributes?: Record<string, string> | null;
}

/** The `data` bag `mdast-util-to-hast` reads to override tag/props. */
interface HastData {
  hName?: string;
  hProperties?: Record<string, unknown>;
  hChildren?: MdastNode[];
  [key: string]: unknown;
}

/** Image hProperties key ← `{…}` key. `alt` is deliberately `markuaAlt` (WP07). */
const IMAGE_KEY_MAP: Record<string, string> = {
  alt: 'markuaAlt',
  caption: 'caption',
  title: 'title',
  width: 'width',
  height: 'height',
  align: 'align',
  class: 'class',
  id: 'id',
};

/** Reconstruct a paragraph's source text from its inline descendants. */
function paragraphText(node: MdastNode): string {
  let out = '';
  const walk = (n: MdastNode): void => {
    if (n.type === 'text' || n.type === 'inlineCode') {
      out += n.value ?? '';
      return;
    }
    if (n.type === 'break') {
      out += '\n';
      return;
    }
    if (Array.isArray(n.children)) for (const child of n.children) walk(child);
  };
  for (const child of node.children ?? []) walk(child);
  return out;
}

/** Merge props onto a node's `data.hProperties` (create the bag if absent). */
function writeHProperties(node: MdastNode, props: Record<string, unknown>): void {
  const data = (node.data ?? {}) as HastData;
  data.hProperties = { ...(data.hProperties ?? {}), ...props };
  node.data = data as Record<string, unknown>;
}

/**
 * The single meaningful `image` node of a lone-image block, or `null`. Accepts a
 * bare `image` node or a `paragraph` whose only non-whitespace child is one image
 * (how `![…](…)` on its own line parses).
 */
function loneImage(node: MdastNode): MdastNode | null {
  if (node.type === 'image') return node;
  if (node.type !== 'paragraph') return null;
  let img: MdastNode | null = null;
  for (const kid of node.children ?? []) {
    if (kid.type === 'text' && (kid.value ?? '').trim() === '') continue;
    if (kid.type === 'image' && img === null) {
      img = kid;
      continue;
    }
    return null;
  }
  return img;
}

/** Write an attribute list's honoured keys onto its resolved block target. */
function attachToBlock(target: MdastNode, attrs: AttrList): void {
  // Container directive (aside / blurb / callout) → directive `attributes`
  // (the channel `markua-callouts` reads); honour id / class / icon.
  if (target.type === 'containerDirective') {
    const container = target as ContainerDirective;
    const next = { ...(container.attributes ?? {}) };
    for (const key of ['id', 'class', 'icon'] as const) {
      const value = attrs.entries[key];
      if (value !== undefined) next[key] = value;
    }
    container.attributes = next;
    return;
  }

  // Image (lone `![…](…)`) → the figure-rehype hProperties key contract (WP07).
  const image = loneImage(target);
  if (image) {
    const props: Record<string, unknown> = {};
    for (const [attrKey, hastKey] of Object.entries(IMAGE_KEY_MAP)) {
      const value = attrs.entries[attrKey];
      if (value !== undefined) props[hastKey] = value;
    }
    if (Object.keys(props).length > 0) writeHProperties(image, props);
    return;
  }

  // Any other block (heading, figure, …) → id only.
  if (attrs.id !== undefined) writeHProperties(target, { id: attrs.id });
}

/**
 * Merge a coalesced run of stacked `{…}` attribute lists into one, nearest-wins:
 * `list` is in document order (index 0 = farthest from the target, last = the
 * one immediately above the target). For a conflicting key the nearer list's
 * value overrides the farther one's, in both the `entries` and the resolved
 * `id` channel (mirrors `entries.id`, since `parseAttrList` keeps the two in
 * sync — see `markua-attributes.internal.ts`).
 */
function mergeAttrLists(list: AttrList[]): AttrList {
  let entries: Record<string, string> = {};
  let id: string | undefined;
  for (const attrs of list) {
    entries = { ...entries, ...attrs.entries };
    if (attrs.id !== undefined) id = attrs.id;
  }
  return { entries, id };
}

/**
 * Fold the block-form attribute lists in ONE block-level sibling list: a RUN of
 * consecutive LONE attribute-list paragraphs (each one's entire trimmed text
 * parses as `{…}`) immediately above one target attaches as a single merged
 * (nearest-wins) attribute list, and the whole run is spliced out. Whitespace-
 * only paragraphs between are not skipped — the run must be IMMEDIATELY above
 * its target.
 *
 * Two (or more) stacked attribute-list paragraphs above one block used to be
 * folded one step at a time: the outer attached to the inner (itself an
 * attribute-list paragraph, not a real target) and was then spliced out with
 * it, silently losing the outer's attributes. Coalescing the whole run before
 * attaching — and merging `entries`/`id` with nearest-wins — fixes that without
 * touching any target that only ever had a single attribute list above it.
 *
 * The pass RECURSES into `containerDirective` children (defect D2, fixed here): a
 * WP02 `{aside}`/`{blurb}` wrapper is a block-level container whose body is its own
 * sibling list, so an `{alt:}`/`{#id}` attribute list ABOVE an image inside the
 * wrapper must fold exactly like a root-level one. The previous implementation
 * walked `root.children` only, so a nested attribute list leaked as literal text
 * and the nested figure/id was lost.
 */
function applyBlockFormsToChildren(children: MdastNode[]): MdastNode[] {
  const kept: MdastNode[] = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i];
    if (node.type === 'paragraph') {
      const attrs = parseAttrList(paragraphText(node));
      if (attrs) {
        // Look ahead for more lone attribute-list paragraphs stacked directly
        // above the same target, coalescing the whole run before attaching.
        const run: AttrList[] = [attrs];
        let j = i + 1;
        while (j < children.length && children[j].type === 'paragraph') {
          const siblingAttrs = parseAttrList(paragraphText(children[j]));
          if (!siblingAttrs) break;
          run.push(siblingAttrs);
          j += 1;
        }
        if (j < children.length) {
          attachToBlock(children[j], mergeAttrLists(run));
          // Advance past the whole coalesced run (not past the target itself)
          // so the target is still visited exactly once, on the next
          // iteration, for its own recursion/keep handling below — this is
          // what avoids double-processing any spliced-out run member.
          i = j;
          continue;
        }
        // The run ran off the end of the sibling list with no target to
        // attach to — every paragraph in it stays as literal text, same as
        // the pre-existing single-paragraph trailing case.
        for (let k = i; k < j; k += 1) kept.push(children[k]);
        i = j;
        continue;
      }
    }
    // Recurse into wrapper containers so a nested attribute list folds too.
    if (node.type === 'containerDirective' && Array.isArray(node.children)) {
      node.children = applyBlockFormsToChildren(node.children);
    }
    kept.push(node);
    i += 1;
  }
  return kept;
}

function applyBlockForms(root: MdastRoot): void {
  root.children = applyBlockFormsToChildren(root.children);
}

/** A hast `<span id="…">` leaf wrapping literal text (never re-parsed). */
function spanNode(text: string, id: string): MdastNode {
  return {
    type: 'markuaSpan',
    data: {
      hName: 'span',
      hProperties: { id },
      hChildren: [{ type: 'text', value: text }],
    } as HastData as Record<string, unknown>,
  };
}

// `[text]{…}` — the bracketed span form. Non-greedy label; the `{…}` body is
// re-validated by `parseAttrList` so a non-id attribute set is left as text.
const BRACKET_SPAN_RE = /\[([^\]]*)\]\{([^}]*)\}/;
// `word{…}` — the bracket-less span form: the immediately preceding non-space
// token. Guarded (in code) so it never fires on a `]{…}` already handled above.
const WORD_SPAN_RE = /(\S+?)\{([^}]*)\}/;

/**
 * Rewrite the span forms inside a single `text` node, returning the replacement
 * node list (the original node when nothing matched). Bracket form is resolved
 * before the bracket-less form so `[is lorem]{#lorem}` never mis-binds on the
 * space inside the brackets.
 */
function rewriteSpansInText(node: MdastNode): MdastNode[] {
  const value = node.value ?? '';
  if (!value.includes('{')) return [node];

  const bracket = BRACKET_SPAN_RE.exec(value);
  const word = bracket ? null : WORD_SPAN_RE.exec(value);
  const match = bracket ?? word;
  if (!match) return [node];

  const attrs = parseAttrList(`{${match[2]}}`);
  // Only an id-bearing span is honoured; any other key leaves the run as text.
  if (!attrs || attrs.id === undefined) {
    // Advance past this `{…}` so a later valid span in the same node is still seen.
    const rest = value.slice(match.index + match[0].length);
    const head = value.slice(0, match.index + match[0].length);
    const tailNodes = rest ? rewriteSpansInText({ type: 'text', value: rest }) : [];
    return [{ type: 'text', value: head }, ...tailNodes];
  }

  const label = bracket ? match[1] : match[1];
  const before = value.slice(0, match.index);
  const after = value.slice(match.index + match[0].length);
  const out: MdastNode[] = [];
  if (before) out.push({ type: 'text', value: before });
  out.push(spanNode(label, attrs.id));
  if (after) out.push(...rewriteSpansInText({ type: 'text', value: after }));
  return out;
}

/**
 * Inline-span pass: walk every node that holds inline children and rewrite the
 * span forms found in its `text` descendants. Runs after the block pass, on the
 * surviving tree.
 */
function applySpanForms(node: MdastNode): void {
  if (!Array.isArray(node.children)) return;
  const out: MdastNode[] = [];
  for (const child of node.children) {
    if (child.type === 'text') {
      out.push(...rewriteSpansInText(child));
      continue;
    }
    applySpanForms(child);
    out.push(child);
  }
  node.children = out;
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[], Root>`).
 */
export default function markuaAttributes() {
  return function transformer(tree: MdastRoot): void {
    if (!Array.isArray(tree.children)) return;
    applyBlockForms(tree);
    applySpanForms(tree);
  };
}
