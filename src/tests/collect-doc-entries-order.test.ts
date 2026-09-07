/**
 * #85 — the collected-entry ORDER contract
 * (`kitty-specs/feed-order-determinism-01M1VV64/contracts/feed-order.md`).
 *
 * `collectDocEntries` is the one adapter every discovery route reads, and the
 * Astro content store it reads from is filled in the completion order of a
 * concurrent glob loader — build-timing noise, not content. Returning the
 * entries slug-sorted makes every downstream surface order-stable BY
 * CONSTRUCTION instead of one comparator at a time, so this suite pins the
 * order through BOTH seams: the pure `sortBySlug` helper in `metadata.ts`, and
 * the `docs-index.ts` adapter that applies it, driven by a shuffled fake
 * collection.
 *
 * `sortBySlug` is Astro-free, so it is imported directly. `docs-index.ts`
 * statically imports `astro:content`, which does not resolve under the
 * framework-agnostic vitest suite; it is neutralized with the same
 * `vi.hoisted` + `vi.mock` posture `docs-root.test.ts` uses.
 */
import { describe, it, expect, vi } from 'vitest';
import type { DocEntry } from '../lib/metadata.js';
import { sortBySlug } from '../lib/metadata.js';

const { collectionEntries } = vi.hoisted(() => ({
  collectionEntries: [] as Array<{ id: string; data: Record<string, unknown>; body?: string }>,
}));
vi.mock('astro:content', () => ({
  getCollection: async () => collectionEntries,
}));

const { collectDocEntries } = await import('../lib/docs-index.js');

const entry = (slug: string): DocEntry => ({
  slug,
  data: { title: slug || 'Home', doc_status: 'active' },
});

describe('sortBySlug', () => {
  // Deterministic permutations, never Math.random, so a failure is reproducible.
  const ascending = ['', 'context/domain', 'guides/deploy', 'how-to/pages', 'zebra'];

  it('orders any input permutation ascending by slug', () => {
    const shuffles = [
      ['zebra', 'guides/deploy', '', 'how-to/pages', 'context/domain'],
      [...ascending].reverse(),
      ['how-to/pages', '', 'zebra', 'context/domain', 'guides/deploy'],
    ];
    for (const shuffle of shuffles) {
      expect(sortBySlug(shuffle.map(entry)).map((e) => e.slug)).toEqual(ascending);
    }
  });

  it('does not mutate the caller’s array', () => {
    const input = ['zebra', '', 'guides/deploy'].map(entry);
    const before = input.map((e) => e.slug);
    sortBySlug(input);
    expect(input.map((e) => e.slug)).toEqual(before);
  });
});

describe('collectDocEntries', () => {
  it('returns the collection slug-sorted regardless of its insertion order', async () => {
    // `index` is the reserved store id for the bundle root, whose route slug is
    // "" — so the root must come out FIRST, not wherever the loader dropped it.
    collectionEntries.length = 0;
    collectionEntries.push(
      { id: 'guides/deploy', data: { title: 'Deploy', doc_status: 'active' } },
      { id: 'index', data: { title: 'Home', doc_status: 'active' } },
      { id: 'context/domain', data: { title: 'Domain', doc_status: 'active' } },
    );
    const first = (await collectDocEntries()).map((e) => e.slug);
    expect(first).toEqual(['', 'context/domain', 'guides/deploy']);

    // Same content, different store order → identical output (the whole point).
    collectionEntries.reverse();
    expect((await collectDocEntries()).map((e) => e.slug)).toEqual(first);
  });

  it('omits body by default and carries it only under { withBody: true } (#90)', async () => {
    collectionEntries.length = 0;
    collectionEntries.push({
      id: 'guides/deploy',
      data: { title: 'Deploy', doc_status: 'active' },
      body: '# Deploy\n\nThe raw markdown body.',
    });
    const [plain] = await collectDocEntries();
    expect(plain.body).toBeUndefined();
    const [withBody] = await collectDocEntries({ withBody: true });
    expect(withBody.body).toBe('# Deploy\n\nThe raw markdown body.');
    // An entry with no body coerces to '' rather than undefined under withBody.
    collectionEntries[0] = { id: 'x', data: { title: 'X', doc_status: 'active' } };
    const [noBody] = await collectDocEntries({ withBody: true });
    expect(noBody.body).toBe('');
  });
});
