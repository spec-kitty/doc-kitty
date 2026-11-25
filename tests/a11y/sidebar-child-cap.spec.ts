// The sidebar child cap in a browser (#341, WP04; NFR-005, FR-005).
//
// The example's `guides/capped-hub/` has five pages and `sidebar_child_cap: 3`,
// so its sidebar group shows the overview link and one "5 pages" entry. On a page
// of the hub that entry is the one current sidebar entry, its group is open, a
// keyboard user reaches it, and the page passes axe (WCAG 2.2 AA) in both colour
// modes. On the hub page itself the overview link is current instead.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BASE, WCAG_TAGS } from './routes';
import { gotoInMode, modeOf } from './mode';

const HUB = `${BASE}/guides/capped-hub/`;
const CHILD = `${BASE}/guides/capped-hub/where-the-cap-is-set/`;
const CHILDREN = ['why-a-cap', 'where-the-cap-is-set', 'what-stays-reachable', 'the-capped-entry', 'generated-pages'];
const SIDEBAR = '#starlight__sidebar';
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

/**
 * The links of the sidebar group whose label is "Capped hub". Anchored on that
 * group's own summary: the enclosing Guides group contains the summary too.
 */
const groupLinks = (page: Page) =>
  page.locator(`${SIDEBAR} summary`, { hasText: /^\s*Capped hub\s*$/ }).locator('xpath=../ul/li/a');

test.describe('sidebar child cap', () => {
  test('a capped child page marks the capped entry current, in an open group', async ({ page }, testInfo) => {
    await gotoInMode(page, CHILD, modeOf(testInfo.project.name));
    const links = groupLinks(page);
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', HUB);
    await expect(links.nth(1)).toHaveAttribute('href', HUB);
    await expect(links.nth(1)).toHaveText('5 pages');
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).toBeVisible();
    // Exactly one current entry in the whole sidebar, and no link to a capped page.
    await expect(page.locator(`${SIDEBAR} [aria-current="page"]`)).toHaveCount(1);
    for (const slug of CHILDREN) await expect(page.locator(`${SIDEBAR} a[href="${HUB}${slug}/"]`)).toHaveCount(0);
  });

  test('the hub page marks its overview link current, not the capped entry', async ({ page }, testInfo) => {
    await gotoInMode(page, HUB, modeOf(testInfo.project.name));
    const links = groupLinks(page);
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).not.toHaveAttribute('aria-current', /.*/);
    // Non-vacuity: the hub still lists every page.
    for (const slug of CHILDREN) await expect(page.locator(`main a[href="${HUB}${slug}/"]`).first()).toBeVisible();
  });

  test('prev/next walk the hub in its listing order, with the OpenAPI renderer on', async ({ page }, testInfo) => {
    test.skip(modeOf(testInfo.project.name) !== 'light', 'pagination does not depend on the colour mode');
    // The hub lists its pages by title: Generated pages, The capped entry, What stays
    // reachable, Where the cap is set, Why a cap. The example also runs the OpenAPI
    // renderer, whose middleware rebuilds prev/next after the toolkit's (#341 WP03 B1).
    const order = ['generated-pages', 'the-capped-entry', 'what-stays-reachable', 'where-the-cap-is-set', 'why-a-cap'];
    const pagination = async (url: string) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      const href = (rel: string) => page.locator(`.pagination-links a[rel="${rel}"]`).getAttribute('href');
      return { prev: await href('prev'), next: await href('next') };
    };
    expect((await pagination(HUB)).next).toBe(`${HUB}${order[0]}/`);
    for (let i = 0; i < order.length; i += 1) {
      const { prev, next } = await pagination(`${HUB}${order[i]}/`);
      expect(prev, order[i]).toBe(i === 0 ? HUB : `${HUB}${order[i - 1]}/`);
      if (i < order.length - 1) expect(next, order[i]).toBe(`${HUB}${order[i + 1]}/`);
      else expect(next, order[i]).not.toContain('/capped-hub/');
    }
  });

  test('a keyboard user reaches the capped entry', async ({ page }, testInfo) => {
    test.skip(modeOf(testInfo.project.name) !== 'light', 'keyboard order does not depend on the colour mode');
    await gotoInMode(page, CHILD, 'light');
    const entry = groupLinks(page).nth(1);
    for (let i = 0; i < 400; i += 1) {
      await page.keyboard.press('Tab');
      if (await entry.evaluate((el) => el === document.activeElement)) break;
    }
    await expect(entry).toBeFocused();
  });

  for (const url of [CHILD, HUB]) {
    test(`axe: no serious/critical WCAG 2.2 AA violations on ${url}`, async ({ page }, testInfo) => {
      await gotoInMode(page, url, modeOf(testInfo.project.name));
      const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
      const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.has(v.impact ?? ''));
      expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
      // Non-vacuity: axe looked at the capped group.
      expect(results.passes.length).toBeGreaterThan(0);
    });
  }
});
