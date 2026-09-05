/**
 * Base-prefixed absolute internal URLs (#61/#62 completeness gap, pre-PR
 * review finding): RSS, llms.txt, and the agent-API JSON compose absolute
 * URLs via `absolute(site, path)` (`routes/shared.ts`). Pre-fix, `absolute`
 * built the URL from the base-LESS `path` verbatim, so every emitted feed/
 * index URL 404'd on a based deployment (`https://…/guides/x/` instead of
 * `https://…/doc-kitty/guides/x/`) even though `discoveryHead` (config.ts)
 * correctly base-prefixed the <head> ADVERTISEMENT of /rss.xml + /llms.txt.
 *
 * Fix: `absolute()` now routes its `path` argument through `withBase` (the
 * ONE component base-prefix helper, #61/C-002) before resolving it against
 * `site` — the same seam `metadata.ts`'s doc comment on `routeFor` names as
 * "that consumer's own concern". `routeFor`/`toAgentRecord`'s `route` and
 * `source` fields stay base-less (a committed agent-API contract) since only
 * the ABSOLUTE `url`/`source`-URL fields route through `absolute()`.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// The route modules statically import `astro:content`, which does not resolve
// under the framework-agnostic vitest suite — neutralize it with a factory
// (mirrors `route-feeds.test.ts`/`docs-root.test.ts`). A mutable `entries`
// list (via `vi.hoisted`) drives `collectDocEntries()`/`getCollection`.
const { entries } = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; filePath?: string; data: Record<string, unknown>; body?: string }>,
}));

vi.mock('astro:content', () => ({
  getCollection: async () => entries,
}));

const { absolute } = await import('../lib/routes/shared.js');
const { rssRoute } = await import('../lib/routes/rss.js');
const { llmsTxtRoute } = await import('../lib/routes/llms-txt.js');
const { agentIndexRoute } = await import('../lib/routes/agent-index.js');
const { agentPageRoute } = await import('../lib/routes/agent-page.js');

const SITE = new URL('https://docs.example/');

afterEach(() => {
  vi.unstubAllEnvs();
  entries.length = 0;
});

// ===========================================================================
// 1. `absolute()` — the shared absolute-URL composer, now base-aware
// ===========================================================================
describe('absolute()', () => {
  it('is unchanged with no base configured (byte-compatible)', () => {
    expect(absolute(SITE, '/guides/getting-started/')).toBe(
      'https://docs.example/guides/getting-started/',
    );
    expect(absolute(SITE, '/')).toBe('https://docs.example/');
  });

  it('base-prefixes the path when a base is configured (#61/#62)', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(absolute(SITE, '/guides/getting-started/')).toBe(
      'https://docs.example/doc-kitty/guides/getting-started/',
    );
    expect(absolute(SITE, '/')).toBe('https://docs.example/doc-kitty/');
  });

  it('is idempotent — a path already carrying the base is not double-prefixed', () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    expect(absolute(SITE, '/doc-kitty/guides/getting-started/')).toBe(
      'https://docs.example/doc-kitty/guides/getting-started/',
    );
  });
});

// ===========================================================================
// 2. rssRoute — <link>/<guid>/atom:self carry the base
// ===========================================================================
describe('rssRoute — base-prefixed absolute URLs (#61/#62)', () => {
  it('carries the base in the channel link, atom:self href, and every item link/guid', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    entries.push({
      id: 'guides/markua-malformed',
      data: { title: 'Malformed', doc_status: 'active' },
    });

    const route = rssRoute({ title: 'Docs' });
    const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
    const xml = await res.text();

    expect(xml).toContain('<link>https://docs.example/doc-kitty/</link>');
    expect(xml).toContain('href="https://docs.example/doc-kitty/rss.xml"');
    expect(xml).toContain(
      '<link>https://docs.example/doc-kitty/guides/markua-malformed/</link>',
    );
    expect(xml).toContain(
      '<guid>https://docs.example/doc-kitty/guides/markua-malformed/</guid>',
    );
    // No base-less internal absolute URL survives.
    expect(xml).not.toMatch(/https:\/\/docs\.example\/(?!doc-kitty\/)/);
  });
});

// ===========================================================================
// 3. llmsTxtRoute — the machine-index pointer and every page URL carry the base
// ===========================================================================
describe('llmsTxtRoute — base-prefixed absolute URLs (#61/#62)', () => {
  it('carries the base in the machine-index pointer and page URLs', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    entries.push({
      id: 'context',
      data: { title: 'Context', doc_status: 'active' },
    });

    const route = llmsTxtRoute({ title: 'Docs' });
    const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
    const txt = await res.text();

    expect(txt).toContain('Full machine index: https://docs.example/doc-kitty/api/index.json');
    expect(txt).toContain('https://docs.example/doc-kitty/context/');
    expect(txt).not.toMatch(/https:\/\/docs\.example\/(?!doc-kitty\/)/);
  });
});

// ===========================================================================
// 4. agentIndexRoute — `url`/`source` carry the base; `route` stays base-less
// ===========================================================================
describe('agentIndexRoute — base-prefixed url/source, base-less route contract (#61/#62)', () => {
  it('base-prefixes url and source while leaving the committed `route` field base-less', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    entries.push({
      id: 'guides/markua-malformed',
      data: { title: 'Malformed', doc_status: 'active' },
    });

    const route = agentIndexRoute({ title: 'Docs' });
    const res = await (route as (ctx: { site: URL }) => Promise<Response>)({ site: SITE });
    const json = JSON.parse(await res.text());
    const page = json.pages.find((p: { slug: string }) => p.slug === 'guides/markua-malformed');

    expect(page).toBeDefined();
    // Committed agent-API contract: base-LESS.
    expect(page.route).toBe('/guides/markua-malformed/');
    // Absolute fields: base-prefixed.
    expect(page.url).toBe('https://docs.example/doc-kitty/guides/markua-malformed/');
    expect(page.source).toBe(
      'https://docs.example/doc-kitty/api/pages/guides/markua-malformed.json',
    );
  });
});

// ===========================================================================
// 5. agentPageRoute — `url` carries the base; `route` stays base-less
// ===========================================================================
describe('agentPageRoute — base-prefixed url, base-less route contract (#61/#62)', () => {
  it('base-prefixes url while leaving the committed `route` field base-less', async () => {
    vi.stubEnv('BASE_URL', '/doc-kitty/');
    entries.push({
      id: 'guides/markua-malformed',
      data: { title: 'Malformed', doc_status: 'active' },
      body: '# Malformed\n',
    });

    const { GET } = agentPageRoute();
    const ctx = {
      props: { id: 'guides/markua-malformed', body: '# Malformed\n' },
      site: SITE,
    };
    const res = await (GET as (ctx: typeof ctx) => Promise<Response>)(ctx);
    const json = JSON.parse(await res.text());

    expect(json.route).toBe('/guides/markua-malformed/');
    expect(json.url).toBe('https://docs.example/doc-kitty/guides/markua-malformed/');
  });
});
