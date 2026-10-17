/**
 * FR-004c (#103): with `links: { pages: false }` the index must not emit
 * `self` links into /api/pages/; with `links: { index: false }` a page emits no
 * `up`; `indexPath` moves the index's `self` and each page's `up`. Route-level,
 * no build. (The "no `source` relation" rule is pinned in agent-links.test.ts.)
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
const { agentPageRoute } = await import('../lib/routes/agent-page.js');
const SITE = new URL('https://docs.example/');

type Ctx = { site: URL };

async function records(links?: { pages?: boolean }) {
  const route = agentIndexRoute({ title: 'Docs', links }) as (ctx: Ctx) => Promise<Response>;
  return JSON.parse(await (await route({ site: SITE })).text()).pages as Array<{ _links: Record<string, unknown> }>;
}

async function indexSelf(indexPath?: string) {
  const route = agentIndexRoute({ title: 'Docs', indexPath }) as (ctx: Ctx) => Promise<Response>;
  return JSON.parse(await (await route({ site: SITE })).text())._links.self.href as string;
}

async function pageLinks(options?: Parameters<typeof agentPageRoute>[0]) {
  const { GET } = agentPageRoute(options);
  const ctx = { props: { id: 'guides/a', body: '' }, site: SITE };
  const res = await (GET as unknown as (c: typeof ctx) => Promise<Response>)(ctx);
  return JSON.parse(await res.text())._links as Record<string, { href: string }>;
}

describe('agent routes _links gating (FR-004c)', () => {
  it('emits no /api/pages/ self link on the index when pages is off', async () => {
    const off = await records({ pages: false });
    expect(off.length).toBeGreaterThan(0);
    for (const r of off) {
      expect('self' in r._links).toBe(false);
      expect(JSON.stringify(r._links)).not.toContain('/api/pages/');
    }
    for (const r of await records()) {
      expect((r._links.self as { href: string }).href).toContain('/api/pages/');
    }
  });

  it('page `up` follows links.index and indexPath; the index `self` follows indexPath', async () => {
    expect((await pageLinks()).up.href).toBe('https://docs.example/api/index.json');
    expect((await pageLinks({ indexPath: '/data/all.json' })).up.href).toBe('https://docs.example/data/all.json');
    expect('up' in (await pageLinks({ links: { index: false } }))).toBe(false);
    expect(await indexSelf()).toBe('https://docs.example/api/index.json');
    expect(await indexSelf('/data/all.json')).toBe('https://docs.example/data/all.json');
  });
});
