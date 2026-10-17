/**
 * FR-004c (#103): with `links: { pages: false }` the index must not emit
 * `self` links into /api/pages/, and no record carries a `source` relation
 * (a record's source IS the per-page JSON, i.e. `self`). Route-level, no build.
 */
import { describe, it, expect, vi } from 'vitest';

const { entries } = vi.hoisted(() => ({
  entries: [{ id: 'guides/a', data: { title: 'A', doc_status: 'active' } }] as Array<{
    id: string;
    data: Record<string, unknown>;
  }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const SITE = new URL('https://docs.example/');

async function records(links?: { pages?: boolean }) {
  const route = agentIndexRoute({ title: 'Docs', links }) as (ctx: { site: URL }) => Promise<Response>;
  return JSON.parse(await (await route({ site: SITE })).text()).pages as Array<{ _links: Record<string, unknown> }>;
}

describe('agentIndexRoute _links gating (FR-004c)', () => {
  it('never emits `source`, and emits no /api/pages/ self link when pages is off', async () => {
    const off = await records({ pages: false });
    expect(off.length).toBeGreaterThan(0);
    for (const r of off) {
      expect('source' in r._links).toBe(false);
      expect('self' in r._links).toBe(false);
      expect(JSON.stringify(r._links)).not.toContain('/api/pages/');
    }
    for (const r of await records()) {
      expect('source' in r._links).toBe(false);
      expect((r._links.self as { href: string }).href).toContain('/api/pages/');
    }
  });
});
