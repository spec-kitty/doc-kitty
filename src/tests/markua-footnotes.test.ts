/**
 * Non-fakeable matrix for the Markua footnote pass (ADR-0041, contract
 * `footnote-feature.md`; FR-004/FR-013, NFR-001).
 *
 * The load-bearing correctness — caret stripping, matched-pair symmetry,
 * plain-footnote no-op, totality on the unmatched/code-span cases — is exercised
 * two ways:
 *   1. the PURE normaliser (`markua-footnotes.internal.ts`) over hand-built node
 *      shapes, with zero build runtime; and
 *   2. the thin remark plugin end-to-end (`unified().use(remarkParse)
 *      .use(remarkGfm).use(markuaFootnotes)`) — so the assertions are made on the
 *      REAL footnote nodes GFM produces from the source double-caret syntax, not
 *      a mock. The end-to-end block also covers the `guardDeck` deck no-op and
 *      the preset-off byte-stability (idempotent no-op on a plain-footnote tree).
 * No Astro/build runtime is involved.
 */
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import markuaFootnotes from '../lib/remark/markua-footnotes.js';
import { guardDeck } from '../lib/markua/deck-guard.js';
import {
  stripLeadingCaret,
  isFootnoteNode,
  normaliseFootnoteNode,
  normaliseFootnotes,
  type FootnoteNode,
} from '../lib/remark/markua-footnotes.internal.js';

// --- shared helpers --------------------------------------------------------

interface MdNode {
  type: string;
  value?: string;
  identifier?: string;
  label?: string;
  children?: MdNode[];
  [key: string]: unknown;
}

/** Parse Markdown with the pinned GFM substrate, then run the real plugin. */
function runPlugin(md: string): MdNode {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as MdNode;
  markuaFootnotes()(tree as never);
  return tree;
}

/** Parse-only (no plugin) — the pre-pass baseline GFM already produces. */
function parseOnly(md: string): MdNode {
  return unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as MdNode;
}

/** Collect `[type, identifier]` for every footnote node in document order. */
function footnotes(tree: MdNode): Array<[string, string | undefined]> {
  const out: Array<[string, string | undefined]> = [];
  (function walk(n: MdNode): void {
    if (n.type === 'footnoteReference' || n.type === 'footnoteDefinition') {
      out.push([n.type, n.identifier]);
    }
    (n.children ?? []).forEach(walk);
  })(tree);
  return out;
}

/** Collect the values of every `inlineCode` node (to prove code is untouched). */
function inlineCodes(tree: MdNode): string[] {
  const out: string[] = [];
  (function walk(n: MdNode): void {
    if (n.type === 'inlineCode' && typeof n.value === 'string') out.push(n.value);
    (n.children ?? []).forEach(walk);
  })(tree);
  return out;
}

/** Concatenate every `text` node value (to prove literal text survives). */
function allText(tree: MdNode): string {
  let out = '';
  (function walk(n: MdNode): void {
    if (n.type === 'text' && typeof n.value === 'string') out += n.value;
    (n.children ?? []).forEach(walk);
  })(tree);
  return out;
}

/** A fake deck/non-deck VFile, mirroring the sibling `markua-*` tests. */
function makeFile(kind: string): { data: { astro: { frontmatter: { kind: string } } } } {
  return { data: { astro: { frontmatter: { kind } } } };
}

// --- pure `.internal` unit cases ------------------------------------------

describe('markua-footnotes.internal — stripLeadingCaret', () => {
  it('strips exactly one leading caret', () => {
    expect(stripLeadingCaret('^0_1')).toBe('0_1');
  });
  it('leaves a caret-free identifier unchanged (plain GFM footnote)', () => {
    expect(stripLeadingCaret('x')).toBe('x');
  });
  it('removes only ONE caret, keeping any remaining inner caret', () => {
    expect(stripLeadingCaret('^^weird')).toBe('^weird');
  });
  it('is total on the empty string', () => {
    expect(stripLeadingCaret('')).toBe('');
  });
});

describe('markua-footnotes.internal — node predicates & mutation', () => {
  it('recognises footnote reference and definition nodes only', () => {
    expect(isFootnoteNode({ type: 'footnoteReference' })).toBe(true);
    expect(isFootnoteNode({ type: 'footnoteDefinition' })).toBe(true);
    expect(isFootnoteNode({ type: 'text' })).toBe(false);
    expect(isFootnoteNode({ type: 'inlineCode' })).toBe(false);
  });

  it('normalises identifier and label in place and reports the change', () => {
    const node: FootnoteNode = { type: 'footnoteReference', identifier: '^0_1', label: '^0_1' };
    expect(normaliseFootnoteNode(node)).toBe(true);
    expect(node.identifier).toBe('0_1');
    expect(node.label).toBe('0_1');
  });

  it('is a no-op on a plain footnote node (no leading caret)', () => {
    const node: FootnoteNode = { type: 'footnoteReference', identifier: 'x', label: 'x' };
    expect(normaliseFootnoteNode(node)).toBe(false);
    expect(node.identifier).toBe('x');
  });

  it('never mutates a non-footnote node', () => {
    const node: FootnoteNode = { type: 'text', value: '^0_1' };
    expect(normaliseFootnoteNode(node)).toBe(false);
    expect(node.value).toBe('^0_1');
  });

  it('walks a tree and returns the count of changed footnote nodes', () => {
    const tree: FootnoteNode = {
      type: 'root',
      children: [
        { type: 'footnoteReference', identifier: '^a', label: '^a' },
        { type: 'text', value: 'plain [^b] mention' },
        {
          type: 'footnoteDefinition',
          identifier: '^a',
          label: '^a',
          children: [{ type: 'paragraph', children: [{ type: 'text', value: 'note' }] }],
        },
        { type: 'footnoteReference', identifier: 'plain', label: 'plain' }, // no caret
      ],
    };
    expect(normaliseFootnotes(tree)).toBe(2);
    expect(tree.children?.[0].identifier).toBe('a');
    expect(tree.children?.[2].identifier).toBe('a');
    expect(tree.children?.[3].identifier).toBe('plain');
  });
});

// --- end-to-end through the real remark plugin ----------------------------

describe('markuaFootnotes — end-to-end via remark-gfm', () => {
  it('pairs and normalises matched double-caret ref + def', () => {
    const tree = runPlugin('Text[^^0_1] more.\n\n[^^0_1]: A note.\n');
    expect(footnotes(tree)).toEqual([
      ['footnoteReference', '0_1'],
      ['footnoteDefinition', '0_1'],
    ]);
  });

  it('keeps ordering with multiple refs to one def', () => {
    const tree = runPlugin('A[^^0_1] B[^^0_1] C[^^1_2].\n\n[^^0_1]: one.\n\n[^^1_2]: two.\n');
    expect(footnotes(tree)).toEqual([
      ['footnoteReference', '0_1'],
      ['footnoteReference', '0_1'],
      ['footnoteReference', '1_2'],
      ['footnoteDefinition', '0_1'],
      ['footnoteDefinition', '1_2'],
    ]);
  });

  it('leaves an unmatched reference as harmless literal text (no footnote node)', () => {
    const tree = runPlugin('See[^^9_9] here.\n');
    expect(footnotes(tree)).toEqual([]);
    expect(allText(tree)).toContain('[^^9_9]');
  });

  it('degrades an unmatched definition without throwing (renders nowhere)', () => {
    // GFM keeps the orphan definition node; normalising its dead id is harmless
    // and the build never throws.
    const tree = runPlugin('Nothing here.\n\n[^^9_9]: orphan def.\n');
    expect(footnotes(tree)).toEqual([['footnoteDefinition', '9_9']]);
  });

  it('never touches a double-caret marker inside inline code', () => {
    const tree = runPlugin('Use `[^^0_1]` literally.\n\n[^^0_1]: real.\n');
    expect(inlineCodes(tree)).toContain('[^^0_1]');
    // the code-span marker is NOT a reference, so the def is an orphan (id normalised)
    expect(footnotes(tree)).toEqual([['footnoteDefinition', '0_1']]);
  });

  it('leaves a plain GFM footnote `[^x]` byte-identical (no caret to strip)', () => {
    const md = 'Plain[^x] one.\n\n[^x]: plain note.\n';
    const before = footnotes(parseOnly(md));
    const after = footnotes(runPlugin(md));
    expect(after).toEqual(before);
    expect(after).toEqual([
      ['footnoteReference', 'x'],
      ['footnoteDefinition', 'x'],
    ]);
  });

  it('no-ops on a deck (kind: Presentation) via guardDeck', () => {
    const md = 'Slide[^^0_1] text.\n\n[^^0_1]: deck note.\n';
    const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as MdNode;
    // guardDeck-wrapped, exactly as registered in config.ts
    (guardDeck(markuaFootnotes)() as (t: MdNode, f: unknown) => void)(tree, makeFile('Presentation'));
    // On a deck the pass is inert: GFM's retained `^`-prefixed ids are unchanged.
    expect(footnotes(tree)).toEqual([
      ['footnoteReference', '^0_1'],
      ['footnoteDefinition', '^0_1'],
    ]);
  });

  it('runs (not no-ops) off a deck via guardDeck', () => {
    const md = 'Page[^^0_1] text.\n\n[^^0_1]: page note.\n';
    const tree = unified().use(remarkParse).use(remarkGfm).parse(md) as unknown as MdNode;
    (guardDeck(markuaFootnotes)() as (t: MdNode, f: unknown) => void)(tree, makeFile('Doc'));
    expect(footnotes(tree)).toEqual([
      ['footnoteReference', '0_1'],
      ['footnoteDefinition', '0_1'],
    ]);
  });

  it('is idempotent — a second pass changes nothing (byte-stability)', () => {
    const md = 'X[^^0_1] Y.\n\n[^^0_1]: note.\n';
    const tree = runPlugin(md);
    const firstPass = footnotes(tree);
    markuaFootnotes()(tree as never); // run again
    expect(footnotes(tree)).toEqual(firstPass);
  });
});
