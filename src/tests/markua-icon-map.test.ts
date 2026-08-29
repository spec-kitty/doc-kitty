/**
 * WP03 T011 — vitest for `icon-map.ts`: mapped hit, unmapped miss-with-warning,
 * no-`fa-`-prefix, no-icon input, and purity/determinism (US4 sc.1/sc.2, FR-009,
 * FR-010, NFR-002; contract `icon-map.md`).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  lookup,
  resolveIcon,
  iconGlyphSvg,
  ICON_SEED,
  type IconMapEntry,
} from '../lib/markua/icon-map.js';

// Re-derive the seed's mapping for fa-lightbulb from the contract rather than
// hardcoding the Starlight name twice — keeps this test honest if the seed
// source-of-truth ever moves the mapped target.
const LIGHTBULB_TARGET = lookup('fa-lightbulb');

describe('resolveIcon (WP03 T010) — mapped hit', () => {
  it('resolves a seeded fa- name to its Starlight name (US4 sc.1)', () => {
    expect(LIGHTBULB_TARGET).toBeDefined();
    expect(resolveIcon('fa-lightbulb')).toBe(LIGHTBULB_TARGET);
  });

  it('resolves lookup() the same way as resolveIcon() for a mapped name', () => {
    expect(resolveIcon('fa-cog')).toBe(lookup('fa-cog'));
    expect(lookup('fa-cog')).toBeDefined();
  });
});

describe('resolveIcon — unmapped miss (US4 sc.2, FR-010, NFR-002)', () => {
  it('returns undefined and emits a console.warn naming the unmapped fa- value', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = resolveIcon('fa-obscure-name');
      expect(result).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('fa-obscure-name');
      expect(String(spy.mock.calls[0]?.[0])).toMatch(/^\[markua\]/);
    } finally {
      spy.mockRestore();
    }
  });

  it('never throws for an unmapped name', () => {
    expect(() => resolveIcon('fa-does-not-exist')).not.toThrow();
  });
});

describe('resolveIcon — no `fa-` prefix is treated as unmapped', () => {
  it('drops a bare name with no fa- prefix and warns', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveIcon('lightbulb')).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(String(spy.mock.calls[0]?.[0])).toContain('lightbulb');
    } finally {
      spy.mockRestore();
    }
  });

  it('lookup() also treats a non-prefixed name as unmapped, without warning (pure)', () => {
    expect(lookup('lightbulb')).toBeUndefined();
  });
});

describe('resolveIcon — no icon given', () => {
  it('returns undefined for undefined input, with no warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveIcon(undefined)).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it('returns undefined for empty-string input, with no warning', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(resolveIcon('')).toBeUndefined();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('lookup — purity, determinism, and map integrity', () => {
  it('returns the same value across repeated calls (deterministic)', () => {
    const first = lookup('fa-star');
    const second = lookup('fa-star');
    const third = lookup('fa-star');
    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(first).toBeDefined();
  });

  it('never throws, including for malformed input', () => {
    expect(() => lookup('')).not.toThrow();
    expect(() => lookup('fa-')).not.toThrow();
  });

  it('has no duplicate fa keys in the seed (single source of truth)', () => {
    // Derive the fa keys from the exported ICON_SEED itself rather than a re-typed
    // probe literal, so a duplicate row added to the seed surfaces here directly.
    const faKeys = ICON_SEED.map((entry) => entry.fa);
    expect(new Set(faKeys).size).toBe(faKeys.length);
    // Every seed fa key must be independently addressable through lookup().
    expect(faKeys.every((fa) => lookup(fa) !== undefined)).toBe(true);
  });

  it('IconMapEntry shape is usable as a plain object literal (type-level smoke check)', () => {
    const entry: IconMapEntry = { fa: 'fa-example', starlight: 'example' };
    expect(entry.fa).toBe('fa-example');
    expect(entry.starlight).toBe('example');
  });
});

// FIX 2 — seed ⊆ glyph parity guard (FR-009). ICON_SEED's starlight targets and
// ICON_GLYPH_INNER's keys are two parallel hand-maintained lists. A future seed
// row whose target has no curated glyph would make resolveIcon a HIT that emits
// an EMPTY `dk-callout__icon` span (silently re-opening the empty-icon defect).
// Close the class by construction: every seed target must have a well-formed
// iconGlyphSvg. This also gives iconGlyphSvg its first direct unit coverage.
describe('every ICON_SEED target has a curated glyph (FIX 2 parity guard)', () => {
  it.each(ICON_SEED.map((e) => [e.fa, e.starlight] as const))(
    '%s → %s has a well-formed <svg> glyph',
    (_fa, starlight) => {
      const svg = iconGlyphSvg(starlight);
      expect(svg, `no curated glyph for seed target "${starlight}"`).toBeDefined();
      expect(svg?.startsWith('<svg')).toBe(true);
      expect(svg?.endsWith('</svg>')).toBe(true);
    },
  );

  it('iconGlyphSvg returns undefined for an uncurated name and for undefined', () => {
    expect(iconGlyphSvg('definitely-not-a-curated-icon')).toBeUndefined();
    expect(iconGlyphSvg(undefined)).toBeUndefined();
  });
});
