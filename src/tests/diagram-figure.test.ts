/**
 * Astro-free unit matrix for `diagram-figure`'s href allowlist (DIAG-SEC-01).
 *
 * `safeHref` is the pure helper the rehype figure builder uses to decide
 * whether a `%% source:` value may become a clickable `<a href>`. Exercised
 * directly here (no hast/vfile runtime needed for the scheme logic), plus one
 * end-to-end pass through the plugin's default export proving the unsafe value
 * never reaches the DOM as a link and a safe value still does.
 */
import { describe, it, expect } from 'vitest';
import diagramFigure, { safeHref } from '../lib/rehype/diagram-figure.js';

describe('safeHref — deny-by-default scheme allowlist', () => {
  it('rejects javascript:, data:, and vbscript: URIs', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
    expect(safeHref('vbscript:msgbox(1)')).toBeUndefined();
  });

  it('rejects a scheme smuggled via embedded control characters (tab/newline)', () => {
    expect(safeHref('java\tscript:alert(1)')).toBeUndefined();
    expect(safeHref('java\nscript:alert(1)')).toBeUndefined();
    expect(safeHref('\t\tjavascript:alert(1)')).toBeUndefined();
  });

  it('rejects a protocol-relative URL (no scheme, but a live external origin)', () => {
    expect(safeHref('//evil.example.com/payload')).toBeUndefined();
  });

  it('allows http:, https:, and mailto: (case-insensitive scheme)', () => {
    expect(safeHref('https://example.com/orders')).toBe('https://example.com/orders');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('mailto:jane@example.com')).toBe('mailto:jane@example.com');
    expect(safeHref('HTTPS://Example.com')).toBe('HTTPS://Example.com');
  });

  it('allows a scheme-less relative or hash link', () => {
    expect(safeHref('#note')).toBe('#note');
    expect(safeHref('../file.md')).toBe('../file.md');
    expect(safeHref('/local/path')).toBe('/local/path');
  });

  it('trims surrounding whitespace on an allowed value', () => {
    expect(safeHref('  https://example.com  ')).toBe('https://example.com');
  });
});

describe('diagramFigure (rehype plugin) — attribution href end-to-end', () => {
  interface HastNode {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    value?: string;
  }

  function preTree(): HastNode {
    return {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['mermaid'] },
          children: [{ type: 'text', value: 'flowchart TD\n  A --> B' }],
        },
      ],
    };
  }

  function findAnchor(node: HastNode): HastNode | undefined {
    if (node.tagName === 'a') return node;
    for (const child of node.children ?? []) {
      const found = findAnchor(child);
      if (found) return found;
    }
    return undefined;
  }

  function attrText(node: HastNode): string {
    const attrSpan = (function find(n: HastNode): HastNode | undefined {
      if (
        n.tagName === 'span' &&
        Array.isArray(n.properties?.className) &&
        (n.properties?.className as string[]).includes('dk-diagram__attr')
      ) {
        return n;
      }
      for (const child of n.children ?? []) {
        const found = find(child);
        if (found) return found;
      }
      return undefined;
    })(node);
    return attrSpan?.children?.map((c) => c.value ?? '').join('') ?? '';
  }

  it('produces NO <a> for a javascript: source — attribution stays plain text', () => {
    const tree = preTree();
    const file = {
      data: {
        dkDiagrams: [{ attribution: 'Evil Corp', source: 'javascript:alert(1)' }],
      },
    };

    diagramFigure()(tree as never, file as never);

    expect(findAnchor(tree)).toBeUndefined();
    expect(attrText(tree)).toBe('Evil Corp');
  });

  it('still links a normal https:// source', () => {
    const tree = preTree();
    const file = {
      data: {
        dkDiagrams: [{ attribution: 'Jane Doe', source: 'https://example.com/orders' }],
      },
    };

    diagramFigure()(tree as never, file as never);

    const anchor = findAnchor(tree);
    expect(anchor).toBeDefined();
    expect(anchor?.properties?.href).toBe('https://example.com/orders');
  });
});
