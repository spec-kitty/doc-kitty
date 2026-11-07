/**
 * Title-as-index in built HTML (page-chrome WP06; FR-007, FR-008, FR-011, ADR-0075).
 * Each claim runs through the real config path, route middleware and renderer of a
 * fixture build, with the default build as its control.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildChromeFixture, DEEP_PAGE, emittedCss, NON_HUB_PAGE, REPO_ROOT, sidebarFragment } from './fixtures/chrome/harness.mjs';
import { groupElementId } from '../components/sidebar/sidebar-data.js';

const BUILD_TIMEOUT = 240_000;
const TITLE_AS_INDEX = { sidebar: { titleIsIndex: true } };
const GUIDES = '/doc-kitty/guides/';

function built(request: Parameters<typeof buildChromeFixture>[0] = {}) {
  const build = buildChromeFixture(request);
  expect(build.status, build.output).toBe(0);
  return build.dist;
}
const page = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');
const sidebar = (dist: string, rel: string) => sidebarFragment(page(dist, rel));

/** A label link's opening tag, found by its href. */
const labelTag = (html: string, href: string) => new RegExp(`<a href="${href}"[^>]*\\bdk-group__label\\b[^>]*>`).exec(html)?.[0];
/** The `href`s of a sidebar's links, in order, from `marker` on. */
function linksAfter(html: string, marker: string) {
  const start = html.indexOf(marker);
  expect(start, `the sidebar has ${marker}`).toBeGreaterThan(-1);
  return [...html.slice(start).matchAll(/<a href="([^"]+)"/g)].map((match) => match[1]);
}
/** The page title a pagination link shows. */
function paginationTitle(html: string, rel: 'prev' | 'next') {
  return new RegExp(`rel="${rel}"[\\s\\S]*?link-title[^>]*>([^<]*)<`).exec(html)?.[1];
}

describe('a group label is the link to its index page (FR-007)', () => {
  it(
    'with aria-current on the index page, and not on any other',
    () => {
      const dist = built({ options: TITLE_AS_INDEX });
      const onIndex = labelTag(sidebar(dist, 'guides/index.html'), GUIDES);
      expect(onIndex).toContain('aria-current="page"');
      expect(onIndex).toContain('large');

      const elsewhere = sidebar(dist, NON_HUB_PAGE);
      expect(labelTag(elsewhere, GUIDES), 'the label is there on another page').toBeDefined();
      expect(labelTag(elsewhere, GUIDES)).not.toContain('aria-current');
      expect(elsewhere).toMatch(/<a href="\/doc-kitty\/guides\/getting-started\/" aria-current="page"/);
    },
    BUILD_TIMEOUT,
  );

  it(
    'the route middleware turns the shaping markers on, and the marker stays out of the output',
    () => {
      // The marker is stripped, so the labels are its evidence: without
      // `annotate: routeShaping.annotate` in route-middleware.ts there are none.
      const on = page(built({ options: TITLE_AS_INDEX }), DEEP_PAGE);
      expect(labelTag(on, GUIDES)).toBeDefined();
      expect(labelTag(on, '/doc-kitty/guides/authoring/advanced/')).toBeDefined();
      expect(on).not.toContain('data-dk-group-index');

      const off = page(built(), DEEP_PAGE);
      expect(off).not.toContain('dk-group__label');
      expect(off).not.toContain('data-dk-group-index');
    },
    BUILD_TIMEOUT,
  );

  it(
    'no "Overview" entry appears, where the default build has one',
    () => {
      expect(sidebar(built(), NON_HUB_PAGE), 'control: the default build has it').toContain('>Overview<');
      expect(sidebar(built({ options: TITLE_AS_INDEX }), NON_HUB_PAGE)).not.toContain('>Overview<');
    },
    BUILD_TIMEOUT,
  );

  it(
    'a chevron is a named summary in a details with a stable, unique id; the wrapper upgrades through the summary',
    () => {
      const dist = built({ options: TITLE_AS_INDEX });
      const html = sidebar(dist, NON_HUB_PAGE);
      expect(html).toMatch(
        /<li class="dk-group dk-disclosure[^"]*" data-dk-disclosure data-dk-toggle-via="summary" data-label-expanded="Collapse Guides" data-label-collapsed="Expand Guides">/,
      );
      expect(html).toMatch(/<details id="dk-group-guides"[^>]*\bopen\b[^>]*> <summary aria-label="Toggle Guides"/);

      const ids = (text: string) => [...text.matchAll(/<details id="([^"]+)"/g)].map((match) => match[1]);
      expect(ids(html).length, 'the fixture has several').toBeGreaterThan(2);
      expect(new Set(ids(html)).size).toBe(ids(html).length);
      expect(ids(sidebar(dist, DEEP_PAGE))).toEqual(ids(html));
    },
    BUILD_TIMEOUT,
  );

  it(
    'a group with no index page keeps Starlight\'s plain toggle',
    () => {
      const html = sidebar(built({ options: TITLE_AS_INDEX }), NON_HUB_PAGE);
      expect(html).toMatch(/<li[^>]*> <details class="[^"]*"> <summary class="[^"]*"> <span class="group-label[^"]*"> <span class="large[^"]*">Notes<\/span>/);
    },
    BUILD_TIMEOUT,
  );

  it(
    'a top-level group whose only entry is its index stays a group, with no details and no chevron',
    () => {
      const html = sidebar(built({ options: TITLE_AS_INDEX, files: { 'docs/adr/template.md': null } }), 'guides/getting-started/index.html');
      const item = /<li class="dk-group[^"]*"[^>]*> <a href="\/doc-kitty\/adr\/"[\s\S]*?<\/li>/.exec(html)?.[0];
      expect(item, 'the group is there').toContain('Decision Records');
      expect(item).not.toContain('<details');
      expect(item).not.toContain('data-dk-disclosure');
      expect(item).not.toContain('dk-disclosure');
    },
    BUILD_TIMEOUT,
  );

  it('directory ids cannot collide or hold whitespace', () => {
    expect(groupElementId('guides/authoring')).not.toBe(groupElementId('guides-authoring'));
    expect(groupElementId('a b')).not.toMatch(/\s/);
    expect(groupElementId('a/2f')).not.toBe(groupElementId('a2f'));
  });
});

describe('the index stays the first link, and keeps its title in prev/next', () => {
  const hubLast = readFileSync(path.join(REPO_ROOT, 'src/tests/fixtures/chrome/site/docs/guides/README.md'), 'utf8').replace(
    /^---\n/,
    '---\nsidebar:\n  order: 99\n',
  );

  it.each([
    ['title-as-index', TITLE_AS_INDEX],
    ['the default', {}],
  ])(
    'the first link in a group is its index, with its source order last, in %s (FR-008)',
    (_name, options) => {
      const html = sidebar(built({ options, files: { 'docs/guides/README.md': hubLast } }), 'guides/undated/index.html');
      const links = linksAfter(html, `<a href="${GUIDES}"`);
      expect(links[0]).toBe(GUIDES);
      expect(links.slice(1), 'and the others follow').toContain('/doc-kitty/guides/getting-started/');
      expect(html.indexOf(`<a href="${GUIDES}"`)).toBeLessThan(html.indexOf('/doc-kitty/guides/getting-started/'));
    },
    BUILD_TIMEOUT,
  );

  it(
    'the page before a relabelled index links forward with its page title, in both modes (FR-011)',
    () => {
      const before = 'context/audience/reader/index.html';
      const stock = page(built(), before);
      expect(sidebarFragment(stock), 'control: the sidebar relabels this index').toMatch(new RegExp(`<a href="${GUIDES}"[^>]*>\\s*<span[^>]*>Overview<`));
      const relabelled = page(built({ options: TITLE_AS_INDEX }), before);
      for (const html of [stock, relabelled]) {
        expect(html).toMatch(new RegExp(`<a href="${GUIDES}" rel="next"`));
        expect(paginationTitle(html, 'next')).toBe('Guides');
      }
    },
    BUILD_TIMEOUT,
  );

  it(
    'the index stays in prev/next on the page after it too',
    () => {
      const html = page(built({ options: TITLE_AS_INDEX }), NON_HUB_PAGE);
      expect(html).toMatch(new RegExp(`<a href="${GUIDES}" rel="prev"`));
      expect(paginationTitle(html, 'prev')).toBe('Guides');
    },
    BUILD_TIMEOUT,
  );
});

describe('the opt-in', () => {
  it(
    'titleIsIndex with indexLabel fails the build with the config message',
    () => {
      const build = buildChromeFixture({ options: { sidebar: { titleIsIndex: true, indexLabel: 'Start here' } } });
      expect(build.status).not.toBe(0);
      expect(build.output).toContain('sidebar.titleIsIndex and sidebar.indexLabel cannot be set together');
    },
    BUILD_TIMEOUT,
  );

  it(
    'brings the upgrade script, outside the persister, and its CSS; the default build has neither',
    () => {
      const dist = built({ options: TITLE_AS_INDEX });
      const html = page(dist, NON_HUB_PAGE);
      const script = /<script type="module" src="[^"]*TitleAsIndexEnhancement[^"]*"/;
      expect(html).toMatch(script);
      expect(sidebarFragment(html)).not.toMatch(/<script type="module"/);
      const css = `${emittedCss(dist)}${html}`;
      expect(css).toContain('.dk-group.dk-disclosure');
      expect(css).toContain('.dk-disclosure__toggle');

      const stock = built();
      const stockHtml = page(stock, NON_HUB_PAGE);
      expect(stockHtml).not.toMatch(script);
      expect(`${emittedCss(stock)}${stockHtml}`).not.toContain('.dk-group');
    },
    BUILD_TIMEOUT,
  );
});

describe('an entry with dkIcon renders it before its label (WP07 supplies it)', () => {
  const ICON = '<svg data-test-icon viewBox="0 0 1 1"></svg>';
  const MIDDLEWARE = `import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
const walk = (entries) => { for (const entry of entries) {
  if (entry.type === 'group') { entry.dkIcon = ${JSON.stringify(ICON)}; walk(entry.entries); }
  else if (entry.label === 'Getting started') entry.dkIcon = ${JSON.stringify(ICON)};
} };
export const onRequest = defineRouteMiddleware((context) => { walk(context.locals.starlightRoute.sidebar); });
`;
  const request = {
    options: { ...TITLE_AS_INDEX, starlight: { routeMiddleware: './src/dk-test-icons.ts' } },
    files: { 'src/dk-test-icons.ts': MIDDLEWARE },
  };
  const iconThen = (text: string) => `<span class="dk-sidebar-icon[^"]*" aria-hidden="true">${ICON}</span><span[^>]*>${text}</span>`;

  it(
    'on a link, a plain group and a title-as-index group, hidden from assistive technology',
    () => {
      const html = sidebar(built(request), NON_HUB_PAGE);
      expect(html).toMatch(new RegExp(iconThen('Getting started')));
      expect(html).toMatch(new RegExp(iconThen('Notes')));
      expect(html).toMatch(new RegExp(iconThen('Guides')));
    },
    BUILD_TIMEOUT,
  );
});

describe('a badge on a title-as-index label', () => {
  const badgeMiddleware = (setOn: string) => `import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
const walk = (entries) => { for (const entry of entries) {
  ${setOn}
  if (entry.type === 'group') walk(entry.entries);
} };
export const onRequest = defineRouteMiddleware((context) => { walk(context.locals.starlightRoute.sidebar); });
`;
  const request = (setOn: string) => ({
    options: { ...TITLE_AS_INDEX, starlight: { routeMiddleware: './src/dk-test-badges.ts' } },
    files: { 'src/dk-test-badges.ts': badgeMiddleware(setOn) },
  });
  const labelContents = (html: string) => new RegExp(`<a href="${GUIDES}"[^>]*\\bdk-group__label\\b[^>]*>([\\s\\S]*?)</a>`).exec(html)?.[1];

  it(
    'shows the group\'s badge inside the label link',
    () => {
      const label = labelContents(sidebar(built(request("if (entry.type === 'group') entry.badge = { variant: 'tip', text: 'GroupBadge' };")), NON_HUB_PAGE));
      expect(label).toMatch(/<span class="sl-badge tip[^"]*"[^>]*>GroupBadge<\/span>/);
    },
    BUILD_TIMEOUT,
  );

  it(
    'falls back to the index page\'s badge when the group has none',
    () => {
      const label = labelContents(sidebar(built(request("if (entry.type === 'link' && entry.href === '" + GUIDES + "') entry.badge = { variant: 'caution', text: 'IndexBadge' };")), NON_HUB_PAGE));
      expect(label).toMatch(/<span class="sl-badge caution[^"]*"[^>]*>IndexBadge<\/span>/);
    },
    BUILD_TIMEOUT,
  );
});

describe('a consumer-written sidebar with titleIsIndex', () => {
  it(
    'renders plain, with no error',
    () => {
      const request = {
        options: { ...TITLE_AS_INDEX, starlight: { sidebar: [{ label: 'Guides', items: [{ label: 'Getting started', link: '/guides/getting-started/' }] }] } },
      };
      const build = buildChromeFixture(request);
      expect(build.status, build.output).toBe(0);
      const html = sidebar(build.dist, NON_HUB_PAGE);
      expect(html).toContain('>Guides<');
      expect(html).not.toContain('dk-group');
    },
    BUILD_TIMEOUT,
  );
});
