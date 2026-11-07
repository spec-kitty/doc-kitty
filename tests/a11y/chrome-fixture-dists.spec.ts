// Each chrome fixture project serves the site it claims to (page-chrome WP11): without
// this, a spec needing other options could silently run against the wrong dist. It is
// also what makes `playwright test --list` show those projects before their specs land.
import { expect, test } from '@playwright/test';

const BRAND_ACCENT = '#f5c518';

test('fixture dist: serves the chrome fixture, with the theme its project asks for', async ({ page }, testInfo) => {
  const response = await page.goto('/doc-kitty/guides/getting-started/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Chrome fixture/);
  await expect(page.locator('.dk-panel')).toHaveCount(4);

  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--dk-color-accent').trim().toLowerCase(),
  );
  if (testInfo.project.name.startsWith('unthemed-')) expect(accent).not.toBe(BRAND_ACCENT);
  else expect(accent).toBe(BRAND_ACCENT);
});
