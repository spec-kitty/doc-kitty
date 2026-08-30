// Shared colour-read helpers for the a11y lane (WP01, #34).
//
// CONVENTION: read node fill via `nodeFill`+`toPass`; a bare `expect.poll` with a
// throwing read reintroduces the #34 flake class.
//
// The flake this closes: `toRgbTriple` used to throw on `''` (an unparseable
// colour), and Mermaid's async theme re-render can transiently leave the node
// shape absent/unstyled mid-flush. A raw `expect.poll` aborts on ANY thrown
// error from its callback (it does not retry past a throw), so that throw
// surfaced as `Cannot parse colour ''` instead of a retry. The fix here is
// twofold: `nodeFill` never throws (it resolves the not-ready sentinel `''`
// instead of throwing when the shape isn't there yet), and callers wrap the
// colour-equality read in `expect(async () => {...}).toPass({ timeout })` so a
// transient sentinel is retried rather than aborting the assertion.

import type { Locator } from '@playwright/test';

/** Returned by `toRgbTriple('')` (and any other unparseable colour). A unique
 * string that can NEVER equal a real `r,g,b` triple (a triple is always
 * three comma-joined base-10 integers, never containing `<` or `>`), so a
 * sentinel-vs-sentinel or sentinel-vs-real comparison always fails rather than
 * green-washing a not-ready read. */
export const EMPTY_COLOUR_SENTINEL = '<empty>';

/** Canonical `r,g,b` triple from a `#rrggbb`/`#rgb` or `rgb()/rgba()` string, so
 * a token (hex) and a computed style (rgb()) compare correctly (finding F3/F4).
 * Empty-tolerant: an unparseable value (notably `''`, the not-ready sentinel
 * `nodeFill` resolves before Mermaid has styled the shape) maps to
 * `EMPTY_COLOUR_SENTINEL` instead of throwing, so a caller polling this via
 * `toPass` retries instead of aborting on a thrown error. */
export function toRgbTriple(value: string): string {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(v);
  if (rgb) {
    return rgb[1].split(',').slice(0, 3).map((n) => Math.round(parseFloat(n.trim()))).join(',');
  }
  return EMPTY_COLOUR_SENTINEL;
}

/** The rendered fill of the figure's first Mermaid node shape — the DIRECTLY
 * mapped attribute (`--dk-diagram-node-fill` → Mermaid `mainBkg`/`primaryColor`).
 * Read via `getComputedStyle` so it resolves whether Mermaid set it as a `fill`
 * attribute, inline `style`, or an in-`<svg>` `<style>` rule.
 *
 * NEVER throws: while the async re-render is flushing, the node shape can be
 * transiently absent; this resolves `''` (the not-ready sentinel — see
 * `toRgbTriple`) instead of throwing, so a caller polling this via `toPass`
 * retries instead of aborting. */
export async function nodeFill(figure: Locator): Promise<string> {
  return figure.locator('pre.mermaid svg').first().evaluate((svg) => {
    const shape = svg.querySelector('.node rect, .node polygon, .node path, .node circle, .node ellipse');
    if (!shape) return '';
    return getComputedStyle(shape as Element).fill;
  });
}
