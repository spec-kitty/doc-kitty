/**
 * DocKitty's sublist against Starlight's (page-chrome WP06; FR-006, ADR-0075).
 *
 * The frozen fixture, built twice, with no group index page anywhere: once stock, and
 * once with `titleIsIndex: true`, which renders `SidebarSublist.astro`. With no index
 * and no icon every group takes the copy's plain path, so the two must be the same
 * bytes once build ids are normalised. This is what fails when a Starlight upgrade
 * changes its markup, or an edit changes the copy. It does not compare the copied CSS.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildChromeFixture, DEEP_PAGE, noIndexVariant, NON_HUB_PAGE, normaliseBuildIds, sidebarFragment } from './fixtures/chrome/harness.mjs';

const BUILD_TIMEOUT = 240_000;
const PAGES = [DEEP_PAGE, NON_HUB_PAGE, 'reference/notes/first/index.html', 'adr/template/index.html'];

// The shaped sidebar is groups only, so a top-level link comes from a consumer's route
// middleware, as does a badge on every link and group (the fixture has none): this
// compares the badge props and the `large` class of the plain link branch.
const MIDDLEWARE = `import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
const walk = (entries) => { for (const entry of entries) {
  entry.badge = { variant: 'note', text: 'Badge' };
  if (entry.type === 'group') walk(entry.entries);
} };
export const onRequest = defineRouteMiddleware((context) => {
  const sidebar = context.locals.starlightRoute.sidebar;
  walk(sidebar);
  const href = '/doc-kitty/top-level/';
  sidebar.push({ type: 'link', label: 'Top level', href, isCurrent: context.url.pathname === href, badge: { variant: 'tip', text: 'New' }, attrs: {} });
});
`;

// The glossary's index page is generated from these definitions, not a file in `docs/`.
const FILES = {
  ...noIndexVariant(),
  '.contextive/definitions.yaml': null,
  'src/dk-test-chrome.ts': MIDDLEWARE,
};

function built(options: Record<string, unknown>) {
  const build = buildChromeFixture({ options: { ...options, starlight: { routeMiddleware: './src/dk-test-chrome.ts' } }, files: FILES });
  expect(build.status, build.output).toBe(0);
  return build;
}

const page = (dist: string, rel: string) => readFileSync(path.join(dist, rel), 'utf8');

/** The carrier's body, `MobileMenuFooter` included: from the persister to the reveal script. */
function body(html: string) {
  const start = html.indexOf('<sl-sidebar-state-persist');
  const end = html.indexOf('data-dk-sidebar-reveal');
  expect(start, 'the page has a sidebar').toBeGreaterThan(-1);
  expect(end, 'the page has the reveal script').toBeGreaterThan(start);
  return html.slice(start, end);
}

/** The opt-in's one addition, which sits outside the persister. */
const ENHANCEMENT_SCRIPT = /<script type="module" src="[^"]*TitleAsIndexEnhancement[^"]*"><\/script>/;

describe('the sublist copy matches Starlight on its plain path', () => {
  it(
    'each page renders the same sidebar through both components',
    () => {
      const stock = built({}).dist;
      const copy = built({ sidebar: { titleIsIndex: true } }).dist;
      for (const rel of PAGES) {
        const stockPage = page(stock, rel);
        const copyPage = page(copy, rel);
        // Non-vacuity: two components rendered this, and what they rendered is a sidebar.
        expect(sidebarFragment(copyPage), `${rel}: a different component rendered it`).not.toBe(sidebarFragment(stockPage));
        expect(copyPage, `${rel}: the opt-in is on`).toMatch(ENHANCEMENT_SCRIPT);
        for (const part of ['<details', '<summary', '<sl-sidebar-restore', 'class="caret ', 'aria-current="page"', 'md:sl-hidden', 'sl-badge']) {
          expect(body(copyPage), `${rel} has ${part}`).toContain(part);
        }

        expect(body(copyPage), `${rel} has a top-level link`).toMatch(/<a href="\/doc-kitty\/top-level\/"[^>]* class="large[ "][^>]*> <span[^>]*>Top level<\/span> <span class="sl-badge tip/);

        expect(normaliseBuildIds(body(copyPage).replace(ENHANCEMENT_SCRIPT, ''))).toBe(normaliseBuildIds(body(stockPage)));
      }
    },
    BUILD_TIMEOUT,
  );
});
