// GitHub alerts render + theme (#250, ADR-0068) — the direct (Playwright, not axe)
// half of the GitHub-alert contract. axe (axe.spec.ts) scans the fixture for WCAG
// violations in both colour modes; this spec asserts, in both modes:
//   - each of the five `> [!TYPE]` alerts renders as the mapped native aside, with
//     the GitHub label as its visible title and accessible name;
//   - the three non-alerts (plain quote, unknown `[!DANGER]`, marker + inline text)
//     stay blockquotes, with their text intact;
//   - each alert aside is themed exactly like the native aside the Markua callouts
//     render for the same variant (`/guides/markua-showcase/`), so the two
//     syntaxes cannot drift apart visually.
import { test, expect, type Page } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf, type Mode } from './mode';

const ALERTS = [
  { type: 'NOTE', variant: 'note', title: 'Note' },
  { type: 'TIP', variant: 'tip', title: 'Tip' },
  { type: 'IMPORTANT', variant: 'note', title: 'Important' },
  { type: 'WARNING', variant: 'caution', title: 'Warning' },
  { type: 'CAUTION', variant: 'danger', title: 'Caution' },
] as const;

/** The computed styles that carry an aside's theme. */
async function themeOf(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const title = el.querySelector('.starlight-aside__title');
    return {
      backgroundColor: cs.backgroundColor,
      borderInlineStartColor: cs.borderInlineStartColor,
      borderInlineStartStyle: cs.borderInlineStartStyle,
      titleColor: title ? getComputedStyle(title).color : null,
    };
  });
}

test.describe('github-alerts render (#250)', () => {
  test('the five alert types render as the mapped native asides', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.githubAlerts, mode);

    const content = page.locator('main .sl-markdown-content');
    for (const { type, variant, title } of ALERTS) {
      const aside = content.locator(`aside.starlight-aside--${variant}[aria-label="${title}"]`);
      await expect(aside, `[!${type}] → aside.starlight-aside--${variant} named "${title}"`).toHaveCount(
        type === 'TIP' ? 2 : 1,
      );
      await expect(aside.first().locator('.starlight-aside__title')).toHaveText(title);
      await expect(aside.first().locator('.starlight-aside__content')).toHaveCount(1);
    }
    // The marker text never survives into an aside.
    const asideText = await content.locator('aside.starlight-aside').allTextContents();
    expect(asideText).toHaveLength(6);
    for (const text of asideText) expect(text).not.toContain('[!');
  });

  test('a multi-block alert keeps every block inside the aside', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.githubAlerts, modeOf(testInfo.project.name));
    const multi = page.locator('main aside.starlight-aside--tip').nth(1).locator('.starlight-aside__content');
    await expect(multi.locator('p')).toHaveCount(1);
    await expect(multi.locator('ul > li')).toHaveCount(2);
  });

  test('a plain quote, an unknown marker and an inline marker stay blockquotes', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.githubAlerts, modeOf(testInfo.project.name));
    const quotes = page.locator('main .sl-markdown-content blockquote');
    await expect(quotes).toHaveCount(3);
    await expect(quotes.nth(0)).toContainText('A plain quotation, with no marker.');
    await expect(quotes.nth(1)).toContainText('[!DANGER]');
    await expect(quotes.nth(2)).toContainText('[!NOTE] This line keeps its literal marker.');
  });
});

test.describe('github-alerts theme parity with Markua asides (#250)', () => {
  for (const variant of ['note', 'tip', 'caution', 'danger'] as const) {
    test(`a "${variant}" alert is themed like the Markua "${variant}" aside`, async ({ page }, testInfo) => {
      const mode: Mode = modeOf(testInfo.project.name);
      await gotoInMode(page, ROUTES.markuaShowcase, mode);
      const markua = await themeOf(page, `main aside.starlight-aside--${variant}`);

      await gotoInMode(page, ROUTES.githubAlerts, mode);
      const alert = await themeOf(page, `main aside.starlight-aside--${variant}`);

      expect(alert.backgroundColor, 'the aside background must resolve, not fall back to transparent').not.toBe(
        'rgba(0, 0, 0, 0)',
      );
      expect(alert.borderInlineStartStyle).toBe('solid');
      expect(alert, `${mode}: the alert aside must compute the same theme as the Markua one`).toEqual(markua);
    });
  }
});
