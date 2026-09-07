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

/**
 * T004 (build mode) — `diagramFigure` unwraps `@beoe/rehype-mermaid`'s
 * `<figure class="beoe">` (holding the baked `<svg>`) and re-wraps the `<svg>`
 * in the SAME `<figure class="dk-diagram" role="group">` + `<figcaption>` shape
 * it produces for the client `<pre class="mermaid">`. Browser-free: a hand-built
 * beoe-figure fixture stands in for the render output.
 */
describe('diagramFigure (rehype plugin) — build-rendered <svg> path (#13)', () => {
  interface HastNode {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    value?: string;
  }

  /** A `<figure class="beoe mermaid"><svg>…</svg></figure>` — the inline-strategy
   * shape `@beoe/rehype-mermaid` emits at a mermaid fence's block position. */
  function beoeTree(): HastNode {
    return {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['beoe', 'mermaid'] },
          children: [
            {
              type: 'element',
              tagName: 'svg',
              properties: { class: 'flowchart' },
              children: [
                { type: 'element', tagName: 'title', properties: {}, children: [{ type: 'text', value: 'Build pipeline' }] },
                { type: 'element', tagName: 'g', properties: {}, children: [] },
              ],
            },
          ],
        },
      ],
    };
  }

  function findByTag(node: HastNode, tag: string): HastNode | undefined {
    if (node.tagName === tag) return node;
    for (const child of node.children ?? []) {
      const found = findByTag(child, tag);
      if (found) return found;
    }
    return undefined;
  }

  function classListOf(node: HastNode): string[] {
    const raw = node.properties?.className;
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') return raw.split(/\s+/).filter(Boolean);
    return [];
  }

  it('re-wraps the baked <svg> in <figure class="dk-diagram" role="group"> (no beoe figure, no <pre>)', () => {
    const tree = beoeTree();
    const file = { data: { dkDiagrams: [{ description: 'The pipeline.' }] } };

    diagramFigure()(tree as never, file as never);

    // Exactly one dk-diagram figure; the beoe wrapper is gone.
    const dk = findByTag(tree, 'figure');
    expect(dk).toBeDefined();
    expect(classListOf(dk as HastNode)).toContain('dk-diagram');
    expect(classListOf(dk as HastNode)).not.toContain('beoe');
    expect(dk?.properties?.role).toBe('group');

    // The `<svg>` is a DIRECT child of the dk-diagram figure (unwrapped in place).
    const svg = findByTag(dk as HastNode, 'svg');
    expect(svg).toBeDefined();
    expect((dk?.children ?? []).includes(svg as HastNode)).toBe(true);
    // Its accessible <title> survived the unwrap.
    expect(findByTag(svg as HastNode, 'title')?.children?.[0]?.value).toBe('Build pipeline');

    // Client-mode `<pre class="mermaid">` is NOT present on this build path.
    expect(findByTag(tree, 'pre')).toBeUndefined();
  });

  it('names the figure via aria-labelledby → its figcaption (role=group needs an explicit name)', () => {
    const tree = beoeTree();
    const file = { data: { dkDiagrams: [{ description: 'The pipeline.' }] } };

    diagramFigure()(tree as never, file as never);

    const dk = findByTag(tree, 'figure');
    const figcaption = findByTag(dk as HastNode, 'figcaption');
    expect(figcaption).toBeDefined();
    const id = figcaption?.properties?.id;
    expect(id).toBeTruthy();
    expect(dk?.properties?.['aria-labelledby']).toBe(id);
    // The caption description span carries the stashed text.
    expect(findByTag(figcaption as HastNode, 'span')?.children?.[0]?.value).toBe('The pipeline.');
  });
});

// ---------------------------------------------------------------------------
// #13 WP03 (renata WP02 INFO) — PlantUML render-error guard + multi-diagram
// figure-index robustness. `astro-plantuml` emits a raw `<figure class=
// "plantuml-diagram"><svg>…` on success and a raw `<div class="plantuml-error">`
// on failure. `plantumlMeta` stashed one `dkPlantuml` entry per fence (errors
// included), and `diagramFigure` correlates rendered figures to that stash by
// document order. A silently-skipped error node would desync the index (a later
// diagram wearing an earlier one's caption); so a render error must FAIL THE BUILD
// LOUDLY, which also keeps the multi-diagram index aligned by construction.
// ---------------------------------------------------------------------------
describe('diagramFigure — PlantUML multi-diagram index + render-error guard (#13 WP03)', () => {
  interface HastNode {
    type: string;
    tagName?: string;
    properties?: Record<string, unknown>;
    children?: HastNode[];
    value?: string;
  }

  const plantumlFigureRaw = (label: string): HastNode => ({
    type: 'raw',
    value: `<figure class="plantuml-diagram"><svg data-label="${label}"><g/></svg></figure>`,
  });
  const plantumlErrorRaw = (msg: string): HastNode => ({
    type: 'raw',
    value:
      `<div class="plantuml-error"><p>Error generating PlantUML diagram: ${msg}</p>` +
      `<pre><code class="language-plantuml">@startuml\n@enduml</code></pre></div>`,
  });
  const root = (children: HastNode[]): HastNode => ({ type: 'root', children });

  it('aligns EACH of several rendered plantuml figures to its own metadata by document order', () => {
    const tree = root([plantumlFigureRaw('a'), plantumlFigureRaw('b')]);
    const file = {
      data: {
        dkPlantuml: [
          { description: 'First diagram.', name: 'First' },
          { description: 'Second diagram.', name: 'Second' },
        ],
      },
    };

    diagramFigure()(tree as never, file as never);

    // Each rewritten raw figure carries ITS OWN caption description (not swapped).
    const [figA, figB] = (tree.children ?? []) as HastNode[];
    expect(figA.value).toContain('data-label="a"');
    expect(figA.value).toContain('First diagram.');
    expect(figA.value).not.toContain('Second diagram.');
    expect(figB.value).toContain('data-label="b"');
    expect(figB.value).toContain('Second diagram.');
    expect(figB.value).not.toContain('First diagram.');
    // Distinct caption ids (no collision across the two figures).
    expect(figA.value).toContain('dk-diagram-caption-plantuml-0');
    expect(figB.value).toContain('dk-diagram-caption-plantuml-1');
  });

  it('throws loudly on a single plantuml render error (never ships a broken figure)', () => {
    const tree = root([plantumlErrorRaw('server unreachable')]);
    const file = { data: { dkPlantuml: [{ description: 'Diagram.' }] } };
    expect(() => diagramFigure()(tree as never, file as never)).toThrowError(
      /astro-plantuml failed to render.*server unreachable/i,
    );
  });

  it('throws loudly when an error sits BETWEEN two diagrams (the desync case) — index never misaligns', () => {
    // Fence order: [ok-a, ERROR, ok-b] with three stash entries (one per fence).
    // Without the guard, the skipped error node would make `ok-b` read the error
    // fence's metadata. The loud throw prevents any mis-captioned figure shipping.
    const tree = root([
      plantumlFigureRaw('a'),
      plantumlErrorRaw('bad syntax'),
      plantumlFigureRaw('b'),
    ]);
    const file = {
      data: {
        dkPlantuml: [
          { description: 'Diagram A.' },
          { description: 'Diagram B (the errored fence).' },
          { description: 'Diagram C.' },
        ],
      },
    };
    expect(() => diagramFigure()(tree as never, file as never)).toThrowError(
      /astro-plantuml failed to render.*bad syntax/i,
    );
  });

  it('leaves a Mermaid-only tree (no dkPlantuml) untouched by the plantuml guard', () => {
    // A plain code fence that is neither a plantuml figure nor an error must pass
    // through walk() without triggering the guard.
    const tree = root([
      { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: 'hi' }] },
    ]);
    expect(() => diagramFigure()(tree as never, {} as never)).not.toThrow();
  });
});
