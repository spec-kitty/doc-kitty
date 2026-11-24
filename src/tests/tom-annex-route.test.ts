/**
 * The evidence-index route `/api/tom-annex.json` (WP03 T011, T016, #401).
 * Unit level: the shared site graph is mocked; the real build is WP05's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTomAnnex, serializeTomAnnex } from '../lib/tom-annex/core.mjs';
import { canonical, catalog, graph, page, record } from './fixtures/tom-annex/graph.mjs';

const state = vi.hoisted(() => ({ site: undefined as unknown, calls: [] as unknown[] }));

vi.mock('../lib/routes/site-graph.js', () => ({
  siteContentGraph: async (options: unknown) => {
    state.calls.push(options);
    return state.site;
  },
}));

const { tomAnnexRoute } = await import('../lib/routes/tom-annex.js');

const SITE = new URL('https://docs.example.org');

/** The shared-graph shape the route reads, around a fixture graph and catalog. */
function siteGraph(g: ReturnType<typeof graph>, c: ReturnType<typeof catalog>) {
  return {
    graph: g,
    measures: { index: new Map(c.records.map((r) => [r.id, r])), records: c.records, source: c.source, isDefault: c.isDefault },
    docsRoot: '/abs/docs',
    locations: {},
  };
}

afterEach(() => {
  state.calls.length = 0;
  vi.unstubAllEnvs();
});

describe('tomAnnexRoute (WP03 T011)', () => {
  it('serves the core bytes for the shared graph, as JSON', async () => {
    const { graph: g, catalog: c } = canonical();
    state.site = siteGraph(g, c);
    const response = await tomAnnexRoute({ docsDir: 'docs', indexBasename: 'README' })({ site: SITE } as never);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(await response.text()).toBe(serializeTomAnnex(buildTomAnnex(g, c, { site: SITE, base: '/' })));
    expect(state.calls).toEqual([{ docsDir: 'docs', indexBasename: 'README' }]);
  });

  it('builds URLs under the configured base', async () => {
    vi.stubEnv('BASE_URL', '/docs/');
    const { graph: g, catalog: c } = canonical();
    state.site = siteGraph(g, c);
    const body = JSON.parse(await (await tomAnnexRoute({ docsDir: 'docs' })({ site: SITE } as never)).text());
    expect(body.scopes.system[0].evidence[0].url).toBe('https://docs.example.org/docs/architecture/audit-logging/');
  });
});

describe('the mount and the graph must agree (WP03 T016)', () => {
  it('throws when it is mounted but the graph has no classified-as edge', async () => {
    state.site = siteGraph(graph([page('p')], []), catalog([record('m')]));
    await expect(tomAnnexRoute({ docsDir: 'docs' })({ site: SITE } as never)).rejects.toThrow(
      /\[dk-tom-annex\].*no classified-as edge.*\/abs\/docs/,
    );
  });
});

describe('tomAnnexIntegration mounts the route only for a classified site (WP03 T012)', () => {
  const setup = async (files: Record<string, string>) => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const path = await import('node:path');
    const root = mkdtempSync(path.join(tmpdir(), 'dk-tom-int-'));
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      writeFileSync(path.join(root, rel), text);
    }
    const { tomAnnexIntegration } = await import('../lib/integrations/tom-annex.js');
    const injected: Array<{ pattern: string; entrypoint: string; prerender?: boolean }> = [];
    const plugins: unknown[] = [];
    const hook = tomAnnexIntegration(root, undefined).hooks['astro:config:setup'] as (args: unknown) => void;
    hook({
      injectRoute: (r: (typeof injected)[number]) => injected.push(r),
      updateConfig: (c: { vite?: { plugins?: unknown[] } }) => plugins.push(...(c.vite?.plugins ?? [])),
    });
    return { injected, plugins };
  };
  const page = (data: string) => `---\ntitle: "T"\ndoc_status: "active"\n${data}---\n\nBody.\n`;

  it('injects /api/tom-annex.json, prerendered, when a published page is classified', async () => {
    const { injected, plugins } = await setup({
      'README.md': page(''),
      'security/audit.md': page('tom_classification:\n  - measure: events-logging\n'),
    });
    expect(injected).toEqual([
      { pattern: '/api/tom-annex.json', entrypoint: '@spec-kitty/doc-toolkit/routes/tom-annex-injected', prerender: true },
    ]);
    expect(plugins).toHaveLength(1);
  });

  it('injects nothing and adds no plugin for a site with no classified page (same tree, unclassified)', async () => {
    const { injected, plugins } = await setup({ 'README.md': page(''), 'security/audit.md': page('') });
    expect(injected).toEqual([]);
    expect(plugins).toEqual([]);
  });
});

describe('package export (WP03 T015)', () => {
  it('exports the injected entrypoint the integration names', async () => {
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.exports['./routes/tom-annex-injected']).toBe('./lib/routes/tom-annex-injected.ts');
  });
});
