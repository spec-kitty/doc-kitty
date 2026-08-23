// Bounded visual-regression baseline (WP09 T041).
//
// A small, deterministic screenshot contract for the brand home in both modes with an
// explicit pixel-diff budget (playwright.config.ts: maxDiffPixelRatio 0.01). A no-op
// visual check cannot pass: a token colour shift beyond the budget turns this red.
//
// Determinism: fixed viewport + reducedMotion (config), fonts awaited before the
// snapshot, and animations disabled at capture. Baselines live under
// tests/a11y/__screenshots__/ and are meant to be generated in the CI container.
import { test, expect } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf } from './mode';

test('brand home visual baseline', async ({ page }, testInfo) => {
  const mode = modeOf(testInfo.project.name);
  await gotoInMode(page, ROUTES.home, mode);

  // Gate on font readiness so glyph metrics are stable before capture.
  await page.evaluate(() => document.fonts.ready);

  // Project name (light/dark) is appended by snapshotPathTemplate.
  await expect(page).toHaveScreenshot('home.png', {
    fullPage: false,
    animations: 'disabled',
  });
});
