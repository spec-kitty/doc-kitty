/**
 * Sidebar icons in built HTML (page-chrome WP07; FR-026, FR-027, FR-028, NFR-007, C-003,
 * C-008, ADR-0075). All on variants of the frozen fixture: an icon in `example/` would
 * move every example build onto the custom renderer.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildChromeFixture, DEEP_PAGE, emittedCss, GOLDEN_DIR, NON_HUB_PAGE, normaliseFooterAndHeadLinks, normaliseFooterCss, normaliseMetadataBlocks, readBaseline, REPO_ROOT, sidebarFragment } from './fixtures/chrome/harness.mjs';
import { resolveIcon } from '../lib/sidebar-icons.js';
import { FONT_AWESOME_LICENCE_COMMENT } from '../components/sidebar/sidebar-data.js';

const BUILD_TIMEOUT = 240_000;
const SITE_DOCS = path.join(REPO_ROOT, 'src/tests/fixtures/chrome/site/docs');
const PRELOAD = fileURLToPath(new URL('./fixtures/chrome/record-icon-reads.cjs', import.meta.url));
const FA_READ_MARKER = '.dk-fa-json-read';
const RECORD_READS = { NODE_OPTIONS: `--require ${PRELOAD}` };

/** A site file with extra frontmatter. */
const withFrontmatter = (rel: string, lines: string) => ({
  [`docs/${rel}`]: readFileSync(path.join(SITE_DOCS, rel), 'utf8').replace(/^---\n/, `---\n${lines}\n`),
});
const pageIcon = (rel: string, name: string) => withFrontmatter(rel, `sidebar:\n  icon: ${name}`);
function sections(icons: Record<string, string>) {
  let text = readFileSync(path.join(SITE_DOCS, '_meta/sections.yaml'), 'utf8');
  for (const [id, name] of Object.entries(icons)) text = text.replace(`- id: ${id}\n`, `- id: ${id}\n    icon: ${name}\n`);
  return { 'docs/_meta/sections.yaml': text };
}
const sectionIcon = (id: string, name: string) => sections({ [id]: name });

/**
 * Every place an icon can be: a page, a section with no index icon (`reference`), a
 * section beating its index page (`guides`), and a nested group from its index
 * (`guides/authoring`, whose README keeps its label).
 */
const ICONS = {
  ...pageIcon('guides/getting-started.md', 'fa-rocket'),
  ...pageIcon('guides/README.md', 'pencil'),
  'docs/guides/authoring/README.md': readFileSync(path.join(SITE_DOCS, 'guides/authoring/README.md'), 'utf8').replace('sidebar:\n', 'sidebar:\n  icon: star\n'),
};
const ICON_REQUEST = { files: { ...ICONS, ...sections({ guides: 'fa-book', reference: 'setting' }) } };

const BUILTIN_ONLY = { files: { ...pageIcon('guides/getting-started.md', 'rocket'), ...sectionIcon('reference', 'setting') } };

function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build.dist;
}
const page = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');
const sidebar = (dist: string, rel: string) => sidebarFragment(page(dist, rel));
const count = (text: string, needle: string) => text.split(needle).length - 1;
const svgOf = (name: string) => resolveIcon(name)!.svg;
/** An icon's span right before the label's span. Attributes other than class are not expected on the svg's wrapper. */
const iconThen = (name: string, label: string): string => `<span class="dk-sidebar-icon[^"]*"[^>]*aria-hidden="true"[^>]*>${escape(svgOf(name))}</span><span[^>]*>${label}</span>`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? htmlFiles(path.join(dir, entry.name)) : entry.name.endsWith('.html') ? [path.join(dir, entry.name)] : [],
  );
const allFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? allFiles(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));

describe('an icon renders in the static sidebar, before its label (FR-026)', () => {
  it(
    'on a page, a section and a nested group, with the label still the name, hidden from assistive technology',
    () => {
      const html = sidebar(built(ICON_REQUEST), NON_HUB_PAGE);
      expect(html).toMatch(new RegExp(iconThen('fa-rocket', 'Getting started')));
      expect(html).toMatch(new RegExp(iconThen('setting', 'Reference notes')));
      expect(html).toMatch(new RegExp(iconThen('star', 'Authoring home')));
      expect(svgOf('fa-rocket')).toContain('aria-hidden="true"');
      expect(svgOf('fa-rocket')).toContain('focusable="false"');
      expect(html).not.toContain('<i class');
    },
    BUILD_TIMEOUT,
  );

  it(
    'sections.yaml wins over the index page, whose icon is nowhere; the index link repeats nothing',
    () => {
      const html = sidebar(built(ICON_REQUEST), NON_HUB_PAGE);
      expect(html).toMatch(new RegExp(iconThen('fa-book', 'Guides')));
      expect(html, 'the index page\'s own icon lost').not.toContain(svgOf('pencil'));
      expect(count(html, svgOf('fa-book'))).toBe(1);
    },
    BUILD_TIMEOUT,
  );

  it(
    'an index page gives its group the icon with no registry entry, and only the group',
    () => {
      const dist = built({ files: pageIcon('guides/README.md', 'pencil') });
      const html = sidebar(dist, NON_HUB_PAGE);
      expect(html).toMatch(new RegExp(iconThen('pencil', 'Guides')));
      expect(count(html, svgOf('pencil'))).toBe(1);
    },
    BUILD_TIMEOUT,
  );

  it(
    'the icon is the same on every page, and the styles sit in the emitted CSS',
    () => {
      const dist = built(ICON_REQUEST);
      expect(sidebar(dist, DEEP_PAGE)).toMatch(new RegExp(iconThen('fa-rocket', 'Getting started')));
      expect(emittedCss(dist)).toContain('.dk-sidebar-icon');
    },
    BUILD_TIMEOUT,
  );
});

describe('an icon-only site keeps the plain toggle (ruling 3)', () => {
  it(
    'icons, "Overview" and the plain summary, with no label link and no title-as-index script',
    () => {
      const html = page(built(ICON_REQUEST), NON_HUB_PAGE);
      const side = sidebarFragment(html);
      expect(side, 'control: the icons are there').toContain(svgOf('fa-book'));
      expect(side).toContain('>Overview<');
      expect(side).not.toContain('dk-group__label');
      expect(side).not.toContain('dk-disclosure');
      expect(side).toMatch(/<summary[^>]*> <span class="group-label[^"]*"[^>]*> <span class="dk-sidebar-icon/);
      expect(html).not.toContain('TitleAsIndexEnhancement');
      expect(html).not.toContain('data-dk-group-index');
    },
    BUILD_TIMEOUT,
  );
});

describe('with title-as-index on too (ruling 4)', () => {
  const REQUEST = { ...ICON_REQUEST, options: { sidebar: { titleIsIndex: true } } };

  it(
    'the label link shows the group\'s icon, and the chevron-only summary has none',
    () => {
      const html = sidebar(built(REQUEST), NON_HUB_PAGE);
      const guides = /<a href="\/doc-kitty\/guides\/"[^>]*\bdk-group__label\b[^>]*>([\s\S]*?)<\/a>\s*<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>/.exec(html);
      expect(guides, 'the label and its chevron').not.toBeNull();
      expect(guides![1]).toMatch(new RegExp(iconThen('fa-book', 'Guides')));
      expect(guides![2]).toContain('caret');
      expect(guides![2], 'the chevron').not.toContain('dk-sidebar-icon');
      expect(html, 'a section icon on another label').toMatch(new RegExp(`<a href="/doc-kitty/reference/"[^>]*dk-group__label[^>]*> ?${iconThen('setting', 'Reference notes')}`));
      expect(html).not.toContain('>Overview<');
    },
    BUILD_TIMEOUT,
  );
});

describe('no icons, no change (FR-028)', () => {
  const GOLDEN = { options: { sidebar: { collapsed: false } } };
  const golden = (name: string) => readFileSync(path.join(GOLDEN_DIR, name), 'utf8');

  it(
    'the fixture with no icons equals its pre-mission golden, and one icon changes the sidebar and CSS',
    () => {
      const stock = readBaseline(built(GOLDEN));
      expect(stock['sidebar.html']).toBe(golden('sidebar.html'));
      expect(normaliseFooterCss(stock['css.txt'])).toBe(golden('css.txt'));
      expect(normaliseFooterAndHeadLinks(normaliseMetadataBlocks(stock['page.html']), 'actual')).toBe(
        normaliseFooterAndHeadLinks(normaliseMetadataBlocks(golden('page.html')), 'golden'),
      );

      const iconned = readBaseline(built({ ...GOLDEN, files: pageIcon('guides/getting-started.md', 'rocket') }));
      expect(iconned['sidebar.html'], 'control: the same fixture with one icon').not.toBe(golden('sidebar.html'));
      expect(iconned['sidebar.html']).toContain(svgOf('rocket'));
      expect(iconned['css.txt']).not.toBe(golden('css.txt'));
      expect(iconned['css.txt']).toContain('.dk-sidebar-icon');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a site with no fa- name does not read Font Awesome\'s file; a site with one does',
    () => {
      const none = buildChromeFixture({ ...BUILTIN_ONLY, env: RECORD_READS });
      expect(none.status, none.output).toBe(0);
      expect(existsSync(path.join(none.root, FA_READ_MARKER))).toBe(false);
      const fa = buildChromeFixture({ ...ICON_REQUEST, env: RECORD_READS });
      expect(fa.status, fa.output).toBe(0);
      expect(existsSync(path.join(fa.root, FA_READ_MARKER)), 'control: the recorder sees the read').toBe(true);
    },
    BUILD_TIMEOUT * 2,
  );
});

describe('an unknown name fails the build (FR-027)', () => {
  it.each([
    ['a page\'s fa- name', pageIcon('guides/getting-started.md', 'fa-no-such-icon'), 'guides/getting-started.md: unknown icon "fa-no-such-icon"'],
    ['a page\'s bare name', pageIcon('guides/getting-started.md', 'no-such-icon'), 'guides/getting-started.md: unknown icon "no-such-icon"'],
    ['a section\'s name', sectionIcon('guides', 'no-such-icon'), 'section "guides": unknown icon "no-such-icon"'],
  ])(
    '%s, with the naming message',
    (_name, files, message) => {
      const build = buildChromeFixture({ files });
      expect(build.status).not.toBe(0);
      expect(build.output).toContain(`[dk-sidebar-icons] ${message}`);
    },
    BUILD_TIMEOUT,
  );

  it(
    'control: the fixed names build',
    () => {
      built(BUILTIN_ONLY);
    },
    BUILD_TIMEOUT,
  );
});

describe('delivery (NFR-007, C-003)', () => {
  const NEVER_AUTHORED = ['fa-dragon', 'fa-book-skull', 'add-document'].filter((name) => resolveIcon(name));

  it(
    'no font file, no external icon URL, and no path data for an icon nobody authored',
    () => {
      const dist = built(ICON_REQUEST);
      const stock = built();
      const files = allFiles(dist);
      const fonts = (list: string[]) => list.filter((file) => /\.(woff2?|ttf|otf|eot)$/.test(file)).length;
      expect(fonts(files)).toBe(fonts(allFiles(stock)));
      expect(emittedCss(dist)).not.toMatch(/fontawesome|fa-solid|font-awesome/i);

      expect(NEVER_AUTHORED.length, 'control: real icons').toBeGreaterThan(1);
      const authored = svgOf('fa-book').match(/ d="([^"]{40})/)![1]!;
      const unused = NEVER_AUTHORED.map((name) => svgOf(name).match(/ d="([^"]{40})/)![1]!);
      const text = files.filter((file) => /\.(html|css|js)$/.test(file)).map((file) => readFileSync(file, 'utf8')).join('\n');
      expect(text, 'control: an authored icon\'s path data is found this way').toContain(authored);
      for (const data of unused) expect(text).not.toContain(data);

      const withoutComment = text.replaceAll(FONT_AWESOME_LICENCE_COMMENT, '');
      expect(withoutComment).not.toMatch(/https?:\/\/[^"'\s]*(fontawesome|fonticons|iconify|nerdfonts)/i);
    },
    BUILD_TIMEOUT,
  );
});

describe('the licence comment (C-008)', () => {
  it(
    'survives Astro\'s compression, once on every page with a sidebar, in a real build',
    () => {
      const dist = built(ICON_REQUEST);
      const withSidebar = htmlFiles(dist).filter((file) => readFileSync(file, 'utf8').includes('<sl-sidebar-state-persist'));
      expect(withSidebar.length, 'control: pages with a sidebar').toBeGreaterThan(5);
      for (const file of withSidebar) {
        expect(count(readFileSync(file, 'utf8'), FONT_AWESOME_LICENCE_COMMENT), path.relative(dist, file)).toBe(1);
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'is on no page of a site with built-in icons only, nor of one with none',
    () => {
      const builtinOnly = built(BUILTIN_ONLY);
      expect(sidebar(builtinOnly, NON_HUB_PAGE), 'control: the icons are there').toContain(svgOf('rocket'));
      for (const dist of [builtinOnly, built()]) {
        for (const file of htmlFiles(dist)) expect(readFileSync(file, 'utf8')).not.toContain('Font Awesome');
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'a withheld draft\'s Font Awesome icon reaches no page, and owes no comment',
    () => {
      const draft = { env: { DK_PUBLISH_DRAFTS: 'off' }, files: pageIcon('adr/template.md', 'fa-rocket') };
      const dist = built(draft);
      expect(existsSync(path.join(dist, 'adr/template/index.html')), 'the draft is withheld').toBe(false);
      for (const file of htmlFiles(dist)) {
        const html = readFileSync(file, 'utf8');
        expect(html).not.toContain(svgOf('fa-rocket'));
        expect(html).not.toContain('Font Awesome');
        expect(html).not.toContain('dk-sidebar-icon');
      }
      const published = built({ files: pageIcon('adr/template.md', 'fa-rocket') });
      expect(sidebar(published, NON_HUB_PAGE), 'control: published, it shows').toContain(svgOf('fa-rocket'));
    },
    BUILD_TIMEOUT,
  );
});

describe('a consumer-written sidebar', () => {
  it(
    'takes no icons, stays on Starlight\'s renderer, and the build warns once',
    () => {
      const build = buildChromeFixture({
        files: pageIcon('guides/getting-started.md', 'fa-rocket'),
        options: { starlight: { sidebar: [{ label: 'Guides', items: [{ label: 'Getting started', link: '/guides/getting-started/' }] }] } },
      });
      expect(build.status, build.output).toBe(0);
      const html = page(build.dist, NON_HUB_PAGE);
      expect(sidebarFragment(html), 'control: the sidebar is there').toContain('Getting started');
      expect(html).not.toContain('dk-sidebar-icon');
      expect(html).not.toContain('Font Awesome');
      expect(emittedCss(build.dist)).not.toContain('.dk-sidebar-icon');
      if (!build.cached) expect(build.output.split('[dk-sidebar-icons]').length - 1).toBe(1);
    },
    BUILD_TIMEOUT,
  );
});

describe('Starlight\'s sidebar frontmatter still works beside an icon', () => {
  it(
    'label, order, hidden, badge and attrs',
    () => {
      const dist = built({
        files: {
          ...withFrontmatter('guides/getting-started.md', 'sidebar:\n  icon: rocket\n  label: Relabelled\n  order: 99\n  badge: Fresh\n  attrs:\n    data-from-author: yes'),
          ...withFrontmatter('guides/undated.md', 'sidebar:\n  icon: star\n  hidden: true'),
        },
      });
      const html = sidebar(dist, 'guides/authoring/index.html');
      expect(html).toMatch(new RegExp(iconThen('rocket', 'Relabelled')));
      expect(html).toContain('Fresh');
      expect(html).toContain('data-from-author="yes"');
      expect(html, 'hidden').not.toContain('Undated');
      expect(html.indexOf('Relabelled'), 'order: it follows the others in its group').toBeGreaterThan(html.indexOf('Overview'));
    },
    BUILD_TIMEOUT,
  );
});
