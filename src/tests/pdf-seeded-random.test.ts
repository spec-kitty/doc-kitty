/**
 * `dockitty-pdf` pins the page's `Math.random` before any page script runs, so a
 * client-mode Mermaid render (whose edge paths use it) draws the same bytes in every
 * print, and two prints of one build stay identical (#394, review of #462). The init
 * script runs in the page; here it runs in a fresh `vm` context standing in for one.
 */
import { describe, it, expect } from 'vitest';
import { createContext, runInContext } from 'node:vm';
import { pdfPageInit } from '../scripts/dockitty-pdf.mjs';

/** A fresh page stand-in: its own `Math` and a `window` with working storage. */
function freshPage(): { ctx: object; stored: Map<string, string> } {
  const stored = new Map<string, string>();
  const ctx = createContext({
    window: { localStorage: { setItem: (k: string, v: string) => stored.set(k, v) } },
  });
  runInContext('window.Math = Math;', ctx);
  return { ctx, stored };
}

function draws(ctx: object, n: number): number[] {
  return runInContext(`Array.from({ length: ${n} }, () => Math.random())`, ctx) as number[];
}

describe('pdfPageInit', () => {
  it('gives every page the same Math.random sequence', () => {
    const a = freshPage();
    const b = freshPage();
    runInContext(`(${pdfPageInit.toString()})()`, a.ctx);
    runInContext(`(${pdfPageInit.toString()})()`, b.ctx);
    const first = draws(a.ctx, 20);
    expect(draws(b.ctx, 20)).toEqual(first);
  });

  it('draws values in [0, 1) that are not all alike', () => {
    const page = freshPage();
    runInContext(`(${pdfPageInit.toString()})()`, page.ctx);
    const values = draws(page.ctx, 200);
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(190);
  });

  it('still stores the light theme', () => {
    const page = freshPage();
    runInContext(`(${pdfPageInit.toString()})()`, page.ctx);
    expect(page.stored.get('starlight-theme')).toBe('light');
  });

  it('control: an unseeded page differs from another', () => {
    expect(draws(freshPage().ctx, 5)).not.toEqual(draws(freshPage().ctx, 5));
  });
});
