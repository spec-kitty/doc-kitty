// Collapsible metadata blocks in a real browser (page-chrome WP04; FR-014, FR-016,
// FR-017, NFR-002..NFR-006, SC-003; ADR-0077). What the built HTML and Pagefind hold is
// in src/tests/metadata-blocks-build.test.ts.
//
// `rhetoric/book-one/` is the example's page with all four blocks. The unthemed
// projects serve the chrome fixture, whose `guides/getting-started/` has all four, and
// run only the tests with "axe" in their title. Geometry and behaviour do not depend on
// the colour scheme, so those run in `light` and skip in `dark`.
import { test, expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { BASE, ROUTES, TOC_RAIL_TOGGLE, WCAG_TAGS, isLightProject } from './routes';
import { gotoInMode, modeOf } from './mode';
import { collectTargets, targetSizeFailures } from './helpers/targets';

const BOOK_ONE = `${BASE}/rhetoric/book-one/`;
const FIXTURE_PAGE = `${BASE}/guides/getting-started/`;
/** Three blocks and an outline, so the rail's toggle is on the same page. */
const WITH_RAIL = `${BASE}/rhetoric/book-one/chapter-08/`;
const WITH_RAIL_BLOCKS = 3;
const SCRIPT = /\/MetadataBlock\.astro[^/]*\.js$/;
const RAIL_KEY = 'dk-toc-collapsed';
const BLOCKS = [
  { id: 'dk-block-audience', label: 'Who is this for', count: 1 },
  { id: 'dk-block-related', label: 'Related', count: 1 },
  { id: 'dk-block-external-references', label: 'External references', count: 1 },
  { id: 'dk-block-glossary', label: 'Glossary links used', count: 2 },
] as const;
const [AUDIENCE, RELATED, REFS, GLOSSARY] = BLOCKS;
const toggleOf = (id: string) => `#${id}-toggle`;
const summaryOf = (id: string) => `#${id} > summary`;

const lightOnly = ({}, testInfo: TestInfo) => {
  test.skip(!isLightProject(testInfo), 'geometry and behaviour are identical in both colour schemes');
};

/** A page with its blocks upgraded: the assertion fails if the script did not run. */
async function gotoUpgraded(page: Page, path = BOOK_ONE, blocks = BLOCKS.length): Promise<void> {
  await page.goto(path);
  await expect(page.locator('.dk-disclosure--upgraded')).toHaveCount(blocks);
}

/** A second context, the same but for scripts, on the project's own server. */
async function scriptsOff(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  return context.newPage();
}

const openStates = (page: Page) =>
  page.evaluate((ids) => ids.map((id) => (document.getElementById(id) as HTMLDetailsElement).open), BLOCKS.map((b) => b.id));

/** Open state, and where each block and the content after it sit. */
const layoutOf = (page: Page) =>
  page.evaluate((ids) => {
    const round = (n: number) => Math.round(n * 2) / 2;
    const box = (el: Element | null) => {
      if (!el) throw new Error('layoutOf: a measured element is missing');
      const { x, y, width, height } = el.getBoundingClientRect();
      return [x + scrollX, y + scrollY, width, height].map(round);
    };
    return {
      open: ids.map((id) => (document.getElementById(id) as HTMLDetailsElement).open),
      blocks: ids.map((id) => box(document.getElementById(id)?.closest('.dk-disclosure') ?? null)),
      firstParagraph: box(document.querySelector('.sl-markdown-content p')),
      hub: box(document.querySelector('.dk-hub')),
      siteFooter: box(document.querySelector('.dk-site-footer')),
    };
  }, BLOCKS.map((b) => b.id));

test.describe('collapsed by default, and reachable (FR-014, SC-003)', () => {
  test.beforeEach(lightOnly);

  test('SC-003: the four blocks start closed with their counts, and the content sits higher than expanded', async ({ page }) => {
    await gotoUpgraded(page);
    for (const { id, label, count } of BLOCKS) {
      await expect(page.locator(`#${id}`)).not.toHaveAttribute('open');
      await expect(page.locator(toggleOf(id))).toContainText(label);
      await expect(page.locator(toggleOf(id))).toContainText(`(${count})`);
      await expect(page.locator(toggleOf(id))).toHaveAttribute('aria-expanded', 'false');
    }
    const collapsed = await layoutOf(page);
    for (const { id } of BLOCKS) await page.locator(toggleOf(id)).click();
    expect(await openStates(page)).toEqual([true, true, true, true]);
    const expanded = await layoutOf(page);
    expect(collapsed.firstParagraph[1], 'the paragraph is higher with the blocks closed').toBeLessThan(expanded.firstParagraph[1]);
  });

  test('keyboard: Tab reaches the next control past closed content, and Enter and Space toggle it', async ({ page }) => {
    await gotoUpgraded(page);
    await page.locator(toggleOf(RELATED.id)).focus();
    await page.keyboard.press('Tab');
    const refs = page.locator(toggleOf(REFS.id));
    await expect(refs).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(refs).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${REFS.id}`)).toHaveAttribute('open');
    await expect(page.locator(`#${REFS.id} a`).first()).toBeVisible();
    await page.keyboard.press('Space');
    await expect(refs).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(`#${REFS.id}`)).not.toHaveAttribute('open');
    await expect(page.locator(`#${REFS.id} a`).first()).toBeHidden();
    await page.keyboard.press('Space');
    await expect(refs).toHaveAttribute('aria-expanded', 'true');
    await expect(refs, 'focus stays on the control').toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator(`#${REFS.id} a`).first(), 'open content is next in the tab order').toBeFocused();
  });

  test('mouse: a click flips details.open and aria-expanded together', async ({ page }) => {
    await gotoUpgraded(page);
    const toggle = page.locator(toggleOf(AUDIENCE.id));
    const state = () =>
      page.evaluate(
        ({ id, toggleId }) => [
          (document.getElementById(id) as HTMLDetailsElement).open,
          document.getElementById(toggleId)?.getAttribute('aria-expanded'),
          document.getElementById(toggleId)?.getAttribute('aria-label'),
        ],
        { id: AUDIENCE.id, toggleId: `${AUDIENCE.id}-toggle` },
      );
    expect(await state()).toEqual([false, 'false', 'Show Who is this for (1)']);
    await toggle.click();
    expect(await state()).toEqual([true, 'true', 'Hide Who is this for (1)']);
    await toggle.click();
    expect(await state()).toEqual([false, 'false', 'Show Who is this for (1)']);
  });

  test('scripts off: the summary toggles by mouse and keyboard, and the content is reachable (NFR-004)', async ({ browser, baseURL }) => {
    const page = await scriptsOff(browser, baseURL);
    await page.goto(BOOK_ONE);
    await expect(page.locator('.dk-disclosure__toggle'), 'no script ran').toHaveCount(0);
    const summary = page.locator(summaryOf(RELATED.id));
    const link = page.locator(`#${RELATED.id} a`).first();
    await expect(summary).toBeVisible();
    await expect(link).toBeHidden();
    await summary.click();
    await expect(page.locator(`#${RELATED.id}`)).toHaveAttribute('open');
    await expect(link).toBeVisible();
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(link).toBeHidden();
    await page.keyboard.press('Space');
    await expect(link).toBeVisible();
    await page.context().close();
  });

  test('a start-open details upgrades to the expanded state, and writes nothing to it (FR-015, NFR-006)', async ({ page }) => {
    await page.route(`**${BOOK_ONE}`, async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace(/<details id="(dk-block-[^"]+)">/g, '<details id="$1" open>');
      await route.fulfill({ response, body });
    });
    await gotoUpgraded(page);
    expect(await openStates(page)).toEqual([true, true, true, true]);
    for (const { id, label, count } of BLOCKS) {
      await expect(page.locator(toggleOf(id))).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(toggleOf(id))).toHaveAttribute('aria-label', `Hide ${label} (${count})`);
    }
  });
});

test.describe('nothing is remembered (FR-016)', () => {
  test.beforeEach(lightOnly);

  test('after expanding, the next page and a reload start closed', async ({ page }) => {
    await gotoUpgraded(page);
    for (const { id } of BLOCKS) await page.locator(toggleOf(id)).click();
    expect(await openStates(page)).toEqual([true, true, true, true]);

    await gotoUpgraded(page, ROUTES.blocks, 3);
    for (const { id } of [AUDIENCE, RELATED, REFS]) await expect(page.locator(`#${id}`)).not.toHaveAttribute('open');

    await gotoUpgraded(page);
    expect(await openStates(page)).toEqual([false, false, false, false]);
  });

  test('toggling a block adds no storage key; toggling the rail on the same page does', async ({ page }) => {
    await gotoUpgraded(page, WITH_RAIL, WITH_RAIL_BLOCKS);
    const keys = () => page.evaluate(() => [Object.keys(localStorage).sort(), Object.keys(sessionStorage).sort()]);
    const before = await keys();
    const toggles = await page.locator('.dk-disclosure__toggle').all();
    for (const toggle of toggles) await toggle.click();
    await expect(page.locator('.dk-disclosure > details[open]')).toHaveCount(WITH_RAIL_BLOCKS);
    for (const toggle of toggles) await toggle.click();
    expect(await keys()).toEqual(before);

    await expect(page.locator(TOC_RAIL_TOGGLE), 'control: the page has a rail').toBeVisible();
    await page.locator(TOC_RAIL_TOGGLE).click();
    const [local] = await keys();
    expect(local, 'control: the rail writes its key').toContain(RAIL_KEY);
    expect(before[0]).not.toContain(RAIL_KEY);
  });
});

test.describe('the upgrade (FR-017, ADR-0077)', () => {
  test.beforeEach(lightOnly);

  test('aria-controls names a real id, and the button sits directly before details', async ({ page }) => {
    await gotoUpgraded(page);
    for (const { id } of BLOCKS) {
      await expect(page.locator(toggleOf(id))).toHaveAttribute('aria-controls', id);
      const sibling = await page.locator(toggleOf(id)).evaluate((button) => button.nextElementSibling?.id);
      expect(sibling).toBe(id);
      await expect(page.locator(summaryOf(id)), 'the upgrade hides the summary').toBeHidden();
    }
  });

  test('upgrading again, through astro:page-load too, leaves one button', async ({ page }) => {
    await gotoUpgraded(page);
    const toggles = page.locator('.dk-disclosure__toggle');
    await expect(toggles).toHaveCount(BLOCKS.length);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('astro:page-load'));
      document.dispatchEvent(new Event('astro:page-load'));
    });
    await expect(toggles).toHaveCount(BLOCKS.length);
    await page.locator(toggleOf(RELATED.id)).click();
    await expect(page.locator(toggleOf(RELATED.id)), 'one listener: one click, one flip').toHaveAttribute('aria-expanded', 'true');
    expect((await openStates(page))[1]).toBe(true);
  });

  test('an external details.open change updates aria-expanded and the label', async ({ page }) => {
    await gotoUpgraded(page);
    const toggle = page.locator(toggleOf(GLOSSARY.id));
    const setOpen = (open: boolean) =>
      page.evaluate(({ id, open }) => {
        (document.getElementById(id) as HTMLDetailsElement).open = open;
      }, { id: GLOSSARY.id, open });
    await setOpen(true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Hide Glossary links used (2)');
    await setOpen(false);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-label', 'Show Glossary links used (2)');
  });

  test('a summary focused before the upgrade passes its focus to the button', async ({ page }) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(SCRIPT, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto(BOOK_ONE, { waitUntil: 'commit' });
    const summary = page.locator(summaryOf(RELATED.id));
    await expect(summary, 'before the upgrade the summary is the control').toBeVisible();
    await expect(page.locator('.dk-disclosure__toggle')).toHaveCount(0);
    await summary.focus();
    release();
    await expect(page.locator('.dk-disclosure--upgraded')).toHaveCount(BLOCKS.length);
    await expect(page.locator(toggleOf(RELATED.id))).toBeFocused();
  });

  test('the accessible name holds the visible label, there is no title, and the clone adds no id', async ({ page }) => {
    await gotoUpgraded(page);
    for (const { id, label, count } of BLOCKS) {
      const toggle = page.locator(toggleOf(id));
      const visible = (await toggle.textContent())?.replace(/\s+/g, ' ').trim();
      expect(visible).toBe(`${label} (${count})`);
      await expect(toggle).toHaveAccessibleName(`Show ${visible}`);
      await expect(toggle).not.toHaveAttribute('title');
    }
    const duplicated = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicated).toEqual([]);
    await expect(page.locator('.dk-disclosure__toggle [id]'), 'the clone drops any id').toHaveCount(0);
  });
});

test.describe('an upgrade moves nothing (NFR-006)', () => {
  test.beforeEach(lightOnly);

  test('open state and positions match with scripts on and off, closed and open', async ({ page, browser, baseURL }) => {
    const off = await scriptsOff(browser, baseURL);
    await off.goto(BOOK_ONE);
    await gotoUpgraded(page);
    await expect(off.locator('.dk-disclosure__toggle'), 'control: this page runs no script').toHaveCount(0);

    const closedOn = await layoutOf(page);
    const closedOff = await layoutOf(off);
    expect(closedOn.open).toEqual([false, false, false, false]);
    expect(closedOff).toEqual(closedOn);

    for (const { id } of BLOCKS) await page.locator(toggleOf(id)).click();
    for (const { id } of BLOCKS) await off.locator(summaryOf(id)).click();
    const openOn = await layoutOf(page);
    const openOff = await layoutOf(off);
    expect(openOn.open).toEqual([true, true, true, true]);
    expect(openOff).toEqual(openOn);
    expect(openOn.siteFooter[1], 'control: opening moved the page').toBeGreaterThan(closedOn.siteFooter[1]);
    await off.context().close();
  });
});

test.describe('the chevron', () => {
  test.beforeEach(lightOnly);

  /**
   * Which way the chevron's tip points on screen, from its computed transform. The
   * button's SVG draws its tip towards +x; the summary's CSS chevron is the corner
   * where its block-end and inline-end borders meet.
   */
  const tipOf = (page: Page, id: string, scripted: boolean) =>
    page.evaluate(
      ({ id, scripted }) => {
        const details = document.getElementById(id) as HTMLElement;
        const rtl = getComputedStyle(details).direction === 'rtl';
        const style = scripted
          ? getComputedStyle(document.querySelector(`[id="${id}-toggle"] > svg`) as Element)
          : getComputedStyle(details.querySelector(':scope > summary') as Element, '::before');
        const m = new DOMMatrix(style.transform === 'none' ? '' : style.transform);
        const [x, y] = scripted ? [1, 0] : [rtl ? -1 : 1, 1];
        return [Math.sign(Math.round((m.a * x + m.c * y) * 100)), Math.sign(Math.round((m.b * x + m.d * y) * 100))];
      },
      { id, scripted },
    );

  const RIGHT = [1, 0];
  const LEFT = [-1, 0];
  const DOWN = [0, 1];

  // Starlight sets `dir` on `<html>` and again on `<main>`. Untranslated fallback content
  // has `<html dir="rtl">` and `<main dir="ltr">`, and reads left to right.
  const CASES = [
    { name: 'ltr', closed: RIGHT, html: 'ltr', main: 'ltr' },
    { name: 'rtl', closed: LEFT, html: 'rtl', main: 'rtl' },
    { name: 'ltr fallback content on an rtl page', closed: RIGHT, html: 'rtl', main: 'ltr' },
  ] as const;

  for (const { name, closed, html, main } of CASES) {
    test(`${name}: inline end when closed, down when open, scripts on and off`, async ({ page, browser, baseURL }) => {
      const setDir = (target: Page) =>
        target.evaluate(
          ({ html, main }) => {
            document.documentElement.setAttribute('dir', html);
            document.querySelector('main')?.setAttribute('dir', main);
          },
          { html, main },
        );

      await gotoUpgraded(page);
      await setDir(page);
      expect(await tipOf(page, RELATED.id, true)).toEqual(closed);
      await page.locator(toggleOf(RELATED.id)).click();
      expect(await tipOf(page, RELATED.id, true)).toEqual(DOWN);

      const off = await scriptsOff(browser, baseURL);
      await off.goto(BOOK_ONE);
      await setDir(off);
      expect(await tipOf(off, RELATED.id, false)).toEqual(closed);
      await off.locator(summaryOf(RELATED.id)).click();
      expect(await tipOf(off, RELATED.id, false)).toEqual(DOWN);
      await off.context().close();
    });
  }
});

test.describe('targets and focus (NFR-003)', () => {
  test.beforeEach(lightOnly);

  const expectTargets = async (page: Page, where: string, atLeast: number) => {
    const targets = await collectTargets(page, ['blocks']);
    expect(targets.length, `${where}: the region holds its targets`).toBeGreaterThanOrEqual(atLeast);
    expect(targetSizeFailures(targets), where).toEqual([]);
  };

  test('at least 24x24, collapsed and expanded, scripted', async ({ page }) => {
    await gotoUpgraded(page);
    await expectTargets(page, 'collapsed', BLOCKS.length);
    for (const { id } of BLOCKS) {
      const box = await page.locator(toggleOf(id)).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(24);
      expect(box!.height).toBeGreaterThanOrEqual(24);
      await page.locator(toggleOf(id)).click();
    }
    await expectTargets(page, 'expanded', BLOCKS.length * 2);
  });

  test('at least 24x24, collapsed and expanded, scripts off', async ({ browser, baseURL }) => {
    const page = await scriptsOff(browser, baseURL);
    await page.goto(BOOK_ONE);
    await expectTargets(page, 'collapsed', BLOCKS.length);
    for (const { id } of BLOCKS) {
      const box = await page.locator(summaryOf(id)).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(24);
      await page.locator(summaryOf(id)).click();
    }
    await expectTargets(page, 'expanded', BLOCKS.length * 2);
    await page.context().close();
  });

  test('the focus ring survives forced colours', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await gotoUpgraded(page);
    const ring = (selector: string) =>
      page.locator(selector).evaluate((el) => {
        const style = getComputedStyle(el);
        return { style: style.outlineStyle, width: style.outlineWidth, colour: style.outlineColor };
      });
    const unfocused = await ring(toggleOf(REFS.id));
    expect(unfocused.style, 'control: no ring until it has focus').toBe('none');

    await page.locator(toggleOf(RELATED.id)).focus();
    await page.keyboard.press('Tab');
    await expect(page.locator(toggleOf(REFS.id))).toBeFocused();
    const focused = await ring(toggleOf(REFS.id));
    expect(focused.style).toBe('solid');
    expect(focused.width).toBe('2px');
    expect(focused.colour).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('print (FR-018)', () => {
  test.beforeEach(lightOnly);

  test('a closed block prints its content, with scripts on and off, and no chevron', async ({ page, browser, baseURL }) => {
    const off = await scriptsOff(browser, baseURL);
    await off.goto(BOOK_ONE);
    await gotoUpgraded(page);
    for (const [target, chevronHidden] of [
      [page, async () => expect(page.locator(`${toggleOf(RELATED.id)} > svg`)).toBeHidden()],
      [off, async () => {
        const display = await off.locator(summaryOf(RELATED.id)).evaluate((el) => getComputedStyle(el, '::before').display);
        expect(display).toBe('none');
      }],
    ] as const) {
      const link = target.locator(`#${RELATED.id} a`).first();
      await expect(link, 'control: on screen it is hidden').toBeHidden();
      await target.emulateMedia({ media: 'print' });
      await expect(target.locator(`#${RELATED.id}`)).not.toHaveAttribute('open');
      await expect(link).toBeVisible();
      expect((await link.boundingBox())!.height).toBeGreaterThan(0);
      await chevronHidden();
    }
    await off.context().close();
  });
});

test.describe('print fallback (FR-018)', () => {
  test.beforeEach(lightOnly);

  // Chromium has `::details-content`, so this tests the script, not the browsers without it.
  test('beforeprint opens the closed blocks and afterprint restores each one', async ({ page }) => {
    await gotoUpgraded(page);
    const blocks = page.locator('.dk-panel.dk-disclosure > details');
    const count = await blocks.count();
    expect(count).toBeGreaterThan(1);
    await blocks.first().evaluate((el: HTMLDetailsElement) => { el.open = true; });
    const states = () => blocks.evaluateAll((els) => els.map((el) => (el as HTMLDetailsElement).open));
    const before = await states();
    expect(before, 'control: one open, the rest closed').toEqual(before.map((_, i) => i === 0));
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    expect(await states()).toEqual(before.map(() => true));
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await states()).toEqual(before);
  });

  test('a second beforeprint before afterprint still restores each block', async ({ page }) => {
    await gotoUpgraded(page);
    const blocks = page.locator('.dk-panel.dk-disclosure > details');
    const states = () => blocks.evaluateAll((els) => els.map((el) => (el as HTMLDetailsElement).open));
    const before = await states();
    expect(before.length).toBeGreaterThan(1);
    expect(before, 'control: all closed').toEqual(before.map(() => false));
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeprint'));
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(await states()).toEqual(before.map(() => true));
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    expect(await states()).toEqual(before);
  });
});

test.describe('Axe (NFR-002)', () => {
  const BLOCKING = new Set(['serious', 'critical']);
  const pathFor = (testInfo: TestInfo) => (testInfo.project.name.startsWith('unthemed-') ? FIXTURE_PAGE : BOOK_ONE);

  async function expectClean(page: Page, where: string): Promise<void> {
    const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
    const blocking = results.violations
      .filter((v) => BLOCKING.has(v.impact ?? ''))
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    expect(blocking, where).toEqual([]);
    expect(results.passes.length, 'axe scanned something').toBeGreaterThan(0);
  }

  test('axe: clean with the blocks collapsed', async ({ page }, testInfo) => {
    await gotoInMode(page, pathFor(testInfo), modeOf(testInfo.project.name));
    await expect(page.locator('.dk-disclosure--upgraded')).toHaveCount(BLOCKS.length);
    await expect(page.locator('.dk-disclosure > details[open]')).toHaveCount(0);
    await expectClean(page, 'collapsed');
  });

  test('axe: clean with the blocks expanded, which brings their content into scope', async ({ page }, testInfo) => {
    await gotoInMode(page, pathFor(testInfo), modeOf(testInfo.project.name));
    await expect(page.locator('.dk-disclosure--upgraded')).toHaveCount(BLOCKS.length);
    for (const { id } of BLOCKS) await page.locator(toggleOf(id)).click();
    await expect(page.locator('.dk-disclosure > details[open]')).toHaveCount(BLOCKS.length);
    await expect(page.locator(`#${RELATED.id} a`).first()).toBeVisible();
    await expectClean(page, 'expanded');
  });
});
