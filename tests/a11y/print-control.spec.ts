// The print control (#379, ADR-0081), on the unthemed chrome fixture dist, which turns
// it on and gives the `guides` section its own PDF (CHROME_DISTS in the chrome harness).
// Runs in the `unthemed-light` and `unthemed-dark` projects only (playwright.config.ts);
// their grep keeps titles that name "axe" or "fixture dist", as these do.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { WCAG_TAGS } from './routes';
import { gotoInMode, modeOf } from './mode';

const IN_PDF_SECTION = '/doc-kitty/guides/getting-started/';
const OUTSIDE = '/doc-kitty/context/';

test('print control fixture dist: prints the page and offers the section PDF', async ({ page }, testInfo) => {
  await gotoInMode(page, IN_PDF_SECTION, modeOf(testInfo.project.name));
  const control = page.locator('.dk-print-control');
  await expect(control).toHaveCount(1);
  const button = control.getByRole('button', { name: 'Print / Save as PDF' });
  await expect(button).toBeVisible();
  const download = control.getByRole('link', { name: 'Download section PDF' });
  await expect(download).toHaveAttribute('href', '/doc-kitty/pdf/guides.pdf');

  // Activating the button with the keyboard calls window.print().
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => {
      (window as unknown as { printed: number }).printed += 1;
    };
  });
  await button.focus();
  await expect(button).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

  // Targets meet the 24 px minimum (WCAG 2.2 2.5.8).
  for (const target of [button, download]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(24);
  }

  // On paper the control itself is hidden.
  await page.emulateMedia({ media: 'print' });
  await expect(control).toBeHidden();
});

test('print control fixture dist: no download link outside a PDF section', async ({ page }, testInfo) => {
  await gotoInMode(page, OUTSIDE, modeOf(testInfo.project.name));
  const control = page.locator('.dk-print-control');
  await expect(control.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
  await expect(control.getByRole('link')).toHaveCount(0);
});

test('print control fixture dist: no control on the print document itself', async ({ page }, testInfo) => {
  await gotoInMode(page, '/doc-kitty/print/guides/', modeOf(testInfo.project.name));
  await expect(page.locator('.dk-print-document')).toHaveCount(1);
  await expect(page.locator('.dk-print-control')).toHaveCount(0);
});

test('print control axe: no WCAG violation in either mode', async ({ page }, testInfo) => {
  await gotoInMode(page, IN_PDF_SECTION, modeOf(testInfo.project.name));
  const results = await new AxeBuilder({ page }).include('.dk-print-control').withTags([...WCAG_TAGS]).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
