/**
 * Mounting the paged hub listing route (#342, WP04, T017). The route-shaping
 * integration injects `/[...hub]/page/[page]` (prerendered, from a package export
 * that resolves to a real file) only when the site has a paged hub; otherwise it
 * injects nothing, and no integration is added, so every other site builds and
 * registers exactly what it did before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGED_HUB_ENTRYPOINT, PAGED_HUB_ROUTE } from '../lib/integrations/paged-hubs.js';
import { routeShapingIntegration, routeShapingSource } from '../lib/integrations/route-shaping.js';
import { readHubData } from '../lib/hub-data-handoff.js';
import { hubListingPages } from '../lib/child-cap.js';
import { DK_HUB_DATA_ENV } from '../lib/internal-env.mjs';

const pagedHubListing = () => hubListingPages(readHubData());
import { defineDocKittyIntegrations } from '../lib/config.js';
import { createBuildState } from '../lib/build-state.js';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

restoreInternalEnv();
const SRC = fileURLToPath(new URL('..', import.meta.url));
const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const page = (title: string, extra = '', kind = 'Guide') =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: d\ndoc_status: active\nupdated: 2026-11-24T00:00:00Z\nkind: ${kind}\n${extra}---\n\nBody.\n`;

/** The routes the route-shaping integration injects for a `missions` hub with `n` children. */
function injected(n: number, hubExtra: string): unknown[] {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-paged-route-'));
  roots.push(root);
  mkdirSync(path.join(root, 'docs', 'missions'), { recursive: true });
  writeFileSync(path.join(root, 'docs', 'missions', 'README.md'), page('Missions', hubExtra, 'Hub'));
  for (let i = 1; i <= n; i += 1) writeFileSync(path.join(root, 'docs', 'missions', `m-${i}.md`), page(`Mission ${i}`));
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  const routes: unknown[] = [];
  const setup = routeShapingIntegration({ docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true }, createBuildState()).hooks[
    'astro:config:setup'
  ] as (arg: unknown) => void;
  setup({ updateConfig: () => {}, injectRoute: (route: unknown) => routes.push(route), config: { cacheDir: pathToFileURL(path.join(root, '.astro') + '/') } });
  return routes;
}

describe('the paged hub listing route (T017)', () => {
  it('is injected, prerendered, when a hub is paged', () => {
    expect(injected(5, 'sidebar_child_cap: 2\nhub_page_size: 2\n')).toEqual([
      { pattern: '/[...hub]/page/[page]', entrypoint: '@spec-kitty/doc-toolkit/routes/paged-hub', prerender: true },
    ]);
  });

  it('is not injected when no hub is paged: uncapped, or capped with a page size covering every child', () => {
    expect(injected(5, 'sidebar_child_cap: 10\nhub_page_size: 2\n')).toEqual([]);
    expect(injected(5, 'sidebar_child_cap: 2\nhub_page_size: 10\n')).toEqual([]);
  });

  it('adds no integration: the registered list is unchanged', () => {
    const names = defineDocKittyIntegrations({ title: 'Docs' }).map((i) => (i as { name: string }).name);
    expect(names.some((name) => name.includes('paged'))).toBe(false);
  });

  it('exports the entrypoint to an existing route file', () => {
    const pkg = JSON.parse(readFileSync(path.join(SRC, 'package.json'), 'utf8')) as { exports: Record<string, string> };
    const target = pkg.exports[PAGED_HUB_ENTRYPOINT.replace('@spec-kitty/doc-toolkit', '.')];
    expect(target).toBe('./lib/routes/paged-hub.astro');
    expect(existsSync(path.join(SRC, target!))).toBe(true);
    expect(PAGED_HUB_ROUTE.entrypoint).toBe(PAGED_HUB_ENTRYPOINT);
  });
});

/*
 * Consolidation (WP04 review item 3, WP05 review item 7): ONE hub-data computation.
 * The setup hook computes the hub data once, mounts the route from it and writes
 * the handoff the agent surfaces read, so the mount and the surfaces cannot
 * disagree; the module serves the same data.
 */
describe('one hub-data computation (consolidation)', () => {
  const setupWithHandoff = (n: number, hubExtra: string) => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-paged-one-'));
    roots.push(root);
    mkdirSync(path.join(root, 'docs', 'missions'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'missions', 'README.md'), page('Missions', hubExtra, 'Hub'));
    for (let i = 1; i <= n; i += 1) writeFileSync(path.join(root, 'docs', 'missions', `m-${i}.md`), page(`Mission ${i}`));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const options = { docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true };
    const state = createBuildState();
    const integration = routeShapingIntegration(options, state);
    const routes: unknown[] = [];
    (integration.hooks['astro:config:setup'] as (arg: unknown) => void)({
      updateConfig: () => {},
      injectRoute: (route: unknown) => routes.push(route),
      config: { cacheDir: pathToFileURL(path.join(root, '.astro') + '/') },
    });
    const text = routeShapingSource(options, state);
    return { integration, routes, served: JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).hubCaps };
  };

  it('writes the handoff in the setup hook, equal to the module\'s hub data', () => {
    const { served } = setupWithHandoff(5, 'sidebar_child_cap: 2\nhub_page_size: 2\n');
    expect(process.env[DK_HUB_DATA_ENV]).toMatch(/\.hubs\.json$/);
    expect(readHubData()).toEqual(served);
  });

  it('mounts the route iff the handoff lists a listing page', () => {
    for (const [extra, paged] of [
      ['sidebar_child_cap: 2\nhub_page_size: 2\n', true],
      ['sidebar_child_cap: 10\nhub_page_size: 2\n', false],
      ['sidebar_child_cap: 2\nhub_page_size: 10\n', false],
    ] as const) {
      const { routes } = setupWithHandoff(5, extra);
      expect(routes.length > 0, extra).toBe(paged);
      expect(pagedHubListing().length > 0, extra).toBe(paged);
    }
  });

  it('has no second computation: no config:done hook, and hubData is called from one place', () => {
    const { integration } = setupWithHandoff(1, '');
    expect(Object.keys(integration.hooks).sort()).toEqual(['astro:build:done', 'astro:config:setup']);
    const source = readFileSync(path.join(SRC, 'lib', 'integrations', 'route-shaping.ts'), 'utf8');
    expect(source.match(/\bhubData\(/g)).toHaveLength(2); // its definition and the one call in siteHubData
    expect(source).not.toMatch(/function siteHubs\b/);
  });
});

describe('withheld drafts (I3/I4, H9)', () => {
  /** Run the setup hook over 5 children (cap 2, page size 4), withholding `withheld`. */
  const run = (withheld: { dirs?: string[]; paths?: string[] }) => {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-paged-drafts-'));
    roots.push(root);
    mkdirSync(path.join(root, 'docs', 'missions'), { recursive: true });
    writeFileSync(path.join(root, 'docs', 'missions', 'README.md'), page('Missions', 'sidebar_child_cap: 2\nhub_page_size: 4\n', 'Hub'));
    for (let i = 1; i <= 5; i += 1) writeFileSync(path.join(root, 'docs', 'missions', `m-${i}.md`), page(`Mission ${i}`));
    vi.spyOn(process, 'cwd').mockReturnValue(root);
    const state = createBuildState();
    state.unpublishedDirs = withheld.dirs ?? [];
    state.unpublishedPaths = withheld.paths ?? [];
    const routes: unknown[] = [];
    (routeShapingIntegration({ docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true }, state).hooks['astro:config:setup'] as (arg: unknown) => void)({
      updateConfig: () => {},
      injectRoute: (route: unknown) => routes.push(route),
      config: { cacheDir: pathToFileURL(path.join(root, '.astro') + '/') },
    });
    return { routes, hubs: readHubData() };
  };

  it('pages 5 children by 4, but not once a withheld draft leaves 4', () => {
    expect(run({}).routes).toHaveLength(1);
    const { routes, hubs } = run({ paths: ['missions/m-5.md'] });
    expect(routes).toEqual([]);
    expect(hubs[0]![1].count).toBe(4);
  });

  it('hands off no hub for a withheld hub directory', () => {
    const { routes, hubs } = run({ dirs: ['missions'] });
    expect(routes).toEqual([]);
    expect(hubs).toEqual([]);
  });
});
