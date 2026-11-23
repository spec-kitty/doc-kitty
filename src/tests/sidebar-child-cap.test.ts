/**
 * The sidebar child cap in shaping (#341, WP03; FR-003, FR-005, FR-007, FR-008,
 * NFR-002). Pure tests on hand-built Starlight trees: a capped group becomes its
 * index link plus one capped entry, the entry is current on any page below the
 * hub, prev/next follow the hub's listing order, and relabelling and icons
 * ignore the entry. Every capped case has an uncapped twin on the same tree.
 */
import { describe, expect, it } from 'vitest';
import {
  buildDirectoryMeta,
  decorateSidebarIcons,
  expandCappedGroups,
  hubOrderPagination,
  relabelledLinks,
  shapePagination,
  shapeSidebar,
  type DirectoryMetaInput,
  type SidebarEntry,
} from '../lib/route-shaping.js';
import type { HubCap } from '../lib/child-cap.js';

const BASE = '/site';

type Link = Extract<SidebarEntry, { type: 'link' }>;
type Group = Extract<SidebarEntry, { type: 'group' }>;

const link = (slug: string, label: string, isCurrent = false): SidebarEntry => ({
  type: 'link',
  label,
  href: `${BASE}/${slug}/`,
  isCurrent,
  badge: undefined,
  attrs: {},
});
const group = (label: string, entries: SidebarEntry[]): SidebarEntry => ({
  type: 'group',
  label,
  entries,
  collapsed: false,
  badge: undefined,
});
const page = (slug: string, title: string, isIndex = false): DirectoryMetaInput => ({ slug, title, isIndex });

/** Hub order (titles): Alpha (zeta), Bravo (alpha), Charlie (charlie). Starlight's order is by slug. */
const CHILDREN = [
  { slug: 'missions/zeta', label: 'Alpha' },
  { slug: 'missions/alpha', label: 'Bravo' },
  { slug: 'missions/charlie', label: 'Charlie' },
];
const HUB: HubCap = { cap: 2, count: 3, children: CHILDREN };
const HUB_CAPS = new Map([['missions', HUB]]);

const META = buildDirectoryMeta([
  page('guides', 'Guides', true),
  page('missions', 'Missions', true),
  page('missions/sub', 'Sub', true),
]);

/** The tree as Starlight builds it, with the page at `current` marked. */
function tree(current = '', { hidden = false } = {}): SidebarEntry[] {
  const mark = (slug: string, label: string) => link(slug, label, slug === current);
  return [
    group('Guides', [mark('guides', 'Guides'), mark('guides/install', 'Install')]),
    group('Missions', [
      mark('missions', 'Missions'),
      ...(hidden
        ? []
        : [mark('missions/alpha', 'Bravo'), mark('missions/charlie', 'Charlie'), mark('missions/zeta', 'Alpha')]),
    ]),
    group('Ops', [mark('ops', 'Ops'), mark('ops/log', 'Log')]),
  ];
}

const shape = (entries: SidebarEntry[], current: string, caps: ReadonlyMap<string, HubCap> = HUB_CAPS) =>
  shapeSidebar(entries, META, { base: BASE, hubCaps: caps, currentSlug: current }).sidebar;

const missionsGroup = (sidebar: SidebarEntry[]) => sidebar.find((e) => e.label === 'Missions') as Group;
const capped = (sidebar: SidebarEntry[]) => missionsGroup(sidebar).entries[1] as Link & { dkCappedHub?: string };

describe('a capped group (FR-003)', () => {
  it('holds the index link and one entry to the hub', () => {
    const entries = missionsGroup(shape(tree('guides'), 'guides')).entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ type: 'link', href: `${BASE}/missions/`, label: 'Overview' });
    expect(entries[1]).toMatchObject({
      type: 'link',
      href: `${BASE}/missions/`,
      label: '3 pages',
      isCurrent: false,
      attrs: {},
      dkCappedHub: 'missions',
    });
  });

  it('is not capped without hub data, and the tree equals today\'s', () => {
    const today = shapeSidebar(tree('guides'), META, { base: BASE }).sidebar;
    expect(shape(tree('guides'), 'guides', new Map())).toEqual(today);
    expect(missionsGroup(today).entries).toHaveLength(4);
  });

  it('uses the label function it is given', () => {
    const sidebar = shapeSidebar(tree('guides'), META, {
      base: BASE,
      hubCaps: HUB_CAPS,
      currentSlug: 'guides',
      cappedLabel: (count) => `All ${count}`,
    }).sidebar;
    expect(capped(sidebar).label).toBe('All 3');
  });

  it('caps a top-level section group and a nested group alike', () => {
    const nested = [
      group('Missions', [
        link('missions', 'Missions'),
        group('sub', [link('missions/sub', 'Sub'), link('missions/sub/a', 'A'), link('missions/sub/b', 'B')]),
      ]),
    ];
    const caps = new Map([['missions/sub', { cap: 1, count: 2, children: [] } as HubCap]]);
    const sub = (shape(nested, '', caps)[0] as Group).entries[1] as Group;
    expect(sub.label).toBe('Sub');
    expect(sub.entries.map((e) => e.label)).toEqual(['Overview', '2 pages']);
  });

  it('drops a nested hub with the rest of a capped parent\'s children', () => {
    const nested = [
      group('Missions', [
        link('missions', 'Missions'),
        link('missions/a', 'A'),
        group('sub', [link('missions/sub', 'Sub'), link('missions/sub/x', 'X')]),
      ]),
    ];
    const caps = new Map([['missions', { cap: 1, count: 2, children: [] } as HubCap]]);
    expect((shape(nested, '', caps)[0] as Group).entries.map((e) => e.type)).toEqual(['link', 'link']);
  });

  it('keeps a group whose index page is not in the tree uncapped', () => {
    const noIndex = [group('Missions', [link('missions/alpha', 'Bravo'), link('missions/charlie', 'Charlie')])];
    expect((shape(noIndex, '')[0] as Group).entries).toHaveLength(2);
  });
});

describe('current marking (FR-005)', () => {
  it('marks the capped entry current on a child, and only it', () => {
    const sidebar = shape(tree('missions/alpha'), 'missions/alpha');
    expect(capped(sidebar)).toMatchObject({ dkCappedHub: 'missions' });
    expect(capped(sidebar).isCurrent).toBe(true);
    const current = JSON.stringify(sidebar).match(/"isCurrent":true/g) ?? [];
    expect(current).toHaveLength(1);
  });

  it('marks the index, not the capped entry, on the hub page', () => {
    const sidebar = shape(tree('missions'), 'missions');
    expect(capped(sidebar)).toMatchObject({ dkCappedHub: 'missions' });
    expect((missionsGroup(sidebar).entries[0] as Link).isCurrent).toBe(true);
    expect(capped(sidebar).isCurrent).toBe(false);
  });

  it('marks the capped entry on a page deeper below the hub, and on a pre-hidden child', () => {
    expect(capped(shape(tree(''), 'missions/sub/deep')).isCurrent).toBe(true);
    expect(capped(shape(tree('', { hidden: true }), 'missions/zeta')).isCurrent).toBe(true);
  });

  it('does not mark it on a sibling folder that shares the prefix', () => {
    const sidebar = shape(tree(''), 'missions-archive/x');
    expect(capped(sidebar)).toMatchObject({ dkCappedHub: 'missions' });
    expect(capped(sidebar).isCurrent).toBe(false);
  });
});

describe('prev/next in hub order (FR-007, FR-008)', () => {
  const FOLLOWS = { prev: true, next: true };

  /** What the middleware does: shape, expand for pagination, re-derive. */
  function paginate(current: string, { hidden = false, follows = FOLLOWS } = {}) {
    const original = tree(current, { hidden });
    // Starlight's own prev/next: the neighbours in its tree, if the page is in it.
    const flat = original.flatMap((g) => (g.type === 'group' ? g.entries : [g])) as Link[];
    const at = flat.findIndex((l) => l.isCurrent);
    const starlight = at === -1 ? { prev: undefined, next: undefined } : { prev: flat[at - 1], next: flat[at + 1] };
    const shaped = shape(original, current);
    const expanded = expandCappedGroups(shaped, HUB_CAPS, current);
    const result = shapePagination(original, expanded, starlight, follows);
    return { prev: result.prev?.href, next: result.next?.href };
  }

  it('follows the hub order on a child, not the slug order', () => {
    expect(paginate('missions/alpha')).toEqual({ prev: `${BASE}/missions/zeta/`, next: `${BASE}/missions/charlie/` });
  });

  it('goes from the hub page to its first child in hub order', () => {
    expect(paginate('missions').next).toBe(`${BASE}/missions/zeta/`);
  });

  it('goes from the last child to the entry after the hub group', () => {
    expect(paginate('missions/charlie').next).toBe(`${BASE}/ops/`);
  });

  it('gives a pre-hidden child the same prev/next as a listed one', () => {
    for (const slug of ['missions/zeta', 'missions/alpha', 'missions/charlie']) {
      expect(paginate(slug, { hidden: true })).toEqual(paginate(slug));
    }
  });

  it('keeps a side the author switched off', () => {
    expect(paginate('missions/alpha', { hidden: true, follows: { prev: false, next: true } }).prev).toBeUndefined();
  });

  it('leaves pagination alone when neither tree holds the page', () => {
    const original = tree('');
    const shaped = shape(original, 'elsewhere');
    const pagination = { prev: undefined, next: undefined };
    expect(shapePagination(original, expandCappedGroups(shaped, HUB_CAPS, 'elsewhere'), pagination, FOLLOWS)).toBe(
      pagination,
    );
  });

  it('returns the shaped tree itself when no hub is capped', () => {
    const shaped = shape(tree('guides'), 'guides', new Map());
    expect(expandCappedGroups(shaped, new Map(), 'guides')).toBe(shaped);
  });
});

describe('prev/next after a later middleware rebuilt them from the shaped sidebar (FR-007)', () => {
  // The OpenAPI renderer's middleware runs after ours and rebuilds prev/next from
  // route.sidebar, the capped tree: it walks the capped entry as if it were a page.
  // `hubOrderPagination` is what our follow-up middleware applies to that result.
  const FOLLOWS = { prev: true, next: true };
  const flat = (entries: SidebarEntry[]): Link[] =>
    entries.flatMap((e) => (e.type === 'group' ? flat(e.entries) : [e as Link]));
  /** What the renderer does: neighbours of the current link in the tree it is given. */
  function rebuilt(sidebar: SidebarEntry[]) {
    const links = flat(sidebar);
    const at = links.findIndex((l) => l.isCurrent);
    return at === -1 ? { prev: undefined, next: undefined } : { prev: links[at - 1], next: links[at + 1] };
  }
  const run = (current: string, follows = FOLLOWS) => {
    const sidebar = shape(tree(current), current);
    const result = hubOrderPagination(sidebar, HUB_CAPS, current, rebuilt(sidebar), follows);
    return { prev: result.prev?.href, next: result.next?.href };
  };

  it('the renderer alone gives every child the capped entry\'s neighbours (the defect)', () => {
    const sidebar = shape(tree('missions/alpha'), 'missions/alpha');
    expect(rebuilt(sidebar).next?.href).toBe(`${BASE}/ops/`);
  });

  it('restores hub order on a child, the hub page and the last child', () => {
    expect(run('missions/alpha')).toEqual({ prev: `${BASE}/missions/zeta/`, next: `${BASE}/missions/charlie/` });
    expect(run('missions')).toEqual({ prev: `${BASE}/guides/install/`, next: `${BASE}/missions/zeta/` });
    expect(run('missions/charlie').next).toBe(`${BASE}/ops/`);
  });

  it('restores the neighbour of the page after a capped group', () => {
    expect(run('ops').prev).toBe(`${BASE}/missions/charlie/`);
  });

  it('keeps a side the author set or switched off', () => {
    expect(run('missions/alpha', { prev: false, next: true }).prev).toBe(`${BASE}/missions/`);
  });

  it('gives a page below the hub that the hub does not list the pagination shaping gave it', () => {
    // A draft child in a drafts-on build: in Starlight's tree, not in the hub's list.
    const original = [
      ...tree(''),
    ].map((g) =>
      g.type === 'group' && g.label === 'Missions'
        ? { ...g, entries: [...g.entries, link('missions/draft', 'Draft', true)] }
        : g,
    );
    const sidebar = shape(original, 'missions/draft');
    const own = { prev: link('missions/charlie', 'Charlie') as Link, next: link('ops', 'Ops') as Link };
    const result = hubOrderPagination(sidebar, HUB_CAPS, 'missions/draft', rebuilt(sidebar), FOLLOWS, own);
    expect(result).toBe(own);
    // A page outside every capped hub never takes it.
    const guides = shape(tree('guides'), 'guides');
    const elsewhere = hubOrderPagination(guides, HUB_CAPS, 'guides', rebuilt(guides), FOLLOWS, own);
    expect(elsewhere).toEqual(rebuilt(guides));
    expect(elsewhere).not.toBe(own);
  });

  it('returns the pagination itself when no hub is capped', () => {
    const sidebar = shape(tree('guides'), 'guides', new Map());
    const pagination = rebuilt(sidebar);
    expect(hubOrderPagination(sidebar, new Map(), 'guides', pagination, FOLLOWS)).toBe(pagination);
  });
});

describe('relabelling and icons skip the capped entry', () => {
  it('does not report the capped entry as a relabelled link', () => {
    const relabelled = relabelledLinks(tree('guides'), shape(tree('guides'), 'guides'));
    expect(relabelled.get(`${BASE}/missions/`)).toEqual({ shaped: 'Overview', original: 'Missions' });
  });

  it('gives the capped entry no link icon', () => {
    const icons = { links: new Map([['missions', { svg: '<svg/>', fa: false }]]), groups: new Map() };
    const decorated = decorateSidebarIcons(shape(tree('guides'), 'guides'), icons, BASE);
    expect(capped(decorated)).not.toHaveProperty('dkIcon');
  });
});

describe('the package export (FR-009)', () => {
  it('serves the cap API at @spec-kitty/doc-toolkit/child-cap', async () => {
    const api = await import('@spec-kitty/doc-toolkit/child-cap');
    expect(api.resolveChildCap({ section: 7 })).toBe(7);
    expect(api.cappedChildHidden(8, 7)).toBe(true);
    expect(api.DEFAULT_CHILD_CAP).toBe(50);
  });
});
