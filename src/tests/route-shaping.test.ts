/**
 * WP04 T025 — sidebar and table-of-contents shaping, the pure core
 * (FR-011, FR-019..FR-023, NFR-006, C-004).
 *
 * `route-shaping.ts` has no filesystem or framework dependency, so every rule is
 * proven here on hand-built trees. The integration-side half — the consumer
 * precedence switch and the middleware merge order — is exercised through
 * `defineDocKittyIntegrations` with Starlight mocked to capture its config (the
 * `config-invariants.test.ts` technique), because that decision is made there
 * and nowhere else. The built-HTML half is `sidebar-build-html.test.ts`.
 *
 * Mission: sidebar-frame-header-carrier-01M4T3CB, WP04.
 */
import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildDirectoryMeta,
  humaniseDirectoryName,
  shapePagination,
  shapeSidebar,
  shapeToc,
  REVEAL_CURRENT_SCRIPT,
  type DirectoryMetaInput,
  type RoutePagination,
  type RouteToc,
  type SidebarEntry,
} from '../lib/route-shaping.js';

vi.mock('@astrojs/starlight', () => ({
  default: (config: Record<string, unknown>) => ({
    name: '@astrojs/starlight',
    __starlightConfig: config,
    hooks: {},
  }),
}));
const { defineDocKittyIntegrations, routeShapingSource, ROUTE_MIDDLEWARE, ROUTE_SHAPING_MODULE_ID } =
  await import('../lib/config.js');

const BASE = '/doc-kitty';

const link = (slug: string, label: string, isCurrent = false): SidebarEntry => ({
  type: 'link',
  label,
  href: `${BASE}/${slug}/`,
  isCurrent,
  badge: undefined,
  attrs: {},
});
const group = (label: string, entries: SidebarEntry[], extra: object = {}): SidebarEntry => ({
  type: 'group',
  label,
  entries,
  collapsed: false,
  badge: undefined,
  ...extra,
});

const page = (slug: string, title: string, extra: Partial<DirectoryMetaInput> = {}): DirectoryMetaInput => ({
  slug,
  title,
  isIndex: false,
  ...extra,
});
const index = (slug: string, title: string, sidebar?: DirectoryMetaInput['sidebar']): DirectoryMetaInput =>
  page(slug, title, { isIndex: true, ...(sidebar ? { sidebar } : {}) });

/** The docs entries behind {@link rhetoricSidebar}. */
const RHETORIC_ENTRIES: DirectoryMetaInput[] = [
  index('', 'Home'),
  index('rhetoric', 'Rhetoric'),
  page('rhetoric/preamble', 'Preamble'),
  index('rhetoric/book-one', 'Book I', { order: 1 }),
  page('rhetoric/book-one/chapter-01', 'Chapter 1'),
  index('rhetoric/book-two', 'Book II', { order: 2 }),
  index('rhetoric/book-three', 'A long third title', { order: 3, label: 'Book III' }),
  page('rhetoric/notes/scratch', 'Scratch'),
];

/** The tree Starlight 0.32 autogenerates: slug-labelled, slug-ordered, index mid-group. */
const rhetoricSidebar = (): SidebarEntry[] => [
  group('Rhetoric', [
    group('book-one', [link('rhetoric/book-one/chapter-01', 'Chapter 1'), link('rhetoric/book-one', 'Book I')]),
    group('book-three', [link('rhetoric/book-three', 'A long third title')]),
    group('book-two', [link('rhetoric/book-two', 'Book II')]),
    group('notes', [link('rhetoric/notes/scratch', 'Scratch')]),
    link('rhetoric', 'Rhetoric'),
    link('rhetoric/preamble', 'Preamble'),
  ]),
];

const labelsOf = (entries: SidebarEntry[]): string[] => entries.map((e) => e.label);
const childrenOf = (entry: SidebarEntry | undefined): SidebarEntry[] => {
  if (entry?.type !== 'group') throw new Error('expected a group');
  return entry.entries;
};

describe('buildDirectoryMeta (T019)', () => {
  const meta = buildDirectoryMeta(RHETORIC_ENTRIES);

  it('labels a directory with its index page title', () => {
    expect(meta.get('rhetoric/book-one')).toEqual({
      label: 'Book I',
      order: 1,
      indexHref: '/rhetoric/book-one/',
    });
  });

  it('prefers the index page sidebar.label over its title', () => {
    expect(meta.get('rhetoric/book-three')?.label).toBe('Book III');
  });

  it('carries no order when the index page declares none', () => {
    expect(meta.get('rhetoric')).toEqual({ label: 'Rhetoric', indexHref: '/rhetoric/' });
  });

  it('has no entry for a directory without an index page, nor for the docs root', () => {
    expect(meta.has('rhetoric/notes')).toBe(false);
    expect(meta.has('')).toBe(false);
    // A non-index page never labels a directory, even one that shares its slug.
    expect(meta.has('rhetoric/preamble')).toBe(false);
  });

  it('gives the same map, in the same order, for shuffled input (NFR-006)', () => {
    const shuffled = buildDirectoryMeta([...RHETORIC_ENTRIES].reverse());
    expect([...shuffled.entries()]).toEqual([...meta.entries()]);
  });
});

describe('shapeSidebar (T020)', () => {
  const meta = buildDirectoryMeta(RHETORIC_ENTRIES);
  const shape = (entries: SidebarEntry[] = rhetoricSidebar()) => shapeSidebar(entries, meta, { base: BASE });

  it('labels nested groups from their index page, not the directory name (FR-019)', () => {
    const groups = childrenOf(shape().sidebar[0]).filter((e) => e.type === 'group');
    expect(labelsOf(groups)).toEqual(['Book I', 'Book II', 'Book III', 'Notes']);
  });

  it('orders groups by declared order, then unordered groups by label (FR-020)', () => {
    // Without the declared order `Book III` (dir book-three) sorts before
    // `Book II` by slug, which is the defect; `Notes` has no order and follows.
    const unordered = buildDirectoryMeta([
      index('s/zeta', 'Zeta'),
      index('s/alpha', 'Alpha'),
      index('s/first', 'Omega', { order: 1 }),
    ]);
    const { sidebar } = shapeSidebar(
      [
        group('S', [
          group('zeta', [link('s/zeta', 'Zeta')]),
          group('first', [link('s/first', 'Omega')]),
          group('alpha', [link('s/alpha', 'Alpha')]),
        ]),
      ],
      unordered,
      { base: BASE },
    );
    expect(labelsOf(childrenOf(sidebar[0]))).toEqual(['Omega', 'Alpha', 'Zeta']);
  });

  it('moves each directory index to the front of its group (FR-021)', () => {
    const top = childrenOf(shape().sidebar[0]);
    expect(labelsOf(top).slice(0, 2)).toEqual(['Rhetoric', 'Preamble']);
    expect(labelsOf(childrenOf(top.find((e) => e.label === 'Book I')))).toEqual(['Book I', 'Chapter 1']);
  });

  it('keeps links in the order Starlight gave them, ahead of subgroups', () => {
    const { sidebar } = shapeSidebar(
      [group('S', [link('s/b', 'B'), group('sub', [link('s/sub/x', 'X')]), link('s/a', 'A')])],
      new Map(),
      { base: BASE },
    );
    expect(labelsOf(childrenOf(sidebar[0]))).toEqual(['B', 'A', 'Sub']);
  });

  it('falls back to a humanised directory name and warns once per group (FR-023)', () => {
    const { warnings } = shape();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"rhetoric/notes"');
    expect(warnings[0]).toContain('"Notes"');
    expect(humaniseDirectoryName('book-one')).toBe('Book one');
    expect(humaniseDirectoryName('release_notes')).toBe('Release notes');
  });

  it('does not warn for a directory whose index exists but is unpublished', () => {
    const { sidebar, warnings } = shapeSidebar(rhetoricSidebar(), meta, {
      base: BASE,
      unpublishedDirs: ['rhetoric/notes'],
    });
    expect(warnings).toEqual([]);
    expect(labelsOf(childrenOf(sidebar[0]))).toContain('Notes');
  });

  it('leaves top-level labels and top-level order alone', () => {
    const { sidebar } = shapeSidebar(
      [group('Zed section', [link('rhetoric', 'Rhetoric')]), group('Reference', [link('glossary/a', 'A')])],
      meta,
      { base: BASE },
    );
    expect(labelsOf(sidebar)).toEqual(['Zed section', 'Reference']);
  });

  it('recurses into groups nested more than one level deep', () => {
    const deep = buildDirectoryMeta([index('a/b', 'Bee'), index('a/b/c', 'Sea'), page('a/b/c/leaf', 'Leaf')]);
    const { sidebar } = shapeSidebar(
      [group('A', [group('b', [group('c', [link('a/b/c/leaf', 'Leaf'), link('a/b/c', 'Sea')]), link('a/b', 'Bee')])])],
      deep,
      { base: BASE },
    );
    const b = childrenOf(sidebar[0])[0];
    expect(b?.label).toBe('Bee');
    expect(labelsOf(childrenOf(b))).toEqual(['Bee', 'Sea']);
    expect(labelsOf(childrenOf(childrenOf(b)[1]))).toEqual(['Sea', 'Leaf']);
  });

  it('reads a group directory through a subgroup that holds only its own index', () => {
    // `a/b` has no direct link: its directory must come from the subgroup
    // (one level up from `a/b/c`), not from the lone link two levels down.
    const deep = buildDirectoryMeta([index('a/b', 'Bee'), index('a/b/c', 'Sea')]);
    const { sidebar } = shapeSidebar(
      [group('A', [group('b', [group('c', [link('a/b/c', 'Sea')])])])],
      deep,
      { base: BASE },
    );
    expect(childrenOf(sidebar[0])[0]?.label).toBe('Bee');
  });

  it('passes a group with no internal link through untouched', () => {
    const external: SidebarEntry = {
      type: 'link',
      label: 'GitHub',
      href: 'https://example.org/repo',
      isCurrent: false,
      badge: undefined,
      attrs: {},
    };
    const { sidebar, warnings } = shapeSidebar([group('Top', [group('links', [external])])], meta, { base: BASE });
    expect(childrenOf(sidebar[0])[0]?.label).toBe('links');
    expect(warnings).toEqual([]);
  });

  it('respects the site base and works without one', () => {
    const bare = (entries: SidebarEntry[]): SidebarEntry[] =>
      JSON.parse(JSON.stringify(entries).replaceAll(`${BASE}/`, '/')) as SidebarEntry[];
    const withBase = shape().sidebar;
    const withoutBase = shapeSidebar(bare(rhetoricSidebar()), meta).sidebar;
    expect(withoutBase).toEqual(bare(withBase));
    // A wrong base leaves every href unmatched: no index is found, so the
    // groups fall back. This is what the base option exists to prevent.
    const wrong = shapeSidebar(rhetoricSidebar(), meta, { base: '/other' });
    expect(wrong.warnings.length).toBeGreaterThan(1);
  });

  it('preserves every other field and does not mutate its input', () => {
    const input = rhetoricSidebar();
    const top = input[0] as Extract<SidebarEntry, { type: 'group' }>;
    top.collapsed = true;
    top.badge = { text: 'new', variant: 'tip' } as typeof top.badge;
    (top.entries[4] as Extract<SidebarEntry, { type: 'link' }>).isCurrent = true;
    (top.entries[4] as Extract<SidebarEntry, { type: 'link' }>).attrs = { 'data-x': '1' };
    const snapshot = structuredClone(input);

    const { sidebar } = shapeSidebar(input, meta, { base: BASE });

    expect(input).toEqual(snapshot);
    const shapedTop = sidebar[0] as typeof top;
    expect(shapedTop).not.toBe(top);
    expect(shapedTop.collapsed).toBe(true);
    expect(shapedTop.badge).toEqual({ text: 'new', variant: 'tip' });
    expect(shapedTop.entries[0]).toMatchObject({ label: 'Rhetoric', isCurrent: true, attrs: { 'data-x': '1' } });
  });

  it('is idempotent: shaping a shaped tree returns an equal tree', () => {
    const once = shape();
    const twice = shape(once.sidebar);
    expect(twice.sidebar).toEqual(once.sidebar);
    expect(twice.warnings).toEqual(once.warnings);
  });

  it('gives identical output for shuffled group input (NFR-006)', () => {
    const shuffled = rhetoricSidebar();
    const top = shuffled[0] as Extract<SidebarEntry, { type: 'group' }>;
    const groups = top.entries.filter((e) => e.type === 'group').reverse();
    top.entries = [...top.entries.filter((e) => e.type === 'link'), ...groups];
    expect(shape(shuffled)).toEqual(shape());
  });

  it('breaks a label tie by directory so the order is total', () => {
    const same = buildDirectoryMeta([index('s/b', 'Same'), index('s/a', 'Same')]);
    const tree = (order: string[]): SidebarEntry[] => [
      group('S', order.map((d) => group(d, [link(`s/${d}`, 'Same')]))),
    ];
    const hrefs = (entries: SidebarEntry[]): string[] =>
      childrenOf(entries[0]).map((g) => (childrenOf(g)[0] as { href: string }).href);
    const ab = shapeSidebar(tree(['a', 'b']), same, { base: BASE }).sidebar;
    const ba = shapeSidebar(tree(['b', 'a']), same, { base: BASE }).sidebar;
    expect(hrefs(ab)).toEqual([`${BASE}/s/a/`, `${BASE}/s/b/`]);
    expect(hrefs(ba)).toEqual(hrefs(ab));
  });
});

describe('shapeToc (T021, FR-011)', () => {
  const item = (text: string, children: unknown[] = []) => ({ depth: 2, slug: text, text, children });
  const toc = (items: unknown[]): RouteToc => ({ minHeadingLevel: 2, maxHeadingLevel: 3, items }) as RouteToc;

  it('drops a table of contents with no items', () => {
    expect(shapeToc(toc([]))).toBeUndefined();
  });

  it('drops a table of contents holding only the page-title entry', () => {
    expect(shapeToc(toc([item('Overview')]))).toBeUndefined();
  });

  it('keeps a table of contents with two or more items, unchanged', () => {
    const two = toc([item('Overview'), item('Details')]);
    expect(shapeToc(two)).toBe(two);
  });

  it('keeps a single item that has children', () => {
    const nested = toc([item('Overview', [item('Child')])]);
    expect(shapeToc(nested)).toBe(nested);
  });

  it('passes through an already absent table of contents', () => {
    expect(shapeToc(undefined)).toBeUndefined();
  });
});

describe('shapePagination', () => {
  const meta = buildDirectoryMeta(RHETORIC_ENTRIES);
  const follows = { prev: true, next: true };
  const on = (slug: string) => {
    const mark = (entries: SidebarEntry[]): SidebarEntry[] =>
      entries.map((e) =>
        e.type === 'group'
          ? { ...e, entries: mark(e.entries) }
          : { ...e, isCurrent: e.href === `${BASE}/${slug}/` },
      );
    const original = mark(rhetoricSidebar());
    return { original, shaped: shapeSidebar(original, meta, { base: BASE }).sidebar };
  };
  const linkOf = (entries: SidebarEntry[], slug: string) => {
    const flat = (list: SidebarEntry[]): SidebarEntry[] =>
      list.flatMap((e) => (e.type === 'group' ? flat(e.entries) : [e]));
    return flat(entries).find((e) => e.type === 'link' && e.href === `${BASE}/${slug}/`) as
      | NonNullable<RoutePagination['prev']>
      | undefined;
  };

  it('follows the shaped order when the links followed the original order', () => {
    // Original reading order: chapter-01, book-one, book-three, book-two, …
    const { original, shaped } = on('rhetoric/book-one');
    const before: RoutePagination = {
      prev: linkOf(original, 'rhetoric/book-one/chapter-01'),
      next: linkOf(original, 'rhetoric/book-three'),
    };
    const after = shapePagination(original, shaped, before, follows);
    // Shaped reading order: rhetoric, preamble, book-one, chapter-01, book-two, …
    expect(after.prev?.href).toBe(`${BASE}/rhetoric/preamble/`);
    expect(after.next?.href).toBe(`${BASE}/rhetoric/book-one/chapter-01/`);
  });

  it('fills a side that was empty only because the page was first in the old order', () => {
    const { original, shaped } = on('rhetoric/book-one/chapter-01');
    const after = shapePagination(original, shaped, { prev: undefined, next: linkOf(original, 'rhetoric/book-one') }, follows);
    expect(after.prev?.href).toBe(`${BASE}/rhetoric/book-one/`);
    expect(after.next?.href).toBe(`${BASE}/rhetoric/book-two/`);
  });

  it('leaves a side the author disabled or pointed elsewhere', () => {
    const { original, shaped } = on('rhetoric/book-one/chapter-01');
    const custom = { ...linkOf(original, 'rhetoric/preamble')!, label: 'Elsewhere' };
    const after = shapePagination(original, shaped, { prev: undefined, next: custom }, { prev: false, next: false });
    expect(after.prev).toBeUndefined();
    expect(after.next).toBe(custom);
  });

  it('keeps a custom label on a link that still follows the sidebar', () => {
    const { original, shaped } = on('rhetoric/book-one');
    const relabelled = { ...linkOf(original, 'rhetoric/book-three')!, label: 'Onwards' };
    const after = shapePagination(original, shaped, { prev: undefined, next: relabelled }, { prev: false, next: false });
    expect(after.next).toMatchObject({ href: `${BASE}/rhetoric/book-one/chapter-01/`, label: 'Onwards' });
  });

  it('returns the pagination unchanged on a page that is not in the sidebar', () => {
    const original = rhetoricSidebar();
    const before: RoutePagination = { prev: undefined, next: undefined };
    expect(shapePagination(original, original, before, follows)).toBe(before);
  });
});

describe('REVEAL_CURRENT_SCRIPT (T023, FR-022)', () => {
  interface Rect { top: number; bottom: number; height: number }
  const rect = (top: number, height: number): Rect => ({ top, bottom: top + height, height });

  /** Run the inline script against a stub document; returns the pane after load. */
  function run(opts: { pane?: Rect; current?: Rect | null; readyState?: string; scrollTop?: number }) {
    const pane = {
      scrollTop: opts.scrollTop ?? 0,
      getBoundingClientRect: () => opts.pane ?? rect(64, 800),
      querySelector: (selector: string) => {
        expect(selector).toBe('[aria-current="page"]');
        return opts.current ? { getBoundingClientRect: () => opts.current } : null;
      },
    };
    const listeners: Array<() => void> = [];
    const document = {
      readyState: opts.readyState ?? 'loading',
      getElementById: (id: string) => (id === 'starlight__sidebar' && opts.pane !== null ? pane : null),
      addEventListener: (type: string, fn: () => void) => {
        expect(type).toBe('DOMContentLoaded');
        listeners.push(fn);
      },
    };
    new Function('document', REVEAL_CURRENT_SCRIPT)(document);
    const ranEarly = listeners.length === 0;
    for (const fn of listeners) fn();
    return { pane, ranEarly };
  }

  it('centres an entry that is below the visible part of the sidebar', () => {
    // Pane 64..864; entry at y=1621, 32px tall → centred at 64 + (800-32)/2 = 448.
    const { pane, ranEarly } = run({ current: rect(1621, 32) });
    expect(ranEarly).toBe(false); // waits for DOMContentLoaded, after Starlight's restore
    expect(pane.scrollTop).toBe(1621 - 448);
  });

  it('scrolls up for an entry above the visible part', () => {
    const { pane } = run({ current: rect(-300, 32), scrollTop: 900 });
    expect(pane.scrollTop).toBe(900 + (-300 - 448));
  });

  it('leaves the pane alone when the entry is already in view', () => {
    expect(run({ current: rect(500, 32), scrollTop: 240 }).pane.scrollTop).toBe(240);
  });

  it('does nothing when the sidebar is hidden (every rect is zero)', () => {
    expect(run({ pane: rect(0, 0), current: rect(0, 0) }).pane.scrollTop).toBe(0);
  });

  it('does nothing without a current entry, and runs at once on a parsed document', () => {
    expect(run({ current: null }).pane.scrollTop).toBe(0);
    const late = run({ current: rect(1621, 32), readyState: 'interactive' });
    expect(late.ranEarly).toBe(true);
    expect(late.pane.scrollTop).toBe(1621 - 448);
  });

  it('never calls scrollIntoView, which would also scroll the page', () => {
    expect(REVEAL_CURRENT_SCRIPT).not.toContain('scrollIntoView');
  });
});

describe('integration wiring (T022, C-004)', () => {
  type Hook = (args: { updateConfig: (config: unknown) => void }) => void;
  interface Captured {
    name: string;
    __starlightConfig?: { routeMiddleware?: string[]; head?: Array<{ content?: string }> };
    hooks: Record<string, Hook>;
  }

  /** A docs tree with one titled and one untitled nested directory. */
  function fixtureSite(): string {
    const root = mkdtempSync(path.join(tmpdir(), 'dk-route-shaping-'));
    const write = (rel: string, title: string, extra = '') => {
      const abs = path.join(root, 'docs', rel);
      mkdirSync(path.dirname(abs), { recursive: true });
      writeFileSync(abs, `---\ntitle: ${title}\n${extra}---\n\n# ${title}\n`);
    };
    write('guides/README.md', 'Guides');
    write('guides/setup/index.md', 'Setting up', 'sidebar:\n  order: 2\n');
    write('guides/setup/install.md', 'Install');
    write('guides/loose/page.md', 'Loose page');
    write('guides/_meta/ignored.md', 'Ignored');
    return root;
  }

  /** Load the virtual module the way Vite would and return its exported data. */
  function servedData(integrations: unknown[]): {
    base: string;
    shapeSidebar: boolean;
    pagination: boolean;
    directoryMeta: Array<[string, unknown]>;
    unpublishedDirs: string[];
  } {
    const seam = (integrations as Captured[]).find((i) => i.name === 'doc-kitty:route-shaping');
    if (!seam) throw new Error('route-shaping integration not registered');
    let plugin: { resolveId(id: string): string | null; load(id: string): string | null } | undefined;
    seam.hooks['astro:config:setup']!({
      updateConfig: (config) => {
        plugin = (config as { vite: { plugins: [typeof plugin] } }).vite.plugins[0];
      },
    });
    const source = plugin!.load(plugin!.resolveId(ROUTE_SHAPING_MODULE_ID)!)!;
    return JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
  }

  const starlightOf = (integrations: unknown[]) =>
    (integrations as Captured[]).find((i) => i.__starlightConfig)!.__starlightConfig!;

  function inSite<T>(run: () => T): T {
    const root = fixtureSite();
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
    try {
      return run();
    } finally {
      cwd.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('shapes a generated sidebar from the index pages on disk', () => {
    const data = inSite(() => servedData(defineDocKittyIntegrations({ title: 'Docs', base: '/docs-site/', indexBasename: ['README', 'index'] })));
    expect(data.shapeSidebar).toBe(true);
    expect(data.base).toBe('/docs-site');
    expect(data.directoryMeta).toEqual([
      ['guides', { label: 'Guides', indexHref: '/guides/' }],
      ['guides/setup', { label: 'Setting up', order: 2, indexHref: '/guides/setup/' }],
    ]);
  });

  it('honours the configured index basename', () => {
    // Under the default (README only) `setup/index.md` is an ordinary page.
    const data = inSite(() => servedData(defineDocKittyIntegrations({ title: 'Docs' })));
    expect(data.directoryMeta.map(([dir]) => dir)).toEqual(['guides']);
  });

  it('does not shape a sidebar the consumer supplied (C-004)', () => {
    const own = [{ label: 'Mine', link: '/mine/' }];
    inSite(() => {
      const direct = servedData(defineDocKittyIntegrations({ title: 'Docs', sidebar: own }));
      expect(direct.shapeSidebar).toBe(false);
      expect(direct.directoryMeta).toEqual([]);
      const viaHatch = servedData(defineDocKittyIntegrations({ title: 'Docs', starlight: { sidebar: own } }));
      expect(viaHatch.shapeSidebar).toBe(false);
    });
  });

  it('registers the toolkit middleware first and keeps the consumer middleware after it', () => {
    const alone = starlightOf(defineDocKittyIntegrations({ title: 'Docs' }));
    expect(alone.routeMiddleware).toEqual([ROUTE_MIDDLEWARE]);
    const one = starlightOf(defineDocKittyIntegrations({ title: 'Docs', starlight: { routeMiddleware: './a.ts' } }));
    expect(one.routeMiddleware).toEqual([ROUTE_MIDDLEWARE, './a.ts']);
    const many = starlightOf(
      defineDocKittyIntegrations({ title: 'Docs', starlight: { routeMiddleware: ['./a.ts', './b.ts'] } }),
    );
    expect(many.routeMiddleware).toEqual([ROUTE_MIDDLEWARE, './a.ts', './b.ts']);
  });

  it('still registers the middleware for a consumer sidebar, for the table of contents', () => {
    const config = starlightOf(defineDocKittyIntegrations({ title: 'Docs', sidebar: [] }));
    expect(config.routeMiddleware).toEqual([ROUTE_MIDDLEWARE]);
  });

  it('records a site-wide pagination switch-off', () => {
    inSite(() => {
      expect(servedData(defineDocKittyIntegrations({ title: 'Docs' })).pagination).toBe(true);
      expect(
        servedData(defineDocKittyIntegrations({ title: 'Docs', starlight: { pagination: false } })).pagination,
      ).toBe(false);
    });
  });

  it('ships the reveal script as a head entry', () => {
    const head = starlightOf(defineDocKittyIntegrations({ title: 'Docs' })).head ?? [];
    expect(head.some((entry) => entry.content === REVEAL_CURRENT_SCRIPT)).toBe(true);
  });

  it('leaves an unpublished index out of the metadata and lists its directory', () => {
    const source = inSite(() =>
      routeShapingSource({
        docsDir: 'docs',
        base: '/',
        indexBasename: ['README', 'index'],
        shapeSidebar: true,
        pagination: true,
        unpublishedDirs: ['guides/setup', 'guides/setup'],
      }),
    );
    const data = JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));
    expect(data.directoryMeta.map(([dir]: [string]) => dir)).toEqual(['guides']);
    expect(data.unpublishedDirs).toEqual(['guides/setup']);
  });

  it('emits the same module source for the same tree (NFR-006)', () => {
    const options = { docsDir: 'docs', base: '/x', shapeSidebar: true, pagination: true } as const;
    const [a, b] = inSite(() => [routeShapingSource(options), routeShapingSource(options)]);
    expect(a).toBe(b);
  });
});
