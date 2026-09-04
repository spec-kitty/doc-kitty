/**
 * `glossaryTerm` — the `:term[text]{context=…}` escape-hatch remark plugin
 * (ADR-0027 Decision 4; contract `autolink-and-term.md` §`:term`; FR-011). It is
 * the author's explicit override for the auto-linker: when a surface is a
 * cross-context collision the linker refuses to guess, or is a common-word false
 * positive, `:term[text]{context=<ctx>}` names the context and forces the link.
 *
 * It consumes the `textDirective` node named `term` that `remark-directive` parses
 * from `:term[text]{attrs}` (a NEW pinned dependency, AS-2). It resolves that
 * surface against the **explicit** `context` through WP02's one shared matcher
 * ({@link ../glossary/resolve.resolveSurface}) and, on a `link` result, replaces
 * the directive with the **exact same** `link` node shape the auto-linker (WP04,
 * `glossary-autolink.ts`) emits — so the hover island, the no-JS fallback, and the
 * "links used" list treat an auto-link and a `:term` uniformly. `:term[text]{link=false}`
 * suppresses (renders the label as plain text). Unknown or missing `context`
 * degrades to a `file.message` **warning** and plain text — never fatal, mirroring
 * the auto-linker's skip-and-warn posture (NFR-007).
 *
 * **Counts-as-used / counts-as-first-eligible — one sanctioned mechanism.** A
 * resolved `:term` carries the same `data-glossary-term`/`data-glossary-context`
 * markers as an auto-link, and WP04's `computePageLinks` collects the page's
 * used-links by scanning **every `data-glossary-term` node in the tree** (WP04
 * T016). The pre-existing `link` node this plugin emits is therefore both counted
 * as used *and* seen by the auto-linker as the section's already-present first
 * eligible (its ancestor/existing-link guard skips it, and it seeds the
 * already-linked-surface set), so the linker never adds a second link for the same
 * surface in that section. There is deliberately **no** separate `file.data` list:
 * the tree scan is the single source (post-squad L-3).
 *
 * **Ordering (WP08 pins it, config.ts):** `remark-gfm` → `remarkDirective` →
 * `glossary-term` → `glossary-autolink`. This plugin runs **after** the directive
 * parser (so a `:term` is a real `textDirective` node, not re-scanned prose) and
 * **before** the auto-linker (so its emitted `link` node is already present when
 * the linker walks).
 *
 * All logic is Astro-free and unit-tested; resolution is delegated to the shared
 * resolver — this plugin only walks the tree, extracts the label, and emits nodes.
 *
 * **DORMANT:** registered by nobody in this work package — WP08 wires
 * `remarkDirective` + this plugin into the pipeline. It is **presence-gated** on
 * the shared index (no index → early return), so until WP08 wires it the built
 * corpus is byte-identical (NFR-002).
 */
import { resolveSurface, glossaryTermUrl } from '../glossary/resolve.js';
import type { SharedTermIndex } from '../glossary/types.js';

/**
 * Minimal structural mdast node — enough to find `:term` directives, read their
 * label + attributes, and splice in the replacement. Mirrors the hand-rolled
 * `MdastNode` in the sibling plugins (deck-split / diagram-meta) so this unit does
 * not depend on `@types/mdast` resolving from the toolkit package; the directive
 * shape below is exactly what `mdast-util-directive` produces.
 */
interface MdastNode {
  type: string;
  value?: string;
  /** Present on `textDirective` nodes: the directive name (we match `term`). */
  name?: string;
  /** Present on directive nodes: `{key=value}` attributes, values are strings. */
  attributes?: Record<string, string | null | undefined> | null;
  children?: MdastNode[];
  url?: string;
  data?: { hProperties?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
}

/** The subset of the remark VFile this plugin uses: skip-and-warn diagnostics. */
interface TermVFile {
  message(reason: string, place?: unknown): unknown;
}

/** Options WP08's config.ts passes when it registers the plugin. */
export interface GlossaryTermOptions {
  /** The one shared term index (WP01). Absent → the plugin is a no-op. */
  index?: SharedTermIndex;
  /** Ignore-listed surfaces (lowercased); passed straight to the resolver. */
  ignoreList?: ReadonlySet<string>;
  /**
   * The site's already-normalized base prefix (#61, C-001) — `config.ts` threads
   * `normalizeBasePrefix(base)` here so an emitted `:term` link carries it, kept
   * single-sourced with the auto-linker via the shared `glossaryTermUrl` builder.
   * Defaults to `''` (no base).
   */
  base?: string;
}

/** Concatenate the text of a directive's label children (`:term[here]`). */
function textOf(node: MdastNode): string {
  if (node.type === 'text') return node.value ?? '';
  const children = node.children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

/**
 * The **shared** glossary link node — MUST stay byte-identical to the node the
 * auto-linker (WP04 `glossary-autolink.ts`) emits (contract `autolink-and-term.md`):
 * a `link` to `/glossary/<contextSlug>/#<anchor>` (the de-collided page slug, issue
 * #17 finding #5 — never the raw context name) carrying `target="_blank"`,
 * `rel="noopener"` (FR-009) and the `data-glossary-term`/`data-glossary-context`
 * (+ `-anchor`/`-context-slug`) markers the hover island and the links-used
 * tree-scan key on. If these two ever
 * diverge, the island / no-JS fallback / used-list treat the two link kinds
 * differently — the reviewer diffs them.
 * `basePrefix` (#61, C-001) is threaded from the plugin factory's `base` option —
 * the ONE shared `glossaryTermUrl` builder keeps this and the auto-linker's
 * emitted href single-sourced.
 */
function glossaryLinkNode(
  context: string,
  contextSlug: string,
  anchor: string,
  termName: string,
  children: MdastNode[],
  basePrefix: string,
): MdastNode {
  return {
    type: 'link',
    url: glossaryTermUrl(basePrefix, contextSlug, anchor),
    children,
    data: {
      hProperties: {
        target: '_blank',
        rel: 'noopener',
        'data-glossary-term': termName,
        'data-glossary-context': context,
        'data-glossary-anchor': anchor,
        'data-glossary-context-slug': contextSlug,
      },
    },
  };
}

/**
 * Turn one `:term` directive into its replacement node: a shared link node, or a
 * plain-text node (suppressed, missing-context, or unresolved). Warnings are
 * non-fatal `file.message`s in a stable greppable form.
 */
function transformDirective(
  node: MdastNode,
  file: TermVFile,
  index: SharedTermIndex,
  ignoreList: ReadonlySet<string>,
  basePrefix: string,
): MdastNode {
  const text = textOf(node);
  const attributes = node.attributes ?? {};

  // Suppress form: `:term[text]{link=false}` → the label as plain text (FR-011).
  // Directive attribute values are strings, so `link=false` arrives as `'false'`.
  if (attributes.link === 'false') {
    return { type: 'text', value: text };
  }

  const context = attributes.context;
  // Missing context → warn (not fatal) and leave the label plain.
  if (context === undefined || context === null || context === '') {
    file.message(`[glossary] :term "${text}" — missing context attribute, left unlinked`, node);
    return { type: 'text', value: text };
  }

  // Resolve against the EXPLICIT context — overriding collision ambiguity and
  // false positives (ADR-0027 D4). The ignore-list still applies (WP05 prompt).
  const resolution = resolveSurface(text, context, index, ignoreList);
  if (resolution.kind === 'link') {
    const label =
      Array.isArray(node.children) && node.children.length > 0
        ? node.children
        : [{ type: 'text', value: text }];
    return glossaryLinkNode(
      resolution.context,
      resolution.contextSlug,
      resolution.anchor,
      resolution.termName,
      label,
      basePrefix,
    );
  }

  // `unresolved` (context not among the surface's candidates) or `none` (not a
  // term/alias, or ignore-listed): the explicit context did not name a linkable
  // term. Warn (skip-and-warn, NFR-007) and leave the label plain.
  file.message(
    `[glossary] :term "${text}" — unknown or unresolved context "${context}", left unlinked`,
    node,
  );
  return { type: 'text', value: text };
}

/**
 * Remark plugin factory. Returns the transformer Astro runs over each page's
 * mdast; assignable to Astro's `RemarkPlugin` (a unified `Plugin<[opts], Root>`).
 */
export default function glossaryTerm(options: GlossaryTermOptions = {}) {
  const { index, ignoreList = new Set<string>(), base: basePrefix = '' } = options;

  return function transformer(tree: MdastNode, file: TermVFile): void {
    // Presence-gated (NFR-002): no shared index → no-op, corpus byte-identical.
    if (index === undefined) return;

    const walk = (node: MdastNode): void => {
      const children = node.children;
      if (!Array.isArray(children)) return;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.type === 'textDirective' && child.name === 'term') {
          // Replace the directive in place; the emitted node is a leaf (link with
          // its own label children, or a text node) — nothing further to descend.
          children[i] = transformDirective(child, file, index, ignoreList, basePrefix);
        } else {
          walk(child);
        }
      }
    };

    walk(tree);
  };
}
