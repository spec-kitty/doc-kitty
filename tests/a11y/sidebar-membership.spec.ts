// Sidebar membership in both draft modes (layout-guards-decisions-01M59CGE WP08;
// FR-012, FR-013, FR-014).
//
// Why this spec exists: the `chrome-1920` screenshot passed against the drafts-on
// baseline although the published sidebar has four rows fewer (a 1.35% diff under
// `maxDiffPixelRatio: 0.01`). A screenshot is a weak guard for which pages a
// sidebar lists; this spec asserts it structurally, from the served HTML.
//
// It runs in all four projects (playwright.config.ts) but is structural, so the
// colour mode does not matter: `dark` and `published-dark` skip. `light` serves
// the drafts-on dist, `published-light` the drafts-off one (the sidebar readers
// see); `isPublishedProject` tells the spec which of the two it is reading.
//
// The draft slugs below are a copy. The source of truth is `SIDEBAR_DRAFTS` in
// src/tests/draft-publication-build.test.ts (a vitest file, not importable here).
// So that the copy cannot drift silently, the last test also derives the drafts
// from the two dists themselves: the drafts-on sidebar minus the published one
// must be exactly this list.
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { BASE, ROUTES, a11yPorts, isLightProject, isPublishedProject } from './routes';

/** Draft pages that the drafts-on sidebar lists. Copy of SIDEBAR_DRAFTS (see above). */
const SIDEBAR_DRAFTS = [
  'context/audience/draft-persona',
  'adr/template',
  'behaviour/shipping/track-consignment',
  'guides/markua-footnotes-malformed',
] as const;
const href = (slug: string): string => `${BASE}/${slug}/`;
const DRAFT_HREFS = SIDEBAR_DRAFTS.map(href);

/** A page promoted from draft to active: published in both modes. */
const PROMOTED_SHOWCASE = href('guides/markua-footnotes-showcase');

const SIDEBAR_LINKS = '#starlight__sidebar a[href]';
/** Starlight's prev/next pagination links. */
const PAGINATION_LINK = /<a\b[^>]*\brel="(?:prev|next)"[^>]*>/g;
const HREF_ATTR = /\bhref="([^"]+)"/;

async function sidebarHrefs(page: Page, url: string): Promise<string[]> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), `${url} serves`).toBe(200);
  const hrefs = await page
    .locator(SIDEBAR_LINKS)
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  // Non-vacuity: a page without a sidebar would pass every "not listed" check.
  expect(hrefs.length, `non-vacuity: ${url} has a sidebar with links`).toBeGreaterThan(20);
  return hrefs;
}

async function paginationHrefs(request: APIRequestContext, url: string): Promise<string[]> {
  const response = await request.get(url);
  expect(response.status(), `${url} serves`).toBe(200);
  const html = await response.text();
  return [...html.matchAll(PAGINATION_LINK)].map((m) => HREF_ATTR.exec(m[0])?.[1] ?? '');
}

test.beforeEach(({}, testInfo) => {
  test.skip(!isLightProject(testInfo), 'membership is identical in both colour schemes');
});

test('the sidebar lists the draft pages in the drafts-on build and none in the published build', async ({
  page,
}, testInfo) => {
  const hrefs = await sidebarHrefs(page, ROUTES.prose);
  expect(hrefs, 'a promoted page is listed in both builds').toContain(PROMOTED_SHOWCASE);
  if (isPublishedProject(testInfo)) {
    for (const draft of DRAFT_HREFS) expect(hrefs, `published sidebar lists ${draft}`).not.toContain(draft);
  } else {
    for (const draft of DRAFT_HREFS) expect(hrefs, `drafts-on sidebar lists ${draft}`).toContain(draft);
  }
});

test('the guide before the malformed draft links "next" to the footnotes showcase in the published build', async ({
  page,
}, testInfo) => {
  // The install guide is the sidebar entry just before the malformed draft.
  await page.goto(href('guides/install'), { waitUntil: 'domcontentloaded' });
  const next = page.locator('a[rel="next"]');
  await expect(next, 'non-vacuity: the page has one "next" link').toHaveCount(1);
  const expected = isPublishedProject(testInfo) ? PROMOTED_SHOWCASE : href('guides/markua-footnotes-malformed');
  await expect(next).toHaveAttribute('href', expected);
});

test('no prev/next link on a sidebar page points at a draft in the published build', async ({
  page,
  request,
}, testInfo) => {
  // Site pages only: the sidebar also links out (the repository), which is not
  // a page of this dist and must not be fetched.
  const pages = (await sidebarHrefs(page, ROUTES.prose)).filter((h) => h.startsWith(`${BASE}/`));
  const toDrafts: string[] = [];
  let linked = 0;
  for (const url of pages) {
    const links = await paginationHrefs(request, url);
    linked += links.length;
    for (const link of links) if (DRAFT_HREFS.includes(link)) toDrafts.push(`${url} -> ${link}`);
  }
  expect(linked, 'non-vacuity: the walked pages have prev/next links').toBeGreaterThan(pages.length);
  if (isPublishedProject(testInfo)) {
    expect(toDrafts, 'published prev/next links that lead to a draft').toEqual([]);
  } else {
    // The same walk finds the drafts in the drafts-on build, so the published
    // assertion above is not passing for want of links to look at.
    expect(toDrafts.length, 'drafts-on prev/next links that lead to a draft').toBeGreaterThan(0);
  }
});

test('the published sidebar has exactly the draft entries fewer than the drafts-on one', async ({
  page,
}, testInfo) => {
  // Reads both servers in one test, so it runs once: in the published lane.
  test.skip(!isPublishedProject(testInfo), 'compares the two dists; runs in published-light');
  const ports = a11yPorts();
  const draftsOn = await sidebarHrefs(page, `http://localhost:${ports.draftsOn}${ROUTES.prose}`);
  const published = await sidebarHrefs(page, `http://localhost:${ports.published}${ROUTES.prose}`);

  expect(draftsOn.length - published.length, 'sidebar links lost to drafts-off').toBe(SIDEBAR_DRAFTS.length);
  const onlyInDraftsOn = draftsOn.filter((h) => !published.includes(h)).sort();
  expect(onlyInDraftsOn, 'the entries only the drafts-on sidebar lists are the drafts').toEqual(
    [...DRAFT_HREFS].sort(),
  );
  expect(
    published.filter((h) => !draftsOn.includes(h)),
    'the published sidebar lists nothing the drafts-on one does not',
  ).toEqual([]);
});
