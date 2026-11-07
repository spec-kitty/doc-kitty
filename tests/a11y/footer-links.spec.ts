// The footer's machine links and page formats (page-chrome WP09, NFR-003, FR-025): 24 x 24
// at least, a visible focus ring, and clean under Axe. One cell per project, so it also
// runs in `unthemed-*`, which keeps tests with "axe" in the title: the contract holds
// themed or not, and without a theme the pill has no size of its own to help.
//
// Axe is scoped to the two groups: `visual` and `axe` own the rest of the page.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { WCAG_TAGS } from './routes';
import { gotoInMode, modeOf } from './mode';

const PAGE = '/doc-kitty/guides/getting-started/';
const LINKS = '.dk-machine-links a, .dk-page-formats a';

test('axe, target size and focus ring: the footer groups', async ({ page }, testInfo) => {
  await gotoInMode(page, PAGE, modeOf(testInfo.project.name));
  const links = page.locator(LINKS);
  // Five machine links on the fixture and eight on the example, and three formats.
  expect(await links.count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator('.dk-page-formats a.dk-pill')).not.toHaveCount(0);

  const themed = !testInfo.project.name.startsWith('unthemed-');
  const styles = await page.locator('.dk-page-formats a').first().evaluate((el) => {
    const css = getComputedStyle(el);
    return { display: css.display, minHeight: css.minHeight, radius: css.borderTopLeftRadius };
  });
  // A flex item's `inline-flex` computes to `flex`. `.dk-pill` would make it `block`.
  expect(styles.display, 'the group sets this, themed or not: it must beat `.dk-pill`').toBe('flex');
  expect(styles.minHeight).toBe('24px');
  if (themed) expect(styles.radius, 'the theme styles the pill').not.toBe('0px');
  else expect(styles.radius, 'no pill look without a theme (C-004)').toBe('0px');

  for (const link of await links.all()) {
    const name = await link.textContent();
    const box = await link.boundingBox();
    expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(24);
    expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(24);

    await link.focus();
    const focus = await link.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        visible: el.matches(':focus-visible'),
        ring: (css.outlineStyle !== 'none' && parseFloat(css.outlineWidth) > 0) || css.boxShadow !== 'none',
      };
    });
    expect(focus.visible, `${name} matches :focus-visible`).toBe(true);
    expect(focus.ring, `${name} shows a ring`).toBe(true);
  }

  const results = await new AxeBuilder({ page }).include('.dk-machine-links').include('.dk-page-formats').withTags([...WCAG_TAGS]).analyze();
  expect(results.violations).toEqual([]);
});
