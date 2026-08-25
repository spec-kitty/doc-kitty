import { describe, it, expect } from 'vitest';
import { resolveTheme, emitTokenSheet } from '../lib/theme.js';

/*
 * ADR-0024 Decision 5 (contract CT-1): prove the promoted Default `--dk-diagram-*`
 * pairs meet WCAG 2.2 AA — SIZE-AWARE — in BOTH modes, at the foundation where the
 * values are authored (not two groups later in the Playwright lane; axe does not
 * evaluate SVG contrast). Astro-free: it reads the Default catalog straight out of
 * `theme.ts` — light values from `resolveTheme(undefined).tokens`, dark values from
 * the dark block `emitTokenSheet` re-declares from `DEFAULT_DARK`.
 */

// --- WCAG 2.2 relative-luminance + contrast-ratio (inlined; no repo helper) ----
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const h = hex.replace('#', '').trim();
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const DIAGRAM_KEYS = [
  '--dk-diagram-node-fill',
  '--dk-diagram-node-border',
  '--dk-diagram-node-text',
  '--dk-diagram-edge',
  '--dk-diagram-subgraph-title',
  '--dk-diagram-cluster-fill',
] as const;

/** Read one `--dk-*` value from a CSS declaration block body. */
function readDecl(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  expect(m, `${name} must be declared`).not.toBeNull();
  return (m as RegExpMatchArray)[1].trim();
}

// Light: the Default catalog straight from resolveTheme (DEFAULT_BASE → tokens).
const light = resolveTheme(undefined).tokens;

// Dark: the block emitTokenSheet re-declares from DEFAULT_DARK for the Default.
const sheet = emitTokenSheet(resolveTheme(undefined));
const darkMarker = ":root[data-theme='dark'] {";
const darkStart = sheet.indexOf(darkMarker);
const darkBlock = sheet.slice(darkStart, sheet.indexOf('}', darkStart));
const dark = Object.fromEntries(DIAGRAM_KEYS.map((k) => [k, readDecl(darkBlock, k)]));

// The Default page background each mode paints behind a diagram (theme.css :root
// / [data-theme='dark']) — the reference for the node-border ≥3:1 check.
const PAGE_BG = { light: '#ffffff', dark: '#131721' } as const;

describe.each([
  { mode: 'light' as const, t: light, bg: PAGE_BG.light },
  { mode: 'dark' as const, t: dark, bg: PAGE_BG.dark },
])('Default --dk-diagram-* AA pairs — $mode', ({ t, bg }) => {
  const nodeFill = t['--dk-diagram-node-fill'];
  const nodeBorder = t['--dk-diagram-node-border'];
  const nodeText = t['--dk-diagram-node-text'];
  const edge = t['--dk-diagram-edge'];
  const title = t['--dk-diagram-subgraph-title'];
  const cluster = t['--dk-diagram-cluster-fill'];

  it('declares all six diagram tokens', () => {
    for (const k of DIAGRAM_KEYS) expect(t[k], `${k} present`).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  // Body text on node fills — ≥4.5:1 (normal-size text).
  it('node-text on node-fill ≥ 4.5:1', () => {
    expect(ratio(nodeText, nodeFill)).toBeGreaterThanOrEqual(4.5);
  });

  // Non-text / large-graphic strokes against the subgraph background — ≥3:1.
  it('edge vs cluster-fill ≥ 3:1', () => {
    expect(ratio(edge, cluster)).toBeGreaterThanOrEqual(3);
  });
  it('subgraph-title vs cluster-fill ≥ 3:1', () => {
    expect(ratio(title, cluster)).toBeGreaterThanOrEqual(3);
  });

  // Node borders must read against BOTH the page bg and the subgraph bg — ≥3:1.
  it('node-border vs page bg ≥ 3:1', () => {
    expect(ratio(nodeBorder, bg)).toBeGreaterThanOrEqual(3);
  });
  it('node-border vs cluster-fill ≥ 3:1', () => {
    expect(ratio(nodeBorder, cluster)).toBeGreaterThanOrEqual(3);
  });
});
