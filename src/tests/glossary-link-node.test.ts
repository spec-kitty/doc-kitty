/**
 * Focused unit tests for the ONE shared glossary link-node builder
 * (`src/lib/glossary/link-node.ts`, issues #79 + #77). The parity test
 * (`glossary-link-node-parity.test.ts`) and the two per-builder goldens pin the
 * common single-`text`-child case; these tests lock the aria-label COMPOSITION
 * edges the builder introduced (post-squad folds):
 *   - rich `:term` labels (nested/emphasis children) compose a PLAIN-TEXT
 *     aria-label (spec Edge Cases; ADR-0039 Risks; renata/paula follow-up), and
 *   - an empty / whitespace-only visible text OMITS the attribute entirely rather
 *     than emitting a dangling ", glossary term" (debugger-debbie B3; NFR-005).
 */
import { describe, it, expect } from 'vitest';
import { glossaryLinkNode, type LinkChild } from '../lib/glossary/link-node.js';

describe('glossaryLinkNode — aria-label composition (#77)', () => {
  it('composes the aria-label from the PLAIN text of rich children (emphasis/nested)', () => {
    // `:term[the *cargo* manifest]{context=shipping}` → children carry an
    // `emphasis` subtree; the affordance must flatten to plain text.
    const richChildren: LinkChild[] = [
      { type: 'text', value: 'the ' },
      { type: 'emphasis', children: [{ type: 'text', value: 'cargo' }] },
      { type: 'text', value: ' manifest' },
    ];
    const node = glossaryLinkNode(
      'shipping',
      'shipping',
      'cargo',
      'Cargo',
      richChildren,
      '',
    );
    expect(node.data.hProperties['aria-label']).toBe('the cargo manifest, glossary term');
    // The visible children are untouched (the aria-label is an attribute only).
    expect(node.children).toBe(richChildren);
  });

  it('omits aria-label entirely for empty visible text (defensive guard)', () => {
    const node = glossaryLinkNode('shipping', 'shipping', 'cargo', 'Cargo', [], '');
    expect(node.data.hProperties).not.toHaveProperty('aria-label');
  });

  it('omits aria-label for whitespace-only visible text (spec Edge Cases)', () => {
    const node = glossaryLinkNode(
      'shipping',
      'shipping',
      'cargo',
      'Cargo',
      [{ type: 'text', value: '   ' }],
      '',
    );
    expect(node.data.hProperties).not.toHaveProperty('aria-label');
  });
});
