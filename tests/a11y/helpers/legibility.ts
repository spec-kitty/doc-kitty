// Diagram legibility measurement for the a11y lane (#369, #370).
//
// Contrast is measured against what is PAINTED behind a label or an edge, not
// against a guessed backdrop. A DOM walk for the backdrop (`elementsFromPoint`)
// missed the very defect it was meant to catch, so this helper reads pixels:
//   1. collect every label and every edge in the build-rendered diagrams, with its
//      computed foreground colour and the page points to sample;
//   2. hide them all, take ONE full-page screenshot, then restore them;
//   3. decode that PNG in a page canvas and read the backdrop at each point.
// No image library is needed: the browser decodes its own screenshot.
//
// Fit is measured on Mermaid's HTML labels: a `foreignObject` whose content is
// wider or taller than the box Mermaid sized at render time cuts the label off.
import type { Page } from '@playwright/test';

/** One label: its text, foreground and the backdrop behind its text box. */
export interface LabelReading {
  figure: number;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
}

/** One edge: the lowest contrast found along its length. `authored` marks a
 * stroke the diagram author set (a Mermaid `linkStyle`), which is reported but
 * not held to the themed-edge threshold. */
export interface EdgeReading {
  figure: number;
  id: string;
  stroke: string;
  bg: string;
  ratio: number;
  authored: boolean;
}

/** A label whose content overflows the box Mermaid sized for it. */
export interface OverflowReading {
  figure: number;
  text: string;
  boxWidth: number;
  contentWidth: number;
  boxHeight: number;
  contentHeight: number;
}

export interface LegibilityReport {
  figures: number;
  labels: LabelReading[];
  edges: EdgeReading[];
  overflow: OverflowReading[];
}

/** WCAG 2.x contrast ratio of two `[r, g, b]` colours (0–255). */
export function contrastRatio(a: readonly number[], b: readonly number[]): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const lum = (c: readonly number[]): number => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The colour shape passed between Node and the page. */
type Rgb = [number, number, number];

interface Target {
  kind: 'label' | 'edge';
  figure: number;
  text: string;
  fg: Rgb;
  fgText: string;
  authored: boolean;
  /** Page-coordinate points (CSS px from the document origin) to sample. */
  points: Array<[number, number]>;
}

/**
 * Measure every build-rendered diagram on the page (`figure.dk-diagram > svg`).
 * Call it once the page has settled (fonts loaded, theme resolved).
 */
export async function measureLegibility(page: Page): Promise<LegibilityReport> {
  // Step 1: collect targets and hide them.
  const collected = await page.evaluate(() => {
    const parse = (value: string): [number, number, number] | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (!m) return null;
      const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length > 3 && parts[3] === 0) return null; // fully transparent
      return [parts[0], parts[1], parts[2]];
    };
    const sx = window.scrollX;
    const sy = window.scrollY;
    const targets: Array<{
      kind: 'label' | 'edge';
      figure: number;
      text: string;
      fg: [number, number, number];
      fgText: string;
      authored: boolean;
      points: Array<[number, number]>;
    }> = [];
    const hidden: Element[] = [];
    const overflow: Array<{
      figure: number;
      text: string;
      boxWidth: number;
      contentWidth: number;
      boxHeight: number;
      contentHeight: number;
    }> = [];
    const figures = [...document.querySelectorAll('figure.dk-diagram')].filter((f) => f.querySelector(':scope > svg'));

    figures.forEach((figure, fi) => {
      const svg = figure.querySelector(':scope > svg') as SVGSVGElement;

      // Labels: the nearest element holding each run of visible text.
      const owners = new Set<Element>();
      const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const parent = n.parentElement;
        if (!parent || !n.textContent?.trim()) continue;
        if (parent.closest('style, title, desc, defs')) continue;
        owners.add(parent.closest('text') ?? parent);
      }
      for (const owner of owners) {
        const range = document.createRange();
        range.selectNodeContents(owner);
        const rect = range.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const cs = getComputedStyle(owner);
        const isSvgText = owner instanceof SVGElement;
        const fgText = isSvgText ? cs.fill : cs.color;
        const fg = parse(fgText);
        if (!fg) continue;
        // A 5 x 3 grid inside the text box; the backdrop is the most frequent
        // pixel there once the text itself is hidden.
        const points: Array<[number, number]> = [];
        for (let ix = 1; ix <= 5; ix++) {
          for (let iy = 1; iy <= 3; iy++) {
            points.push([rect.left + sx + (rect.width * ix) / 6, rect.top + sy + (rect.height * iy) / 4]);
          }
        }
        targets.push({ kind: 'label', figure: fi, text: owner.textContent!.trim().replace(/\s+/g, ' '), fg, fgText, authored: false, points });
        hidden.push(owner);
      }

      // Edges: Mermaid flowchart links and PlantUML links. Where an edge label sits on
      // the edge, the label box covers it: those points show the label, not the edge,
      // so they are left out (the label's own contrast is measured above).
      const labelBoxes = [...svg.querySelectorAll('g.edgeLabel, g.link > text')]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0);
      const underLabel = (x: number, y: number): boolean =>
        labelBoxes.some((r) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1);
      const edges = [...svg.querySelectorAll('path.flowchart-link, g.link > path')] as SVGPathElement[];
      for (const edge of edges) {
        const cs = getComputedStyle(edge);
        const fg = parse(cs.stroke);
        if (!fg || typeof edge.getTotalLength !== 'function') continue;
        const length = edge.getTotalLength();
        const ctm = edge.getScreenCTM();
        if (!length || !ctm) continue;
        // Themed edges take their stroke from the token; anything else is the author's.
        const declared = `${edge.getAttribute('style') ?? ''}`;
        const themed = getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-edge').trim();
        const themedRgb = (() => {
          const probe = document.createElement('span');
          probe.style.color = themed;
          document.body.append(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        })();
        const authored = /stroke\s*:\s*#/i.test(declared) || cs.stroke !== themedRgb;
        const points: Array<[number, number]> = [];
        for (let i = 1; i < 16; i++) {
          const p = edge.getPointAtLength((length * i) / 16);
          const sp = new DOMPoint(p.x, p.y).matrixTransform(ctm);
          if (!underLabel(sp.x, sp.y)) points.push([sp.x + sx, sp.y + sy]);
        }
        if (points.length === 0) continue;
        targets.push({ kind: 'edge', figure: fi, text: edge.id || edge.getAttribute('class') || 'edge', fg, fgText: cs.stroke, authored, points });
        hidden.push(edge);
      }
      // Arrowheads and PlantUML arrow polygons would otherwise paint over the sampled backdrop.
      for (const extra of svg.querySelectorAll('marker, g.link > polygon')) hidden.push(extra);

      // Fit: Mermaid HTML labels.
      for (const fo of svg.querySelectorAll('foreignObject')) {
        const content = fo.firstElementChild as HTMLElement | null;
        if (!content || !fo.textContent?.trim()) continue;
        const boxWidth = (fo as SVGForeignObjectElement).width.baseVal.value;
        const boxHeight = (fo as SVGForeignObjectElement).height.baseVal.value;
        if (content.scrollWidth > boxWidth + 1 || content.scrollHeight > boxHeight + 1) {
          overflow.push({
            figure: fi,
            text: fo.textContent.trim().replace(/\s+/g, ' '),
            boxWidth,
            contentWidth: content.scrollWidth,
            boxHeight,
            contentHeight: content.scrollHeight,
          });
        }
      }
    });

    for (const el of hidden) (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
    (window as unknown as { __dkHidden: Element[] }).__dkHidden = hidden;
    return { figures: figures.length, targets, overflow };
  });

  // Step 2: one screenshot with every label and edge hidden.
  const png = await page.screenshot({ fullPage: true, animations: 'disabled', scale: 'css' });

  // Step 3: restore, then sample the screenshot in a canvas.
  const samples = await page.evaluate(
    async ({ b64, targets }) => {
      for (const el of (window as unknown as { __dkHidden: Element[] }).__dkHidden) {
        (el as HTMLElement).style.removeProperty('visibility');
      }
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const at = (x: number, y: number): [number, number, number] => {
        const px = Math.min(canvas.width - 1, Math.max(0, Math.round(x)));
        const py = Math.min(canvas.height - 1, Math.max(0, Math.round(y)));
        const d = ctx.getImageData(px, py, 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      return targets.map((t) => t.points.map(([x, y]) => at(x, y)));
    },
    { b64: png.toString('base64'), targets: collected.targets as Target[] },
  );

  const hex = (c: readonly number[]): string => `rgb(${c[0]},${c[1]},${c[2]})`;
  const labels: LabelReading[] = [];
  const edges: EdgeReading[] = [];
  collected.targets.forEach((t, i) => {
    const pts = samples[i];
    if (t.kind === 'label') {
      // Most frequent backdrop colour in the text box.
      const counts = new Map<string, { c: number[]; n: number }>();
      for (const c of pts) {
        const key = c.join(',');
        const entry = counts.get(key) ?? { c, n: 0 };
        entry.n += 1;
        counts.set(key, entry);
      }
      const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0].c;
      labels.push({ figure: t.figure, text: t.text.slice(0, 60), fg: t.fgText, bg: hex(bg), ratio: round(contrastRatio(t.fg, bg)) });
    } else {
      // Lowest contrast along the edge.
      let worst = { ratio: Infinity, bg: pts[0] };
      for (const c of pts) {
        const r = contrastRatio(t.fg, c);
        if (r < worst.ratio) worst = { ratio: r, bg: c };
      }
      edges.push({ figure: t.figure, id: t.text, stroke: t.fgText, bg: hex(worst.bg), ratio: round(worst.ratio), authored: t.authored });
    }
  });

  return { figures: collected.figures, labels, edges, overflow: collected.overflow };
}

const round = (n: number): number => Math.round(n * 100) / 100;
