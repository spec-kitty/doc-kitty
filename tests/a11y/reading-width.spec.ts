// Reading width (reading-width-01M4X4XG, issue 154, ADR-0053).
//
// The default reading column is `--dk-width-content: 60rem` (960px) and all body
// content shares it: the column is the smaller of that token and the reading pane.
//
//   W1  1440px, sidebar + rail: the column fills the reading pane (816px < 960px)
//   W2  1920px: the column is centred in the pane (its 960px width is pinned by
//       EXPANDED_MEASURE in layout-geometry.spec.ts)
//   W3  `--dk-width-content: 45rem` restores the 720px column (the documented way back)
//   R1  the column never reaches under the rail: expanded, collapsed, and under a
//       frame cap, and it stays inside the pane
//   U1  below 72rem the column fills its pane (small screens unchanged)
//
// The "reading pane" is the content box of the `.content-panel` that holds the
// article: the pane between sidebar and rail, without its inline padding. Every
// case also checks that the page does not scroll sideways.
//
// Tolerance is 1 CSS pixel. Geometry does not depend on the colour scheme, so
// this spec runs in the `light` project only.
import { test, expect, type Page } from '@playwright/test';
import { TOC_RAIL_ROUTE, TOC_RAIL_TOGGLE } from './routes';
import { measure, settle, inline, type Box, type Geometry } from './helpers/geometry';

const HEIGHT = 900;
const TOLERANCE = 1;
const REM = 16;
const DEFAULT_COLUMN = 60 * REM;
const COLLAPSED_KEY = 'dk-toc-collapsed';
const PATH = TOC_RAIL_ROUTE.path;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'geometry is identical in both colour schemes');
});

interface Load {
  width: number;
  collapsed?: boolean;
  css?: string;
}

interface Reading {
  g: Geometry;
  /** The reading pane's content box. */
  pane: Box;
  /** The article column. */
  column: Box;
}

async function read(page: Page, opts: Load): Promise<Reading> {
  await page.setViewportSize({ width: opts.width, height: HEIGHT });
  if (opts.collapsed) {
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, '1');
      } catch {
        /* storage unavailable: the state assertion below fails loudly */
      }
    }, COLLAPSED_KEY);
  }
  await page.goto(PATH, { waitUntil: 'load' });
  if (opts.collapsed) await expect(page.locator('html')).toHaveAttribute('data-toc-collapsed', '');
  if (opts.css) await page.addStyleTag({ content: opts.css });
  await settle(page);
  const g = await measure(page);
  const pane = await page.evaluate(() => {
    const panel = document.querySelector('.sl-markdown-content')?.closest('.content-panel');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const cs = getComputedStyle(panel);
    const start = parseFloat(cs.paddingLeft);
    const end = parseFloat(cs.paddingRight);
    const x = r.x + start;
    const width = r.width - start - end;
    return { x, y: r.y, width, height: r.height, right: x + width, bottom: r.bottom };
  });
  if (!pane) throw new Error(`reading-width: no article on ${PATH}`);
  if (!g.column) throw new Error(`reading-width: no reading column on ${PATH}`);
  expect.soft(g.scrollWidth, `${PATH} at ${opts.width}px scrolls sideways`).toBe(g.viewportWidth);
  return { g, column: g.column, pane };
}

function near(actual: number, expected: number, label: string): void {
  expect
    .soft(
      Math.abs(actual - expected),
      `${label}: measured ${actual}px, expected ${expected}px (tolerance ${TOLERANCE}px)`,
    )
    .toBeLessThanOrEqual(TOLERANCE);
}

/** The column is inside the pane: never under the rail or the sidebar. */
function assertInPane(r: Reading, label: string): void {
  const column = inline(r.column, r.g);
  const pane = inline(r.pane, r.g);
  expect.soft(column.start, `${label}: column start vs pane start`).toBeGreaterThanOrEqual(pane.start - TOLERANCE);
  expect.soft(column.end, `${label}: column end vs pane end`).toBeLessThanOrEqual(pane.end + TOLERANCE);
}

test.describe('reading width', () => {
  const load = async (page: Page, opts: Load) => {
    const r = await read(page, opts);
    await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
    return r;
  };

  test('W1 1440px: the column fills the reading pane', async ({ page }) => {
    const r = await load(page, { width: 1440 });
    near(r.column.width, r.pane.width, 'W1 column width vs pane content width');
  });

  test('W2 1920px: the column is centred in the pane', async ({ page }) => {
    const r = await load(page, { width: 1920 });
    near(inline(r.column, r.g).centre, inline(r.pane, r.g).centre, 'W2 column centre vs pane centre');
  });

  test('W3 1920px: --dk-width-content: 45rem restores the 720px column', async ({ page }) => {
    const r = await load(page, { width: 1920, css: ':root { --dk-width-content: 45rem }' });
    near(r.column.width, 45 * REM, 'W3 column width under the restore line');
  });

  test('R1 2560px expanded: the column stays clear of the rail', async ({ page }) => {
    const r = await load(page, { width: 2560 });
    assertInPane(r, 'R1 expanded');
    expect
      .soft(inline(r.column, r.g).end, 'R1 expanded: column end vs rail start')
      .toBeLessThanOrEqual(inline(r.g.railContainer!, r.g).start + TOLERANCE);
  });

  test('R1 2560px collapsed: the column stays clear of the rail hairline', async ({ page }) => {
    const r = await load(page, { width: 2560, collapsed: true });
    assertInPane(r, 'R1 collapsed');
    expect
      .soft(inline(r.column, r.g).end, 'R1 collapsed: column end vs rail hairline start')
      .toBeLessThanOrEqual(inline(r.g.railContainer!, r.g).start + TOLERANCE);
  });

  test('R1 1920px under a 70rem frame cap: the column follows the capped pane', async ({ page }) => {
    const r = await load(page, { width: 1920, css: ':root { --dk-width-frame: 70rem }' });
    assertInPane(r, 'R1 capped');
    const frame = inline(r.g.frame!, r.g);
    expect.soft(inline(r.column, r.g).end, 'R1 capped: column end vs frame end').toBeLessThanOrEqual(frame.end + TOLERANCE);
    expect.soft(r.column.width, 'R1 capped: the cap narrows the column below 60rem').toBeLessThan(DEFAULT_COLUMN - TOLERANCE);
  });

  // Below 72rem the column fills its pane: nothing about phones and tablets moves.
  for (const width of [390, 768, 1024]) {
    test(`U1 ${width}px: the column fills its pane`, async ({ page }) => {
      const r = await read(page, { width });
      near(r.column.width, r.pane.width, `U1 ${width}px column width vs pane content width`);
    });
  }
});
