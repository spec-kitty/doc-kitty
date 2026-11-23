/**
 * The sidebar child cap on BUILT output (#341, WP04; NFR-001, NFR-002, NFR-003,
 * SC-001..SC-003). A fixture site with a `missions` hub of 200 generated children
 * is built with the default cap (50):
 *
 *  1. every built page's sidebar holds at most cap + 2 links in the hub's group
 *     (in fact two: the index link and the "200 pages" entry);
 *  2. on every child page the capped entry is the one sidebar entry marked
 *     current; on the hub page it is the index link;
 *  3. prev/next follow the hub's listing order (by title), not Starlight's (by
 *     slug), which the fixture makes the reverse of each other;
 *  4. the same site with every child `sidebar: { hidden: true }` (the producer
 *     hint) builds the same sidebar and prev/next on every page;
 *  5. a site with no hub over its cap builds pages identical to the goldens
 *     captured before the cap existed (`fixtures/large-hub/golden/uncapped.json`),
 *     once the checkout path Astro hashes into class names is masked;
 *  6. two builds of the capped site are byte-identical.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  BASE,
  REPO_ROOT,
  buildSite,
  builtPages,
  missionChildren,
  normaliseBuildPaths,
  sha256,
  writeSite,
} from './fixtures/large-hub/site.mjs';

const CHILDREN = 200;
const CAP = 50;
const BUILD_TIMEOUT = 300_000;
const root = (name: string) => path.join(REPO_ROOT, 'example', `.dk-test-sidebar-cap-${name}`);
const SITES = { capped: root('capped'), again: root('again'), hidden: root('hidden'), uncapped: root('uncapped') };

/** Build a site and return its pages; fails the suite on a failed build. */
function build(dir: string, options: Parameters<typeof writeSite>[1]): Map<string, string> {
  writeSite(dir, options);
  const result = buildSite(dir);
  if (result.status !== 0) throw new Error(`fixture build failed:\n${result.output.slice(-4000)}`);
  return builtPages(path.join(dir, 'dist'));
}

/** The sidebar markup of a page: Starlight's sidebar pane. */
function sidebarOf(html: string): string {
  const start = html.indexOf('id="starlight__sidebar"');
  const end = html.indexOf('data-dk-sidebar-reveal', start);
  expect(start, 'sidebar pane').toBeGreaterThan(-1);
  expect(end, 'end of sidebar').toBeGreaterThan(start);
  return html.slice(start, end);
}

/** The `<ul>` of the sidebar group labelled `label`. */
function groupOf(sidebar: string, label: string): string {
  const at = sidebar.indexOf(`>${label}</span>`);
  expect(at, `group ${label}`).toBeGreaterThan(-1);
  const open = sidebar.indexOf('<ul', at);
  return sidebar.slice(open, sidebar.indexOf('</ul>', open));
}

const links = (fragment: string) => [...fragment.matchAll(/<a href="([^"]*)"([^>]*)>\s*<span[^>]*>([^<]*)</g)].map((m) => ({
  href: m[1]!,
  current: /aria-current="page"/.test(m[2]!),
  label: m[3]!.trim(),
}));

function pagination(html: string): { prev?: string; next?: string } {
  const href = (rel: string) => html.match(new RegExp(`<a href="([^"]*)" rel="${rel}"`))?.[1];
  return { prev: href('prev'), next: href('next') };
}

let capped: Map<string, string>;
let hidden: Map<string, string>;

beforeAll(() => {
  capped = build(SITES.capped, { missions: CHILDREN });
  hidden = build(SITES.hidden, { missions: CHILDREN, hidden: true });
}, 2 * BUILD_TIMEOUT);

afterAll(() => {
  for (const dir of Object.values(SITES)) rmSync(dir, { recursive: true, force: true });
});

describe('a 200-child hub with the default cap', () => {
  const childRoutes = missionChildren(CHILDREN).map((c) => c.slug);

  it('built every child page', () => {
    for (const route of childRoutes) expect(capped.has(route), route).toBe(true);
  });

  it(`holds at most cap + 2 links in the hub's group on every page (NFR-001, SC-001)`, () => {
    for (const [route, html] of capped) {
      const group = links(groupOf(sidebarOf(html), 'Missions'));
      expect(group.length, route).toBeLessThanOrEqual(CAP + 2);
      expect(group.map((l) => [l.href, l.label]), route).toEqual([
        [`${BASE}/missions/`, 'Overview'],
        [`${BASE}/missions/`, `${CHILDREN} pages`],
      ]);
    }
  });

  it('marks the capped entry, and only it, current on every child page (SC-002)', () => {
    for (const route of childRoutes) {
      const all = links(sidebarOf(capped.get(route)!));
      expect(all.filter((l) => l.current), route).toEqual([
        { href: `${BASE}/missions/`, current: true, label: `${CHILDREN} pages` },
      ]);
    }
  });

  it('marks the index link current on the hub page', () => {
    const current = links(sidebarOf(capped.get('missions')!)).filter((l) => l.current);
    expect(current).toEqual([{ href: `${BASE}/missions/`, current: true, label: 'Overview' }]);
  });

  it('pages through the children in hub order (FR-007)', () => {
    // Hub order is by title, which counts down as the slug counts up.
    const hubOrder = missionChildren(CHILDREN)
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, 'en'))
      .map((c) => `${BASE}/${c.slug}/`);
    expect(pagination(capped.get('missions')!).next).toBe(hubOrder[0]);
    for (const i of [0, 1, 99, CHILDREN - 2]) {
      const route = hubOrder[i]!.slice(BASE.length + 1, -1);
      expect(pagination(capped.get(route)!), route).toEqual({
        prev: i === 0 ? `${BASE}/missions/` : hubOrder[i - 1],
        next: hubOrder[i + 1],
      });
    }
    const last = hubOrder[CHILDREN - 1]!.slice(BASE.length + 1, -1);
    expect(pagination(capped.get(last)!).next).toBe(`${BASE}/ops/`);
  });
});

describe('the sidebar.hidden producer hint (FR-008)', () => {
  it('builds the same sidebar and prev/next on every page', () => {
    expect([...hidden.keys()].sort()).toEqual([...capped.keys()].sort());
    for (const [route, html] of capped) {
      const other = hidden.get(route)!;
      expect(sidebarOf(other), route).toBe(sidebarOf(html));
      expect(pagination(other), route).toEqual(pagination(html));
    }
  });
});

describe('determinism and byte-identity', () => {
  it(
    'builds a site with no hub over its cap exactly as before the cap existed (NFR-002, SC-003)',
    () => {
      const golden = JSON.parse(
        readFileSync(new URL('./fixtures/large-hub/golden/uncapped.json', import.meta.url), 'utf8'),
      ) as { fixture: Parameters<typeof writeSite>[1]; pages: Record<string, string> };
      const pages = build(SITES.uncapped, golden.fixture);
      const now = Object.fromEntries([...pages].map(([route, html]) => [route, sha256(normaliseBuildPaths(html))]));
      expect(now).toEqual(golden.pages);
    },
    BUILD_TIMEOUT,
  );

  it(
    'builds the capped site byte-identically twice (NFR-003)',
    () => {
      const again = build(SITES.again, { missions: CHILDREN });
      // Same site folder name in the same checkout: the raw bytes must match.
      const strip = (html: string) => html.replaceAll('sidebar-cap-again', 'sidebar-cap-capped');
      for (const [route, html] of capped) expect(strip(again.get(route)!), route).toBe(html);
    },
    BUILD_TIMEOUT,
  );
});
