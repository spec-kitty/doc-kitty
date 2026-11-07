// Title-as-index in a browser (page-chrome WP06; FR-007, NFR-002, NFR-003, NFR-004,
// NFR-006, ADR-0075). Runs on the `title-as-index-light` project, which serves the
// chrome fixture built with `sidebar: { titleIsIndex: true }`.
//
// "Guides" is the group of the page these tests start on, so it starts open.
// "Context" is another group with an index page, so it starts closed.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { WCAG_TAGS } from './routes';
import { gotoInMode, type Mode } from './mode';
import { settle } from './helpers/geometry';
import { collectTargets, targetSizeFailures } from './helpers/targets';

const PAGE = '/doc-kitty/guides/getting-started/';
const OTHER_PAGE = '/doc-kitty/guides/undated/';
const INDEX_PAGE = '/doc-kitty/guides/';
const DEEP_PAGE = '/doc-kitty/guides/authoring/advanced/deep-page/';

const label = (page: Page, href: string) => page.locator(`#starlight__sidebar a.dk-group__label[href="${href}"]`);
const toggle = (page: Page, id: string) => page.locator(`[id="${id}-toggle"]`);
const details = (page: Page, id: string) => page.locator(`[id="${id}"]`);
const isOpen = (page: Page, id: string) => details(page, id).evaluate((el) => (el as HTMLDetailsElement).open);
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('href') || '');

async function load(page: Page, path = PAGE): Promise<void> {
  await page.goto(path, { waitUntil: 'load' });
  await expect(toggle(page, 'dk-group-guides')).toBeVisible();
}

test.describe('keyboard (FR-007)', () => {
  test('Tab goes from the label to the chevron to the children', async ({ page }) => {
    await load(page);
    await label(page, INDEX_PAGE).focus();
    expect(await focused(page)).toBe(INDEX_PAGE);
    await page.keyboard.press('Tab');
    expect(await focused(page)).toBe('dk-group-guides-toggle');
    await page.keyboard.press('Tab');
    expect(await focused(page)).toBe(PAGE);
  });

  test('Enter on the label navigates, and the index is then marked current', async ({ page }) => {
    await load(page);
    await expect(label(page, INDEX_PAGE)).not.toHaveAttribute('aria-current');
    await label(page, INDEX_PAGE).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${INDEX_PAGE}$`));
    await expect(label(page, INDEX_PAGE)).toHaveAttribute('aria-current', 'page');
    expect(await isOpen(page, 'dk-group-guides'), 'the group of the current page opens').toBe(true);
  });

  for (const key of ['Enter', 'Space']) {
    test(`${key} on the chevron toggles and does not navigate`, async ({ page }) => {
      await load(page);
      const button = toggle(page, 'dk-group-guides');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(button).toHaveAttribute('aria-controls', 'dk-group-guides');
      await expect(button).toHaveAccessibleName('Collapse Guides');
      await button.focus();

      await page.keyboard.press(key);
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(button).toHaveAccessibleName('Expand Guides');
      expect(await isOpen(page, 'dk-group-guides')).toBe(false);

      await page.keyboard.press(key);
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(await isOpen(page, 'dk-group-guides')).toBe(true);
      await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
    });
  }

  test('a group with no index page keeps a toggle on its label, and no button', async ({ page }) => {
    await page.goto('/doc-kitty/reference/generated-page/', { waitUntil: 'load' });
    const summary = page.locator('#starlight__sidebar summary:has(.group-label)', { hasText: 'Notes' });
    await expect(summary).toBeVisible();
    const before = await summary.evaluate((el) => (el.parentElement as HTMLDetailsElement).open);
    await summary.click();
    expect(await summary.evaluate((el) => (el.parentElement as HTMLDetailsElement).open)).toBe(!before);
  });
});

test.describe("Starlight's persister receives a chevron toggle", () => {
  test('a group opened on one page is open on the next', async ({ page }) => {
    await load(page);
    expect(await isOpen(page, 'dk-group-context'), 'control: it starts closed').toBe(false);
    await toggle(page, 'dk-group-context').click();
    expect(await isOpen(page, 'dk-group-context')).toBe(true);

    await page.locator(`#starlight__sidebar a[href="${OTHER_PAGE}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${OTHER_PAGE}$`));
    await expect(toggle(page, 'dk-group-context')).toHaveAttribute('aria-expanded', 'true');
    expect(await isOpen(page, 'dk-group-context')).toBe(true);
  });

  test("a group closed on one page stays closed on the next, though it holds that page", async ({ page }) => {
    await load(page);
    await toggle(page, 'dk-group-guides').click();
    expect(await isOpen(page, 'dk-group-guides')).toBe(false);

    await page.goto(OTHER_PAGE, { waitUntil: 'load' });
    expect(await isOpen(page, 'dk-group-guides')).toBe(false);
    await expect(toggle(page, 'dk-group-guides')).toHaveAttribute('aria-expanded', 'false');
  });

  test('in a fresh session the default is back', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await load(page);
    await toggle(page, 'dk-group-context').click();
    await context.close();

    const fresh = await browser.newContext({ baseURL });
    const next = await fresh.newPage();
    await load(next);
    expect(await isOpen(next, 'dk-group-context')).toBe(false);
    await fresh.close();
  });
});

test.describe('with scripts off (NFR-004, NFR-006)', () => {
  test('the summary is the control, and nothing is lost', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(PAGE);
    await expect(page.locator('.dk-disclosure__toggle')).toHaveCount(0);
    const summary = details(page, 'dk-group-context').locator('> summary');
    await expect(summary).toHaveAccessibleName('Toggle Context');
    const children = details(page, 'dk-group-context').locator('> ul');
    await expect(children).toBeHidden();
    await summary.click();
    await expect(children).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`));
    await context.close();
  });

  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['mobile', { width: 390, height: 800 }],
  ] as const) {
    test(`open state and boxes match with scripts on, on ${name}`, async ({ browser, baseURL }) => {
      const read = async (javaScriptEnabled: boolean) => {
        const context = await browser.newContext({ baseURL, viewport, javaScriptEnabled, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await page.goto(DEEP_PAGE, { waitUntil: 'load' });
        // The pane is a popover on a small viewport, and its menu button sits outside it.
        if (viewport.width < 800) await page.locator('#starlight__sidebar').evaluate((el) => (el as HTMLElement).showPopover());
        const control = javaScriptEnabled ? '> .dk-disclosure__toggle' : '> details > summary';
        const rows = page.locator('#starlight__sidebar li.dk-group.dk-disclosure');
        const out: unknown[] = [];
        for (const row of await rows.all()) {
          const open = await row.locator('> details').evaluate((el) => (el as HTMLDetailsElement).open);
          // A row in a closed group has no box in either build.
          out.push({ open, label: await row.locator('> .dk-group__label').boundingBox(), control: await row.locator(control).boundingBox() });
        }
        expect(out.length, 'the fixture has such groups').toBeGreaterThan(2);
        await context.close();
        return out;
      };
      expect(await read(true)).toEqual(await read(false));
    });
  }

  test('the upgrade changes no open state on first load', async ({ page }) => {
    await page.addInitScript(() => {
      const changes: string[] = [];
      (window as unknown as { __dkOpenChanges: string[] }).__dkOpenChanges = changes;
      new MutationObserver((records) => {
        for (const record of records) changes.push((record.target as Element).id || 'plain');
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['open'] });
    });
    await load(page, DEEP_PAGE);
    await settle(page);
    const changes = await page.evaluate(() => (window as unknown as { __dkOpenChanges: string[] }).__dkOpenChanges);
    expect(changes).toEqual([]);
  });
});

test.describe('layout', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    test(`in ${dir}, the chevron is at the row's inline end and shows the state`, async ({ page }) => {
      await load(page);
      await page.evaluate((value) => {
        document.documentElement.dir = value;
      }, dir);
      await settle(page);

      const row = (await page.locator('li.dk-group:has(> [id="dk-group-guides"])').boundingBox())!;
      const box = (await toggle(page, 'dk-group-guides').boundingBox())!;
      const text = (await label(page, INDEX_PAGE).boundingBox())!;
      if (dir === 'ltr') {
        expect(Math.abs(box.x + box.width - (row.x + row.width))).toBeLessThan(1);
        expect(text.x + text.width).toBeLessThanOrEqual(box.x + 0.5);
      } else {
        expect(Math.abs(box.x - row.x)).toBeLessThan(1);
        expect(text.x).toBeGreaterThanOrEqual(box.x + box.width - 0.5);
      }
      expect(box.y, 'on the label row').toBeLessThan(text.y + text.height);

      const angle = (id: string) =>
        toggle(page, id).locator('svg').evaluate((el) => {
          const { a, b } = new DOMMatrix(getComputedStyle(el).transform);
          return Math.round((Math.atan2(b, a) * 180) / Math.PI);
        });
      // Polled: changing `dir` here runs the caret's own transition.
      await expect.poll(() => angle('dk-group-guides'), { message: 'expanded: down' }).toBe(90);
      await expect
        .poll(async () => Math.abs(await angle('dk-group-context')), { message: 'collapsed: the inline end' })
        .toBe(dir === 'ltr' ? 0 : 180);
    });
  }

  test('the chevron shows the same caret, at the same size, as a plain group', async ({ page }) => {
    await load(page);
    const svg = toggle(page, 'dk-group-guides').locator('svg');
    await expect(svg).toHaveClass(/\bcaret\b/);
    await expect(toggle(page, 'dk-group-guides')).toHaveAttribute('title', 'Collapse Guides');
    const size = await svg.evaluate((el) => el.getBoundingClientRect().width);
    const plain = await page.locator('#starlight__sidebar summary:has(.group-label) .caret').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(size).toBe(plain);
  });

  test('the reveal script scrolls to the current entry', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 320 });
    await page.goto(DEEP_PAGE, { waitUntil: 'load' });
    const pane = page.locator('#starlight__sidebar');
    const metrics = await pane.evaluate((el) => ({ scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(metrics.scrollHeight, 'non-vacuity: the pane overflows').toBeGreaterThan(metrics.clientHeight);
    expect(metrics.scrollTop, 'the pane moved').toBeGreaterThan(0);
    const inView = await pane.evaluate((el) => {
      const current = el.querySelector('[aria-current="page"]')!.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      return current.top >= box.top && current.bottom <= box.bottom;
    });
    expect(inView).toBe(true);
  });
});

/** Open every closed group, plain or not, so every target in the tree is rendered. */
async function openAllGroups(page: Page): Promise<void> {
  for (;;) {
    const closed = page.locator('#starlight__sidebar details:not([open])').first();
    if ((await closed.count()) === 0) return;
    await closed.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
  }
}

test.describe('target size and focus (NFR-003)', () => {
  test('each sidebar target is big enough at 1280, with groups open', async ({ page }) => {
    await load(page);
    await openAllGroups(page);
    await settle(page);
    const targets = await collectTargets(page, ['sidebar']);
    expect(targets.some((t) => t.id === 'dk-group-guides-toggle'), 'the chevrons are measured').toBe(true);
    expect(targetSizeFailures(targets)).toEqual([]);
    const box = (await toggle(page, 'dk-group-guides').boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test('each sidebar target is big enough at 390 with the menu open', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(PAGE, { waitUntil: 'load' });
    await page.locator('button[popovertarget="starlight__sidebar"]').click();
    await expect(page.locator('#starlight__sidebar')).toBeVisible();
    await openAllGroups(page);
    await settle(page);
    const targets = await collectTargets(page, ['sidebar']);
    expect(targets.some((t) => t.id === 'dk-group-guides-toggle'), 'the chevrons are measured').toBe(true);
    expect(targetSizeFailures(targets)).toEqual([]);
  });

  test('the label and the chevron show a focus ring', async ({ page }) => {
    await load(page);
    await label(page, INDEX_PAGE).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    // The theme's focus style is a box-shadow; `disclosure.css` and the browser's are outlines.
    const hasRing = (control: ReturnType<typeof toggle>) =>
      control.evaluate((el) => {
        const style = getComputedStyle(el);
        return el.matches(':focus-visible') && (style.boxShadow !== 'none' || (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0));
      });
    expect(await hasRing(label(page, INDEX_PAGE)), 'the label').toBe(true);
    await page.keyboard.press('Tab');
    expect(await hasRing(toggle(page, 'dk-group-guides')), 'the chevron').toBe(true);
  });
});

// The project is `title-as-index-light`; dark is driven here, and `gotoInMode` asserts it.
test.describe('axe (NFR-002)', () => {
  for (const mode of ['light', 'dark'] as Mode[]) {
    for (const path of [PAGE, INDEX_PAGE]) {
      test(`${path} in ${mode}, with groups open`, async ({ page }) => {
        await gotoInMode(page, path, mode);
        await expect(toggle(page, 'dk-group-guides')).toBeVisible();
        await openAllGroups(page);
        await settle(page);
        const { violations } = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }
});
