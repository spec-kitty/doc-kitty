// Bounded visual-regression baseline (WP09 T041).
//
// A small, deterministic screenshot contract for the brand home in both modes with an
// explicit pixel-diff budget (playwright.config.ts: maxDiffPixelRatio 0.01). A no-op
// visual check cannot pass: a token colour shift beyond the budget turns this red.
//
// Determinism: fixed viewport + reducedMotion (config), fonts awaited before the
// snapshot, and animations disabled at capture. Baselines live under
// tests/a11y/__screenshots__/ and are meant to be generated in the CI container.
//
// BASELINE HAND-OFF (sidebar-frame-header-carrier-01M4T3CB, WP03 T017, C-005).
// This mission moves the page frame, the rail and the toggle, so the committed
// `home-{light,dark}.png` no longer match, and the wide-viewport test below has NO
// committed baseline yet. Neither was regenerated in WP03 on purpose: two sibling
// work packages (sidebar shaping, draft publication) change the same pixels, so a
// baseline taken before they merge would be stale. Until the step below is run,
// both tests in this file fail in both projects; that is expected, not a defect.
//
// To regenerate, once every lane is merged into the mission's landing branch:
//   1. Push the branch, then dispatch the "Update a11y baselines" workflow
//      (.github/workflows/update-a11y-baselines.yml) with `target_branch` set to
//      it:  gh workflow run update-a11y-baselines.yml -f target_branch=<branch>
//      The workflow file must be on `main` to be dispatchable (it is).
//   2. It builds the example in `mcr.microsoft.com/playwright:v1.62.1-noble` with
//      `DK_DIAGRAM_BUILD_RENDER=on` and a PlantUML service container, runs
//      `pnpm test:a11y --update-snapshots`, and opens a pull request against the
//      branch with the changed files under `tests/a11y/__screenshots__/`.
//   3. Review the images against the causes recorded in the WP03 hand-off (frame
//      full width, rail pinned to the sidebar width at the frame edge, toggle
//      centred on the rail edge, sidebar entries), then merge that pull request.
//      Dispatch FROM the branch as well (`--ref <branch>`) when the branch changes
//      the workflow file: a dispatch runs the workflow copy on its ref, `main` by
//      default. This mission adds `DK_PUBLISH_DRAFTS: 'on'` to that workflow; the
//      copy on `main` builds without drafts until this branch is merged, and a
//      baseline from that build shows a sidebar the a11y lane never renders.
// Do not run `--update-snapshots` on a workstation: fonts and rasterisation differ
// from the pinned image and the result fails in CI.
//
// WARNING — local runs write files you must not commit. A local `pnpm test:a11y`
// has no baseline for the wide-viewport test, so Playwright WRITES
// `__screenshots__/visual.spec.ts/chrome-1920-{light,dark}.png` from the
// workstation's own rendering and reports the test as failed ("a snapshot doesn't
// exist ... writing actual"). Those files are untracked "actual" images, not
// baselines. Delete them after the run and never `git add` them: a
// workstation-rendered baseline fails in CI's pinned container. The only source
// of a committed `.png` here is the workflow above.
import { test, expect } from '@playwright/test';
import { ROUTES, TOC_RAIL_ROUTE, TOC_RAIL_TOGGLE } from './routes';
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

// Wide-viewport chrome baseline (WP03 T017). The home baseline above is taken at
// 1280px, where the pre-mission layout looked almost right; the defects this
// mission fixed showed from 1600px up. This one is taken at 1920px on a page with
// both a left sidebar and an outline rail, and hides the reading pane, so the image
// is the header, the two rails and the toggle: it moves when the layout moves and
// not when the article's wording does. The numeric guard is
// layout-geometry.spec.ts; this is its visual complement.
test.describe('wide-viewport chrome', () => {
  test.use({ viewport: { width: 1920, height: 800 } });

  test('header, sidebar, rail and toggle at 1920px', async ({ page }, testInfo) => {
    const mode = modeOf(testInfo.project.name);
    await gotoInMode(page, TOC_RAIL_ROUTE.path, mode);
    for (const root of TOC_RAIL_ROUTE.guardRoots) {
      await expect(page.locator(root), `non-vacuity: "${root}" must exist`).toHaveCount(1);
    }
    await expect(page.locator('nav.sidebar'), 'non-vacuity: the page has a left sidebar').toHaveCount(1);
    // The toggle is injected by a client script; capture only once it is there.
    await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);

    // Hidden with a style, not Playwright's `mask`: a mask is painted over the
    // pane's box and would cover the half of the toggle that sits on its edge.
    await page.addStyleTag({ content: '.main-pane { visibility: hidden !important; }' });

    await expect(page).toHaveScreenshot('chrome-1920.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});
