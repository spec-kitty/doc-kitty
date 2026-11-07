/**
 * The chrome fixture's pre-mission baseline (page-chrome WP11; NFR-001, C-003), and
 * proof that the harness every later page-chrome suite uses does what it says.
 *
 * The goldens in `fixtures/chrome/golden/` record the frozen site's output from
 * before the mission changed anything. Later work packages change `BASELINE_OPTIONS`
 * to the opt-outs that restore today's output, or these expectations where a
 * mission default changes them. They do not recapture the goldens: that needs an
 * edit to `CAPTURED_ON` below, in plain sight.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildChromeFixture,
  DEEP_PAGE,
  elementEnd,
  emittedCss,
  FOOTER_CSS_RULES,
  GOLDEN_DIR,
  METADATA_PANELS,
  NON_HUB_PAGE,
  noIndexVariant,
  normaliseFooterAndHeadLinks,
  normaliseFooterCss,
  normaliseMetadataBlocks,
  readBaseline,
  resolvedVersion,
  sidebarFragment,
} from './fixtures/chrome/harness.mjs';

/** The commit the goldens were captured on: this WP's base, before any behaviour change. */
const CAPTURED_ON = 'ff738ffe0373526e503720cd150b63db5527198e';
/** Options that make today's build match the goldens: the opt-outs of every changed default (FR-006). */
const BASELINE_OPTIONS = { sidebar: { collapsed: false } };
const BUILD_TIMEOUT = 240_000;
const BRAND_ACCENT = /#f5c518/i;

const golden = (name: string) => readFileSync(path.join(GOLDEN_DIR, name), 'utf8');
const stamp = JSON.parse(golden('stamp.json'));

/** A successful build, failing with its output. */
function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build;
}
const read = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');

describe('the goldens were not regenerated', () => {
  it('the stamp names the commit they were captured on, and the Starlight they were captured with', () => {
    expect(stamp.toolkitCommit).toBe(CAPTURED_ON);
    expect(stamp.starlight, 'Starlight moved: its markup may differ from the goldens').toBe(resolvedVersion('@astrojs/starlight'));
    expect(stamp.astro, 'Astro moved: its output may differ from the goldens').toBe(resolvedVersion('astro'));
  });

  it('each golden is what the stamp recorded', () => {
    for (const name of ['sidebar.html', 'page.html', 'css.txt']) {
      expect(createHash('sha256').update(golden(name)).digest('hex'), name).toBe(stamp.sha256[name]);
    }
  });
});

describe('the frozen fixture matches its pre-mission goldens', () => {
  it(
    "a deep page's whole sidebar fragment, data-hash included",
    () => {
      const { dist } = built({ options: BASELINE_OPTIONS });
      const current = readBaseline(dist)['sidebar.html'];
      expect(current, 'a real sidebar was captured').toMatch(/^<sl-sidebar-state-persist data-hash="[^"]+"/);
      expect(current).toContain('aria-current="page"');
      expect(current).toBe(golden('sidebar.html'));
    },
    BUILD_TIMEOUT,
  );

  it(
    "a non-hub page's HTML, with its panels",
    () => {
      const { dist } = built({ options: BASELINE_OPTIONS });
      const current = readBaseline(dist)['page.html'];
      for (const panel of ['audience', 'related', 'external-references', 'glossary']) {
        expect(current, `the page renders its ${panel} panel`).toContain(`dk-panel--${panel}`);
      }
      // WP04's block regions and WP09's footer groups and head links legitimately change the page.
      expect(normaliseFooterAndHeadLinks(normaliseMetadataBlocks(current), 'actual')).toBe(
        normaliseFooterAndHeadLinks(normaliseMetadataBlocks(golden('page.html')), 'golden'),
      );
    },
    BUILD_TIMEOUT,
  );

  it(
    'the list and content of the emitted CSS',
    () => {
      const { dist } = built({ options: BASELINE_OPTIONS });
      const current = emittedCss(dist);
      expect(current, 'the theme is in the CSS').toMatch(BRAND_ACCENT);
      // WP09's scoped sheets and the theme's link pills land in the shared stylesheet.
      expect(normaliseFooterCss(current)).toBe(golden('css.txt'));
    },
    BUILD_TIMEOUT,
  );
});

describe('normaliseFooterAndHeadLinks keeps the page comparison honest', () => {
  const built = () => readBaseline(buildChromeFixture({ options: BASELINE_OPTIONS }).dist)['page.html'];
  const normal = (page: string) => normaliseFooterAndHeadLinks(normaliseMetadataBlocks(page), 'actual');
  const goldenNormal = () => normaliseFooterAndHeadLinks(normaliseMetadataBlocks(golden('page.html')), 'golden');

  it(
    'a build compares equal, with its markers, and the golden had none of them',
    () => {
      const expected = goldenNormal();
      expect(normal(built())).toBe(expected);
      for (const marker of ['<!--footer:machine-links--><!--footer:page-formats-->', '<!--head:alternates-->']) {
        expect(expected).toContain(marker);
        expect(golden('page.html')).not.toContain(marker);
      }
      expect(expected, 'the removed discovery links are gone').not.toContain('rel="alternate"');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a class outside these regions still fails',
    () => {
      const page = built();
      const changed = page.replace('class="dk-on-this-page"', 'class="dk-on-this-page dk-changed"');
      expect(changed).not.toBe(page);
      expect(normal(built()), 'control: the unchanged page compares equal').toBe(goldenNormal());
      expect(normal(changed)).not.toBe(goldenNormal());
    },
    BUILD_TIMEOUT,
  );

  it(
    'moving a group, or the head links, still fails',
    () => {
      const expected = goldenNormal();
      const page = built();
      expect(normal(page), 'control: the unchanged page compares equal').toBe(expected);
      const machine = /<nav class="dk-machine-links[\s\S]*?<\/nav>/.exec(page)?.[0] as string;
      const formats = /<nav class="dk-page-formats[\s\S]*?<\/nav>/.exec(page)?.[0] as string;

      const swapped = page.replace(machine, '@@').replace(formats, machine).replace('@@', formats);
      expect(normal(swapped), 'the groups swapped').not.toBe(expected);

      const below = page.replace(machine, '').replace('</main>', `${machine}</main>`);
      expect(normal(below), 'a group moved past the site footer').not.toBe(expected);

      const link = /<link rel="alternate"[^>]*>/.exec(page)?.[0] as string;
      const movedLink = page.replace(link, '').replace('<meta name="generator"', `${link}<meta name="generator"`);
      expect(normal(movedLink), 'one head link moved').not.toBe(expected);
    },
    BUILD_TIMEOUT,
  );

  it(
    'a page without a group throws',
    () => {
      const page = built();
      expect(() => normal(page.replace(/<nav class="dk-machine-links[\s\S]*?<\/nav>/, ''))).toThrow('no machine links group');
      expect(() => normal(page.replace(/<nav class="dk-page-formats[\s\S]*?<\/nav>/, ''))).toThrow('no page formats group');
    },
    BUILD_TIMEOUT,
  );

  it(
    "normaliseFooterCss removes WP09's rules and no others",
    () => {
      const css = emittedCss(buildChromeFixture().dist);
      const green = golden('css.txt');
      expect(normaliseFooterCss(css)).toBe(green);
      expect(FOOTER_CSS_RULES, 'the ten rules are the whole list').toHaveLength(10);
      for (const rule of FOOTER_CSS_RULES) expect(css, `the build has ${rule}`).toContain(rule);

      // Added rules stay in the result, so the comparison is red.
      const added = [
        '.other{color:red}',
        'a.dk-pill,body{display:none}',
        '.dk-page-formats,.dk-kind-tag{color:red}',
        '.dk-machine-links-other{color:red}',
        'a.dk-pill--brand{color:red}',
        '.foo a.dk-pill{text-decoration:none}',
        '.x .dk-machine-links a{color:var(--sl-color-text-accent)}',
        ':where(.dk-page-formats) a:focus-visible{outline-offset:2px;outline:2px solid}',
      ];
      for (const rule of added) {
        let result: string | undefined;
        try {
          result = normaliseFooterCss(css.replace(FOOTER_CSS_RULES[0] as string, `${rule}${FOOTER_CSS_RULES[0]}`));
        } catch {
          continue; // throwing is red too
        }
        expect(result, `adding ${rule}`).not.toBe(green);
      }

      for (const rule of FOOTER_CSS_RULES) {
        expect(() => normaliseFooterCss(css.replace(rule, '')), `removing ${rule}`).toThrow('exactly once');
        const edited = rule.replace(/(\d+px|none|underline|flex|2px|var\(--sl-color-text-accent\))/, 'EDITED');
        expect(edited, 'the edit changes the rule').not.toBe(rule);
        expect(() => normaliseFooterCss(css.replace(rule, edited)), `editing ${rule}`).toThrow('exactly once');
        expect(() => normaliseFooterCss(css + rule), `repeating ${rule}`).toThrow('exactly once');
      }
      expect(() => normaliseFooterCss(green)).toThrow('exactly once');
    },
    BUILD_TIMEOUT,
  );
});

describe('normaliseMetadataBlocks keeps the page comparison honest (FR-013)', () => {
  const page = golden('page.html');
  const normalised = normaliseMetadataBlocks(page);

  it('removes the block regions and leaves the content around them', () => {
    expect(page).toContain('Who is this for');
    expect(normalised).not.toContain('Who is this for');
    expect(normalised).not.toContain('dk-panel');
    expect(normalised, 'control: the content stays').toContain('The table of contents needs at least one heading.');
    expect(normalised, 'control: the wrapper around the blocks stays').toContain('<div class="dk-on-this-page">');
  });

  it('ignores a change inside a block, and the sheet and script the blocks add', () => {
    const changed = page
      .replace('Who is this for', 'Who reads this')
      .replace('</head>', '<style>.dk-disclosure{margin:0}</style></head>')
      .replace('<div class="sl-markdown-content">', '<script type="module" src="/_astro/MetadataBlock.astro_astro_type_script_index_0_lang.HASH.js"></script><div class="sl-markdown-content">');
    expect(changed).not.toBe(page);
    expect(normaliseMetadataBlocks(changed)).toBe(normalised);
  });

  it('leaves a marker per block, and sees two blocks swapped', () => {
    for (const panel of METADATA_PANELS) expect(normalised).toContain(`<!--block:${panel}-->`);
    const region = (panel: string) => {
      const start = page.search(new RegExp(`<(section|div)\\b[^>]*\\bclass="dk-panel dk-panel--${panel}[ "]`));
      const tag = /^<(section|div)/.exec(page.slice(start))![1];
      return page.slice(start, elementEnd(page, start, tag));
    };
    const [a, b] = [region('related'), region('external-references')];
    expect(page.indexOf(a), 'control: related comes first').toBeLessThan(page.indexOf(b));
    const swapped = page.replace(a, '\u0000A').replace(b, '\u0000B').replace('\u0000A', b).replace('\u0000B', a);
    expect(swapped).not.toBe(page);
    expect(normaliseMetadataBlocks(swapped)).not.toBe(normalised);
  });

  it('still sees a class change outside a block', () => {
    const changed = page.replace('<div class="dk-on-this-page">', '<div class="dk-on-this-page dk-moved">');
    expect(changed).not.toBe(page);
    expect(normaliseMetadataBlocks(changed)).not.toBe(normalised);
  });

  it('still sees another inline style or module script', () => {
    const style = page.replace('</head>', '<style>.dk-other{margin:0}</style></head>');
    const script = page.replace('</head>', '<script type="module" src="/_astro/Other.astro.HASH.js"></script></head>');
    expect(normaliseMetadataBlocks(style)).not.toBe(normalised);
    expect(normaliseMetadataBlocks(script)).not.toBe(normalised);
  });

  it.each(METADATA_PANELS)('refuses a page with no %s panel, rather than comparing it clean', (panel) => {
    const missing = page.replace(`dk-panel--${panel}`, 'dk-panel--removed');
    expect(() => normaliseMetadataBlocks(missing)).toThrow(`no ${panel} panel`);
  });
});

describe('the sidebar default changes the fixture, and the opt-out undoes exactly that', () => {
  it(
    "the default build's sidebar differs from the golden by closed groups, and the CSS does not",
    () => {
      const { dist } = built();
      const current = readBaseline(dist);
      const openGroups = (html: string) => (html.match(/<details[^>]*\bopen\b/g) ?? []).length;
      expect(current['sidebar.html']).not.toBe(golden('sidebar.html'));
      // The golden (today's tree) opens every group; the default opens only the path to the page.
      expect(openGroups(golden('sidebar.html')), 'control: the golden has more open groups').toBeGreaterThan(
        openGroups(current['sidebar.html']),
      );
      expect(openGroups(current['sidebar.html']), 'the current branch stays open').toBeGreaterThan(0);
      expect(normaliseFooterCss(current['css.txt'])).toBe(golden('css.txt'));
    },
    BUILD_TIMEOUT,
  );
});

describe('the fixture site', () => {
  it(
    'holds every page the mission tests need',
    () => {
      const { dist } = built();
      for (const page of [
        DEEP_PAGE,
        NON_HUB_PAGE,
        'index.html',
        'guides/authoring/index.html',
        'guides/empty-hub/index.html',
        'guides/undated/index.html',
        'reference/notes/first/index.html',
        'reference/generated-page/index.html',
        'adr/template/index.html',
      ]) {
        expect(existsSync(path.join(dist, page)), page).toBe(true);
      }
      for (const surface of ['rss.xml', 'llms.txt', 'api/index.json', 'sitemap-index.xml']) {
        expect(existsSync(path.join(dist, surface)), surface).toBe(true);
      }

      const sidebar = sidebarFragment(read(dist, DEEP_PAGE));
      expect(sidebar, 'the relabelled index').toContain('Authoring home');
      expect(sidebar, 'the group with no index').toContain('>Notes<');
      expect(read(dist, 'guides/index.html'), 'the hub with children').toContain('dk-hub__card');
      expect(read(dist, 'guides/empty-hub/index.html'), 'the hub with none').not.toContain('dk-hub__card');
      const rss = read(dist, 'rss.xml');
      expect(rss, 'a dated page is in the feed').toContain('Deep page');
      expect(rss, 'the undated page is not').not.toContain('Undated');
      expect(rss, 'the stamped page is dated by its stamp').toContain('Generated page');
    },
    BUILD_TIMEOUT,
  );

  it(
    'its draft follows DK_PUBLISH_DRAFTS',
    () => {
      const { dist } = built({ env: { DK_PUBLISH_DRAFTS: 'off' } });
      expect(existsSync(path.join(dist, 'adr/template/index.html'))).toBe(false);
      expect(existsSync(path.join(dist, DEEP_PAGE)), 'control: a published page is built').toBe(true);
    },
    BUILD_TIMEOUT,
  );

  it(
    'a variant can delete a file, as the served-surfaces suite deletes rss.xml.ts',
    () => {
      const { dist } = built({ files: { 'src/pages/rss.xml.ts': null } });
      expect(existsSync(path.join(dist, 'rss.xml'))).toBe(false);
      expect(existsSync(path.join(dist, 'llms.txt')), 'control: the other surfaces stay').toBe(true);
    },
    BUILD_TIMEOUT,
  );

  it(
    'the no-index variant has no group index page, and still builds',
    () => {
      const { dist } = built({ files: noIndexVariant() });
      expect(existsSync(path.join(dist, 'guides/index.html'))).toBe(false);
      expect(existsSync(path.join(dist, 'guides/authoring/index.html'))).toBe(false);
      expect(existsSync(path.join(dist, DEEP_PAGE)), 'control: its leaves are built').toBe(true);
    },
    BUILD_TIMEOUT,
  );
});

describe('DK_TEST_OPTIONS', () => {
  it(
    '`"theme": null` builds with no theme',
    () => {
      const { dist } = built({ options: { theme: null } });
      const css = emittedCss(dist);
      expect(css).not.toMatch(BRAND_ACCENT);
      expect(css, 'control: the default layer is still there').toContain('--dk-color-accent');
    },
    BUILD_TIMEOUT,
  );

  it(
    'an option reaches the toolkit',
    () => {
      const stock = built();
      const relabelled = built({ options: { sidebar: { indexLabel: 'Start here' } } });
      expect(sidebarFragment(read(relabelled.dist, DEEP_PAGE))).toContain('Start here');
      expect(sidebarFragment(read(stock.dist, DEEP_PAGE)), 'control').not.toContain('Start here');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a sidebar option from later in the mission builds; any other unknown one fails the build',
    () => {
      built({ options: { sidebar: { titleIsIndex: true } } });
      const refused = buildChromeFixture({ options: { sidebar: { noSuchOption: true } } });
      expect(refused.status).not.toBe(0);
      expect(refused.output).toContain('unknown key "noSuchOption" under sidebar');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a request is built once and then reused, until a request differs',
    () => {
      const first = built();
      const again = built();
      expect(again.cached).toBe(true);
      expect(again.dist).toBe(first.dist);
      const other = built({ options: { theme: null } });
      expect(other.dist, 'another option set has its own build').not.toBe(first.dist);
    },
    BUILD_TIMEOUT,
  );
});
