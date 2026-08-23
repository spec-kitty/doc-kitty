import { describe, it, expect } from 'vitest';
import {
  isAbsoluteOrRemote,
  resolveColocatedKey,
  matchGlobKey,
} from '../components/slots/image-paths.js';

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
