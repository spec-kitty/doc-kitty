import { describe, it, expect } from 'vitest';
import { resolveSurface } from '../lib/glossary/resolve.js';
import type { SharedTermIndex } from '../lib/glossary/types.js';

/**
 * The resolver's only dependency is the shape of `SharedTermIndex.bySurface`, so
 * we build tiny stub indexes inline rather than depend on WP01's loader at
 * runtime — the exhaustive collision matrix from contracts/resolver.md.
 *
 * `contexts` is required by the type but unused by the resolver; an empty Map
 * keeps the stubs minimal and honest about what this function actually reads.
 */
function indexOf(
  bySurface: Record<string, Array<{ context: string; anchor: string; termName: string }>>,
): SharedTermIndex {
  return {
    bySurface: new Map(Object.entries(bySurface)),
    contexts: new Map(),
  };
}

const EMPTY_IGNORE: ReadonlySet<string> = new Set();

// `anchor` in the stub entries is deliberately a WRONG value so the tests prove
// the resolver recomputes it via the shared slug(termName) rule (Rule 8), never
// trusting the index entry's field.
const index = indexOf({
  // Single-candidate surface.
  bill: [{ context: 'shipping', anchor: 'WRONG', termName: 'Bill of Lading' }],
  // Collision: `policy` lives in both `hr` and `shipping`.
  policy: [
    { context: 'shipping', anchor: 'WRONG', termName: 'Policy' },
    { context: 'hr', anchor: 'WRONG', termName: 'Policy' },
  ],
  // Alias: `consignment` is an alias of the `cargo` term (shares bySurface).
  cargo: [{ context: 'shipping', anchor: 'WRONG', termName: 'Cargo' }],
  consignment: [{ context: 'shipping', anchor: 'WRONG', termName: 'Cargo' }],
});

describe('resolveSurface', () => {
  it('links a single-candidate surface (Rule 4), anchor = slug(termName)', () => {
    expect(resolveSurface('bill', undefined, index, EMPTY_IGNORE)).toEqual({
      kind: 'link',
      context: 'shipping',
      anchor: 'bill-of-lading',
      termName: 'Bill of Lading',
    });
  });

  it('resolves a multi-candidate surface by the page context (Rule 5)', () => {
    expect(resolveSurface('policy', 'hr', index, EMPTY_IGNORE)).toEqual({
      kind: 'link',
      context: 'hr',
      anchor: 'policy',
      termName: 'Policy',
    });
    // ...and to the other candidate when the page is that one.
    expect(resolveSurface('policy', 'shipping', index, EMPTY_IGNORE)).toEqual({
      kind: 'link',
      context: 'shipping',
      anchor: 'policy',
      termName: 'Policy',
    });
  });

  it('is unresolved with sorted competing[] when page context is absent (Rule 6)', () => {
    expect(resolveSurface('policy', undefined, index, EMPTY_IGNORE)).toEqual({
      kind: 'unresolved',
      surface: 'policy',
      competing: ['hr', 'shipping'], // code-point sorted, deterministic (NFR-007)
    });
  });

  it('is unresolved when the page context is not among the candidates (Rule 6)', () => {
    expect(resolveSurface('policy', 'legal', index, EMPTY_IGNORE)).toEqual({
      kind: 'unresolved',
      surface: 'policy',
      competing: ['hr', 'shipping'],
    });
  });

  it('orders competing[] deterministically regardless of candidate order', () => {
    // Candidates listed shipping-then-hr in the index; competing must still sort.
    const a = resolveSurface('policy', undefined, index, EMPTY_IGNORE);
    const reordered = indexOf({
      policy: [
        { context: 'zulu', anchor: 'WRONG', termName: 'Policy' },
        { context: 'alpha', anchor: 'WRONG', termName: 'Policy' },
        { context: 'mike', anchor: 'WRONG', termName: 'Policy' },
      ],
    });
    const b = resolveSurface('policy', undefined, reordered, EMPTY_IGNORE);
    expect(a).toMatchObject({ kind: 'unresolved', competing: ['hr', 'shipping'] });
    expect(b).toMatchObject({ kind: 'unresolved', competing: ['alpha', 'mike', 'zulu'] });
  });

  it('returns none for an ignore-listed surface (Rule 2, FR-008)', () => {
    const ignore = new Set(['bill']);
    expect(resolveSurface('bill', undefined, index, ignore)).toEqual({ kind: 'none' });
    // Ignore matching is case-insensitive too — the surface is lowercased first.
    expect(resolveSurface('Bill', 'shipping', index, ignore)).toEqual({ kind: 'none' });
  });

  it('returns none for an unknown surface (Rule 3)', () => {
    expect(resolveSurface('demurrage', undefined, index, EMPTY_IGNORE)).toEqual({ kind: 'none' });
  });

  it('resolves an alias exactly like its term name (Rule 7, FR-012)', () => {
    const viaName = resolveSurface('cargo', undefined, index, EMPTY_IGNORE);
    const viaAlias = resolveSurface('consignment', undefined, index, EMPTY_IGNORE);
    expect(viaAlias).toEqual({
      kind: 'link',
      context: 'shipping',
      anchor: 'cargo', // anchor derives from the term name, not the alias surface
      termName: 'Cargo',
    });
    expect(viaAlias).toEqual(viaName);
  });

  it('is case-insensitive — "Cargo" and "cargo" resolve identically (Rule 1)', () => {
    const lower = resolveSurface('cargo', undefined, index, EMPTY_IGNORE);
    const mixed = resolveSurface('Cargo', undefined, index, EMPTY_IGNORE);
    const upper = resolveSurface('CARGO', undefined, index, EMPTY_IGNORE);
    expect(mixed).toEqual(lower);
    expect(upper).toEqual(lower);
  });

  it('treats an empty candidate array as none (defensive, Rule 3)', () => {
    const emptyList = indexOf({ ghost: [] });
    expect(resolveSurface('ghost', undefined, emptyList, EMPTY_IGNORE)).toEqual({ kind: 'none' });
  });
});
