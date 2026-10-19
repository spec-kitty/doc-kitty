// Persona card width and alignment (layout-guards-decisions-01M59CGE, WP05 T025 —
// FR-008; issue #206).
//
//   P1  the passport card (`.dk-passport`) starts where the reading column starts
//       (±1px) and is as wide as the metadata band: min(--dk-width-band, column)
//   P2  the card shares one start edge with the prose below it (±1px)
//   P3  `--dk-width-passport` is still the override hook: 32rem gives 512px
//
// Start-aligned, not centred: the owner's decision for #206. Centring the card
// put its title 329px to the right of the prose below it at 1920px.
//
// P2 note. The page's only `h1` is the card's name heading, which sits after the
// avatar inside the card, so it cannot share the card's start edge without a
// markup change. The edge the decision keeps is the one the card shares with
// the column and the body prose, which P1 and P2 assert.
//
// FAIL-FIRST (red) on the lane's pre-WP05 build, b1584cf: the card was 512px
// wide at 1280 and 1920, where 800px was expected.
//
// Geometry does not depend on the colour scheme, so this spec runs in the
// `light` project only.
import { test, expect, type Page } from '@playwright/test';
import { ROUTES } from './routes';
import { settle } from './helpers/geometry';

const HEIGHT = 900;
const TOLERANCE = 1;
const REM = 16;
/** `--dk-width-band`, the metadata band's width. */
const BAND = 50 * REM;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'geometry is identical in both colour schemes');
});

interface Edges {
  start: number;
  width: number;
}

async function measureCard(page: Page, width: number, css?: string) {
  await page.setViewportSize({ width, height: HEIGHT });
  await page.goto(ROUTES.persona, { waitUntil: 'load' });
  await expect(page.locator('.dk-passport'), 'non-vacuity: the persona card is rendered').toHaveCount(1);
  if (css) await page.addStyleTag({ content: css });
  await settle(page);
  return page.evaluate(() => {
    const ltr = getComputedStyle(document.documentElement).direction !== 'rtl';
    const vw = document.documentElement.clientWidth;
    const edges = (el: Element | null): Edges | null => {
      if (!el || el.getClientRects().length === 0) return null;
      const r = el.getBoundingClientRect();
      return { start: ltr ? r.x : vw - r.right, width: r.width };
    };
    const card = document.querySelector('.dk-passport');
    return {
      card: edges(card),
      column: edges(card ? card.closest('.sl-container') : null),
      prose: edges(document.querySelector('.sl-markdown-content > p')),
    };
  });
}

function near(actual: number, expected: number, label: string): void {
  expect
    .soft(Math.abs(actual - expected), `${label}: measured ${actual}px, expected ${expected}px (tolerance ${TOLERANCE}px)`)
    .toBeLessThanOrEqual(TOLERANCE);
}

test.describe('persona card — start-aligned at band width (#206)', () => {
  for (const width of [1920, 1280]) {
    test(`P1, P2 ${width}px: the card starts at the column and is band-wide`, async ({ page }) => {
      const m = await measureCard(page, width);
      if (!m.card || !m.column || !m.prose) throw new Error(`persona: missing card, column or prose at ${width}px`);
      near(m.card.start, m.column.start, `P1 ${width}px card start vs column start`);
      near(m.card.width, Math.min(BAND, m.column.width), `P1 ${width}px card width vs min(band, column)`);
      near(m.prose.start, m.card.start, `P2 ${width}px prose start vs card start`);
    });
  }

  test('P3 1920px: `--dk-width-passport: 32rem` narrows the card to 512px', async ({ page }) => {
    const m = await measureCard(page, 1920, ':root { --dk-width-passport: 32rem }');
    if (!m.card || !m.column) throw new Error('persona: missing card or column');
    near(m.card.width, 32 * REM, 'P3 card width under the override');
    near(m.card.start, m.column.start, 'P3 card start vs column start');
  });
});
