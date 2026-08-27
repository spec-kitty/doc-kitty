/**
 * The glossary hover-preview definitions payload (the WP06 island contract).
 *
 * The preview island (`preview-popover.client.ts`) sources each term's definition
 * text with NO network call, from a single per-page JSON payload:
 *
 * ```html
 * <script type="application/json" id="dk-glossary-definitions">
 *   {"<context>": {"<termName>": "<plain-text definition>"}}
 * </script>
 * ```
 *
 * keyed by the SAME `data-glossary-context` / `data-glossary-term` values the
 * anchors (WP04 auto-links + WP05 `:term`) carry — i.e. the ORIGINAL-CASE context
 * name and the CANONICAL term name (never an alias; a `:term` on an alias surface
 * still emits `data-glossary-term=<canonical name>`). The island reads the text via
 * `textContent`, so the payload holds **plain text with markdown stripped** — never
 * markup — which keeps the island injection-safe.
 *
 * This module owns two things WP08 wires:
 *   1. {@link buildDefinitionsPayload} — turn the shared index into the
 *      `context → termName → plain-text` map (a **global** payload: every context
 *      and term, deterministic, static, and small — the same object for every page).
 *   2. {@link glossaryDefinitions} — the rehype plugin (mirroring
 *      `rehype/diagram-figure.ts`) that appends the `<script>` element carrying that
 *      payload to each page, registered in the glossary integration's rehypePlugins.
 *
 * Determinism (NFR-004): contexts and terms are emitted in a stable name-sorted
 * order and `stripMarkdown` is pure, so the payload string is byte-identical
 * run-to-run — the dev-watcher idempotency the config hook relies on.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import type { SharedTermIndex } from './types.js';

/** The island's payload shape: context name → term name → plain-text definition. */
export type DefinitionsPayload = Record<string, Record<string, string>>;

/** Minimal structural mdast node — enough to collect text from a parsed definition. */
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
}

/**
 * Block-level mdast nodes: a run of text ENDS at each of these, so a space is
 * appended after them to keep words from fusing across paragraphs / list items /
 * code blocks. Inline nodes (emphasis, link, strong…) are NOT here — their text
 * children already carry their own surrounding spaces, so they concatenate cleanly.
 */
const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'list',
  'blockquote',
  'table',
  'tableRow',
  'tableCell',
  'thematicBreak',
]);

/**
 * Strip markdown to plain text: parse the definition to mdast and CONCATENATE its
 * text-bearing nodes (`text`/`inlineCode`/`code`) in document order, dropping all
 * markup (emphasis, link URLs, list markers, raw HTML). Adjacent inline nodes join
 * directly (their text already carries the spacing, so no stray space lands before
 * punctuation); a space is inserted only at block boundaries and hard/soft breaks.
 * Whitespace is then collapsed and trimmed. Pure + deterministic — same input, same
 * output (NFR-004).
 */
export function stripMarkdown(markdown: string): string {
  const tree = unified().use(remarkParse).parse(markdown) as unknown as MdNode;
  const parts: string[] = [];
  const walk = (node: MdNode): void => {
    if (node.type === 'text' || node.type === 'inlineCode') {
      if (typeof node.value === 'string') parts.push(node.value);
      return;
    }
    // Fenced/indented code: keep its text, then a space (it is a block).
    if (node.type === 'code') {
      if (typeof node.value === 'string') parts.push(node.value);
      parts.push(' ');
      return;
    }
    // A hard/soft break becomes a space so words never fuse across lines.
    if (node.type === 'break') {
      parts.push(' ');
      return;
    }
    if (Array.isArray(node.children)) for (const child of node.children) walk(child);
    // Close a block-level run with a separating space.
    if (BLOCK_TYPES.has(node.type)) parts.push(' ');
  };
  walk(tree);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Build the GLOBAL definitions payload from the shared index. Every context's every
 * term contributes one `context → termName → plain-text` entry, keyed exactly as the
 * anchors are (context original-case name; canonical term name). Emitted in
 * name-sorted order for byte-stable serialization (NFR-004).
 */
export function buildDefinitionsPayload(index: SharedTermIndex): DefinitionsPayload {
  const payload: DefinitionsPayload = {};
  const contextNames = [...index.contexts.keys()].sort();
  for (const contextName of contextNames) {
    const context = index.contexts.get(contextName);
    if (context === undefined) continue;
    const terms: Record<string, string> = {};
    const sorted = [...context.terms].sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    );
    for (const term of sorted) terms[term.name] = stripMarkdown(term.definition);
    payload[contextName] = terms;
  }
  return payload;
}

/**
 * Serialize the payload to the exact JSON string the island parses. A stable
 * `JSON.stringify` over the name-sorted structure keeps it byte-identical run-to-run.
 */
export function serializeDefinitionsPayload(index: SharedTermIndex): string {
  // HTML-safe JSON: the string lands as the text child of a raw-text `<script>`
  // element (hast-util-to-html does NOT entity-escape raw-text content), so a
  // literal `</script>` in a term name or an inline-code definition would close
  // the element and let the remainder parse as live DOM. Escaping `<` as `<`
  // (JSON.parse decodes it back to `<`, so the island reads the true text) makes
  // `</script>`/`<!--` impossible; U+2028/U+2029 are escaped too (they are valid
  // in JSON but terminate a JS string, a defensive nicety). Post-squad security
  // MED — closes the stored-XSS breakout the module previously (wrongly) claimed
  // it prevented.
  return JSON.stringify(buildDefinitionsPayload(index)).replace(
    /[<\u2028\u2029]/g,
    (c) => (c === '<' ? '\\u003c' : c === '\u2028' ? '\\u2028' : '\\u2029'),
  );
}

/** Minimal structural hast node — enough to append the payload `<script>` element. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

/** Options the config integration passes when it registers the rehype plugin. */
export interface GlossaryDefinitionsOptions {
  /** The pre-serialized global payload JSON (built once at config:setup). */
  json: string;
}

/**
 * Rehype plugin factory (mirrors `rehype/diagram-figure.ts`). Appends a single
 * `<script type="application/json" id="dk-glossary-definitions">` element carrying
 * the global payload to each page's hast root — the island reads it by id. The JSON
 * lands as a text child (never HTML), so it is inert data, not executable script.
 * Registered as `[glossaryDefinitions, { json }]` in the glossary integration's
 * rehypePlugins, so it only ever runs when the glossary is active (NFR-002).
 */
export function glossaryDefinitions(options: GlossaryDefinitionsOptions) {
  const scriptNode: HastNode = {
    type: 'element',
    tagName: 'script',
    properties: { type: 'application/json', id: 'dk-glossary-definitions' },
    children: [{ type: 'text', value: options.json }],
  };
  return function transformer(tree: HastNode): void {
    if (!Array.isArray(tree.children)) tree.children = [];
    tree.children.push(scriptNode);
  };
}
