/**
 * The `openapi` option wired into `defineDocKittyIntegrations` (mission
 * openapi-reference-pages, WP03: FR-002..FR-005, FR-009, FR-010, NFR-002, NFR-003).
 *
 * A fast guard with no browser and no build. It runs the real option, the real
 * Starlight plugin hooks (with stub parameters) and the real Vite plugin, and reads
 * the sources as text for the chrome and the CSS. The built pages are checked by the
 * integrated build suite and by `tests/a11y/openapi.spec.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreInternalEnv } from './helpers/restore-internal-env';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));

const inner = vi.fn();
const rendererMock = vi.fn<(config: unknown) => unknown>(() => ({
  name: 'starlight-openapi-plugin',
  hooks: { 'config:setup': inner },
}));

const { defineDocKittyIntegrations } = await import('../lib/config.js');
const adapters = await import('../lib/openapi/adapters.js');

restoreInternalEnv();

const FIXTURES = fileURLToPath(new URL('../../example/openapi/', import.meta.url));
const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

const OPENAPI_OPTION = {
  renderer: rendererMock,
  specs: [
    { path: 'openapi/v1.yaml', label: 'v1', released: true },
    { path: 'openapi/main.yaml', label: 'main', released: false },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Plugin = { name: string; hooks: Record<string, (p: any) => unknown> };

interface StarlightCfg {
  plugins: Plugin[];
  sidebar?: Array<{ label?: string; items?: unknown[] }>;
}

function starlightConfig(integrations: unknown[]): StarlightCfg {
  const entry = (integrations as Array<{ name: string; __starlightConfig?: unknown }>).find(
    (i) => i.name === '@astrojs/starlight',
  );
  return entry?.__starlightConfig as StarlightCfg;
}

let cwd: string;
let site: string;

beforeEach(() => {
  cwd = process.cwd();
  site = mkdtempSync(path.join(tmpdir(), 'dk-openapi-int-'));
  mkdirSync(path.join(site, 'docs'));
  cpSync(FIXTURES, path.join(site, 'openapi'), { recursive: true });
  process.chdir(site);
  rendererMock.mockClear();
  inner.mockClear();
});

afterEach(() => {
  process.chdir(cwd);
  rmSync(site, { recursive: true, force: true });
});

describe('no openapi option (FR-010)', () => {
  it('registers no plugin, no sidebar group and never calls a renderer', async () => {
    const integrations = defineDocKittyIntegrations({ title: 'T' });
    const cfg = starlightConfig(integrations);
    expect(cfg.plugins.map((p) => p.name)).toEqual(['doc-kitty:i18n']);
    expect(JSON.stringify(cfg.sidebar ?? [])).not.toContain('dk-openapi');
    expect(rendererMock).not.toHaveBeenCalled();
  });
});

describe('with the option (FR-002)', () => {
  it('adds the adopter renderer plugin, ours, then the stylesheet filter, after the adopter plugins', () => {
    const own: Plugin = { name: 'own', hooks: { 'config:setup': () => {} } };
    const cfg = starlightConfig(
      defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION, starlight: { plugins: [own] } as never }),
    );
    expect(cfg.plugins.map((p) => p.name)).toEqual([
      'doc-kitty:i18n',
      'own',
      'starlight-openapi-plugin',
      'doc-kitty:openapi',
      'doc-kitty:openapi-styles',
    ]);
  });

  it('appends one generated sidebar group per version', () => {
    const cfg = starlightConfig(defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION }));
    const groups = (cfg.sidebar ?? []).filter((g) => String(g.label).startsWith('Symbol(dk-openapi:'));
    expect(groups.map((g) => g.label)).toEqual([
      'Symbol(dk-openapi:reference/api/v1)',
      'Symbol(dk-openapi:reference/api/main)',
    ]);
  });

  it('with no adopter sidebar, keeps the tree Starlight would show and appends the API groups after it', () => {
    const cfg = starlightConfig(defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION }));
    expect(cfg.sidebar![0]).toEqual({ label: 'docs', autogenerate: { directory: 'docs' } });
    expect(cfg.sidebar!.slice(1).map((g) => g.label)).toEqual([
      'Symbol(dk-openapi:reference/api/v1)',
      'Symbol(dk-openapi:reference/api/main)',
    ]);
  });

  it('starlightDefaultSidebar names the group after the first docs-root segment', () => {
    const { starlightDefaultSidebar } = adapters;
    expect(starlightDefaultSidebar('docs')).toEqual([{ label: 'docs', autogenerate: { directory: 'docs' } }]);
    expect(starlightDefaultSidebar('./site/docs/')).toEqual([{ label: 'site', autogenerate: { directory: 'site' } }]);
  });

  it('with an adopter sidebar, appends the API groups and leaves their entries alone', () => {
    const own = [{ label: 'Mine', autogenerate: { directory: 'docs/mine' } }];
    const cfg = starlightConfig(
      defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION, sidebar: own as never }),
    );
    expect(cfg.sidebar![0]).toEqual(own[0]);
    expect(cfg.sidebar).toHaveLength(3);
  });

  it('calls the renderer once, synchronously, with one entry per version, code samples off', () => {
    const cfg = starlightConfig(defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION }));
    expect(rendererMock).toHaveBeenCalledTimes(1);
    expect(cfg.plugins.map((p) => p.name)).toContain('starlight-openapi-plugin');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = rendererMock.mock.calls[0][0] as Array<Record<string, any>>;
    expect(entries.map((e) => e.base)).toEqual(['reference/api/v1', 'reference/api/main']);
    expect(entries.map((e) => e.schema)).toEqual([
      path.join(fs_realpath(site), 'openapi/v1.yaml'),
      path.join(fs_realpath(site), 'openapi/main.yaml'),
    ]);
    for (const e of entries) {
      expect(e.snippets).toEqual({ operation: false, requestBody: false, response: false });
    }
    expect(entries.map((e) => e.sidebar.group.label)).toEqual(
      cfg.sidebar!.filter((g) => String(g.label).startsWith('Symbol(dk-openapi:')).map((g) => g.label),
    );
  });

  it('our plugin registers the middleware and the Vite integration in a build', () => {
    const cfg = starlightConfig(defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION }));
    const plugin = cfg.plugins.find((p) => p.name === 'doc-kitty:openapi')!;
    const params = { command: 'build', addIntegration: vi.fn(), addRouteMiddleware: vi.fn() };
    plugin.hooks['config:setup'](params);
    expect(params.addRouteMiddleware).toHaveBeenCalledWith(
      expect.objectContaining({ entrypoint: adapters.OPENAPI_ROUTE_MIDDLEWARE }),
    );
    expect(params.addIntegration.mock.calls[0][0].name).toBe('doc-kitty:openapi');
  });

  it('does nothing outside a build or the dev server', () => {
    const cfg = starlightConfig(defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION }));
    const plugin = cfg.plugins.find((p) => p.name === 'doc-kitty:openapi')!;
    const params = { command: 'preview', addIntegration: vi.fn(), addRouteMiddleware: vi.fn() };
    plugin.hooks['config:setup'](params);
    expect(params.addIntegration).not.toHaveBeenCalled();
    expect(params.addRouteMiddleware).not.toHaveBeenCalled();
  });

  it('fails eagerly on a bad option, naming the entry', () => {
    expect(() =>
      defineDocKittyIntegrations({
        title: 'T',
        openapi: { renderer: rendererMock, specs: [{ path: 'openapi/v1.yaml', label: 'v1' } as never] },
      }),
    ).toThrow(/\[dk-openapi\] specs\[0\] "v1": "released" is required/);
  });
});

function fs_realpath(p: string): string {
  return path.resolve(p);
}

describe('route collisions (ADR-0050 report)', () => {
  it('an authored page at a version overview fails, naming both', () => {
    mkdirSync(path.join(site, 'docs/reference/api'), { recursive: true });
    writeFileSync(path.join(site, 'docs/reference/api/v1.md'), '---\ntitle: x\n---\n');
    expect(() => defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION })).toThrow(
      /\[dk-routes\][\s\S]*\/reference\/api\/v1\/[\s\S]*docs\/reference\/api\/v1\.md[\s\S]*generated by the openapi option, specs\[0\] "v1"/,
    );
  });

  it('an authored page under a version fails; a sibling label does not', () => {
    mkdirSync(path.join(site, 'docs/reference/api/main'), { recursive: true });
    writeFileSync(path.join(site, 'docs/reference/api/main/extra.md'), '---\ntitle: x\n---\n');
    expect(() => defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION })).toThrow(/api\/main\/extra\.md/);
    rmSync(path.join(site, 'docs/reference'), { recursive: true });
    mkdirSync(path.join(site, 'docs/reference/api/other'), { recursive: true });
    writeFileSync(path.join(site, 'docs/reference/api/other/page.md'), '---\ntitle: x\n---\n');
    expect(() => defineDocKittyIntegrations({ title: 'T', openapi: OPENAPI_OPTION })).not.toThrow();
  });

  it('the agent API root is refused as a section', () => {
    expect(() => defineDocKittyIntegrations({ title: 'T', openapi: { ...OPENAPI_OPTION, section: 'api/v1' } })).toThrow(
      /reserved for the agent API/,
    );
  });
});

describe('stylesheet filter (FR-005)', () => {
  const update = (css: string[]) => {
    const updateConfig = vi.fn();
    adapters.openApiStylesheetFilter().hooks['config:setup']({ config: { customCss: css }, updateConfig });
    return updateConfig.mock.calls[0][0].customCss as string[];
  };

  const CHROME = adapters.OPENAPI_CHROME_SHEET;

  it('removes the renderer stylesheet, keeps every other entry in order, and adds the chrome sheet last', () => {
    expect(update(['a.css', 'starlight-openapi/styles', 'b.css'])).toEqual(['a.css', 'b.css', CHROME]);
  });

  it('copes with no customCss at all, and never lists the chrome sheet twice', () => {
    expect(update(undefined as never)).toEqual([CHROME]);
    expect(update(['a.css', CHROME])).toEqual(['a.css', CHROME]);
  });

  it('the chrome sheet is shipped in the package and kept out of the shared component sheet (SC-004)', () => {
    expect(CHROME).toBe('@spec-kitty/doc-toolkit/styles/dk-openapi.css');
    expect(read('../styles/dk-openapi.css')).toContain('.dk-openapi-nav');
    expect(read('../styles/dk-components.css')).not.toMatch(/openapi/i);
  });
});

describe('description adapter (FR-002 with the strict docs schema)', () => {
  const schema = (info: Record<string, string>) => ({ config: { base: 'reference/api/v1' }, document: { info } });

  it('an operation page reads "<label> API reference: <summary>"', () => {
    expect(
      adapters.describeOpenApiPage('List parcels', schema({ title: 'Shipping' }), { operation: { summary: 'List parcels' } }),
    ).toBe('v1 API reference: List parcels');
  });

  it('falls back to the title when the operation has no summary', () => {
    expect(adapters.describeOpenApiPage('getThing', schema({}), { operation: {} })).toBe('v1 API reference: getThing');
  });

  it('a tag overview and a version overview each get one', () => {
    expect(adapters.describeOpenApiPage('Overview', schema({}), undefined, { name: 'parcels' })).toBe(
      'v1 API reference: parcels operations',
    );
    expect(adapters.describeOpenApiPage('Overview', schema({ summary: 'Parcels.' }))).toBe('Parcels.');
    expect(adapters.describeOpenApiPage('Overview', schema({ description: 'A **small** [fixture](x). More.' }))).toBe(
      'A small fixture.',
    );
    expect(adapters.describeOpenApiPage('Overview', schema({ title: 'Shipping API', version: '1.0.0' }))).toBe(
      'v1 API reference: Shipping API 1.0.0',
    );
  });

  it('never exceeds the docs schema bound (180)', () => {
    const long = adapters.describeOpenApiPage('x', schema({ summary: 'word '.repeat(100) }));
    expect(long.length).toBeLessThanOrEqual(180);
    expect(long.endsWith('…')).toBe(true);
  });

  it('the Vite transform splices it into the renderer, and refuses a changed renderer', () => {
    const real = readFileSync(
      fileURLToPath(new URL('../node_modules/starlight-openapi/libs/starlight.ts', import.meta.url)),
      'utf8',
    );
    const plugin = adapters.openApiVitePlugin({ section: 'reference/api', versions: [] });
    const patched = plugin.transform(real, '/x/node_modules/starlight-openapi/libs/starlight.ts?v=1')!;
    expect(patched).toContain('description: dkDescribeOpenApiPage(title, schema, pathItemOperation, tag)');
    expect(patched).not.toContain('frontmatter: {\n      title,\n    }');
    expect(plugin.transform(real, '/x/src/other.ts')).toBeNull();
    expect(() => plugin.transform('export const x = 1', '/x/starlight-openapi/libs/starlight.ts')).toThrow(
      /no longer has the expected frontmatter/,
    );
  });

  it('buildEnd fails closed when the renderer module was never seen, but not on an erroring build', () => {
    const plugin = adapters.openApiVitePlugin({ section: 's', versions: [] });
    plugin.buildStart();
    expect(() => plugin.buildEnd()).toThrow(/\[dk-openapi\].*never loaded/);
    expect(() => plugin.buildEnd(new Error('boom'))).not.toThrow();
    plugin.buildStart();
    plugin.transform(
      'const x = { frontmatter: { title } }',
      '/x/node_modules/starlight-openapi/libs/starlight.ts',
    );
    expect(() => plugin.buildEnd()).not.toThrow();
    // A later build in the same process (Astro's client bundle) never loads the renderer
    // and must not fail the site: the renderer was seen by the server build.
    plugin.buildStart();
    expect(() => plugin.buildEnd()).not.toThrow();
  });

  it('the splice tolerates a multi-line frontmatter with or without a trailing comma', () => {
    for (const fm of ['frontmatter: {\n  title,\n}', 'frontmatter: {\n    title\n  }', 'frontmatter: { title }']) {
      const out = adapters.patchPageProps(`const x = { ${fm}, y }`);
      expect(out).toContain('description: dkDescribeOpenApiPage(title, schema, pathItemOperation, tag)');
    }
  });

  it('serves the virtual module with the section and versions', () => {
    const plugin = adapters.openApiVitePlugin({ section: 's', versions: [{ label: 'v1', released: true }] });
    const id = plugin.resolveId('virtual:doc-kitty/openapi')!;
    expect(plugin.resolveId('other')).toBeNull();
    expect(plugin.load(id)).toContain('"section":"s"');
    expect(plugin.load('other')).toBeNull();
  });
});

describe('version nav data (FR-003, FR-004)', () => {
  const data = {
    section: 'reference/api',
    versions: [
      { label: 'v1', released: true },
      { label: 'main', released: false },
    ],
  };

  it('finds the version of an overview, an operation page and a based path', () => {
    for (const p of [
      '/reference/api/v1/',
      '/reference/api/v1',
      '/reference/api/v1/parcels/listparcels/',
      '/doc-kitty/reference/api/v1/',
    ]) {
      expect(adapters.resolveOpenApiNav(p, '/doc-kitty/', data)?.current.label, p).toBe('v1');
    }
  });

  it('lists every version with its released flag', () => {
    const nav = adapters.resolveOpenApiNav('/reference/api/main/', '/', data)!;
    expect(nav.versions.map((v) => [v.label, v.released, v.route])).toEqual([
      ['v1', true, '/reference/api/v1/'],
      ['main', false, '/reference/api/main/'],
    ]);
    expect(nav.current.released).toBe(false);
  });

  it('strips the base only at a segment boundary', () => {
    expect(adapters.resolveOpenApiNav('/doc-kittyX/reference/api/v1/', '/doc-kitty/', data)).toBeUndefined();
    expect(adapters.resolveOpenApiNav('/doc-kitty', '/doc-kitty/', data)).toBeUndefined();
  });

  it('is undefined elsewhere, including a label that merely starts the same', () => {
    expect(adapters.resolveOpenApiNav('/guides/start/', '/', data)).toBeUndefined();
    expect(adapters.resolveOpenApiNav('/reference/api/v10/', '/', data)).toBeUndefined();
    expect(adapters.resolveOpenApiNav('/reference/api/', '/', data)).toBeUndefined();
  });
});

describe('chrome sources', () => {
  const nav = read('../components/OpenApiVersionNav.astro');
  const pageTitle = read('../components/PageTitle.astro');

  it('every link goes through withBase; the badge is text', () => {
    expect(nav).toContain("import { withBase } from '../lib/with-base.js'");
    expect(nav).toMatch(/href=\{withBase\(version\.route\)\}/);
    expect(nav.match(/href=/g)).toHaveLength(1);
    expect(nav).toMatch(/>unreleased<\/span>/);
  });

  it('lists versions only when there is more than one', () => {
    expect(nav).toMatch(/versions\.length > 1/);
  });

  it('PageTitle mounts it from the route local, abutted so other pages are unchanged', () => {
    expect(pageTitle).toContain('{openApiNav && <OpenApiVersionNav nav={openApiNav} />}');
    expect(pageTitle).toMatch(/\{isDraft && <DraftNotice \/>\}\{openApiNav/);
  });
});

describe('theming uses tokens only (FR-005)', () => {
  const css = stripCssComments(read('../styles/dk-openapi.css'));
  const start = css.indexOf(':root {\n  --sl-openapi-method-bg-get');
  const section = css.slice(start);
  const decls = [...section.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map((m) => [m[1], m[2]] as const);
  const literals = decls.map(([, v]) => v.replace(/var\([^()]*(\([^()]*\)[^()]*)*\)/g, ''));

  it('has rules, and they reference --dk-* tokens (positive control)', () => {
    expect(start).toBeGreaterThan(-1);
    expect(decls.length).toBeGreaterThan(20);
    expect(section).toMatch(/var\(--dk-color-info-bg\)/);
  });

  it('carries no hex, rgb(), hsl(), named colour, font family or px length outside var()', () => {
    const NAMED = /\b(black|white|red|green|blue|yellow|orange|gray|grey|purple|navy|teal|gold|brown|pink)\b/i;
    for (const [i, literal] of literals.entries()) {
      const where = `${decls[i][0]}: ${decls[i][1]}`;
      expect(literal, where).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(literal, where).not.toMatch(/\b(rgba?|hsla?|oklch|oklab)\(/i);
      expect(literal, where).not.toMatch(NAMED);
      expect(literal, where).not.toMatch(/\d(px|rem|em)\b/);
      if (decls[i][0] === 'font-family') expect.fail(`font-family literal: ${where}`);
    }
  });

  it('maps every renderer method hook to a catalog token', () => {
    for (const m of ['get', 'put', 'post', 'delete', 'patch', 'options', 'head', 'trace']) {
      expect(section).toMatch(new RegExp(`--sl-openapi-method-bg-${m}: var\\(--dk-color-`));
      expect(section).toMatch(new RegExp(`--sl-openapi-method-border-${m}: var\\(--dk-color-`));
    }
  });
});

describe('peer pins (the description splice and the loader are tied to one version)', () => {
  const manifest = JSON.parse(read('../package.json'));
  it.each(['starlight-openapi', '@astrojs/markdown-satteri'])('%s is pinned exactly in both places', (name) => {
    for (const field of ['peerDependencies', 'devDependencies']) {
      expect(manifest[field][name], `${field}.${name}`).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe('example wiring', () => {
  it('configures both fixtures: v1 released, main unreleased', () => {
    const cfg = read('../../example/astro.config.mjs');
    expect(cfg).toContain("import starlightOpenAPI from 'starlight-openapi'");
    expect(cfg).toContain('renderer: starlightOpenAPI');
    expect(cfg).toMatch(/path: 'openapi\/v1\.yaml', label: 'v1', released: true/);
    expect(cfg).toMatch(/path: 'openapi\/main\.yaml', label: 'main', released: false/);
  });
});
