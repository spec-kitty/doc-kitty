/**
 * The sidebar icon resolver and what surrounds it, without a build (page-chrome WP07;
 * FR-026, FR-027, C-003). `sidebar-icons-build.test.ts` proves the rendered output.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildState } from '../lib/build-state.js';
import { sidebarIconsIntegration, SIDEBAR_ICONS_MODULE_ID } from '../lib/integrations/sidebar-icons.js';
import { routeShapingSource } from '../lib/integrations/route-shaping.js';
import { docKittyManifest } from '../lib/manifest.js';
import { decorateSidebarIcons, type SidebarEntry } from '../lib/route-shaping.js';
import { docKittyDocsSchema, docKittyFields } from '../lib/schema.js';
import { resolveSectionRegistry } from '../lib/sections.js';
import { collectAuthoredIcons, resolveIcon, sidebarIconData } from '../lib/sidebar-icons.js';
import type { ResolvedTheme } from '../lib/theme.js';
import { hasFontAwesomeIcon } from '../components/sidebar/sidebar-data.js';
import { BUILTIN_ICONS_FILE, generateBuiltinIcons } from '../scripts/generate-sidebar-icons.mjs';
import { validate } from '../scripts/validate-frontmatter.mjs';

const VALIDATOR = fileURLToPath(new URL('../scripts/validate-frontmatter.mjs', import.meta.url));
const PAGE = (extra = '') =>
  `---\ntitle: A page\ndescription: A page that exists so the gate has something real to read here.\ndoc_status: active\nupdated: 2026-01-01T00:00:00Z\nkind: How-To\n${extra}---\nBody.\n`;

const roots: string[] = [];
const cwd = process.cwd();
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'dk-icons-'));
  roots.push(root);
  for (const [rel, contents] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), contents);
  }
  return root;
}
afterEach(() => {
  process.chdir(cwd);
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('resolveIcon', () => {
  it.each([
    ['fa-rocket', 'fa', 'viewBox="0 0 512 512"', 'width="1em"'],
    // A wide Font Awesome icon keeps its own proportions.
    ['fa-truck', 'fa', 'viewBox="0 0 640 512"', 'width="1.25em"'],
    ['rocket', 'starlight', 'viewBox="0 0 24 24"', 'width="1em"'],
  ])('%s resolves from %s, with its own box', (name, source, box, width) => {
    const icon = resolveIcon(name);
    expect(icon?.source).toBe(source);
    expect(icon?.svg).toContain(box);
    expect(icon?.svg).toContain(width);
    expect(icon?.svg).toMatch(/^<svg aria-hidden="true" focusable="false" fill="currentColor" [^>]*height="1em"[^>]*><path /);
  });

  it.each(['fa-no-such-icon', 'no-such-icon', 'seti:shell', '', 'constructor', '__proto__', 'fa-constructor', 'fa-__proto__', 5, null, undefined])(
    '%s is unknown',
    (name) => {
      expect(resolveIcon(name)).toBeUndefined();
    },
  );

  it('is deterministic', () => {
    expect(resolveIcon('fa-rocket')).toEqual(resolveIcon('fa-rocket'));
    expect(resolveIcon('rocket')).toEqual(resolveIcon('rocket'));
  });
});

describe('the built-in list', () => {
  it('is what the installed Starlight would generate, so an upgrade fails here', async () => {
    const generated = await generateBuiltinIcons();
    expect(JSON.parse(generated).icons, 'control: real icons').toHaveProperty('rocket');
    expect(readFileSync(BUILTIN_ICONS_FILE, 'utf8')).toBe(generated);
  });

  it('holds no name the fa- prefix would take', () => {
    expect(Object.keys(JSON.parse(readFileSync(BUILTIN_ICONS_FILE, 'utf8')).icons).filter((name) => name.startsWith('fa-'))).toEqual([]);
  });
});

describe('Font Awesome data is read only for an fa- name', () => {
  it('a fresh resolver does not read it for a built-in or an unknown bare name, and does for fa-', async () => {
    vi.resetModules();
    const reads: string[] = [];
    vi.doMock('node:fs', async (importOriginal) => {
      const fs = await importOriginal<typeof import('node:fs')>();
      return {
        ...fs,
        readFileSync: (file: string, ...rest: []) => {
          reads.push(String(file));
          return fs.readFileSync(file, ...rest);
        },
      };
    });
    const core = await import('../lib/sidebar-icons-core.mjs');
    const faReads = () => reads.filter((file) => file.includes('fa6-solid'));

    expect(core.resolveIcon('rocket')?.source).toBe('starlight');
    expect(core.resolveIcon('no-such-icon')).toBeUndefined();
    expect(reads.length, 'control: the wrapper sees reads').toBeGreaterThan(0);
    expect(faReads()).toEqual([]);

    expect(core.resolveIcon('fa-rocket')?.source).toBe('fa');
    expect(faReads()).toHaveLength(1);
    vi.doUnmock('node:fs');
    vi.resetModules();
  });
});

describe('collectAuthoredIcons and sidebarIconData', () => {
  it('reads pages and the registry, keyed by route, with a section beating its index page', () => {
    const root = tree({
      'docs/guides/README.md': PAGE('sidebar:\n  icon: pencil\n'),
      'docs/guides/page.md': PAGE('sidebar:\n  icon: fa-rocket\n'),
      'docs/guides/none.md': PAGE(),
      'docs/reference/README.md': PAGE('sidebar:\n  icon: star\n'),
      'docs/_meta/sections.yaml': 'version: 1\nsections:\n  - { id: guides, label: Guides, order: 1, icon: fa-book }\n  - { id: reference, label: Reference, order: 2 }\n',
    });
    process.chdir(root);
    const authored = collectAuthoredIcons('docs', { indexBasename: 'README' });
    expect(authored.pages.map(({ rel, slug, isIndex, name }) => [rel, slug, isIndex, name])).toEqual([
      ['guides/README.md', 'guides', true, 'pencil'],
      ['guides/page.md', 'guides/page', false, 'fa-rocket'],
      ['reference/README.md', 'reference', true, 'star'],
    ]);
    expect(authored.sections).toEqual([{ id: 'guides', name: 'fa-book' }]);

    const data = sidebarIconData(authored);
    expect(Object.fromEntries(data.groups).guides).toEqual({ svg: resolveIcon('fa-book')!.svg, fa: true });
    expect(Object.fromEntries(data.groups).reference).toEqual({ svg: resolveIcon('star')!.svg, fa: false });
    expect(Object.fromEntries(data.links)['guides/page']?.fa).toBe(true);
  });

  it('a charter\'s sections.entries carry an icon too', () => {
    const root = tree({
      'docs/_meta/charter.yaml': 'version: 1\nsections:\n  entries:\n    - { id: guides, label: Guides, order: 1, icon: fa-book }\n',
    });
    expect(resolveSectionRegistry(path.join(root, 'docs'))?.[0]?.icon).toBe('fa-book');
  });

  it('a non-string registry icon is refused', () => {
    const root = tree({ 'docs/_meta/sections.yaml': 'version: 1\nsections:\n  - { id: guides, label: Guides, order: 1, icon: 5 }\n' });
    expect(() => resolveSectionRegistry(path.join(root, 'docs'))).toThrow('section "guides" "icon" must be a string');
  });

  it('an unknown name throws, naming the file or section', () => {
    const page = { rel: 'guides/a.md', slug: 'guides/a', isIndex: false, name: 'fa-nope' };
    expect(() => sidebarIconData({ pages: [page], sections: [] })).toThrow('[dk-sidebar-icons] guides/a.md: unknown icon "fa-nope"');
    expect(() => sidebarIconData({ pages: [], sections: [{ id: 'guides', name: 'nope' }] })).toThrow(
      '[dk-sidebar-icons] section "guides": unknown icon "nope"',
    );
  });

  it('a withheld draft is checked, and left out of what is served', () => {
    const draft = { rel: 'guides/draft.md', slug: 'guides/draft', isIndex: false, name: 'rocket' };
    expect(sidebarIconData({ pages: [draft], sections: [] }, new Set([draft.rel])).links).toEqual([]);
    expect(sidebarIconData({ pages: [draft], sections: [] }).links).toHaveLength(1);
    expect(() => sidebarIconData({ pages: [{ ...draft, name: 'nope' }], sections: [] }, new Set([draft.rel]))).toThrow('unknown icon');
  });
});

/** Hooks and plugins of the integrations that decide, as the real config wires them. */
function deciders(shapeSidebar = true) {
  const state = createBuildState();
  const options = { docsDir: 'docs', base: '', indexBasename: 'README', shapeSidebar, pagination: true };
  const icons = sidebarIconsIntegration(options, state);
  const plugins: Array<{ resolveId: (id: string) => string | null; load: (id: string) => string | null }> = [];
  const updateConfig = (config: { vite: { plugins: (typeof plugins)[number][] } }) => plugins.push(...config.vite.plugins);
  const resolved = { layouts: {}, slots: {}, assets: {}, tokens: {}, tokenSheets: [] } as unknown as ResolvedTheme;
  // The factory runs first, while the docs tree is as the caller left it.
  const manifest = docKittyManifest(resolved, state);
  return {
    state,
    setup() {
      for (const integration of [manifest, icons]) integration.hooks['astro:config:setup']!({ updateConfig } as never);
    },
    done: () => icons.hooks['astro:config:done']!({} as never),
    manifestSource: () => plugins[0]!.load('\0virtual:doc-kitty/manifest'),
    iconsSource: () => plugins[1]!.load(plugins[1]!.resolveId(SIDEBAR_ICONS_MODULE_ID)!),
    annotate: () => /"annotate": (true|false)/.exec(routeShapingSource(options, state))?.[1],
  };
}
const BODY_IMPORT = 'components/sidebar/CustomSidebarBody.astro';

describe('when the opt-in is decided (the factory runs before any generator)', () => {
  it('a page a generator writes during setup, after the factory, turns both deciders on', () => {
    process.chdir(tree({ 'docs/guides/README.md': PAGE() }));
    const site = deciders();
    site.setup();
    writeFileSync('docs/guides/generated.md', PAGE('sidebar:\n  icon: rocket\n'));
    site.done();
    expect(site.state.iconsAuthored).toBe(true);
    expect(site.manifestSource()).toContain(BODY_IMPORT);
    expect(site.annotate()).toBe('true');
    expect(site.iconsSource()).toContain('guides/generated');
  });

  it('an icon on a page gone by then, a stale generated page, turns neither on', () => {
    process.chdir(tree({ 'docs/guides/stale.md': PAGE('sidebar:\n  icon: rocket\n'), 'docs/guides/README.md': PAGE() }));
    const site = deciders();
    site.setup();
    rmSync('docs/guides/stale.md');
    site.done();
    expect(site.state.iconsAuthored).toBe(false);
    expect(site.manifestSource()).not.toContain(BODY_IMPORT);
    expect(site.annotate()).toBe('false');
    expect(site.iconsSource()).not.toContain('<svg');
  });

  it('a consumer-written sidebar turns neither on, warns once, and still checks names', () => {
    process.chdir(tree({ 'docs/guides/page.md': PAGE('sidebar:\n  icon: rocket\n') }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const site = deciders(false);
    site.setup();
    site.done();
    expect(site.state.iconsAuthored).toBe(false);
    expect(site.manifestSource()).not.toContain(BODY_IMPORT);
    expect(warn.mock.calls.filter(([line]) => String(line).includes('[dk-sidebar-icons]'))).toHaveLength(1);
    expect(warn.mock.calls.flat().join()).toContain('writes its own sidebar');
    warn.mockRestore();

    process.chdir(tree({ 'docs/guides/page.md': PAGE('sidebar:\n  icon: nope\n') }));
    const typo = deciders(false);
    typo.setup();
    expect(() => typo.done()).toThrow('unknown icon "nope"');
  });

  it('an icon-free site warns about nothing', () => {
    process.chdir(tree({ 'docs/guides/page.md': PAGE() }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const site = deciders(false);
    site.setup();
    site.done();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('decorateSidebarIcons', () => {
  const link = (href: string, attrs: Record<string, string> = {}): SidebarEntry => ({ type: 'link', label: href, href, isCurrent: false, badge: undefined, attrs });
  const group = (dkDir: string | undefined, entries: SidebarEntry[]): SidebarEntry =>
    ({ type: 'group', label: 'G', collapsed: false, badge: undefined, entries, ...(dkDir ? { dkDir } : {}) }) as SidebarEntry;
  const a = { svg: '<svg a/>', fa: true };
  const b = { svg: '<svg b/>', fa: false };
  const maps = { links: new Map([['guides', a], ['guides/page', b], ['guides/solo', b]]), groups: new Map([['guides', a]]) };

  it('sets a group\'s by directory, and a link\'s by slug under the base, leaving its own index link and the input alone', () => {
    const input = [group('guides', [link('/doc-kitty/guides/', { 'data-dk-group-index': '' }), link('/doc-kitty/guides/page/'), link('/doc-kitty/guides/solo/'), link('https://example.com/guides/page/')])];
    const before = JSON.stringify(input);
    const [out] = decorateSidebarIcons(input, maps, '/doc-kitty') as Array<SidebarEntry & { dkIcon?: string; dkIconFa?: boolean; entries: Array<SidebarEntry & { dkIcon?: string }> }>;
    expect(out!.dkIcon).toBe(a.svg);
    expect(out!.dkIconFa).toBe(true);
    expect(out!.entries.map((entry) => entry.dkIcon)).toEqual([undefined, b.svg, b.svg, undefined]);
    expect(JSON.stringify(input)).toBe(before);
    expect(hasFontAwesomeIcon([out!]), 'found through the tree').toBe(true);
    expect(hasFontAwesomeIcon(out!.entries), 'a built-in owes nothing').toBe(false);
  });

  it('with no icons returns the same tree', () => {
    const input = [link('/a/')];
    expect(decorateSidebarIcons(input, { links: new Map(), groups: new Map() })).toBe(input);
  });
});

describe('the authoring surface', () => {
  it('sidebar.icon parses beside all five of Starlight\'s sidebar keys', () => {
    const schema = docKittyDocsSchema()({ image: () => ({}) } as never);
    const parsed = schema.parse({
      title: 'T',
      description: 'D',
      doc_status: 'active',
      updated: '2026-01-01T00:00:00Z',
      kind: 'How-To',
      sidebar: { icon: 'fa-rocket', label: 'L', order: 3, hidden: true, badge: 'B', attrs: { class: 'c' } },
    });
    expect(parsed.sidebar).toEqual({ icon: 'fa-rocket', label: 'L', order: 3, hidden: true, badge: { text: 'B', variant: 'default' }, attrs: { class: 'c' } });
  });

  it('a page with no sidebar still gets Starlight\'s defaults', () => {
    const parsed = docKittyDocsSchema()({ image: () => ({}) } as never).parse({ title: 'T', description: 'D', doc_status: 'active', updated: '2026-01-01T00:00:00Z', kind: 'How-To' });
    expect(parsed.sidebar.hidden).toBe(false);
  });

  it('a non-string icon fails both schemas', () => {
    expect(docKittyFields.sidebar.safeParse({ icon: 5 }).success).toBe(false);
    expect(validate('guides/a.md', { title: 'T', doc_status: 'active', updated: '2026-01-01T00:00:00Z', kind: 'Guide', description: 'd', sidebar: { icon: 5 } }).problems.join()).toContain('sidebar');
  });
});

describe('validate-frontmatter (FR-027, build-free)', () => {
  const run = (root: string) => spawnSync(process.execPath, [VALIDATOR, 'docs'], { cwd: root, encoding: 'utf8' });
  const REGISTRY = (icon: string) => `version: 1\nsections:\n  - { id: guides, label: Guides, order: 1, type: Guide, icon: ${icon} }\n`;

  it.each(['fa-no-such-icon', 'no-such-icon'])('a page with %s fails, naming the file; the fixed name passes', (name) => {
    const bad = run(tree({ 'docs/guides/page.md': PAGE(`sidebar:\n  icon: ${name}\n`) }));
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain(`[dk-sidebar-icons] guides/page.md: unknown icon "${name}"`);
    const good = run(tree({ 'docs/guides/page.md': PAGE('sidebar:\n  icon: fa-rocket\n') }));
    expect(good.stderr).not.toContain('unknown icon');
    expect(good.status).toBe(0);
  });

  it.each([
    ['sections.yaml', { 'docs/_meta/sections.yaml': REGISTRY('nope') }, { 'docs/_meta/sections.yaml': REGISTRY('rocket') }],
    [
      'a charter',
      { 'docs/_meta/charter.yaml': 'version: 1\nsections:\n  entries:\n    - { id: guides, label: Guides, order: 1, icon: nope }\n' },
      { 'docs/_meta/charter.yaml': 'version: 1\nsections:\n  entries:\n    - { id: guides, label: Guides, order: 1, icon: rocket }\n' },
    ],
  ])('a section in %s fails with an unknown icon; the fixed name passes', (_name, broken, fixed) => {
    const page = { 'docs/guides/page.md': PAGE() };
    const bad = run(tree({ ...page, ...broken }));
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('[dk-sidebar-icons] section "guides": unknown icon "nope"');
    expect(run(tree({ ...page, ...fixed })).status).toBe(0);
  });
});
