// Both-modes drive PROBE (WP09 T039 validation).
//
// Proves the dark project genuinely renders dark and the light project genuinely
// renders light — the guard against a config that silently runs one mode twice.
// gotoInMode() already asserts data-theme + background luminance per mode; this spec
// additionally pins the exact resolved attribute so the drive mechanism is a named,
// standalone contract.
import { test, expect } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf } from './mode';

test('colour mode is genuinely applied on the brand home', async ({ page }, testInfo) => {
  const mode = modeOf(testInfo.project.name);
  await gotoInMode(page, ROUTES.home, mode);
  await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
});
