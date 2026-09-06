/**
 * Live cross-emitter parity guard (C-001 "shared link-node shape").
 *
 * The auto-linker (`computePageLinks` in `glossary-autolink.internal.ts`) and the
 * `:term` directive (`glossary-term.ts`) each build the glossary link node from
 * their own inline builder (`makeLinkNode` / `glossaryLinkNode`). The contract is
 * that both emit a BYTE-IDENTICAL `hProperties` bag + href so the hover island,
 * the no-JS fallback, and the links-used tree-scan treat auto-links and `:term`
 * links uniformly, and so the On-this-page re-derive matches the build output.
 *
 * The per-builder suites (`glossary-autolink.test.ts`, `glossary-term.test.ts`)
 * each pin their own builder to a hardcoded literal — but nothing there compares
 * the TWO ACTUAL builders against each other, so a coordinated edit of both
 * literals could let the emitters drift while both suites stayed green. This test
 * closes that hole structurally (DIRECTIVE_043): it invokes both real emitters on
 * an equivalent input and asserts their emitted node shape is equal. Fork either
 * builder and this fails — regardless of the golden literals.
 */
import { describe, it, expect } from 'vitest';
import { computePageLinks, type MdNode, type MdRoot } from '../lib/remark/glossary-autolink.internal.js';
import glossaryTerm from '../lib/remark/glossary-term.js';
import type { GlossaryTermOptions } from '../lib/remark/glossary-term.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

// A single-candidate surface so the auto-linker actually links it (it refuses to
// guess a collision); `:term` can force the same term with an explicit context.
const index: SharedTermIndex = {
  bySurface: new Map([
    ['cargo', [{ context: 'shipping', contextSlug: 'shipping', anchor: 'cargo', termName: 'Cargo' }]],
  ]),
  contexts: new Map(),
};
const EMPTY_IGNORE: ReadonlySet<string> = new Set();

/** Depth-first find of the first emitted glossary link node in a tree. */
function findGlossaryLink(node: MdNode): MdNode | undefined {
  if (node.type === 'link' && typeof node.data?.hProperties?.['data-glossary-term'] === 'string') {
    return node;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findGlossaryLink(child);
      if (found) return found;
    }
  }
  return undefined;
}

/** Run the auto-linker over a paragraph mentioning the surface; return the link node. */
function autolinkNode(): MdNode {
  const tree: MdRoot = {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: 'The cargo moved on.' }] }],
  };
  computePageLinks(tree, undefined, index, EMPTY_IGNORE);
  const node = findGlossaryLink(tree);
  if (!node) throw new Error('auto-linker emitted no glossary link');
  return node;
}

/** Run the `:term` directive over `:term[cargo]{context=shipping}`; return the link node. */
function termNode(): MdNode {
  const directive: MdNode = {
    type: 'textDirective',
    name: 'term',
    attributes: { context: 'shipping' },
    children: [{ type: 'text', value: 'cargo' }],
  } as MdNode;
  const tree: MdNode = { type: 'root', children: [{ type: 'paragraph', children: [directive] }] };
  const opts: GlossaryTermOptions = { index };
  (glossaryTerm(opts) as (t: MdNode, f: { message(r: string): unknown }) => void)(tree, {
    message: () => undefined,
  });
  const node = findGlossaryLink(tree);
  if (!node) throw new Error(':term emitted no glossary link');
  return node;
}

describe('shared glossary link-node parity (C-001)', () => {
  it('the auto-linker and :term emit an identical hProperties bag + href for the same term', () => {
    const auto = autolinkNode();
    const term = termNode();
    // href is single-sourced (glossaryTermUrl) — assert it matches too.
    expect(term.url).toBe(auto.url);
    // The load-bearing invariant: the two independent builders agree on the shape.
    expect(term.data?.hProperties).toEqual(auto.data?.hProperties);
  });
});
