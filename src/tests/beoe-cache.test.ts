/**
 * Unit matrix for the build-render Mermaid disk cache (#13 WP03, FR-009).
 *
 * The behaviour that matters: a cache HIT restores the stored `<figure class="beoe">`
 * WITHOUT invoking `@beoe` (so Chromium never launches for an unchanged diagram),
 * a MISS renders + stores, a MIXED page renders only the misses, and a FULLY-WARM
 * page never calls `@beoe` at all. Exercised with a fake `@beoe` plugin that counts
 * its renders — no browser, no disk (an in-memory `DiskCache`).
 */
import { describe, it, expect } from 'vitest';
import { withMermaidDiskCache, type DiskCache } from '../lib/diagram/beoe-cache.js';

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
  [key: string]: unknown;
}

/** An in-memory `DiskCache` (get/set), so the wrapper's restore/store is tested
 * without touching the filesystem. Deep-clones on get so a restored node is never
 * a shared reference (the real disk cache re-parses JSON each get). */
function memCache(): DiskCache & { size(): number } {
  const store = new Map<string, string>();
  return {
    get: (key) => {
      const v = store.get(key);
      return v === undefined ? undefined : (JSON.parse(v) as { v: unknown }).v;
    },
    set: (key, value) => {
      store.set(key, JSON.stringify({ v: value }));
    },
    size: () => store.size,
  };
}

/** A `<pre><code class="language-mermaid">SOURCE</code></pre>` fence node. */
function mermaidPre(source: string): HastNode {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: ['language-mermaid'] },
        children: [{ type: 'text', value: source }],
      },
    ],
  };
}

/** A fake `@beoe` plugin factory: replaces each `pre>code.language-mermaid` with a
 * `<figure class="beoe"><svg data-src="SOURCE"/></figure>`, counting each render. */
function fakeBeoe(counter: { renders: number }) {
  return () =>
    (tree: HastNode): void => {
      const walk = (node: HastNode): void => {
        const kids = node.children;
        if (!Array.isArray(kids)) return;
        for (let k = 0; k < kids.length; k++) {
          const child = kids[k];
          if (child.tagName === 'pre' && child.children?.[0]?.tagName === 'code') {
            const code = child.children[0];
            const src = code.children?.[0]?.value ?? '';
            counter.renders += 1;
            kids[k] = {
              type: 'element',
              tagName: 'figure',
              properties: { className: ['beoe', 'mermaid'] },
              children: [{ type: 'element', tagName: 'svg', properties: { 'data-src': src }, children: [] }],
            };
            continue;
          }
          walk(child);
        }
      };
      walk(tree);
    };
}

const root = (children: HastNode[]): HastNode => ({ type: 'root', children });

describe('withMermaidDiskCache — restore/store around @beoe (#13 WP03 / FR-009)', () => {
  it('a MISS renders via @beoe and stores the figure', async () => {
    const cache = memCache();
    const counter = { renders: 0 };
    const plugin = withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1');

    const tree = root([mermaidPre('graph TD; a-->b')]);
    await plugin()(tree, {});

    expect(counter.renders, 'a cold diagram is rendered once').toBe(1);
    expect(cache.size(), 'the rendered figure is stored').toBe(1);
    const fig = tree.children![0];
    expect(fig.tagName).toBe('figure');
    expect((fig.children![0].properties as Record<string, unknown>)['data-src']).toBe('graph TD; a-->b');
  });

  it('a HIT restores the stored figure WITHOUT invoking @beoe (Chromium is never launched)', async () => {
    const cache = memCache();
    const counter = { renders: 0 };
    const plugin = withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1');

    // Cold pass populates the cache.
    await plugin()(root([mermaidPre('graph TD; a-->b')]), {});
    expect(counter.renders).toBe(1);

    // Warm pass: same source → restored from cache, @beoe NOT called again.
    const warm = root([mermaidPre('graph TD; a-->b')]);
    await plugin()(warm, {});
    expect(counter.renders, 'the warm pass must NOT re-render (no Chromium)').toBe(1);
    const fig = warm.children![0];
    expect(fig.tagName, 'the restored node is the stored figure').toBe('figure');
    expect((fig.children![0].properties as Record<string, unknown>)['data-src']).toBe('graph TD; a-->b');
    // The restore marker is a transient top-level field (not serialised to HTML).
    expect(fig._dkBeoeCached).toBe(true);
  });

  it('a MIXED page renders ONLY the miss, and each figure keeps its OWN source (index aligned)', async () => {
    const cache = memCache();
    const counter = { renders: 0 };
    const plugin = withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1');

    // Warm the cache for diagram A only.
    await plugin()(root([mermaidPre('AAA')]), {});
    expect(counter.renders).toBe(1);

    // A page with A (cached) then B (new): only B renders; A restored.
    const mixed = root([mermaidPre('AAA'), mermaidPre('BBB')]);
    await plugin()(mixed, {});
    expect(counter.renders, 'only the miss (B) renders on the mixed page').toBe(2);
    const [figA, figB] = mixed.children!;
    expect((figA.children![0].properties as Record<string, unknown>)['data-src']).toBe('AAA');
    expect((figB.children![0].properties as Record<string, unknown>)['data-src']).toBe('BBB');
    expect(cache.size(), 'both figures are now cached').toBe(2);
  });

  it('a FULLY-WARM page never invokes @beoe at all', async () => {
    const cache = memCache();
    const counter = { renders: 0 };
    const plugin = withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1');

    await plugin()(root([mermaidPre('AAA'), mermaidPre('BBB')]), {}); // cold → 2 renders
    expect(counter.renders).toBe(2);

    const rendersBefore = counter.renders;
    const warm = root([mermaidPre('AAA'), mermaidPre('BBB')]);
    await plugin()(warm, {});
    expect(counter.renders, 'a fully-warm page renders nothing (Chromium never launches)').toBe(rendersBefore);
    for (const fig of warm.children!) expect(fig.tagName).toBe('figure');
  });

  it('a different SALT (config change) invalidates the cache — a re-render', async () => {
    const cache = memCache();
    const counter = { renders: 0 };

    await withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1')()(root([mermaidPre('AAA')]), {});
    expect(counter.renders).toBe(1);

    // Same source, DIFFERENT salt (e.g. the sentinel table changed) → miss → re-render.
    await withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-2')()(root([mermaidPre('AAA')]), {});
    expect(counter.renders, 'a salt change invalidates the cache').toBe(2);
  });

  it('ignores non-mermaid code fences (only language-mermaid is cached/rendered)', async () => {
    const cache = memCache();
    const counter = { renders: 0 };
    const plugin = withMermaidDiskCache(fakeBeoe(counter), cache, 'salt-1');

    const other: HastNode = {
      type: 'element',
      tagName: 'pre',
      properties: {},
      children: [
        { type: 'element', tagName: 'code', properties: { className: ['language-js'] }, children: [{ type: 'text', value: 'x=1' }] },
      ],
    };
    await plugin()(root([other]), {});
    expect(counter.renders, 'a non-mermaid fence is not a diagram').toBe(0);
    expect(cache.size()).toBe(0);
  });
});
