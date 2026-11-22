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
  cssEscapeId,
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

  it('clears 4.5:1 for every opaque fill, including the worst mid-grey', () => {
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
    expect(parseLiteralColour('#FFC')).toEqual({ rgb: [255, 255, 204], alpha: 1 });
    expect(parseLiteralColour('#1168bd!important')).toEqual({ rgb: [17, 104, 189], alpha: 1 });
    expect(parseLiteralColour('rgb(1, 2, 3)')).toEqual({ rgb: [1, 2, 3], alpha: 1 });
  });

  it('reads the alpha of rgba(), #rgba and #rrggbbaa', () => {
    expect(parseLiteralColour('rgba(17,104,189,.6)')).toEqual({ rgb: [17, 104, 189], alpha: 0.6 });
    expect(parseLiteralColour('rgb(0 0 0 / 50%)')).toEqual({ rgb: [0, 0, 0], alpha: 0.5 });
    expect(parseLiteralColour('#00000080')?.alpha).toBeCloseTo(128 / 255);
    expect(parseLiteralColour('#0008')?.alpha).toBeCloseTo(136 / 255);
  });

  it('treats a token, a name, none or a gradient as not literal', () => {
    for (const v of ['var(--dk-diagram-node-fill)', 'white', 'none', 'url(#g)']) {
      expect(parseLiteralColour(v), v).toBeNull();
    }
  });
});

describe('labelColourFor — translucent fills (review cycle 1)', () => {
  /** The worst contrast of `text` over the fill composited on any page, from black to white. */
  function worstOverAnyPage(rgb: number[], alpha: number, text: number[]): number {
    let worst = Infinity;
    for (let page = 0; page <= 255; page += 5) {
      const seen = rgb.map((c) => c * alpha + page * (1 - alpha));
      worst = Math.min(worst, contrast(seen, text));
    }
    return worst;
  }

  it('leaves the label themed when no fixed colour clears 4.5:1 over every page', () => {
    // The reviewer's reproductions: each got white, which failed on a light page.
    expect(labelColourFor([17, 104, 189], 0.6)).toBeNull();
    expect(labelColourFor([0, 0, 0], 0.5)).toBeNull();
    expect(labelColourFor([0, 0, 0], 0.3)).toBeNull(); // fill:#000; fill-opacity:.3
  });

  it('picks a colour that clears 4.5:1 over every page when one exists', () => {
    for (const [rgb, alpha] of [[[255, 255, 204], 0.9], [[10, 20, 60], 0.85], [[255, 255, 255], 0.8]] as Array<[number[], number]>) {
      const colour = labelColourFor(rgb, alpha);
      expect(colour, `${rgb} @ ${alpha}`).not.toBeNull();
      const text = colour === '#000000' ? [0, 0, 0] : [255, 255, 255];
      expect(worstOverAnyPage(rgb, alpha, text), `${rgb} @ ${alpha}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never picks a colour that fails over some page', () => {
    for (let v = 0; v <= 255; v += 15) {
      for (const alpha of [0.2, 0.5, 0.75, 0.95]) {
        for (const rgb of [[v, v, v], [v, 0, 255 - v], [255, v, 0]]) {
          const colour = labelColourFor(rgb, alpha);
          if (colour === null) continue;
          const text = colour === '#000000' ? [0, 0, 0] : [255, 255, 255];
          expect(worstOverAnyPage(rgb, alpha, text), `${rgb} @ ${alpha}`).toBeGreaterThanOrEqual(4.5);
        }
      }
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

  it('folds rgba alpha, fill-opacity and opacity into the fill, and leaves a see-through fill themed', () => {
    for (const fill of ['rgba(17,104,189,.6)', 'rgba(0,0,0,.5)']) {
      const node = mermaidNode({ fill });
      const before = JSON.stringify(node);
      run(node);
      expect(JSON.stringify(node), fill).toBe(before);
    }
    const faded = mermaidNode({ fill: '#000' });
    faded.children![0].properties!.style = 'fill:#000;fill-opacity:.3';
    const before = JSON.stringify(faded);
    run(faded);
    expect(JSON.stringify(faded)).toBe(before);
    const nearlyOpaque = mermaidNode({ fill: '#ffffcc' });
    nearlyOpaque.children![0].properties!.style = 'fill:#ffffcc;opacity:0.95';
    run(nearlyOpaque);
    expect(spanOf(nearlyOpaque).properties?.style).toBe('color:#000000!important');
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

  // Real PlantUML 1.2026.9 output (server SVG, node-text sentinel already rewritten).
  const ACTOR = "<g class=\"entity\" data-qualified-name=\"Bob\" id=\"ent0001\" data-source-line=\"2\"><ellipse cx=\"19.528\" cy=\"14\" rx=\"8\" ry=\"8\" fill=\"#FFC0CB\" style=\"stroke:#181818;stroke-width:0.5;\"/><path d=\"M19.528,22 L19.528,49 M6.528,30 L32.528,30 M19.528,49 L6.528,64 M19.528,49 L32.528,64\" style=\"stroke:#181818;stroke-width:0.5;\" fill=\"none\"/><text x=\"6\" y=\"78.495\" fill=\"var(--dk-diagram-node-text)\" font-size=\"14\" textLength=\"27.057\">Bob</text></g>";
  const USECASE = "<g class=\"entity\" data-qualified-name=\"UC\" id=\"ent0002\" data-source-line=\"3\"><ellipse cx=\"115.53\" cy=\"43.654\" rx=\"47.77\" ry=\"14.524\" fill=\"#C9FFC9\" style=\"stroke:#181818;stroke-width:0.5;\"/><text x=\"83.873\" y=\"48.302\" fill=\"var(--dk-diagram-node-text)\" font-size=\"14\" textLength=\"63.314\">Book trip</text></g>";
  const INTERFACE = "<g class=\"entity\" data-qualified-name=\"I\" id=\"ent0003\" data-source-line=\"4\"><ellipse cx=\"19.53\" cy=\"170.8\" rx=\"8\" ry=\"8\" fill=\"#C2F0FF\" style=\"stroke:#181818;stroke-width:0.5;\"/><text x=\"8.456\" y=\"200.795\" fill=\"var(--dk-diagram-node-text)\" font-size=\"14\" textLength=\"22.148\">API</text></g>";

  it('leaves a label drawn outside its shape themed: actor and lollipop interface (squad finding)', () => {
    expect(fixPlantumlRaw(ACTOR)).toBe(ACTOR);
    expect(fixPlantumlRaw(INTERFACE)).toBe(INTERFACE);
  });

  it('pins a label drawn inside an ellipse shape (use case)', () => {
    expect(fixPlantumlRaw(USECASE)).toBe(USECASE.replace('fill="var(--dk-diagram-node-text)"', 'fill="#000000"'));
  });

  it('reads fill-opacity on the shape and leaves a see-through entity themed', () => {
    const block = entity('#000000').replace('fill="#000000"', 'fill="#000000" fill-opacity="0.3"');
    expect(fixPlantumlRaw(block)).toBe(block);
    const styled = entity('#C9FFC9').replace('style="stroke:#181818;', 'style="opacity:0.95;stroke:#181818;');
    expect(fixPlantumlRaw(styled)).toBe(styled.replace('fill="var(--dk-diagram-node-text)"', 'fill="#000000"'));
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

  it('escapes an id that is not a plain CSS identifier', () => {
    expect(cssEscapeId('m0046-0')).toBe('m0046-0');
    expect(cssEscapeId('1abc')).toBe('\\31 abc');
    expect(cssEscapeId('a:b.c')).toBe('a\\:b\\.c');
    const svg = { type: 'element', tagName: 'svg', properties: { id: '9x', ariaRoleDescription: 'flowchart-v2' }, children: [] as Array<{ children: Array<{ value: string }> }> };
    pinDiagramLabelFont()({ type: 'root', children: [svg] } as never);
    expect(svg.children[0].children[0].value.startsWith('#\\39 x foreignObject')).toBe(true);
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
