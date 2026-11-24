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
import { fileURLToPath } from 'node:url';
import { PAGED_HUB_ENTRYPOINT, PAGED_HUB_ROUTE } from '../lib/integrations/paged-hubs.js';
import { routeShapingIntegration } from '../lib/integrations/route-shaping.js';
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
  setup({ updateConfig: () => {}, injectRoute: (route: unknown) => routes.push(route) });
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
