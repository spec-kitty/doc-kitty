// Collapsible TOC rail — live interaction + a11y + persistence + desktop scoping
// (collapsible-toc-rail-01M23HNA, WP04 T014/T015 — contract C-3/C-4, FR-004,
// NFR-003, SC-001..003).
//
// The static axe scan (axe.spec.ts) covers the resting page; the structural
// no-flash proof (src/tests/toc-rail-build-html.test.ts, T013) covers zero-flash by
// construction. This spec is the complementary LIVE layer: it drives the injected
// toggle on a real served page and asserts the behavioural contract a static scan
// cannot — collapse/restore, the RECENTER (asserted by the computed `.main-pane`
// WIDTH, not merely the attribute flip), keyboard (Enter AND Space) + `aria-expanded`,
// persistence across reload with no expanded frame, and the desktop-only scoping
// (below 72rem the toggle is absent and the mobile TOC / left nav are untouched).
//
// Chrome DOM (Starlight @0.32.6, verified in the contract's C-2 selector list):
//   .right-sidebar-container > .right-sidebar > .right-sidebar-panel  (the outline)
//   .main-pane  (the article column; right-biased when a TOC is reserved)
//   <html> carries data-has-sidebar / data-has-toc / (when collapsed) data-toc-collapsed
// The toggle (#dk-toc-toggle, body-mounted, position:fixed) is injected by the
// client island (toc-rail.client) on load and shown only >= 72rem.
import { test, expect, type Page } from '@playwright/test';
import { ROUTES, TOC_RAIL_ROUTE, TOC_RAIL_TOGGLE } from './routes';

// The two-column TOC breakpoint is 72rem = 1152px (toc-rail/preference
// TOC_BREAKPOINT_PX). The Playwright default viewport (playwright.config.ts,
// 1280×800) is ABOVE it, so the desktop tests below inherit a ≥72rem width; the
// scoping test overrides to a width BELOW it via `test.use`.
const BELOW_BREAKPOINT = { width: 1024, height: 800 } as const;

/**
 * Navigate to the pinned has-TOC route and assert the non-vacuity guardRoots
 * BEFORE driving anything — if home ever loses its on-page TOC this fails loudly
 * rather than exercising an absent toggle. Returns once the injected toggle is
 * visible (the client island has mounted at the ≥72rem default viewport).
 */
async function gotoTocRoute(page: Page): Promise<void> {
  await page.goto(TOC_RAIL_ROUTE.path, { waitUntil: 'domcontentloaded' });
  for (const root of TOC_RAIL_ROUTE.guardRoots) {
    await expect(
      page.locator(root),
      `non-vacuity: "${root}" must exist on ${TOC_RAIL_ROUTE.name} (else the page lost its TOC)`,
    ).toHaveCount(1);
  }
  await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
}

/** Read the article-pane border-box width AND its containing block's content
 *  width in ONE evaluate, so the recenter is judged against the LIVE geometry. */
async function paneGeometry(page: Page): Promise<{ pane: number; parentContent: number }> {
  return page.evaluate(() => {
    const mp = document.querySelector<HTMLElement>('.main-pane');
    if (!mp) throw new Error('no .main-pane on the page');
    const parent = mp.parentElement;
    if (!parent) throw new Error('.main-pane has no parent element');
    return {
      pane: mp.getBoundingClientRect().width,
      parentContent: parent.clientWidth, // content-box width of the containing block
    };
  });
}

const outlinePanel = (page: Page) => page.locator('.right-sidebar-panel').first();

// ---------------------------------------------------------------------------
// T014 — desktop interaction: collapse/restore + RECENTER (computed width) +
// outline hidden + aria/keyboard + no-flash persistence, at the ≥72rem default.
// ---------------------------------------------------------------------------
test.describe('Collapsible TOC rail — desktop interaction (T014, ≥72rem)', () => {
  test('click collapses (outline hidden + article recenters to full width) and restores', async ({
    page,
  }) => {
    await gotoTocRoute(page);
    const toggle = page.locator(TOC_RAIL_TOGGLE);

    // Resting state: expanded. The outline is shown and the button says so.
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(outlinePanel(page)).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-toc-collapsed', /.*/);
    const expanded = await paneGeometry(page);

    // Collapse.
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-toc-collapsed', '');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // The outline panel is display:none (so axe skips the off-screen TOC links).
    await expect(outlinePanel(page)).toBeHidden();

    // RECENTER — the whole point (C-2): the article's COMPUTED width must change to
    // full, not merely the attribute. Assert against live geometry, two ways:
    //   (a) the pane genuinely WIDENED (reclaimed the reserved TOC column, ~sidebar
    //       width) — a no-op / attribute-only change fails here; and
    //   (b) the collapsed pane fills (≈100% of) its containing block — it is FULL.
    const collapsed = await paneGeometry(page);
    expect(
      collapsed.pane - expanded.pane,
      `collapsed .main-pane (${collapsed.pane}px) must be materially WIDER than expanded (${expanded.pane}px) — the recenter reclaimed the rail column`,
    ).toBeGreaterThan(100);
    expect(
      collapsed.pane,
      `collapsed .main-pane (${collapsed.pane}px) must fill its container content width (${collapsed.parentContent}px) — recentered to FULL`,
    ).toBeGreaterThanOrEqual(collapsed.parentContent * 0.98);

    // Restore — every observable returns to the expanded resting state.
    await toggle.click();
    await expect(page.locator('html')).not.toHaveAttribute('data-toc-collapsed', /.*/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(outlinePanel(page)).toBeVisible();
    const restored = await paneGeometry(page);
    expect(
      Math.abs(restored.pane - expanded.pane),
      'the article width must return to its expanded value after restoring',
    ).toBeLessThan(2);
  });

  test('the toggle activates with Enter AND Space, flipping aria-expanded', async ({ page }) => {
    await gotoTocRoute(page);
    const toggle = page.locator(TOC_RAIL_TOGGLE);
    const html = page.locator('html');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.focus();

    // Enter activates a native <button> (keydown) — collapses.
    await page.keyboard.press('Enter');
    await expect(html).toHaveAttribute('data-toc-collapsed', '');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Space activates a native <button> (keyup) — restores. Proves BOTH keys work,
    // for free from the native button element (no custom key handling — C-3).
    await page.keyboard.press('Space');
    await expect(html).not.toHaveAttribute('data-toc-collapsed', /.*/);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('the collapsed preference persists across reload with no expanded frame', async ({
    page,
  }) => {
    await gotoTocRoute(page);
    const toggle = page.locator(TOC_RAIL_TOGGLE);

    // Collapse and persist (the toggle writes localStorage['dk-toc-collapsed']='1').
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-toc-collapsed', '');

    // Reload. The pre-paint inline <head> script (T013 proves it is classic +
    // render-blocking) runs during head parse, BEFORE first paint, so the
    // collapsed attribute is already set at the FIRST post-load evaluation — the
    // outline never flashes expanded. (The definitive zero-flash proof is the
    // structural build assertion in src/tests/toc-rail-build-html.test.ts; this is
    // the runtime complement named in contract C-5.)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('html'),
      'data-toc-collapsed must already be present at first evaluation after reload (no expanded frame)',
    ).toHaveAttribute('data-toc-collapsed', '');

    // …and the persisted state fully restores with no manual re-click: the outline
    // stays hidden and the button reflects the collapsed state.
    await expect(page.locator(TOC_RAIL_TOGGLE)).toHaveAttribute('aria-expanded', 'false');
    await expect(outlinePanel(page)).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// T015 — scoping / non-regression (NFR-003 / SC-003): a FRESH load BELOW 72rem
// shows no toggle and no collapsed chrome, and leaves the mobile TOC + left nav
// untouched. `test.use` sets the viewport before the context is created, so the
// page loads fresh at the narrow width (NOT a resize-down, which would leave the
// injected button in the DOM — the contract's explicit caveat).
// ---------------------------------------------------------------------------
test.describe('Collapsible TOC rail — desktop scoping, fresh below-breakpoint load (T015, <72rem)', () => {
  test.use({ viewport: BELOW_BREAKPOINT });

  test('no toggle, no collapsed chrome, and the mobile TOC + left nav are unchanged', async ({
    page,
  }) => {
    // Fresh load at 1024px (< 72rem). No stored preference (isolated context).
    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });
    // Let the client island run (it may still inject the button into the DOM; CSS
    // must hide it below the breakpoint regardless).
    await page.waitForLoadState('load');

    // The toggle is not visible (present-but-hidden via the base `display:none`, or
    // never injected on a TOC-less narrow render) — either way the reader sees none.
    await expect(
      page.locator(TOC_RAIL_TOGGLE),
      'the collapse toggle must not be visible below 72rem (desktop-only affordance)',
    ).toBeHidden();

    // No collapsed chrome on a fresh narrow load: the layout driver attribute is
    // absent, so nothing about the rail is collapsed.
    await expect(page.locator('html')).not.toHaveAttribute('data-toc-collapsed', /.*/);

    // The mobile TOC block still exists and the feature added NOTHING to it (C-4:
    // no rule/script targets `mobile-starlight-toc`).
    const mobileToc = page.locator('mobile-starlight-toc');
    expect(await mobileToc.count(), 'the mobile TOC must still render below 72rem').toBeGreaterThan(0);
    expect(
      await page.locator('mobile-starlight-toc').locator(TOC_RAIL_TOGGLE).count(),
      'the feature must not inject its toggle inside the mobile TOC',
    ).toBe(0);

    // The left navigation sidebar still exists and is likewise untouched.
    expect(await page.locator('nav.sidebar').count(), 'the left nav must still render').toBeGreaterThan(0);
    expect(
      await page.locator('nav.sidebar').locator(TOC_RAIL_TOGGLE).count(),
      'the feature must not inject its toggle inside the left nav',
    ).toBe(0);

    // And the collapse driver attribute lives ONLY on <html> — never leaked onto
    // the mobile TOC or the left nav.
    await expect(page.locator('mobile-starlight-toc').first()).not.toHaveAttribute(
      'data-toc-collapsed',
      /.*/,
    );
    await expect(page.locator('nav.sidebar').first()).not.toHaveAttribute('data-toc-collapsed', /.*/);

    // Non-vacuity for the narrow-load claim itself: at the DESKTOP viewport this
    // same route DOES carry the right-sidebar rail (the desktop tests above assert
    // it through gotoTocRoute's guardRoots, which include `.right-sidebar`), so this
    // below-breakpoint absence is a real scoping result — not a route that simply
    // never had a rail.
  });
});
