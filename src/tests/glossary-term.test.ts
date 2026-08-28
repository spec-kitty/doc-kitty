import { describe, it, expect } from 'vitest';
import glossaryTerm from '../lib/remark/glossary-term.js';
import type { GlossaryTermOptions } from '../lib/remark/glossary-term.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

/**
 * The `:term` plugin's only real dependency is the shared resolver, so we build
 * the same tiny stub `SharedTermIndex` the resolver's own suite uses. `anchor` and
 * `contextSlug` are the AUTHORITATIVE stored values the resolver returns verbatim
 * (issue #17); the emitted link node carries them straight through.
 */
function indexOf(
  bySurface: Record<
    string,
    Array<{ context: string; contextSlug: string; anchor: string; termName: string }>
  >,
): SharedTermIndex {
  return { bySurface: new Map(Object.entries(bySurface)), contexts: new Map() };
}

const index = indexOf({
  // Single-candidate surface.
  bill: [
    { context: 'shipping', contextSlug: 'shipping', anchor: 'bill-of-lading', termName: 'Bill of Lading' },
  ],
  // Collision: `policy` lives in both `hr` and `shipping` — the linker refuses to
  // guess, but an explicit `:term{context=…}` forces the choice.
  policy: [
    { context: 'shipping', contextSlug: 'shipping', anchor: 'policy', termName: 'Policy' },
    { context: 'hr', contextSlug: 'hr', anchor: 'policy', termName: 'Policy' },
  ],
  // Single-candidate surface used for the suppress case.
  cargo: [{ context: 'shipping', contextSlug: 'shipping', anchor: 'cargo', termName: 'Cargo' }],
});

/** A minimal remark VFile that records the skip-and-warn diagnostics. */
function fakeFile(): TermVFile & { messages: string[] } {
  const messages: string[] = [];
  return { messages, message: (reason: string) => void messages.push(reason) };
}
interface TermVFile {
  message(reason: string, place?: unknown): unknown;
}

/** Minimal structural node type for building fixture trees. */
interface Node {
  type: string;
  value?: string;
  name?: string;
  attributes?: Record<string, string | null | undefined>;
  children?: Node[];
  url?: string;
  data?: { hProperties?: Record<string, unknown> };
}

/** A `:term[label]{attrs}` text-directive node, as `remark-directive` parses it. */
function termDirective(label: string, attributes: Record<string, string>): Node {
  return {
    type: 'textDirective',
    name: 'term',
    attributes,
    children: [{ type: 'text', value: label }],
  };
}

/** Wrap a directive in a one-paragraph page and run the plugin over it. */
function runOn(
  directive: Node,
  opts: GlossaryTermOptions = { index },
): { node: Node; messages: string[] } {
  const tree: Node = { type: 'root', children: [{ type: 'paragraph', children: [directive] }] };
  const file = fakeFile();
  // The plugin factory returns the transformer; run it over the tree + file.
  (glossaryTerm(opts) as (t: Node, f: TermVFile) => void)(tree, file);
  return { node: tree.children![0].children![0], messages: file.messages };
}

describe('glossaryTerm (:term directive)', () => {
  it('T019: force-links a single-candidate surface via the explicit context', () => {
    const { node, messages } = runOn(termDirective('bill', { context: 'shipping' }));
    expect(node).toEqual({
      type: 'link',
      url: '/glossary/shipping/#bill-of-lading',
      children: [{ type: 'text', value: 'bill' }],
      data: {
        hProperties: {
          target: '_blank',
          rel: 'noopener',
          'data-glossary-term': 'Bill of Lading',
          'data-glossary-context': 'shipping',
          'data-glossary-anchor': 'bill-of-lading',
          'data-glossary-context-slug': 'shipping',
        },
      },
    });
    expect(messages).toEqual([]);
  });

  it('T019/T020: the explicit context resolves a cross-context collision', () => {
    // `policy` is ambiguous (hr + shipping); the auto-linker would leave it plain,
    // but `:term{context=hr}` forces the hr page. The other context picks shipping.
    const hr = runOn(termDirective('policy', { context: 'hr' }));
    expect(hr.node.url).toBe('/glossary/hr/#policy');
    expect(hr.node.data?.hProperties?.['data-glossary-context']).toBe('hr');
    expect(hr.messages).toEqual([]);

    const shipping = runOn(termDirective('policy', { context: 'shipping' }));
    expect(shipping.node.url).toBe('/glossary/shipping/#policy');
    expect(shipping.node.data?.hProperties?.['data-glossary-context']).toBe('shipping');
  });

  it('T019: link=false renders the label as a plain text node (no warning)', () => {
    const { node, messages } = runOn(termDirective('cargo', { link: 'false' }));
    expect(node).toEqual({ type: 'text', value: 'cargo' });
    expect(messages).toEqual([]);
  });

  it('T020: an unknown/unresolved context warns (not fatal) and leaves plain text', () => {
    // `policy` is a collision; `legal` is not one of its candidates → unresolved.
    const { node, messages } = runOn(termDirective('policy', { context: 'legal' }));
    expect(node).toEqual({ type: 'text', value: 'policy' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('[glossary] :term "policy"');
    expect(messages[0]).toContain('legal');
  });

  it('T020: a non-term surface with an explicit context warns, does not throw', () => {
    const run = () => runOn(termDirective('widget', { context: 'shipping' }));
    expect(run).not.toThrow();
    const { node, messages } = run();
    expect(node).toEqual({ type: 'text', value: 'widget' });
    expect(messages).toHaveLength(1);
  });

  it('T020: a missing context attribute warns and leaves plain text', () => {
    const { node, messages } = runOn(termDirective('policy', {}));
    expect(node).toEqual({ type: 'text', value: 'policy' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('missing context');
  });

  it('T021: node-shape parity — the emitted link matches the auto-linker (WP04) shape', () => {
    // The shared link node the WP04 auto-linker (`glossary-autolink.ts`) emits, per
    // contract `autolink-and-term.md`. A `:term` MUST emit byte-identical structure
    // so the hover island, no-JS fallback, and the links-used tree-scan treat both
    // uniformly. If WP04 changes this shape, this expectation changes with it.
    const wp04LinkNode = {
      type: 'link',
      url: '/glossary/hr/#policy',
      children: [{ type: 'text', value: 'policy' }],
      data: {
        hProperties: {
          target: '_blank',
          rel: 'noopener',
          'data-glossary-term': 'Policy',
          'data-glossary-context': 'hr',
          'data-glossary-anchor': 'policy',
          'data-glossary-context-slug': 'hr',
        },
      },
    };
    const { node } = runOn(termDirective('policy', { context: 'hr' }));
    expect(node).toEqual(wp04LinkNode);
    // The link carries the `data-glossary-term` marker WP04's `computePageLinks`
    // scans for — the SINGLE counts-as-used mechanism (no separate file.data list).
    expect(node.data?.hProperties).toHaveProperty('data-glossary-term');
  });

  it('presence-gated: with no shared index the directive is left untouched (byte-identical)', () => {
    const directive = termDirective('policy', { context: 'hr' });
    const { node } = runOn(directive, {});
    // Same textDirective node, unmodified — WP08 has not wired an index yet.
    expect(node.type).toBe('textDirective');
    expect(node.name).toBe('term');
  });
});
