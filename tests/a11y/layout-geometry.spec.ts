// Multi-width layout geometry guard (sidebar-frame-header-carrier-01M4T3CB, WP03
// T012..T016 — FR-028, FR-006, FR-012, NFR-001, NFR-002, NFR-003, NFR-005,
// SC-001, SC-002, SC-003, SC-007).
//
// Why this spec exists: the earlier guard (toc-rail.interaction.spec.ts) runs at
// the 1280px default viewport only. At that width the old layout's toggle was 8px
// off the rail edge and the frame happened to be full width, so a 432px dead
// gutter at 1920px and a 552px reading column were invisible to it. This spec
// measures bounding boxes at 1152, 1280, 1600, 1920 and 2560px, expanded and
// collapsed, plus a capped frame, an invalid frame token and right-to-left.
//
// Tolerance is 1 CSS pixel everywhere (NFR-001). Do not loosen it to get green:
// a failing assertion here is a layout finding.
//
// Assertion ids (used in the messages and in the evidence below):
//   A1  frame fills the viewport (or is exactly the cap, centred)
//   A2  sidebar start edge = frame start edge
//   A2b reading pane starts where the sidebar ends (SC-001: no dead gutter)
//   A3  rail start edge = rail-container start edge (the fixed rail sits in the
//       column reserved for it); rail-container end edge = frame end edge (ratchet)
//   A4  rail and rail-container width = `--sl-sidebar-width`
//   A5  expanded toggle is CENTRED on the rail container's inner edge (SC-003);
//       A5b it clears the nearest article text by >= 4px; A5c it clears every
//       outline link by >= 1px
//   A6  reading column >= 720px at 1600px and wider (NFR-002, SC-002)
//   A7  header: first item at frame start + nav padding, last at frame end - nav padding
//   A8  collapsed rail container is 1px wide at the frame end edge
//   A9  collapsed toggle's end edge = frame end edge (SC-003)
//   A10 collapsed reading column is centred between sidebar and frame end
//   A11 reading column never shrinks as the viewport grows (FR-006)
//
// FAIL-FIRST EVIDENCE (T016, SC-007). Verified red against the pre-mission layout,
// `origin/main` at 79d63cb, on 2026-10-13: that tree was built in a scratch
// worktree, its `example/dist` served, and this spec run against it unchanged.
// 20 of 32 tests were red (all five expanded tests, the three collapsed tests from
// 1600px, A11, six capped-frame, one invalid-token and four right-to-left tests). "measured -> expected" in CSS pixels:
//
//   id    1152          1280          1600           1920           2560
//   A1    green         green         1056 -> 1600   1056 -> 1920   1056 -> 2560   frame width
//   A2    green         green         0 -> 272       0 -> 432       0 -> 752       sidebar vs frame start
//   A2b   green         green         272 gutter     432 gutter     752 gutter     (SC-001)
//   A4    1152 / 216    1280 / 280    1600 / 168     1920 / 168     2560 / 168     rail / container, -> 288
//   A5    88 off        24 off        136 off        296 off        616 off        toggle vs rail edge
//   A5b   -64.94        -14.73        green          green          green          toggle OVER text
//   A5c   green         green         -135           green          green          toggle OVER outline links
//   A6    n/a           n/a           552            552            552            column, floor 720 (SC-002)
//   A7    green         green         272 off        432 off        752 off        header items vs frame
//   A9    green         green         271.5 off      431.5 off      751.5 off      collapsed toggle
//   A10   green         green         295.5 vs 25    455.5 vs 25    775.5 vs 25    collapsed centring
//   A11   red once: column 600, 664, 552, 552, 552 across the five widths (shrinks at 1600)
//
// Also red: all six capped-frame tests (the frame ignored the token: 1056px where
// 1440px and 1536px were set), the invalid-token test (through A1) and all four
// right-to-left tests (the toggle did not mirror: inline-start offset 288px where
// 960px was expected at 1280, 0px where 1248px collapsed).
// Those right-to-left figures were taken when the cases ran at 1280px; they now
// run at 1920px, uncapped and under a 90rem cap, so a gutter inset is non-zero.
//
// RATCHETS — green on the pre-mission layout too. They are kept because they pin a
// property the frame change could have broken, not because they prove this
// mission; none of them counts towards SC-007:
//   - A3, both halves. The rail container already ended at the frame's end edge.
//     The rail-start half was not run against 79d63cb: it holds there by
//     construction, because Starlight gives the fixed rail no inline inset, so it
//     starts at its static position, the container's start edge. An earlier A3
//     compared the rail's END edge with the frame's; that was red on the old
//     layout only because the old rail was as wide as the viewport, which is the
//     A4 defect, so it was replaced. A3 now fails if the rail is ever positioned
//     away from the column reserved for it (for example by an inline inset that
//     disagrees with the frame);
//   - every `green` cell above: below 1600px the old frame was already full width,
//     so A1, A2, A2b, A7, A9 and A10 only discriminate from 1600px up, and the
//     `1152px collapsed` and `1280px collapsed` tests were green as a whole;
//   - A8 (collapsed rail container is a 1px hairline at the frame edge) at every
//     width: delivered by the collapsible-rail work and unchanged here;
//   - A5c at four of five widths: it guards the 1px clearance the centred toggle
//     now has by construction, against a later padding change;
//   - the equality half of the invalid-token test (the old layout had no token to
//     misread);
//   - the reading-column measure at 1152 and 1280 is the reverse case: it was red
//     (600 and 664) because it records the NEW, accepted measure, see
//     `EXPANDED_MEASURE`;
//   - all eight no-horizontal-scroll tests (NFR-003) and both layout-shift tests
//     (NFR-005).
//
// LATER MOVE. The reading-width mission (issue 154, ADR-0053) raised the default
// column to 60rem; `EXPANDED_MEASURE` moved from 720 to 960px from 1600px with it.
// That move is recorded at the table; this evidence block describes the frame
// mission's fail-first run and is otherwise unchanged.
//
// Geometry does not depend on the colour scheme (the two modes differ in colour
// tokens only), so this spec runs in the `light` project and skips in `dark`.
import { test, expect, type Browser, type Page } from '@playwright/test';
import { ROUTES, TOC_RAIL_ROUTE, TOC_RAIL_TOGGLE } from './routes';
import { measure, settle, inline, type Box, type Geometry } from './helpers/geometry';

const WIDTHS = [1152, 1280, 1600, 1920, 2560] as const;
const HEIGHT = 900;
/** NFR-001. */
const TOLERANCE = 1;
/** NFR-002: the floor from 1600px up. */
const COLUMN_FLOOR = 720;
const COLUMN_FLOOR_FROM = 1600;
/**
 * The full matrix runs on one route: the home page, the route the collapse spec
 * already pins. It has a left sidebar and an outline rail with three entries,
 * and it had both before this mission, which the fail-first run needs.
 */
const ROUTE = TOC_RAIL_ROUTE;
/** The collapsed preference, exactly as the client stores it (C-003). */
const COLLAPSED_KEY = 'dk-toc-collapsed';

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'light', 'geometry is identical in both colour schemes');
});

interface LoadOptions {
  width: number;
  collapsed?: boolean;
  /** Injected after load, before measuring (frame cap, invalid token). */
  css?: string;
  dir?: 'rtl';
}

async function load(page: Page, opts: LoadOptions): Promise<Geometry> {
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
  await page.goto(ROUTE.path, { waitUntil: 'domcontentloaded' });
  for (const root of ROUTE.guardRoots) {
    await expect(page.locator(root), `non-vacuity: "${root}" on ${ROUTE.name}`).toHaveCount(1);
  }
  // The toggle is injected by a client script; nothing about it can be measured before.
  await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
  const html = page.locator('html');
  if (opts.collapsed) await expect(html).toHaveAttribute('data-toc-collapsed', '');
  else await expect(html).not.toHaveAttribute('data-toc-collapsed', /.*/);

  if (opts.css) await page.addStyleTag({ content: opts.css });
  if (opts.dir) await page.evaluate((d) => document.documentElement.setAttribute('dir', d), opts.dir);
  await settle(page);
  return measure(page);
}

function need(box: Box | null, name: string): Box {
  if (!box) throw new Error(`geometry: "${name}" is not rendered on ${ROUTE.name}`);
  return box;
}

function near(actual: number, expected: number, label: string): void {
  expect
    .soft(
      Math.abs(actual - expected),
      `${label}: measured ${actual}px, expected ${expected}px (tolerance ${TOLERANCE}px)`,
    )
    .toBeLessThanOrEqual(TOLERANCE);
}

/** A1. `cap` is the expected frame width in pixels when the frame is capped. */
function assertFrame(g: Geometry, cap?: number): void {
  const frame = inline(need(g.frame, 'frame'), g);
  const width = cap ?? g.viewportWidth;
  near(frame.width, width, 'A1 frame width');
  near(frame.start, (g.viewportWidth - width) / 2, 'A1 frame start edge (centred)');
}

/** A2, A2b, A7 — hold in both rail states, relative to the frame. */
function assertChrome(g: Geometry): void {
  const frame = inline(need(g.frame, 'frame'), g);
  const sidebar = inline(need(g.sidebar, 'sidebar'), g);
  const pane = inline(need(g.pane, 'pane'), g);
  near(sidebar.start, frame.start, 'A2 sidebar start edge vs frame start edge');
  near(pane.start, sidebar.end, 'A2b reading pane start vs sidebar end (dead gutter)');
  near(
    inline(need(g.headerFirst, 'headerFirst'), g).start,
    frame.start + g.navPad,
    'A7 header first item vs frame start + nav padding',
  );
  near(
    inline(need(g.headerLast, 'headerLast'), g).end,
    frame.end - g.navPad,
    'A7 header last item vs frame end - nav padding',
  );
}

/** A3, A4, A5. */
function assertExpanded(g: Geometry): void {
  assertChrome(g);
  const frame = inline(need(g.frame, 'frame'), g);
  const rail = inline(need(g.rail, 'rail'), g);
  const container = inline(need(g.railContainer, 'railContainer'), g);
  const toggle = inline(need(g.toggle, 'toggle'), g);

  near(rail.start, container.start, 'A3 rail start edge vs rail container start edge');
  near(container.end, frame.end, 'A3 rail container end edge vs frame end edge (ratchet)');
  near(rail.width, g.sidebarWidthToken, 'A4 rail width vs --sl-sidebar-width');
  near(container.width, g.sidebarWidthToken, 'A4 rail container width vs --sl-sidebar-width');

  // Expanded, the 32px button is centred on the rail's inner edge by design: half
  // over the article's end padding, half over the rail panel's start padding.
  near(toggle.centre, container.start, 'A5 toggle centre vs rail container inner edge');

  expect(g.toggleToTextGap, 'A5b the article has text to measure against').not.toBeNull();
  expect
    .soft(g.toggleToTextGap!, `A5b toggle to nearest article text: ${g.toggleToTextGap}px`)
    .toBeGreaterThanOrEqual(4);
  expect(g.tocLinkCount, 'A5c the outline has links to measure against').toBeGreaterThan(0);
  // The measured clearance is exactly the panel's 1px border; a padding regression
  // on the panel or the links takes it to 0 or below.
  expect
    .soft(g.toggleToTocLinkGap!, `A5c toggle to nearest outline link: ${g.toggleToTocLinkGap}px`)
    .toBeGreaterThanOrEqual(1);
}

/** A8, A9, A10. */
function assertCollapsed(g: Geometry): void {
  assertChrome(g);
  const frame = inline(need(g.frame, 'frame'), g);
  const sidebar = inline(need(g.sidebar, 'sidebar'), g);
  const column = inline(need(g.column, 'column'), g);
  const container = inline(need(g.railContainer, 'railContainer'), g);
  const toggle = inline(need(g.toggle, 'toggle'), g);

  // A 1px tolerance on a 1px hairline would accept 0 and 2, so this one is exact.
  expect.soft(container.width, 'A8 collapsed rail container width').toBe(1);
  near(container.end, frame.end, 'A8 collapsed rail container end edge vs frame end edge');
  near(toggle.end, frame.end, 'A9 collapsed toggle end edge vs frame end edge');

  const startGap = column.start - sidebar.end;
  const endGap = frame.end - column.end;
  expect
    .soft(
      Math.abs(startGap - endGap),
      `A10 collapsed column centring: ${startGap}px before, ${endGap}px after`,
    )
    .toBeLessThanOrEqual(TOLERANCE);

  expect(g.panel, 'collapsed: the outline panel is not rendered').toBeNull();
  expect(g.toggleToTextGap, 'A5b the article has text to measure against').not.toBeNull();
  expect
    .soft(g.toggleToTextGap!, `A5b collapsed toggle to nearest article text: ${g.toggleToTextGap}px`)
    .toBeGreaterThanOrEqual(4);
}

/** A6, plus the recorded measures below the floor. */
function assertColumn(g: Geometry, width: number): void {
  const column = need(g.column, 'column');
  if (width >= COLUMN_FLOOR_FROM) {
    expect
      .soft(column.width, `A6 reading column at ${width}px: ${column.width}px`)
      .toBeGreaterThanOrEqual(COLUMN_FLOOR);
  }
  near(column.width, EXPANDED_MEASURE[width], `reading-column measure at ${width}px (ratchet)`);
}

/**
 * RATCHET — the expanded reading-column measure with the default frame.
 *
 * The rail is pinned to the sidebar width (18rem) at every desktop width, so
 * below 84rem the column is whatever is left: 528px at 1152 and 656px at 1280.
 * That is narrower than the 720px floor the frame mission set (its NFR-002, required
 * from 1600px; the 960px measure now clears it there). It is an accepted, recorded trade-off of the fixed-width rail, pinned here so a
 * change in either direction is a deliberate one. From 1600px the column is
 * `--dk-width-content`, 60rem: 960px.
 *
 * Moved on purpose by the reading-width mission (issue 154, ADR-0053): the
 * default went from 45rem to 60rem, so the 1600, 1920 and 2560 rows went from
 * 720 to 960. Below 1600px the pane still limits the column, so 1152 and 1280
 * did not move. `reading-width.spec.ts` guards the new behaviour itself.
 */
const EXPANDED_MEASURE: Record<number, number> = {
  1152: 528,
  1280: 656,
  1600: 960,
  1920: 960,
  2560: 960,
};

// ---------------------------------------------------------------------------
// T013 — default frame, five widths, both rail states.
// ---------------------------------------------------------------------------
test.describe('layout geometry — default frame', () => {
  for (const width of WIDTHS) {
    test(`${width}px expanded: frame, sidebar, rail, toggle, column and header align`, async ({
      page,
    }) => {
      const g = await load(page, { width });
      assertFrame(g);
      assertExpanded(g);
      assertColumn(g, width);
    });

    test(`${width}px collapsed: hairline rail, toggle at the frame edge, centred column`, async ({
      page,
    }) => {
      const g = await load(page, { width, collapsed: true });
      assertFrame(g);
      assertCollapsed(g);
    });
  }

  test('A11 the expanded reading column never shrinks as the viewport grows', async ({ page }) => {
    const measures: Array<{ width: number; column: number }> = [];
    for (const width of WIDTHS) {
      const g = await load(page, { width });
      measures.push({ width, column: need(g.column, 'column').width });
    }
    const summary = measures.map((m) => `${m.width}:${m.column}`).join(', ');
    for (let i = 1; i < measures.length; i += 1) {
      expect
        .soft(
          measures[i].column,
          `A11 column at ${measures[i].width}px vs ${measures[i - 1].width}px (${summary})`,
        )
        .toBeGreaterThanOrEqual(measures[i - 1].column);
    }
  });
});

// ---------------------------------------------------------------------------
// T014 — capped frame. Everything aligns to the FRAME, not the viewport.
// ---------------------------------------------------------------------------
test.describe('layout geometry — capped frame', () => {
  const REM = 16;
  const CAPS = [
    { label: '90rem', css: ':root { --dk-width-frame: 90rem }', px: () => 90 * REM, widths: [1920, 2560] },
    { label: '80%', css: ':root { --dk-width-frame: 80% }', px: (w: number) => w * 0.8, widths: [1920] },
  ];
  for (const cap of CAPS) {
    for (const width of cap.widths) {
      test(`${cap.label} at ${width}px expanded: the frame is the cap, centred, and the chrome follows it`, async ({
        page,
      }) => {
        const g = await load(page, { width, css: cap.css });
        assertFrame(g, cap.px(g.viewportWidth));
        assertExpanded(g);
        expect
          .soft(need(g.column, 'column').width, 'A6 reading column inside a capped frame')
          .toBeGreaterThanOrEqual(COLUMN_FLOOR);
      });

      test(`${cap.label} at ${width}px collapsed: hairline and toggle sit at the frame edge, not the viewport edge`, async ({
        page,
      }) => {
        const g = await load(page, { width, collapsed: true, css: cap.css });
        assertFrame(g, cap.px(g.viewportWidth));
        assertCollapsed(g);
        // Non-vacuity for "relative to the frame": the frame edge is well inside the viewport.
        expect(g.viewportWidth - need(g.frame, 'frame').right).toBeGreaterThan(100);
      });
    }
  }

  test('an invalid frame token at 1920px gives exactly the default layout (FR-003)', async ({
    page,
    browser,
  }) => {
    const invalid = await load(page, { width: 1920, css: ':root { --dk-width-frame: banana }' });
    const other = await browser.newPage();
    try {
      const fallback = await load(other, { width: 1920 });
      expect(invalid).toEqual(fallback);
    } finally {
      await other.close();
    }
    assertFrame(invalid);
  });
});

// ---------------------------------------------------------------------------
// T014 — right-to-left. The layout is the mirror image (FR-012).
// ---------------------------------------------------------------------------
test.describe('layout geometry — right-to-left', () => {
  const BOXES = ['frame', 'sidebar', 'pane', 'column', 'railContainer', 'toggle', 'headerFirst', 'headerLast'] as const;

  // Uncapped, the frame gutter is 0 and gutter-based insets mirror trivially.
  // Under the 90rem cap the gutter is 240px at 1920px, so a physical-property
  // slip in a gutter inset shows up as a mirror failure.
  const CASES = [
    { label: '1920px', width: 1920, css: undefined, cap: undefined },
    { label: '1920px under a 90rem cap', width: 1920, css: ':root { --dk-width-frame: 90rem }', cap: 90 * 16 },
  ];
  for (const { label, width, css, cap } of CASES) {
    for (const collapsed of [false, true]) {
      const state = collapsed ? 'collapsed' : 'expanded';
      test(`${label} ${state}: mirror of the left-to-right layout`, async ({ page, browser }) => {
        const rtl = await load(page, { width, collapsed, css, dir: 'rtl' });
        expect(rtl.dir).toBe('rtl');

        // Physically mirrored: sidebar on the right, rail on the left of the column.
        const column = need(rtl.column, 'column');
        expect(need(rtl.sidebar, 'sidebar').x, 'sidebar is to the right of the column').toBeGreaterThanOrEqual(column.right);
        expect(need(rtl.railContainer, 'railContainer').right, 'rail is to the left of the column').toBeLessThanOrEqual(column.x);

        assertFrame(rtl, cap);
        if (collapsed) assertCollapsed(rtl);
        else assertExpanded(rtl);

        // Inline-axis offsets equal the left-to-right ones, box by box.
        const other = await browser.newPage();
        try {
          const ltr = await load(other, { width, collapsed, css });
          for (const name of BOXES) {
            const a = inline(need(rtl[name], name), rtl);
            const b = inline(need(ltr[name], name), ltr);
            near(a.start, b.start, `mirror: ${name} inline-start offset`);
            near(a.width, b.width, `mirror: ${name} width`);
          }
        } finally {
          await other.close();
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// T015 — no horizontal page scroll at eight widths (NFR-003). RATCHET: the
// pre-mission layout did not scroll sideways either; this pins that property
// across the widths and routes the frame change could have broken.
// ---------------------------------------------------------------------------
test.describe('layout geometry — no horizontal page scroll', () => {
  const SCROLL_WIDTHS = [390, 768, 1024, 1152, 1280, 1600, 1920, 2560] as const;
  /** 72rem: below it the toggle is a desktop-only affordance and must not show. */
  const DESKTOP_BREAKPOINT = 1152;
  const SCROLL_ROUTES = [
    ['landing', ROUTES.home],
    ['hub', ROUTES.hub],
    ['long page', ROUTES.rhetoricChapter],
    ['glossary demonstrator', ROUTES.glossaryDemo],
    ['persona', ROUTES.persona],
  ] as const;

  for (const width of SCROLL_WIDTHS) {
    test(`${width}px: scroll width equals viewport width on ${SCROLL_ROUTES.length} routes`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      for (const [name, path] of SCROLL_ROUTES) {
        await page.goto(path, { waitUntil: 'load' });
        await expect(page.locator('main'), `non-vacuity: ${name} rendered`).toHaveCount(1);
        await settle(page);
        const g = await measure(page);
        expect.soft(g.scrollWidth, `${name} at ${width}px: scrollWidth vs clientWidth`).toBe(g.viewportWidth);
        if (width < DESKTOP_BREAKPOINT) {
          await expect
            .soft(page.locator(TOC_RAIL_TOGGLE), `${name} at ${width}px: no toggle below 72rem`)
            .toBeHidden();
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// NFR-005 — the enhancement (mounting the toggle, revealing the current sidebar
// entry) moves nothing. RATCHET where noted in the evidence block.
// ---------------------------------------------------------------------------
test.describe('layout geometry — no layout shift from enhancement', () => {
  const SHIFT_WIDTH = 1280;

  async function staticBoxes(browser: Browser, javaScriptEnabled: boolean) {
    const context = await browser.newContext({
      javaScriptEnabled,
      viewport: { width: SHIFT_WIDTH, height: HEIGHT },
    });
    try {
      const page = await context.newPage();
      await page.goto(ROUTE.path, { waitUntil: 'load' });
      if (javaScriptEnabled) {
        await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
      }
      // Without JavaScript the page cannot resolve a promise or run an animation
      // frame, so `settle` would never return. `load` has fired and `measure` is a
      // synchronous read that forces layout, which is all a static page needs.
      if (javaScriptEnabled) await settle(page);
      const g = await measure(page);
      return { g, boxes: { column: g.column, pane: g.pane, sidebar: g.sidebar, railContainer: g.railContainer } };
    } finally {
      await context.close();
    }
  }

  test('the reading column is in the same place with JavaScript disabled and enabled', async ({
    browser,
  }) => {
    const off = await staticBoxes(browser, false);
    const on = await staticBoxes(browser, true);
    // Non-vacuity: the two runs really differ in whether the script ran.
    expect(off.g.toggle, 'no toggle without JavaScript').toBeNull();
    expect(on.g.toggle, 'toggle mounted with JavaScript').not.toBeNull();
    expect(off.boxes.column, 'the reading column is rendered without JavaScript').not.toBeNull();
    expect(on.boxes).toEqual(off.boxes);
  });

  test('cumulative layout shift for the load is 0', async ({ page }) => {
    await page.setViewportSize({ width: SHIFT_WIDTH, height: HEIGHT });
    await page.addInitScript(() => {
      const w = window as unknown as { __dkShift: { supported: boolean; total: number; count: number } };
      w.__dkShift = {
        supported: PerformanceObserver.supportedEntryTypes.includes('layout-shift'),
        total: 0,
        count: 0,
      };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          w.__dkShift.total += (entry as unknown as { value: number }).value;
          w.__dkShift.count += 1;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(ROUTE.path, { waitUntil: 'load' });
    await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
    await settle(page);
    await settle(page);
    const shift = await page.evaluate(
      () => (window as unknown as { __dkShift: { supported: boolean; total: number; count: number } }).__dkShift,
    );
    expect(shift.supported, 'non-vacuity: this browser reports layout-shift entries').toBe(true);
    expect(shift.total, `layout-shift entries: ${shift.count}`).toBe(0);
  });
});

// The current page's sidebar entry is in view after load (FR-022, WP04 T023;
// WP07 review gap 4.4). `route-shaping.test.ts` runs REVEAL_CURRENT_SCRIPT
// against a stub document only; this measures it in a browser.
//
// The page is the last chapter of the longest sidebar group, in a viewport
// short enough that its entry starts far below the pane's visible part.
// Fail-first: with the script's `head` entry removed from `config.ts` and the
// site rebuilt, the pane stays at scroll position 0 and the entry is measured
// below the pane's bottom edge, so the range assertion fails.
test.describe('the current sidebar entry is revealed on load (FR-022)', () => {
  const DEEP_ROUTE = `${ROUTES.rhetoricChapter.replace(/chapter-01\/$/, '')}chapter-15/`;

  interface Reveal {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    pane: { top: number; bottom: number };
    entry: { top: number; bottom: number; href: string };
    scrollY: number;
  }

  async function measureReveal(page: Page): Promise<Reveal> {
    return page.evaluate(() => {
      const pane = document.getElementById('starlight__sidebar');
      const entry = pane?.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      if (!pane || !entry) throw new Error('no sidebar pane or no aria-current entry');
      const p = pane.getBoundingClientRect();
      const e = entry.getBoundingClientRect();
      return {
        scrollTop: pane.scrollTop,
        scrollHeight: pane.scrollHeight,
        clientHeight: pane.clientHeight,
        pane: { top: p.top, bottom: p.bottom },
        entry: { top: e.top, bottom: e.bottom, href: entry.getAttribute('href') ?? '' },
        scrollY: window.scrollY,
      };
    });
  }

  function assertRevealed(r: Reveal, where: string): void {
    expect(r.entry.href, 'the aria-current entry is the page under test').toBe(DEEP_ROUTE);
    // Non-vacuity: the entry's natural position is below the fold of the pane,
    // so it is visible only if the pane was scrolled.
    const natural = r.entry.top + r.scrollTop;
    expect(natural, `${where}: unscrolled, the entry would sit below the pane (bottom ${r.pane.bottom})`).toBeGreaterThan(
      r.pane.bottom,
    );
    expect(r.scrollHeight, `${where}: the pane overflows`).toBeGreaterThan(r.clientHeight);
    expect(r.entry.top, `${where}: entry top ${r.entry.top} is at or below the pane top ${r.pane.top}`).toBeGreaterThanOrEqual(
      r.pane.top - TOLERANCE,
    );
    expect(
      r.entry.bottom,
      `${where}: entry bottom ${r.entry.bottom} is at or above the pane bottom ${r.pane.bottom} (pane scrollTop ${r.scrollTop})`,
    ).toBeLessThanOrEqual(r.pane.bottom + TOLERANCE);
    expect(r.scrollY, `${where}: the document itself did not scroll`).toBe(0);
  }

  test('1280x600: the entry lies inside the sidebar pane and the document is not scrolled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(DEEP_ROUTE, { waitUntil: 'load' });
    await settle(page);
    assertRevealed(await measureReveal(page), '1280x600');
  });

  test('390x600: the entry lies inside the mobile menu once it is opened', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto(DEEP_ROUTE, { waitUntil: 'load' });
    await settle(page);
    expect(await page.evaluate(() => window.scrollY), 'the document is not scrolled by the reveal').toBe(0);
    await page.locator('starlight-menu-button button').click();
    await expect(page.locator('#starlight__sidebar')).toBeVisible();
    assertRevealed(await measureReveal(page), '390x600, menu open');
  });
});
