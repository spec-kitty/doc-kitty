// Label contrast on author fills (#369 item 2), the rgba sentinel rewrite (#369) and
// the pinned label font (#370). The browser check (tests/a11y/diagram-legibility.spec.ts)
// proves the outcome on a real build; these pin each rule on its own.
import { describe, it, expect } from 'vitest';
import diagramLabelContrast, {
  fixPlantumlRaw,
  labelColourFor,
  parseLiteralColour,
  type LabelHastNode,
} from '../lib/rehype/diagram-label-contrast.js';
import {
  BUILD_MERMAID_OPTS,
  DIAGRAM_LABEL_FONT_STACK,
  DIAGRAM_SENTINELS,
  labelFontRule,
  pinDiagramLabelFont,
  sentinelThemeRewrite,
} from '../lib/integrations/diagrams.js';

/** WCAG contrast of two `[r,g,b]` colours. */
function contrast(a: readonly number[], b: readonly number[]): number {
  const ch = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c: readonly number[]): number => 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const el = (tagName: string, properties: Record<string, unknown> = {}, children: LabelHastNode[] = []): LabelHastNode => ({
  type: 'element',
  tagName,
  properties,
  children,
});

/** A Mermaid node group as `@beoe` bakes it: shape, then `g.label > foreignObject > div > span.nodeLabel > p`. */
function mermaidNode(opts: { fill: string; spanStyle?: string; labelStyle?: string; divStyle?: string }): LabelHastNode {
  return el('g', { className: ['node', 'default'] }, [
    el('rect', { className: ['basic', 'label-container'], style: `fill:${opts.fill}!important;stroke:#000!important` }),
    el('g', { className: ['label'], ...(opts.labelStyle ? { style: opts.labelStyle } : {}) }, [
      el('rect'),
      el('foreignObject', { width: 100, height: 24 }, [
        el('div', { style: opts.divStyle ?? 'display:table-cell;white-space:nowrap' }, [
          el('span', { className: ['nodeLabel'], ...(opts.spanStyle !== undefined ? { style: opts.spanStyle } : {}) }, [
            el('p', {}, [{ type: 'text', value: 'Label' }]),
          ]),
        ]),
      ]),
    ]),
  ]);
}

/** Run the plugin over one Mermaid `<svg>` holding `groups`; return the tree. */
function run(...groups: LabelHastNode[]): LabelHastNode {
  const tree: LabelHastNode = {
    type: 'root',
    children: [el('svg', { ariaRoleDescription: 'flowchart-v2' }, [el('g', { className: ['root'] }, [el('g', { className: ['nodes'] }, groups)])])],
  };
  diagramLabelContrast()(tree);
  return tree;
}

const spanOf = (group: LabelHastNode): LabelHastNode => {
  let found: LabelHastNode | undefined;
  const walk = (n: LabelHastNode): void => {
    const c = n.properties?.className;
    if (Array.isArray(c) && c.includes('nodeLabel')) found = n;
    for (const child of n.children ?? []) walk(child);
  };
  walk(group);
  if (!found) throw new Error('no nodeLabel');
  return found;
};

describe('labelColourFor', () => {
  it('picks black on a pale fill and white on a deep one', () => {
    expect(labelColourFor([255, 255, 204])).toBe('#000000'); // ArchiMate business
    expect(labelColourFor([17, 104, 189])).toBe('#ffffff'); // deep blue
  });

  it('clears 4.5:1 for every fill, including the worst mid-grey', () => {
    let worst = Infinity;
    for (let v = 0; v <= 255; v += 1) {
      for (const fill of [[v, v, v], [v, 0, 0], [0, v, 0], [0, 0, v], [255, v, 0]]) {
        const text = labelColourFor(fill) === '#000000' ? [0, 0, 0] : [255, 255, 255];
        worst = Math.min(worst, contrast(fill, text));
      }
    }
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });
});

describe('parseLiteralColour', () => {
  it('reads hex, short hex and rgb(), with or without !important', () => {
    expect(parseLiteralColour('#FFC')).toEqual([255, 255, 204]);
    expect(parseLiteralColour('#1168bd!important')).toEqual([17, 104, 189]);
    expect(parseLiteralColour('rgb(1, 2, 3)')).toEqual([1, 2, 3]);
  });

  it('treats a token, a name, none, a gradient or a mostly transparent fill as not literal', () => {
    for (const v of ['var(--dk-diagram-node-fill)', 'white', 'none', 'url(#g)', 'rgba(1,2,3,.2)']) {
      expect(parseLiteralColour(v), v).toBeNull();
    }
  });
});

describe('diagramLabelContrast — Mermaid', () => {
  it('pins black on a pale author fill whose label has no author colour (FR-002)', () => {
    const node = mermaidNode({ fill: '#ffc', spanStyle: 'fill:#ffc!important;stroke:#993!important' });
    run(node);
    expect(spanOf(node).properties?.style).toBe('fill:#ffc!important;stroke:#993!important;color:#000000!important');
  });

  it('pins white on a deep author fill', () => {
    const node = mermaidNode({ fill: '#1168bd' });
    run(node);
    expect(spanOf(node).properties?.style).toBe('color:#ffffff!important');
  });

  it('keeps an author label colour, wherever Mermaid put it (FR-003)', () => {
    for (const where of ['labelStyle', 'divStyle', 'spanStyle'] as const) {
      const node = mermaidNode({ fill: '#1d6b3a', [where]: 'color:#fff!important' });
      const before = JSON.stringify(node);
      run(node);
      expect(JSON.stringify(node), where).toBe(before);
    }
  });

  it('leaves a themed fill and its themed label alone', () => {
    const node = mermaidNode({ fill: 'var(--dk-diagram-node-fill)' });
    const before = JSON.stringify(node);
    run(node);
    expect(JSON.stringify(node)).toBe(before);
  });

  it('replaces a themed inline label colour on an author-filled cluster', () => {
    const cluster = el('g', { className: ['cluster'] }, [
      el('rect', { style: 'fill:#ffffcc;stroke:var(--dk-diagram-node-border)' }),
      el('foreignObject', { className: ['cluster-label'] }, [
        el('div', {}, [el('span', { className: ['nodeLabel'], style: 'color:var(--dk-diagram-subgraph-title)' }, [])]),
      ]),
    ]);
    run(cluster);
    expect(spanOf(cluster).properties?.style).toBe('color:#000000!important');
  });

  it('touches nothing outside a Mermaid <svg>', () => {
    const node = mermaidNode({ fill: '#ffc' });
    const tree: LabelHastNode = { type: 'root', children: [el('div', {}, [node])] };
    const before = JSON.stringify(tree);
    diagramLabelContrast()(tree);
    expect(JSON.stringify(tree)).toBe(before);
  });
});

describe('diagramLabelContrast — PlantUML (FR-001)', () => {
  const entity = (fill: string, textFill = 'var(--dk-diagram-node-text)'): string =>
    `<g class="entity" data-qualified-name="op" id="ent0001"><rect x="7" y="7" width="80" height="56" fill="${fill}" style="stroke:#181818;stroke-width:0.5;"></rect>` +
    `<path d="M1,1" fill="#000"></path><text x="17" y="36" fill="${textFill}" font-size="14">Operator</text></g>`;

  it('pins black on the ArchiMate layer fills', () => {
    for (const fill of ['#FFFFCC', '#C2F0FF', '#C9FFC9']) {
      expect(fixPlantumlRaw(entity(fill))).toBe(entity(fill, '#000000'));
    }
  });

  it('leaves a themed fill, an author text colour and every non-entity byte alone', () => {
    const themed = entity('var(--dk-diagram-node-fill)');
    expect(fixPlantumlRaw(themed)).toBe(themed);
    const authored = entity('#FFFFCC', '#7a0000');
    expect(fixPlantumlRaw(authored)).toBe(authored);
    const link = '<g class="link"><path d="M0,0" style="stroke:var(--dk-diagram-edge)"></path><text fill="var(--dk-diagram-node-text)">uses</text></g>';
    const html = `<figure><svg>${link}${entity('#FFFFCC')}${link}</svg></figure>`;
    expect(fixPlantumlRaw(html)).toBe(`<figure><svg>${link}${entity('#FFFFCC', '#000000')}${link}</svg></figure>`);
  });

  it('runs on the raw PlantUML node in the rehype tree', () => {
    const tree: LabelHastNode = { type: 'root', children: [{ type: 'raw', value: `<svg>${entity('#FFFFCC')}</svg>` }] };
    diagramLabelContrast()(tree);
    expect(tree.children?.[0].value).toBe(`<svg>${entity('#FFFFCC', '#000000')}</svg>`);
  });
});

describe('sentinelThemeRewrite — rgb()/rgba() sentinels (#369)', () => {
  const rewrite = (css: string): string => {
    const tree = { type: 'root', children: [{ type: 'text', value: css }] };
    sentinelThemeRewrite()(tree as never);
    return (tree.children[0] as { value: string }).value;
  };

  it("maps Mermaid's translucent edge-label halo to the token at the same alpha", () => {
    expect(rewrite('.labelBkg{background-color:rgba(225,240,193,.5)}')).toBe(
      '.labelBkg{background-color:color-mix(in srgb,var(--dk-diagram-node-fill) 50%,transparent)}',
    );
  });

  it('maps an opaque rgb() sentinel, in either notation, to the plain token', () => {
    expect(rewrite('a{fill:rgb(122, 63, 240)}b{fill:rgb(122 63 240 / 100%)}')).toBe(
      'a{fill:var(--dk-diagram-edge)}b{fill:var(--dk-diagram-edge)}',
    );
  });

  it('leaves a non-sentinel rgba() alone, and covers all six sentinels', () => {
    expect(rewrite('a{color:rgba(225,240,194,.5)}')).toBe('a{color:rgba(225,240,194,.5)}');
    for (const [token, hex] of Object.entries(DIAGRAM_SENTINELS)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(rewrite(`x{c:rgba(${r},${g},${b},0.25)}`)).toBe(`x{c:color-mix(in srgb,var(--dk-diagram-${token}) 25%,transparent)}`);
    }
  });
});

describe('pinned label font (#370)', () => {
  it('measures labels in the pinned stack at render time', () => {
    expect(BUILD_MERMAID_OPTS.mermaidConfig.fontFamily).toBe(DIAGRAM_LABEL_FONT_STACK);
  });

  it('writes the same rule into each Mermaid SVG, scoped to its id', () => {
    const svg = {
      type: 'element',
      tagName: 'svg',
      properties: { id: 'm42-0', ariaRoleDescription: 'flowchart-v2' },
      children: [{ type: 'element', tagName: 'style', properties: {}, children: [{ type: 'text', value: '#m42-0 p{margin:0}' }] }],
    };
    pinDiagramLabelFont()({ type: 'root', children: [svg] } as never);
    const texts = svg.children[0].children.map((c) => (c as { value: string }).value);
    expect(texts).toEqual(['#m42-0 p{margin:0}', labelFontRule('#m42-0')]);
    expect(labelFontRule('#m42-0')).toBe(
      `#m42-0 foreignObject,#m42-0 foreignObject *{font-family:${DIAGRAM_LABEL_FONT_STACK}!important}`,
    );
  });

  it('adds a <style> when the SVG has none, and leaves a non-Mermaid <svg> alone', () => {
    const mermaid = { type: 'element', tagName: 'svg', properties: { id: 'm1', ariaRoleDescription: 'sequence' }, children: [] as unknown[] };
    const other = { type: 'element', tagName: 'svg', properties: { id: 'icon' }, children: [] as unknown[] };
    pinDiagramLabelFont()({ type: 'root', children: [mermaid, other] } as never);
    expect(mermaid.children).toHaveLength(1);
    expect(other.children).toHaveLength(0);
  });
});
