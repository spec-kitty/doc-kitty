/**
 * Served-surface detection (page-chrome WP01; FR-002): the pure table, the handoff
 * reader, the integration's hooks, and the agent index reading the result. The real
 * build proof is `served-surfaces-build.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AstroIntegration } from 'astro';
import { DK_SERVED_SURFACES_ENV, clearInternalEnv } from '../lib/internal-env.mjs';
import { detectServedSurfaces, servedSurfaces, type ServedSurfaces } from '../lib/served-surfaces.js';
import { servedSurfacesIntegration } from '../lib/integrations/served-surfaces.js';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

vi.mock('astro:content', () => ({
  getCollection: async () => [{ id: 'guides/a', data: { title: 'A', doc_status: 'active' } }],
}));

const { agentIndexRoute } = await import('../lib/routes/agent-index.js');

restoreInternalEnv();
beforeEach(() => {
  delete process.env[DK_SERVED_SURFACES_ENV];
});

const NONE: ServedSurfaces = {
  llms: false,
  agentIndex: false,
  agentPages: false,
  rss: false,
  bibliography: false,
  scenarios: false,
  contentGraph: false,
  sitemap: false,
  okf: true,
  pageAtom: false,
};

describe('detectServedSurfaces', () => {
  it.each([
    ['llms', '/llms.txt'],
    ['agentIndex', '/api/index.json'],
    ['agentPages', '/api/pages/[...slug].json'],
    ['rss', '/rss.xml'],
    ['bibliography', '/api/bibliography.json'],
    ['scenarios', '/api/scenarios.json'],
    ['contentGraph', '/api/content-graph.json'],
    ['pageAtom', '/api/pages/[...slug].atom.xml'],
  ])('%s is true only with %s', (surface, pattern) => {
    expect(detectServedSurfaces([pattern], false)).toEqual({ ...NONE, [surface]: true });
    expect(detectServedSurfaces(['/other', '/[...slug]'], false)[surface as keyof ServedSurfaces]).toBe(false);
  });

  it('reads the routes the spike reported on the example (research R1)', () => {
    const spike = ['/api/bibliography.json', '/api/content-graph.json', '/api/index.json', '/api/pages/[...slug].json', '/api/scenarios.json', '/llms.txt', '/rss.xml'];
    expect(detectServedSurfaces(spike, true)).toEqual({
      llms: true,
      agentIndex: true,
      agentPages: true,
      rss: true,
      bibliography: true,
      scenarios: true,
      contentGraph: true,
      sitemap: true,
      okf: true,
      pageAtom: false,
    });
  });

  it('sitemap follows the second argument alone, and okf is always true', () => {
    expect(detectServedSurfaces([], true)).toEqual({ ...NONE, sitemap: true });
    expect(detectServedSurfaces([], false)).toEqual(NONE);
    expect(detectServedSurfaces(['/sitemap-index.xml'], false).sitemap).toBe(false);
  });

  it('leaves a route at a non-standard path undetected, the documented limit', () => {
    expect(detectServedSurfaces(['/feeds/rss.xml', '/rss.xml/', '/doc-kitty/rss.xml', '/llms.txt.bak'], false)).toEqual(NONE);
  });
});

describe('servedSurfaces()', () => {
  it('is undefined until detection has run', () => {
    expect(servedSurfaces()).toBeUndefined();
  });

  it('reads the current value, and stops when clearInternalEnv removes it', () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify({ ...NONE, rss: true });
    expect(servedSurfaces()?.rss).toBe(true);
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify(NONE);
    expect(servedSurfaces()?.rss).toBe(false);
    clearInternalEnv();
    expect(servedSurfaces()).toBeUndefined();
  });
});

describe('servedSurfacesIntegration', () => {
  type Hooks = Required<AstroIntegration['hooks']>;
  const route = (pattern: string, type = 'endpoint') => ({ pattern, type });
  const resolve = (integration: AstroIntegration, routes: Array<{ pattern: string; type: string }>) =>
    (integration.hooks['astro:routes:resolved'] as Hooks['astro:routes:resolved'])({ routes } as never);
  const configDone = (integration: AstroIntegration, site?: string) =>
    (integration.hooks['astro:config:done'] as Hooks['astro:config:done'])({ config: { site } } as never);

  it('publishes nothing before routes resolve', () => {
    configDone(servedSurfacesIntegration(), 'https://example.test');
    expect(servedSurfaces()).toBeUndefined();
  });

  it('knows the site in the order of a build: routes, then config:done', () => {
    const integration = servedSurfacesIntegration();
    resolve(integration, [route('/rss.xml')]);
    configDone(integration, 'https://example.test');
    expect(servedSurfaces()).toEqual({ ...NONE, rss: true, sitemap: true });
  });

  it('knows the site in the order of dev: config:done, then routes', () => {
    const integration = servedSurfacesIntegration();
    configDone(integration, 'https://example.test');
    resolve(integration, [route('/rss.xml')]);
    expect(servedSurfaces()).toEqual({ ...NONE, rss: true, sitemap: true });
  });

  it('sitemap stays false with no site', () => {
    const integration = servedSurfacesIntegration();
    resolve(integration, [route('/rss.xml')]);
    configDone(integration, undefined);
    expect(servedSurfaces()).toEqual({ ...NONE, rss: true });
  });

  it('overwrites when routes resolve again, rather than merging', () => {
    const integration = servedSurfacesIntegration();
    resolve(integration, [route('/rss.xml')]);
    expect(servedSurfaces()?.rss).toBe(true);
    resolve(integration, [route('/llms.txt')]);
    expect(servedSurfaces()).toEqual({ ...NONE, llms: true });
  });

  it('does not count a redirect at a surface path; a real route there is the control', () => {
    resolve(servedSurfacesIntegration(), [route('/rss.xml', 'redirect'), route('/llms.txt')]);
    expect(servedSurfaces()).toEqual({ ...NONE, llms: true });
  });
});

describe('agentIndexRoute reads the detection result', () => {
  type Ctx = { site: URL };
  const SITE = new URL('https://docs.example/');
  const WITHOUT_ANY = { ...NONE, agentIndex: true };
  const fetchIndex = async (route: unknown) =>
    JSON.parse(await (await (route as (ctx: Ctx) => Promise<Response>)({ site: SITE })).text()) as {
      _links: Record<string, unknown>;
      pages: Array<{ _links: Record<string, unknown> }>;
    };
  const LINKED = ['rss', 'bibliography', 'scenarios'];

  it('links nothing the site does not serve', async () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify(WITHOUT_ANY);
    const index = await fetchIndex(agentIndexRoute({ title: 'Docs' }));
    for (const name of LINKED) expect(index._links).not.toHaveProperty(name);
    expect(index.pages.length).toBeGreaterThan(0);
    for (const record of index.pages) expect(record._links).not.toHaveProperty('self');
  });

  it('links each surface the site serves', async () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify({ ...WITHOUT_ANY, agentPages: true, rss: true, bibliography: true, scenarios: true });
    const index = await fetchIndex(agentIndexRoute({ title: 'Docs' }));
    for (const name of LINKED) expect(index._links).toHaveProperty(name);
    for (const record of index.pages) expect(record._links).toHaveProperty('self');
  });

  it('an explicit links value wins, in both directions', async () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify({ ...WITHOUT_ANY, scenarios: true });
    const index = await fetchIndex(agentIndexRoute({ title: 'Docs', links: { rss: true, scenarios: false } }));
    expect(index._links).toHaveProperty('rss');
    expect(index._links).not.toHaveProperty('scenarios');
  });

  it('llms and sitemap follow detection, and stay linked when detection has not run', async () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify(WITHOUT_ANY);
    const none = (await fetchIndex(agentIndexRoute({ title: 'Docs' })))._links;
    expect(none).not.toHaveProperty('llms');
    expect(none).not.toHaveProperty('sitemap');
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify({ ...WITHOUT_ANY, llms: true, sitemap: true });
    const both = (await fetchIndex(agentIndexRoute({ title: 'Docs' })))._links;
    expect(both).toHaveProperty('llms');
    expect(both).toHaveProperty('sitemap');
    delete process.env[DK_SERVED_SURFACES_ENV];
    const undetected = (await fetchIndex(agentIndexRoute({ title: 'Docs' })))._links;
    expect(undetected).toHaveProperty('llms');
    expect(undetected).toHaveProperty('sitemap');
  });

  it('keeps mcp opt-in whatever is detected', async () => {
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify(detectServedSurfaces(['/rss.xml'], true));
    expect((await fetchIndex(agentIndexRoute({ title: 'Docs' })))._links).not.toHaveProperty('mcp');
  });

  it('reads the result per request, not in the factory, so a dev re-detection takes effect', async () => {
    const route = agentIndexRoute({ title: 'Docs' });
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify({ ...WITHOUT_ANY, rss: true });
    expect((await fetchIndex(route))._links).toHaveProperty('rss');
    process.env[DK_SERVED_SURFACES_ENV] = JSON.stringify(WITHOUT_ANY);
    expect((await fetchIndex(route))._links).not.toHaveProperty('rss');
  });

  it('applies the old defaults when detection has not run', async () => {
    const index = await fetchIndex(agentIndexRoute({ title: 'Docs' }));
    for (const name of LINKED) expect(index._links).toHaveProperty(name);
    for (const record of index.pages) expect(record._links).toHaveProperty('self');
  });
});
