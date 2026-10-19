// Frame geometry decisions (layout-guards-decisions-01M59CGE, WP05 T022..T024 —
// FR-005, FR-006, FR-007, NFR-006, SC-001, SC-004; issues #216, #217, #205;
// ADR-0064).
//
//   S1  #216  the header search starts where the reading column starts (±1px):
//             rail page expanded and collapsed, no-rail page; 1440, 1920, 2560;
//             default frame, `100%` and a 90rem cap
//   T1  #217  with the rail collapsed, the column box ends >= 4px before the
//             toggle at every width from 72rem; right-to-left mirrors it
//   C1  #205  the frame defaults to 120rem: at 2560px it is 1920px wide and
//             centred, with 192px beside the column on each side of a rail page
//   C2  #205  `:root { --dk-width-frame: 100% }` restores the full-width frame
//   N1  NFR-006  column x and width at 1920px and narrower match NARROW_BASELINE
//
// S1 and the site title. Starlight's first header track is `minmax(<length>,
// auto)`, so a site title wider than the space before the column pushes the
// search to the title's end plus the nav gap instead of overlapping it (WP05
// T027 step 3 keeps that). On the example site the title ("DocKitty Example"
// and its logo) is wider than that space at 1440px on a rail page, expanded,
// where the column starts 312px into the frame (so also under the 90rem cap,
// where the frame is 1440px wide). S1 therefore expects the search at
// `max(column start, title end + nav gap)`. In a frame 1920px or wider the
// title fits on every page and state, and a non-vacuity check requires the
// column branch there, so the alignment itself is what those cells prove.
//
// T1 measures boxes, not text, so it holds with any font: the collapsed toggle
// sits wholly inside the frame, and the column box must end 4px before it.
//
// FAIL-FIRST (red) on the lane's pre-WP05 build, b1584cf, before any CSS change:
//   S1 rail collapsed: search 322.86 vs column 383.5 at 1440 (60.6 off), 456 vs
//      624 at 1920 and 776 vs 944 at 2560 (168 off); rail expanded: 456 vs 480
//      at 1920 and 776 vs 800 at 2560 (24 off), under each frame.
//   T1 -7 at 1152, 1200, 1280 and 1295 (and 1296), right-to-left -7 at 1280.
//   C1 the frame was 2560px wide at 2560.
//
// Geometry does not depend on the colour scheme, so this spec runs in the
// `light` project only.
import { test, expect, type Page } from '@playwright/test';
import { BASE, ROUTES, TOC_RAIL_TOGGLE } from './routes';
import { measure, settle, inline, type Box, type Geometry } from './helpers/geometry';

const HEIGHT = 900;
const TOLERANCE = 1;
const REM = 16;
const COLLAPSED_KEY = 'dk-toc-collapsed';
/** ADR-0064: the default frame cap. */
const DEFAULT_FRAME = 120 * REM;
/** WP05 T023: the collapsed column box ends at least this far before the toggle. */
const TOGGLE_CLEARANCE = 4;

const PAGES = {
  rail: { name: 'rail page', path: ROUTES.markuaShowcase, rail: true },
  // A section index: it carries no headings, so no rail (getting-started gained
  // one when #193 rewrote it).
  noRail: { name: 'no-rail page', path: `${BASE}/guides/`, rail: false },
  persona: { name: 'persona page', path: ROUTES.persona, rail: false },
} as const;
type PageKey = keyof typeof PAGES;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'geometry is identical in both colour schemes');
});

interface LoadOptions {
  width: number;
  collapsed?: boolean;
  css?: string;
  dir?: 'rtl';
}

interface Frame {
  g: Geometry;
  column: Box;
  /** The header search button (`site-search` itself is `display: contents`). */
  search: Box;
  /** The header site title link. */
  title: Box;
  /** `--sl-nav-gap` resolved to pixels. */
  navGap: number;
}

async function load(page: Page, key: PageKey, opts: LoadOptions): Promise<Frame> {
  const target = PAGES[key];
  await page.setViewportSize({ width: opts.width, height: HEIGHT });
  if (opts.collapsed) {
    await page.addInitScript((k) => {
      try {
        window.localStorage.setItem(k, '1');
      } catch {
        /* storage unavailable: the state assertion below fails loudly */
      }
    }, COLLAPSED_KEY);
  }
  await page.goto(target.path, { waitUntil: 'domcontentloaded' });
  if (target.rail) {
    await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
    const html = page.locator('html');
    if (opts.collapsed) await expect(html).toHaveAttribute('data-toc-collapsed', '');
    else await expect(html).not.toHaveAttribute('data-toc-collapsed', /.*/);
  } else {
    await expect(page.locator('html'), `non-vacuity: ${target.name} has no rail`).not.toHaveAttribute(
      'data-has-toc',
      /.*/,
    );
  }
  if (opts.css) await page.addStyleTag({ content: opts.css });
  if (opts.dir) await page.evaluate((d) => document.documentElement.setAttribute('dir', d), opts.dir);
  await settle(page);
  const g = await measure(page);
  const extra = await page.evaluate(() => {
    const rect = (s: string) => {
      const el = document.querySelector(s);
      if (!el || el.getClientRects().length === 0) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(--sl-nav-gap);block-size:0';
    document.body.appendChild(probe);
    const navGap = probe.getBoundingClientRect().width;
    probe.remove();
    return { search: rect('header button[data-open-modal]'), title: rect('header.header a.site-title'), navGap };
  });
  if (!g.column) throw new Error(`frame-alignment: no reading column on ${target.name}`);
  if (!extra.search) throw new Error(`frame-alignment: no header search on ${target.name}`);
  if (!extra.title) throw new Error(`frame-alignment: no site title on ${target.name}`);
  return { g, column: g.column, search: extra.search, title: extra.title, navGap: extra.navGap };
}

// ---------------------------------------------------------------------------
// T022 — #216: the header search tracks the reading column (S1).
// ---------------------------------------------------------------------------
test.describe('frame alignment — header search starts at the column (#216)', () => {
  const WIDTHS = [1440, 1920, 2560] as const;
  const FRAMES = [
    { label: 'default frame', css: undefined },
    { label: 'frame 100%', css: ':root { --dk-width-frame: 100% }' },
    { label: 'frame 90rem', css: ':root { --dk-width-frame: 90rem }' },
  ];
  const STATES = [
    { label: 'rail page expanded', key: 'rail' as const, collapsed: false },
    { label: 'rail page collapsed', key: 'rail' as const, collapsed: true },
    { label: 'no-rail page', key: 'noRail' as const, collapsed: false },
  ];

  for (const state of STATES) {
    for (const frame of FRAMES) {
      test(`S1 ${state.label}, ${frame.label}: search start = column start at ${WIDTHS.join(', ')}px`, async ({
        page,
      }) => {
        for (const width of WIDTHS) {
          const f = await load(page, state.key, { width, collapsed: state.collapsed, css: frame.css });
          const column = inline(f.column, f.g);
          const search = inline(f.search, f.g);
          const titlePush = inline(f.title, f.g).end + f.navGap;
          const expected = Math.max(column.start, titlePush);
          const where = `${state.label}, ${frame.label}, ${width}px`;
          if (inline(f.g.frame!, f.g).width >= 1920) {
            // Non-vacuity: in a frame this wide the title fits, so the cell proves the alignment.
            expect.soft(titlePush, `S1 ${where}: the site title fits before the column`).toBeLessThanOrEqual(
              column.start + TOLERANCE,
            );
          }
          expect
            .soft(
              Math.abs(search.start - expected),
              `S1 ${where}: search ${search.start}px, column ${column.start}px, title end + gap ${titlePush}px`,
            )
            .toBeLessThanOrEqual(TOLERANCE);
        }
      });
    }
  }

  test('S1 right-to-left, rail page collapsed at 1920px: the search mirrors to the column start', async ({
    page,
  }) => {
    const f = await load(page, 'rail', { width: 1920, collapsed: true, dir: 'rtl' });
    expect(f.g.dir).toBe('rtl');
    const column = inline(f.column, f.g);
    const search = inline(f.search, f.g);
    expect
      .soft(Math.abs(search.start - column.start), `S1 rtl: search ${search.start}px, column ${column.start}px`)
      .toBeLessThanOrEqual(TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// T023 — #217: the collapsed column clears the toggle (T1).
// ---------------------------------------------------------------------------
test.describe('frame alignment — collapsed column clears the toggle (#217)', () => {
  const WIDTHS = [1152, 1200, 1280, 1295, 1296, 1344, 1440, 1920, 2560] as const;

  test(`T1 collapsed rail page: column end + ${TOGGLE_CLEARANCE}px <= toggle start at ${WIDTHS.join(', ')}px`, async ({
    page,
  }) => {
    for (const width of WIDTHS) {
      const f = await load(page, 'rail', { width, collapsed: true });
      if (!f.g.toggle) throw new Error(`T1: no toggle at ${width}px`);
      const gap = inline(f.g.toggle, f.g).start - inline(f.column, f.g).end;
      expect.soft(gap, `T1 ${width}px: toggle start - column end = ${gap}px`).toBeGreaterThanOrEqual(TOGGLE_CLEARANCE);
    }
  });

  test(`T1 right-to-left at 1280px: column start >= toggle end + ${TOGGLE_CLEARANCE}px`, async ({ page }) => {
    const f = await load(page, 'rail', { width: 1280, collapsed: true, dir: 'rtl' });
    expect(f.g.dir).toBe('rtl');
    if (!f.g.toggle) throw new Error('T1 rtl: no toggle');
    // Physically mirrored: the toggle is on the left of the column.
    const gap = f.column.x - f.g.toggle.right;
    expect.soft(gap, `T1 rtl 1280px: column start - toggle end = ${gap}px`).toBeGreaterThanOrEqual(TOGGLE_CLEARANCE);
  });
});

// ---------------------------------------------------------------------------
// T024 — #205: the 120rem default, its opt-out, and narrow layouts unchanged.
// ---------------------------------------------------------------------------

/**
 * NFR-006 baseline: the reading column's x and width, in CSS pixels, measured on
 * the lane's last commit before WP05 (b1584cf, kitty/mission-layout-guards-
 * decisions-01M59CGE-lane-d), built with `pnpm build:a11y` and served as the
 * lane serves it, viewport height 900. The 120rem default must leave every one
 * of these within 0.5px; `NARROW_EXCEPTIONS` lists the cells moved on purpose.
 */
const NARROW_BASELINE = {
  railExpanded: {
    1152: { x: 312, width: 528 },
    1280: { x: 312, width: 656 },
    1440: { x: 312, width: 816 },
    1600: { x: 320, width: 960 },
    1920: { x: 480, width: 960 },
  },
  railCollapsed: {
    1152: { x: 312, width: 815 },
    1280: { x: 312, width: 943 },
    1440: { x: 383.5, width: 960 },
    1600: { x: 463.5, width: 960 },
    1920: { x: 623.5, width: 960 },
  },
  noRail: {
    1152: { x: 312, width: 816 },
    1280: { x: 312, width: 944 },
    1440: { x: 384, width: 960 },
    1600: { x: 464, width: 960 },
    1920: { x: 624, width: 960 },
  },
  persona: {
    1152: { x: 312, width: 816 },
    1280: { x: 312, width: 944 },
    1440: { x: 384, width: 960 },
    1600: { x: 464, width: 960 },
    1920: { x: 624, width: 960 },
  },
} as const;

/**
 * Cells #217 moves on purpose (WP05 T028): below 84rem the collapsed pane's end
 * padding grows from 1.5rem to the toggle width + 4px (36px), so the collapsed
 * column there is 12px narrower and keeps its start. From 84rem the column is
 * capped below its pane and the padding is unchanged, so 1440px and up match.
 */
const NARROW_EXCEPTIONS: Partial<Record<keyof typeof NARROW_BASELINE, Record<number, { x: number; width: number; reason: string }>>> = {
  railCollapsed: {
    1152: { x: 312, width: 803, reason: '#217: end padding 36px, not 24px, below 84rem' },
    1280: { x: 312, width: 931, reason: '#217: end padding 36px, not 24px, below 84rem' },
  },
};

test.describe('frame alignment — the 120rem default frame (#205, ADR-0064)', () => {
  test('C1 2560px: the frame is 120rem wide and centred, with 192px beside the column on a rail page', async ({
    page,
  }) => {
    const f = await load(page, 'rail', { width: 2560 });
    const frame = inline(f.g.frame!, f.g);
    expect.soft(Math.abs(frame.width - DEFAULT_FRAME), `C1 frame width ${frame.width}px`).toBeLessThanOrEqual(0.5);
    expect
      .soft(Math.abs(frame.start - (2560 - DEFAULT_FRAME) / 2), `C1 frame start ${frame.start}px`)
      .toBeLessThanOrEqual(0.5);
    const column = inline(f.column, f.g);
    const before = column.start - inline(f.g.sidebar!, f.g).end;
    const after = inline(f.g.railContainer!, f.g).start - column.end;
    expect.soft(Math.abs(before - 192), `C1 space before the column: ${before}px`).toBeLessThanOrEqual(TOLERANCE);
    expect.soft(Math.abs(after - 192), `C1 space after the column: ${after}px`).toBeLessThanOrEqual(TOLERANCE);
  });

  test('C2 2560px: `--dk-width-frame: 100%` restores the full-width frame', async ({ page }) => {
    const f = await load(page, 'rail', { width: 2560, css: ':root { --dk-width-frame: 100% }' });
    const frame = inline(f.g.frame!, f.g);
    expect.soft(frame.width, 'C2 frame width').toBe(f.g.viewportWidth);
    expect.soft(frame.start, 'C2 frame start').toBe(0);
  });

  const CASES: Array<{ key: keyof typeof NARROW_BASELINE; page: PageKey; collapsed: boolean }> = [
    { key: 'railExpanded', page: 'rail', collapsed: false },
    { key: 'railCollapsed', page: 'rail', collapsed: true },
    { key: 'noRail', page: 'noRail', collapsed: false },
    { key: 'persona', page: 'persona', collapsed: false },
  ];
  for (const c of CASES) {
    test(`N1 ${c.key}: column x and width at 1920px and narrower match the pre-WP05 baseline`, async ({ page }) => {
      for (const [w, base] of Object.entries(NARROW_BASELINE[c.key])) {
        const width = Number(w);
        const expected = NARROW_EXCEPTIONS[c.key]?.[width] ?? base;
        const f = await load(page, c.page, { width, collapsed: c.collapsed });
        const why = 'reason' in expected ? ` (exception: ${expected.reason})` : '';
        expect
          .soft(Math.abs(f.column.x - expected.x), `N1 ${c.key} ${width}px: x ${f.column.x}, expected ${expected.x}${why}`)
          .toBeLessThanOrEqual(0.5);
        expect
          .soft(
            Math.abs(f.column.width - expected.width),
            `N1 ${c.key} ${width}px: width ${f.column.width}, expected ${expected.width}${why}`,
          )
          .toBeLessThanOrEqual(0.5);
      }
    });
  }
});
