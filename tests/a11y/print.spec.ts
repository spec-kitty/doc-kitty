// The page print layer (#378, #390): print media in both colour modes.
//
// For each fixture page and each project mode, the page is opened in that mode, the
// print layer's `beforeprint` hook is fired and print media is emulated. The checks:
//   - the header bar, sidebar and TOC rail are not displayed;
//   - no lightbox trigger is laid out;
//   - the page background is light;
//   - the diagram tokens resolve to their light values (on a page with a diagram);
//   - the page identity (title, metadata band) still prints.
// A second test prints the dark mode WITHOUT the event (a browser that never fires
// `beforeprint`): the generated print-token fallback must still give a light page.
// A third covers a page with client-mode diagrams (`pre.mermaid`): the hook leaves its
// theme alone, so the renderer's redraw cannot reset the diagrams mid-print, and the
// fallback alone prints it light.
// Tabs: no tabs component exists in this repository (FR-008a descope), so no tab case.
import { expect, test, type Page } from '@playwright/test';
import { gotoInMode, modeOf } from './mode';
import { ROUTES } from './routes';

const PAGES = [
  { name: 'diagram demonstrator', path: ROUTES.diagram, diagram: true },
  { name: 'Markua showcase', path: ROUTES.markuaShowcase, diagram: false },
  { name: 'Gherkin feature page', path: ROUTES.behaviourFeature, diagram: false },
  { name: 'OpenAPI operation page', path: ROUTES.openApiOperation, diagram: false },
];

/** Relative luminance 0..255 of a computed `rgb()`/`rgba()` colour. */
async function bodyLuminance(page: Page): Promise<number> {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bg.match(/[\d.]+/g) ?? []).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relative luminance 0..255 of the body text colour. */
async function textLuminance(page: Page): Promise<number> {
  const fg = await page.evaluate(() => getComputedStyle(document.body).color);
  const [r, g, b] = (fg.match(/[\d.]+/g) ?? []).map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The value a custom property resolves to on the root, as the browser computes it. */
const rootToken = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** The value the same token takes in the light theme, on screen. */
async function lightValue(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const root = document.documentElement;
    const before = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    const value = getComputedStyle(root).getPropertyValue(n).trim();
    if (before === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', before);
    return value;
  }, name);
}

async function expectChromeHidden(page: Page): Promise<void> {
  for (const selector of ['.page > header.header', 'nav.sidebar', '.right-sidebar-container']) {
    const shown = await page.locator(selector).evaluateAll((els) =>
      els.some((el) => getComputedStyle(el).display !== 'none'),
    );
    expect(shown, `${selector} is not displayed in print`).toBe(false);
  }
  const laidOutTriggers = await page.locator('.dk-lightbox__trigger').evaluateAll((els) =>
    els.filter((el) => el.getClientRects().length > 0).length,
  );
  expect(laidOutTriggers, 'no lightbox trigger is laid out in print').toBe(0);
}

for (const fixture of PAGES) {
  test(`print media: ${fixture.name} prints light with the screen chrome hidden`, async ({ page }, testInfo) => {
    const mode = modeOf(testInfo.project.name);
    await gotoInMode(page, fixture.path, mode);
    const lightNodeFill = fixture.diagram ? await lightValue(page, '--dk-diagram-node-fill') : '';
    const screenNodeFill = fixture.diagram ? await rootToken(page, '--dk-diagram-node-fill') : '';

    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({ media: 'print' });

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expectChromeHidden(page);
    expect(await bodyLuminance(page), 'the page background prints light').toBeGreaterThan(230);
    expect(await textLuminance(page), 'the text prints dark').toBeLessThan(100);
    await expect(page.locator('h1#_top')).toBeVisible();
    await expect(page.locator('.dk-metadata-band').first()).toBeVisible();

    if (fixture.diagram) {
      await expect(page.locator('.dk-diagram svg').first()).toBeVisible();
      expect(await rootToken(page, '--dk-diagram-node-fill')).toBe(lightNodeFill);
      // And a drawn node really paints with it: some shape in the diagram resolves its
      // fill to the light token's colour.
      const lightRgb = await page.evaluate((value) => {
        const probe = document.createElement('div');
        probe.style.color = value;
        document.body.append(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return rgb;
      }, lightNodeFill);
      const fills = await page.locator('.dk-diagram svg').first().evaluate((svg) =>
        [...svg.querySelectorAll('rect, polygon, path, circle, ellipse')].map((el) => getComputedStyle(el).fill),
      );
      expect(fills, 'a diagram node is painted with the light node fill').toContain(lightRgb);
      // Control: in the dark mode the screen value differs, so the check above is not vacuous.
      if (mode === 'dark') expect(screenNodeFill).not.toBe(lightNodeFill);
    }

    // `afterprint` restores the reader's theme and writes nothing to storage.
    const stored = await page.evaluate(() => window.localStorage.getItem('starlight-theme'));
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    expect(await page.evaluate(() => window.localStorage.getItem('starlight-theme'))).toBe(stored);
  });
}

// The dark theme is opened in both projects: this case is about the dark theme only.
test('print media without beforeprint: the generated fallback still prints a dark page light', async ({ page }) => {
  await gotoInMode(page, ROUTES.prose, 'dark');
  expect(await textLuminance(page), 'control: on screen the dark theme has light text').toBeGreaterThan(150);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bodyLuminance(page), 'the page background prints light').toBeGreaterThan(230);
  // The text colour comes from the tokens alone, so this is the fallback's own effect.
  expect(await textLuminance(page), 'the fallback prints the text dark').toBeLessThan(100);
  await expectChromeHidden(page);
});

// The dark theme is opened in both projects. This lane builds diagrams at build time, so
// a client-mode diagram node is planted to put the page in that state.
test('print media with client-mode diagrams: the hook keeps the theme, the fallback prints light', async ({ page }) => {
  await gotoInMode(page, ROUTES.prose, 'dark');
  await page.evaluate(() => {
    const node = document.createElement('pre');
    node.className = 'mermaid';
    node.textContent = 'graph TD; A-->B';
    document.querySelector('main')?.append(node);
  });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('html'), 'the hook does not switch a page with client-mode diagrams').toHaveAttribute(
    'data-theme',
    'dark',
  );
  expect(await bodyLuminance(page), 'the page background prints light').toBeGreaterThan(230);
  expect(await textLuminance(page), 'the text prints dark').toBeLessThan(100);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
