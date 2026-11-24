// The paged hub listing in a browser (#342, WP06; FR-008, FR-014, NFR-004).
//
// The example's `guides/paged-hub/` has seven pages, `sidebar_child_cap: 3` and
// `hub_page_size: 2`, so it lists two pages and links listing pages 2..4 through a
// "Pagination" landmark. A keyboard user moves through it with a visible focus
// ring and 24px targets; the current page is text, not a link; search finds the
// listing pages, and a child's own page still comes first for its title. Axe for
// the hub and a listing page runs in axe.spec.ts (both are in AXE_PAGES).
import { test, expect } from '@playwright/test';
import { BASE } from './routes';
import { gotoInMode, modeOf } from './mode';

const HUB = `${BASE}/guides/paged-hub/`;
const PAGE = (n: number) => `${HUB}page/${n}/`;
const NAV = 'nav[aria-label="Pagination"]';

test.describe('paged hub listing', () => {
  test('each listing page has one labelled pagination with its page current, as text', async ({ page }, testInfo) => {
    for (const [url, n] of [[HUB, 1], [PAGE(2), 2], [PAGE(4), 4]] as const) {
      await gotoInMode(page, url, modeOf(testInfo.project.name));
      await expect(page.getByRole('navigation', { name: 'Pagination' })).toHaveCount(1);
      const current = page.locator(`${NAV} [aria-current="page"]`);
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(`Page ${n}`);
      expect(await current.evaluate((el) => el.tagName)).toBe('SPAN');
    }
  });

  test('a keyboard user reaches Next with a visible focus ring, and follows it', async ({ page }, testInfo) => {
    test.skip(modeOf(testInfo.project.name) !== 'light', 'keyboard order does not depend on the colour mode');
    await gotoInMode(page, HUB, 'light');
    const next = page.locator(`${NAV} a[rel="next"]`);
    for (let i = 0; i < 400; i += 1) {
      await page.keyboard.press('Tab');
      if (await next.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(next).toBeFocused();
    const ring = await next.evaluate((el) => {
      const style = getComputedStyle(el);
      return { shadow: style.boxShadow, outline: style.outlineStyle };
    });
    expect(ring.shadow !== 'none' || ring.outline !== 'none').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(PAGE(2));
  });

  test('every pagination link is reachable by Tab and at least 24×24', async ({ page }, testInfo) => {
    test.skip(modeOf(testInfo.project.name) !== 'light', 'geometry does not depend on the colour mode');
    await gotoInMode(page, PAGE(2), 'light');
    const links = page.locator(`${NAV} a`);
    const count = await links.count();
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      expect(box!.width, `link ${i}`).toBeGreaterThanOrEqual(24);
      expect(box!.height, `link ${i}`).toBeGreaterThanOrEqual(24);
      expect(await links.nth(i).getAttribute('tabindex')).not.toBe('-1');
    }
  });

  test('search finds a child first for its title, and finds the listing pages', async ({ page }, testInfo) => {
    test.skip(modeOf(testInfo.project.name) !== 'light', 'search does not depend on the colour mode');
    await page.goto(HUB, { waitUntil: 'domcontentloaded' });
    const urls = await page.evaluate(async (base) => {
      const pagefind = await import(`${base}/pagefind/pagefind.js`);
      await pagefind.init();
      const child = await pagefind.search('Translating the pagination');
      const listing = await pagefind.search('Paged hub page 3');
      const urlsOf = async (search: { results: Array<{ data: () => Promise<{ url: string }> }> }) =>
        Promise.all(search.results.slice(0, 10).map(async (r) => (await r.data()).url));
      return { child: await urlsOf(child), listing: await urlsOf(listing) };
    }, BASE);
    expect(urls.child[0]).toBe(`${HUB}translating-the-pagination/`);
    expect(urls.listing).toContain(PAGE(3));
  });
});
