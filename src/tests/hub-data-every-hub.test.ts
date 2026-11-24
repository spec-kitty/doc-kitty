/**
 * Hub data for every hub (#342 paged hub listing, folds #429; WP02: FR-001,
 * FR-003, FR-004, FR-016, FR-017, FR-018, NFR-003). The route-shaping module
 * lists every published `kind: Hub` hub in every sidebar mode with `capped` and
 * `pageSize`; the site option `hub.pageSize` is validated and reaches it; a `page`
 * child of a paged hub fails the build.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { routeShapingSource, type RouteShapingOptions } from '../lib/integrations/route-shaping.js';
import { defineDocKittyIntegrations, type DocKittyOptions } from '../lib/config.js';
import type { HubCap } from '../lib/child-cap.js';
import { restoreInternalEnv } from './helpers/restore-internal-env.js';

/** The options each `defineDocKittyIntegrations` call hands the route-shaping integration. */
const routeShapingCalls = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('../lib/integrations/route-shaping.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/integrations/route-shaping.js')>();
  return {
    ...actual,
    routeShapingIntegration: (options: Record<string, unknown>, ...rest: unknown[]) => {
      routeShapingCalls.push(options);
      return (actual.routeShapingIntegration as (...args: unknown[]) => unknown)(options, ...rest);
    },
  };
});

restoreInternalEnv();

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

const page = (title: string, extra = '', kind = 'Guide', status = 'active') =>
  `---\ntitle: ${JSON.stringify(title)}\ndescription: Fixture page.\ndoc_status: ${status}\nupdated: 2026-11-24T00:00:00Z\nkind: ${kind}\n${extra}---\n\nBody.\n`;

function site(files: Record<string, string>): void {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-hub-data-'));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, 'docs', rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  vi.spyOn(process, 'cwd').mockReturnValue(root);
}

function source(options: Partial<RouteShapingOptions> = {}): string {
  return routeShapingSource(
    { docsDir: 'docs', base: '/', shapeSidebar: true, pagination: true, ...options },
    { unpublishedDirs: [], unpublishedPaths: [] },
  );
}

function served(options: Partial<RouteShapingOptions> = {}): { hubCaps: Array<[string, HubCap]>; directoryMeta: unknown[] } {
  const text = source(options);
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

/** A `missions` hub with `n` children `m-01..`, plus `extra` files. */
function missions(n: number, hubExtra = '', extra: Record<string, string> = {}): Record<string, string> {
  const files: Record<string, string> = { 'missions/README.md': page('Missions', hubExtra, 'Hub'), ...extra };
  for (let i = 1; i <= n; i += 1) files[`missions/m-${String(i).padStart(2, '0')}.md`] = page(`Mission ${String(i).padStart(2, '0')}`);
  return files;
}

const SECTIONS = (hub: string) =>
  `version: 1\nsections:\n  - id: missions\n    label: Missions\n    order: 10\n${hub}`;

describe('site option hub.pageSize (T005: FR-003, FR-004)', () => {
  const define = (hub: unknown) => () => defineDocKittyIntegrations({ title: 'Docs', hub: hub as DocKittyOptions['hub'] });

  it('accepts a positive whole number and hands it to the route-shaping integration', () => {
    routeShapingCalls.length = 0;
    define({ pageSize: 7 })();
    define(undefined)();
    define({})();
    expect(routeShapingCalls).toHaveLength(3);
    expect(routeShapingCalls[0]).toMatchObject({ pageSize: 7 });
    expect(routeShapingCalls[1]).not.toHaveProperty('pageSize');
    expect(routeShapingCalls[2]).not.toHaveProperty('pageSize');
  });

  it.each([0, -1, 1.5, '5'])('refuses pageSize %j, naming the setting', (value) => {
    expect(define({ pageSize: value })).toThrow('[dk-config] hub.pageSize must be a positive whole number');
  });

  it('refuses a non-mapping and an unknown key', () => {
    expect(define(1)).toThrow('[dk-config] hub must be a mapping');
    expect(define([])).toThrow('[dk-config] hub must be a mapping');
    expect(define({ page_size: 3 })).toThrow('[dk-config] unknown key "page_size" under hub; expected pageSize');
  });

  it('reaches the module: a hub with no other setting gets the site page size', () => {
    site(missions(3, 'sidebar_child_cap: 2\n'));
    expect(served({ pageSize: 7 }).hubCaps[0]![1].pageSize).toBe(7);
  });
});

describe('page-size levels in the module (T008: FR-003)', () => {
  it('takes the hub, then the section, then the site, then 50', () => {
    site({ ...missions(3, 'hub_page_size: 2\n'), '_meta/sections.yaml': SECTIONS('    hub:\n      pageSize: 4\n') });
    expect(served({ pageSize: 9 }).hubCaps[0]![1].pageSize).toBe(2);
    site({ ...missions(3), '_meta/sections.yaml': SECTIONS('    hub:\n      pageSize: 4\n') });
    expect(served({ pageSize: 9 }).hubCaps[0]![1].pageSize).toBe(4);
    site(missions(3));
    expect(served({ pageSize: 9 }).hubCaps[0]![1].pageSize).toBe(9);
    expect(served().hubCaps[0]![1].pageSize).toBe(50);
  });

  it('ignores an invalid frontmatter value here (the frontmatter gate refuses it)', () => {
    site(missions(3, 'hub_page_size: 0\n'));
    expect(served({ pageSize: 9 }).hubCaps[0]![1].pageSize).toBe(9);
  });

  it('marks capped exactly when the count is over the cap', () => {
    site(missions(3, 'sidebar_child_cap: 3\n'));
    expect(served().hubCaps[0]![1]).toMatchObject({ count: 3, capped: false });
    site(missions(4, 'sidebar_child_cap: 3\n'));
    expect(served().hubCaps[0]![1]).toMatchObject({ count: 4, capped: true });
  });
});

describe('every hub, both sidebar modes (T007, T011: FR-001, FR-017)', () => {
  it('emits the same hub data with and without toolkit sidebar shaping, and no directory meta without', () => {
    site({ ...missions(5, 'sidebar_child_cap: 2\n'), 'guides/README.md': page('Guides', '', 'Hub'), 'guides/one.md': page('One') });
    const shaped = served();
    const own = served({ shapeSidebar: false });
    expect(own.hubCaps).toEqual(shaped.hubCaps);
    expect(own.hubCaps.map(([dir, hub]) => [dir, hub.capped])).toEqual([
      ['guides', false],
      ['missions', true],
    ]);
    expect(own.directoryMeta).toEqual([]);
    expect(shaped.directoryMeta.length).toBeGreaterThan(0);
  });

  it('never emits the root hub', () => {
    site({ 'README.md': page('Home', '', 'Hub'), ...missions(2) });
    expect(served().hubCaps.map(([dir]) => dir)).toEqual(['missions']);
  });

  it('keys a locale hub by its own folder, and gives a locale folder without a hub index no entry (FR-018)', () => {
    const files: Record<string, string> = { ...missions(3), 'fr/README.md': page('Accueil', '', 'Hub') };
    files['fr/missions/README.md'] = page('Missions (fr)', 'sidebar_child_cap: 1\n', 'Hub');
    for (const n of ['a', 'b']) files[`fr/missions/${n}.md`] = page(`Mission ${n}`);
    files['de/missions/x.md'] = page('Mission x');
    site(files);
    const dirs = served().hubCaps.map(([dir, hub]) => [dir, hub.count, hub.capped]);
    expect(dirs).toEqual([
      ['fr', 1, false],
      ['fr/missions', 2, true],
      ['missions', 3, false],
    ]);
  });

  it('serves byte-identical module text from two runs (NFR-003)', () => {
    site({ ...missions(5, 'sidebar_child_cap: 2\n'), 'guides/README.md': page('Guides', '', 'Hub') });
    expect(source()).toBe(source());
  });
});

describe('a page child of a paged hub (T009: FR-016)', () => {
  const pageChild = { 'missions/page.md': page('Page') };
  const message =
    '[dk-hubs] hub "missions" is paged, but its child "missions/page" would collide with the paged listing URLs; rename the child or raise the hub\'s page size or cap';

  it('fails when the hub is paged', () => {
    site(missions(4, 'sidebar_child_cap: 2\nhub_page_size: 2\n', pageChild));
    expect(() => source()).toThrow(message);
  });

  it('fails for a page sub-folder too', () => {
    site(missions(4, 'sidebar_child_cap: 2\nhub_page_size: 2\n', { 'missions/page/README.md': page('Page folder', '', 'Hub') }));
    expect(() => source()).toThrow(message);
  });

  it('builds when the hub is not paged: uncapped, or capped with a page size that covers every child', () => {
    site(missions(4, 'sidebar_child_cap: 10\nhub_page_size: 2\n', pageChild));
    expect(() => source()).not.toThrow();
    site(missions(4, 'sidebar_child_cap: 2\nhub_page_size: 10\n', pageChild));
    expect(() => source()).not.toThrow();
  });
});
