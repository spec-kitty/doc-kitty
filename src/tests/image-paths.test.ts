import { describe, it, expect } from 'vitest';
import {
  isAbsoluteOrRemote,
  resolveColocatedKey,
  matchGlobKey,
  pickShareImage,
} from '../components/slots/image-paths.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Unit coverage for the framework-agnostic path math behind the WP03
// optimized-image slots (dk:page-hero + dk:head share). The Astro-coupled
// glob/optimize wiring is exercised by the example build; this pins the pure
// resolution rules the slots depend on.

describe('isAbsoluteOrRemote', () => {
  it('flags http(s) and protocol-relative URLs', () => {
    expect(isAbsoluteOrRemote('https://cdn.example/x.png')).toBe(true);
    expect(isAbsoluteOrRemote('http://cdn.example/x.png')).toBe(true);
    expect(isAbsoluteOrRemote('//cdn.example/x.png')).toBe(true);
  });
  it('flags site-absolute (public/) and data URLs', () => {
    expect(isAbsoluteOrRemote('/social/card.png')).toBe(true);
    expect(isAbsoluteOrRemote('data:image/png;base64,AAAA')).toBe(true);
  });
  it('treats a page-relative path as not absolute/remote', () => {
    expect(isAbsoluteOrRemote('./assets/hero.png')).toBe(false);
    expect(isAbsoluteOrRemote('assets/hero.png')).toBe(false);
    expect(isAbsoluteOrRemote('../shared/hero.png')).toBe(false);
  });
});

describe('resolveColocatedKey', () => {
  it('resolves a ./-relative src against the page directory', () => {
    expect(
      resolveColocatedKey('./assets/hero.png', 'docs/architecture/overview.md'),
    ).toBe('/docs/architecture/assets/hero.png');
  });
  it('resolves a bare-relative src (no leading ./)', () => {
    expect(
      resolveColocatedKey('assets/hero.png', 'docs/guides/getting-started.md'),
    ).toBe('/docs/guides/assets/hero.png');
  });
  it('honours ../ segments', () => {
    expect(
      resolveColocatedKey('../shared/hero.png', 'docs/guides/getting-started.md'),
    ).toBe('/docs/shared/hero.png');
  });
  it('returns null for an absolute/remote src (nothing to optimize)', () => {
    expect(resolveColocatedKey('/social/card.png', 'docs/a/b.md')).toBeNull();
    expect(resolveColocatedKey('https://cdn/x.png', 'docs/a/b.md')).toBeNull();
  });
  it('returns null when filePath is unavailable', () => {
    expect(resolveColocatedKey('./assets/hero.png', undefined)).toBeNull();
  });
});

describe('matchGlobKey', () => {
  const keys = [
    '/docs/architecture/assets/hero.png',
    '/docs/guides/assets/share.png',
  ];
  it('returns null for a null resolved key', () => {
    expect(matchGlobKey(null, keys)).toBeNull();
  });
  it('prefers an exact match', () => {
    expect(matchGlobKey('/docs/guides/assets/share.png', keys)).toBe(
      '/docs/guides/assets/share.png',
    );
  });
  it('falls back to a unique suffix match', () => {
    // Glob keys carrying an extra leading segment (a differently-rooted docs
    // tree) still resolve the intended asset from the `/docs/...`-rooted key.
    const prefixedKeys = ['/site-root/docs/guides/assets/share.png'];
    expect(
      matchGlobKey('/docs/guides/assets/share.png', prefixedKeys),
    ).toBe('/site-root/docs/guides/assets/share.png');
  });
  it('returns null when a suffix match is ambiguous', () => {
    const ambiguous = ['/a/assets/hero.png', '/b/assets/hero.png'];
    expect(matchGlobKey('/x/assets/hero.png', ambiguous)).toBeNull();
  });
  it('returns null when nothing matches', () => {
    expect(matchGlobKey('/docs/nope/missing.png', keys)).toBeNull();
  });
});

describe('pickShareImage (#180: never an SVG card)', () => {
  const png = { src: '/hero.png', format: 'png' };
  const pageSvg = { src: '/hero.svg', format: 'svg' };
  const themePng = { src: '/social-card.png', format: 'png' };
  const themeSvg = { src: '/social-card.svg', format: 'svg' };
  const toolkit = { src: '/social-default.png', format: 'png' };

  it('passes a raster image through unchanged, without a warning', () => {
    const r = pickShareImage({ image: png, alt: 'Hero', siteDefault: themePng, toolkitDefault: toolkit, siteTitle: 'Docs' });
    expect(r).toEqual({ image: png, alt: 'Hero' });
  });
  it('falls a page SVG back to the site default, with the site title as alt and a warning', () => {
    const r = pickShareImage({ image: pageSvg, alt: 'Hero', siteDefault: themePng, toolkitDefault: toolkit, siteTitle: 'Docs' });
    expect(r.image).toBe(themePng);
    expect(r.alt).toBe('Docs');
    expect(r.warning).toMatch(/is an SVG/);
  });
  it('falls an SVG site default (and a page SVG under it) back to the toolkit default, never throwing', () => {
    for (const image of [themeSvg, pageSvg]) {
      const r = pickShareImage({ image, alt: 'x', siteDefault: themeSvg, toolkitDefault: toolkit, siteTitle: 'Docs' });
      expect(r.image).toBe(toolkit);
      expect(r.warning).toMatch(/assets\.socialImage to a PNG/);
    }
  });
});

describe('spec-kitty theme share card (#180)', () => {
  const assets = new URL('../themes/spec-kitty/assets/', import.meta.url);
  it('ships a 1200x630 PNG rasterized from the pinned SVG source', () => {
    const png = readFileSync(new URL('social-card.png', assets));
    // PNG IHDR: width and height are big-endian uint32s at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    // Editing the SVG source without regenerating the PNG fails here: re-rasterize
    // social-card.png at 1200x630, then update this hash.
    const svgHash = createHash('sha256').update(readFileSync(new URL('social-card.svg', assets))).digest('hex');
    expect(svgHash).toBe('d04ebfed87c53f53a5df7ccc0a1758a183336604592c24339364857330d3569e');
  });
});

