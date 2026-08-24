/**
 * URL-parity unit test for the deck-slug SSOT helper (ADR-0021 decision 4).
 *
 * BA-3 (the build assertion) can't import this TS helper under bare node, so it
 * pins the slug by hand and checks parity transitively via the emitted artifacts
 * (BA-2). This vitest closes the "one source of truth" intent directly: it proves
 * that reconstructing the route path from `deckRouteParams` (the `presentations/`
 * prefix the route file re-adds + the stripped param) is exactly `deckSlug` — the
 * same string the generators (`llms.txt`, agent API, sitemap) emit — so a future
 * refactor that breaks the prefix math fails here, loudly, not in production.
 */
import { describe, it, expect } from 'vitest';
import { deckSlug, deckRouteParams } from '../lib/deck/deck-slug.js';

describe('deck-slug — URL parity (ADR-0021 D4 / A-03)', () => {
  // The route file is `presentations/[...slug].astro`, so the built path is
  // `presentations/` + the rest param; that must reconstruct to the generator slug.
  const reconstruct = (entry: { id: string }): string =>
    `presentations/${deckRouteParams(entry).slug}`;

  for (const id of [
    'presentations/showcase-deck',
    'presentations/draft-preview',
    'presentations/sub/nested-deck',
  ]) {
    it(`route path reconstructs to the generator slug for ${id}`, () => {
      const entry = { id };
      // deckSlug is what llms.txt / agent / sitemap emit → /${deckSlug}/ is the URL
      expect(reconstruct(entry)).toBe(deckSlug(entry));
      // and the param never re-includes the prefix (the prefix-doubling trap)
      expect(deckRouteParams(entry).slug.startsWith('presentations/')).toBe(false);
    });
  }

  it('strips the presentations/ prefix exactly once (no over-strip)', () => {
    // a deck literally named to look like the prefix must not lose extra segments
    const entry = { id: 'presentations/presentations-intro' };
    expect(deckRouteParams(entry).slug).toBe('presentations-intro');
    expect(`presentations/${deckRouteParams(entry).slug}`).toBe(deckSlug(entry));
  });
});
