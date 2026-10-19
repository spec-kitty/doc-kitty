// FR-010 guard: the reading column is centred on a page with an outline rail and
// no left sidebar (layout-guards-decisions WP06 T031; issue #199; mission
// sidebar-frame-header-carrier-01M4T3CB FR-010, until now a code-review item).
//
// The page is a real rail page turned into its no-sidebar twin in the browser
// (`helpers/no-sidebar.ts` says why that equals a `hasSidebar={false}` page and
// why no fixture page is added). Measured per width and rail state:
//   R0  collapsed: the rail column is the 1px hairline, exactly (as
//       layout-geometry A8: a 1px tolerance on a 1px box would accept 0 and 2)
//   R1  collapsed: the column is centred in the frame (`.main-frame`, capped at
//       120rem by ADR-0064) less the 1px hairline, i.e. between the frame start
//       and the rail column's start, less the padding, +-1px
//   R2  expanded: the column is centred between the frame start and the rail
//       start, less the padding, +-1px
//   R3  the column is `min(960, available)` wide, +-1px
//   R4  no horizontal page scroll
//   R5  the padding is the pinned value: start 24px (`--sl-content-pad-x`) in
//       every cell; end 24px too, except collapsed below 84rem, where it is the
//       toggle's 32px plus 4px = 36px (#217)
//
// The reference end is the rail column's start in BOTH states: that is where the
// pane ends (A8 collapsed, A3 expanded), so the hairline is not hidden in the
// tolerance and +-1px is symmetric (`layout-geometry.spec.ts` A10 centres against
// the pane end the same way).
//
// Why "less the padding" (R1). Below 84rem the collapsed pane's end padding is
// widened past the toggle (#217, toc-rail.css), so the padded area is not
// symmetric there. The paddings are read from the page and subtracted, and R5
// pins them, so neither a margin that moves the column (the positive control
// below) nor an uneven-padding regression that moves the reference with it can
// pass.
//
// Measured on 2026-10-19 (fresh `pnpm build:a11y`): the gaps are equal in every
// cell (|start - end| = 0). Collapsed, 455.5 / 455.5 at 1920px; expanded, 152/152
// at 1600 and 312/312 from 1920; at 1152 and 1280 the column fills its space, so
// both gaps are 0.
//
// FAIL-FIRST (T035): the FR-010 selector in toc-rail.css is redundant on Starlight
// 0.42 (Starlight already centres a sidebar-less pane), so deleting it does not
// make this spec red. The positive control breaks the pane's inline margin
// instead and asserts R1 then fails. With the same mutation forced into every
// cell, 8 of the 10 cells went red (gaps 911 / 0 at 1920px collapsed); 1152 and
// 1280 expanded stayed green because a column that fills its space has no margin
// to move, which is correct. Tolerance symmetry (cycle 2, column shifted with
// `position:relative`): 1px toward the start and 1px toward the end each turn all
// 10 cells red in R1/R2 (e.g. 1920 collapsed 454.5 / 456.5 and 456.5 / 454.5);
// 0.5px either way stays green (|diff| = 1). A 40px panel start padding turns all
// 10 cells red in R5 while R1 stays green, which is why R5 pins the paddings.
// (Recorded in the WP06 history.)
//
// Geometry does not depend on the colour scheme, so this spec runs in the `light`
// project and skips in `dark` (as layout-geometry.spec.ts).
import { test, expect, type Page } from '@playwright/test';
import { ROUTES, TOC_RAIL_TOGGLE } from './routes';
import { measure, settle, inline, type Box, type Geometry } from './helpers/geometry';
import { simulateNoSidebar } from './helpers/no-sidebar';

const ROUTE = ROUTES.markuaShowcase;
const WIDTHS = [1152, 1280, 1600, 1920, 2560] as const;
const HEIGHT = 900;
/** NFR-001. */
const TOLERANCE = 1;
/** `--dk-width-content`, 60rem: the reading measure. */
const MEASURE = 960;
/** The collapsed preference, exactly as the client stores it. */
const COLLAPSED_KEY = 'dk-toc-collapsed';
/** `--sl-content-pad-x`, 1.5rem: the start padding everywhere, the end padding mostly. */
const PAD_X = 24;
/** `--dk-toc-toggle-size` (2rem) + 4px: the collapsed end padding below 84rem (#217). */
const PAD_END_NARROW_COLLAPSED = 32 + 4;
/** 84rem: from here the column is narrower than its pane (toc-rail.css #217). */
const WIDE = 1344;
/** Breaks the pane's centring margin; the column is pushed to the frame end. */
const RECENTRE_MUTATION = 'html .main-pane { --sl-content-margin-inline: auto 0 !important; }';

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'geometry is identical in both colour schemes');
});

interface Pads {
  paneStart: number;
  paneEnd: number;
  panelStart: number;
  panelEnd: number;
}

type Measured = Geometry & { pads: Pads };

/**
 * Order: the collapsed preference is stored before navigation, so the page's
 * head script applies it at parse time, as on any real load. The sidebar is
 * removed after load. A real `hasSidebar={false}` page never has the sidebar, so
 * what matters is the end state; both inputs are plain attribute and DOM states
 * that the CSS reads at layout, and the toggle script does not read the sidebar,
 * so the order of the two does not change the measured layout.
 */
async function load(page: Page, width: number, collapsed: boolean, css?: string): Promise<Measured> {
  await page.setViewportSize({ width, height: HEIGHT });
  if (collapsed) {
    await page.addInitScript((key) => {
      try {
        window.localStorage.setItem(key, '1');
      } catch {
        /* storage unavailable: the state assertion below fails loudly */
      }
    }, COLLAPSED_KEY);
  }
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' });
  // Non-vacuity: this is a rail page. Without an outline FR-010 does not apply.
  await expect(page.locator('.right-sidebar-panel starlight-toc a').first(), 'the page has an outline').toBeAttached();
  await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
  const html = page.locator('html');
  if (collapsed) await expect(html).toHaveAttribute('data-toc-collapsed', '');
  else await expect(html).not.toHaveAttribute('data-toc-collapsed', /.*/);

  await simulateNoSidebar(page);
  if (css) await page.addStyleTag({ content: css });
  await settle(page);
  const g = await measure(page);
  expect(g.sidebar, 'the sidebar pane is not rendered').toBeNull();
  expect(g.railContainer, 'the rail column is rendered').not.toBeNull();
  const pads = await page.evaluate(() => {
    const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
    const side = (el: Element | null) => {
      if (!el) return { start: 0, end: 0 };
      const cs = getComputedStyle(el);
      const left = parseFloat(cs.paddingLeft);
      const right = parseFloat(cs.paddingRight);
      return rtl ? { start: right, end: left } : { start: left, end: right };
    };
    const panel = document.querySelector('.sl-markdown-content')?.closest('.content-panel') ?? null;
    const pane = side(document.querySelector('.main-pane'));
    const p = side(panel);
    return { paneStart: pane.start, paneEnd: pane.end, panelStart: p.start, panelEnd: p.end };
  });
  return { ...g, pads };
}

function need(box: Box | null, name: string): Box {
  if (!box) throw new Error(`geometry: "${name}" is not rendered on ${ROUTE}`);
  return box;
}

interface Centring {
  startGap: number;
  endGap: number;
  available: number;
  column: number;
  summary: string;
}

/**
 * The column's gaps in the reference span, less the paddings. The span runs from
 * the frame start to the rail column's start in both states: collapsed, that
 * column is the 1px hairline (R0), so the span is the frame less the hairline.
 */
function centring(g: Measured): Centring {
  const frame = inline(need(g.frame, 'frame'), g);
  const column = inline(need(g.column, 'column'), g);
  const end = inline(need(g.railContainer, 'railContainer'), g).start;
  const padStart = g.pads.paneStart + g.pads.panelStart;
  const padEnd = g.pads.paneEnd + g.pads.panelEnd;
  const startGap = Math.round((column.start - frame.start - padStart) * 100) / 100;
  const endGap = Math.round((end - padEnd - column.end) * 100) / 100;
  const available = end - frame.start - padStart - padEnd;
  return {
    startGap,
    endGap,
    available,
    column: column.width,
    summary:
      `frame ${frame.start}..${frame.end}, reference end ${end}, column ${column.start}..${column.end}, ` +
      `padding ${padStart}/${padEnd}: gaps ${startGap} / ${endGap}`,
  };
}

test.describe('FR-010: no left sidebar, the column is centred', () => {
  for (const width of WIDTHS) {
    for (const collapsed of [true, false]) {
      const state = collapsed ? 'collapsed' : 'expanded';
      test(`${width}px ${state}: centred, min(960, available) wide, no sideways scroll`, async ({ page }) => {
        const g = await load(page, width, collapsed);
        const c = centring(g);
        test.info().annotations.push({ type: 'measured', description: `${c.summary}; column ${c.column}, available ${c.available}` });
        if (collapsed) {
          expect.soft(inline(need(g.railContainer, 'railContainer'), g).width, `R0 collapsed rail column width at ${width}px`).toBe(1);
        }
        const padStart = g.pads.paneStart + g.pads.panelStart;
        const padEnd = g.pads.paneEnd + g.pads.panelEnd;
        const expectedEnd = collapsed && width < WIDE ? PAD_END_NARROW_COLLAPSED : PAD_X;
        expect.soft(padStart, `R5 start padding at ${width}px ${state}`).toBe(PAD_X);
        expect.soft(padEnd, `R5 end padding at ${width}px ${state}`).toBe(expectedEnd);
        if (width >= WIDE) expect.soft(padStart, `R5 start vs end padding from 84rem, ${width}px ${state}`).toBe(padEnd);
        const id = collapsed ? 'R1 collapsed: centred in the frame' : 'R2 expanded: centred between frame start and rail';
        expect.soft(Math.abs(c.startGap - c.endGap), `${id} at ${width}px (${c.summary})`).toBeLessThanOrEqual(TOLERANCE);
        const expected = Math.min(MEASURE, c.available);
        expect
          .soft(Math.abs(c.column - expected), `R3 column ${c.column}px vs min(960, ${c.available}) at ${width}px ${state}`)
          .toBeLessThanOrEqual(TOLERANCE);
        expect.soft(g.scrollWidth, `R4 scrollWidth vs clientWidth at ${width}px ${state}`).toBe(g.viewportWidth);
      });
    }
  }

  test('positive control: with the pane margin broken, R1 fails at 1920px collapsed', async ({ page }) => {
    const g = await load(page, 1920, true, RECENTRE_MUTATION);
    const c = centring(g);
    test.info().annotations.push({ type: 'measured', description: c.summary });
    // The mutation pushes the 960px column to the end of its padded area.
    expect(Math.abs(c.startGap - c.endGap), `the probe sees the broken centring (${c.summary})`).toBeGreaterThan(
      TOLERANCE,
    );
  });
});
