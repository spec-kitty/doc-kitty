/**
 * #88 / FR-002 — the llms.txt SECTION ordering must be intrinsically total.
 *
 * The route groups the ranked pages by section into a `Map`, then orders the
 * section keys by `sectionRank`. Two sections that tie on rank (e.g. both
 * unregistered, both falling to the same fallback rank) were previously left in
 * `Map`-insertion order — which is the order they first appeared in
 * `rankForAgents`' output, i.e. driven by per-page priority, not by the section
 * key. WP02 APPENDS `|| compareCodeUnit(aKey, bKey)` so the section order is a
 * function of the keys alone.
 *
 * This suite exercises the REAL route (not a replica of its sort): the route
 * module statically imports `astro:content`, neutralized with a `vi.hoisted`
 * factory (mirrors `absolute-url-base.test.ts`/`route-feeds.test.ts`). Removing
 * the appended tiebreak reverts the two tied sections to insertion order and
 * reddens the ordering assertions below.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const { entries } = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; filePath?: string; data: Record<string, unknown>; body?: string }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');

const SITE = new URL('https://docs.example/');

afterEach(() => {
  vi.unstubAllEnvs();
  entries.length = 0;
});

async function renderText(): Promise<string> {
  const route = llmsTxtRoute({ title: 'Docs' });
  const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
  return res.text();
}

/** The order in which the two section H2 headings appear in the rendered text. */
function headingOrder(txt: string, headings: string[]): string[] {
  return [...headings]
    .map((h) => ({ h, at: txt.indexOf(`## ${h}`) }))
    .filter((x) => x.at !== -1)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.h);
}

describe('llms.txt section order (#88) — appended code-unit tiebreak on the section key', () => {
  // Two UNREGISTERED sections (absent from SECTION_ORDER) tie on sectionRank, so
  // only the appended compareCodeUnit(sectionKey) separates them. `zeta`'s page
  // carries the HIGHER agent priority, so rankForAgents emits it first and the
  // section `Map` inserts `zeta` before `alpha`; the section sort must still emit
  // `alpha` first (code-unit ascending), independent of that insertion order.
  const shuffled = [
    { id: 'zeta/high', data: { title: 'Zeta High', doc_status: 'active', agent: { priority: 0.9 } } },
    { id: 'alpha/low', data: { title: 'Alpha Low', doc_status: 'active', agent: { priority: 0.1 } } },
  ];

  it('orders tied (unregistered) sections by ascending section key, not by insertion order', async () => {
    entries.push(...shuffled);
    const txt = await renderText();
    expect(headingOrder(txt, ['alpha', 'zeta'])).toEqual(['alpha', 'zeta']);
  });

  it('is stable under a permuted input (order is a function of the keys alone)', async () => {
    entries.push(...[...shuffled].reverse());
    const txt = await renderText();
    expect(headingOrder(txt, ['alpha', 'zeta'])).toEqual(['alpha', 'zeta']);
  });
});
