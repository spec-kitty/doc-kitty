/**
 * WP01 T003 — node-project unit checks for the pure string/const surface
 * (contract C-5: "node for the pure string/const … the pre-paint script *string*
 * shape / no async attrs"). No DOM here — this suite guards the no-flash contract
 * structurally: the breakpoint constant and that `PRE_PAINT_SCRIPT` is a classic
 * (non-module, non-deferred, non-async) inline script body.
 */
import { describe, it, expect } from 'vitest';
import { TOC_BREAKPOINT, TOC_BREAKPOINT_PX } from '../lib/toc-rail/preference.js';
import { PRE_PAINT_SCRIPT } from '../lib/toc-rail/pre-paint.js';

describe('toc-rail breakpoint constant (C-002 / C-5)', () => {
  it('is Starlight\'s two-column TOC breakpoint', () => {
    expect(TOC_BREAKPOINT).toBe('72rem');
  });

  it('exposes the px equivalent (72rem × 16) for viewport-sized tests', () => {
    expect(TOC_BREAKPOINT_PX).toBe(1152);
  });
});

describe('PRE_PAINT_SCRIPT shape (no-flash contract, C-1 / C-5 / NFR-001)', () => {
  it('is a non-empty string', () => {
    expect(typeof PRE_PAINT_SCRIPT).toBe('string');
    expect(PRE_PAINT_SCRIPT.length).toBeGreaterThan(0);
  });

  it('carries NO type=module / defer / async tokens (stays a classic sync script)', () => {
    expect(PRE_PAINT_SCRIPT).not.toMatch(/type\s*=\s*["']?module/i);
    expect(PRE_PAINT_SCRIPT).not.toMatch(/\bdefer\b/i);
    expect(PRE_PAINT_SCRIPT).not.toMatch(/\basync\b/i);
  });

  it('reads the persistence key inside a try/catch and sets the collapse attribute', () => {
    expect(PRE_PAINT_SCRIPT).toContain("localStorage.getItem('dk-toc-collapsed')");
    expect(PRE_PAINT_SCRIPT).toMatch(/try\s*\{/);
    expect(PRE_PAINT_SCRIPT).toMatch(/catch\s*\(/);
    expect(PRE_PAINT_SCRIPT).toContain("setAttribute('data-toc-collapsed'");
  });
});
