// No-sidebar simulation for the FR-010 recentre guard (layout-guards-decisions,
// WP06 T030; issue #199).
//
// FR-010 (mission sidebar-frame-header-carrier-01M4T3CB) says that on a page with
// an outline rail and NO left sidebar the reading column is centred. The example
// site has no such page, and this lane adds none: a fixture page would change the
// example's page and sitemap counts, which other guards pin (C-003: no test pages
// in the example). So the shape is derived from a real rail page in the browser.
//
// Why this equals a real `StarlightPage hasSidebar={false}` page. Starlight 0.42
// renders the left sidebar as `nav.sidebar` (the static wrapper, which also holds
// the mobile menu button) around `sl-sidebar-pane#starlight__sidebar.sidebar-pane`
// (the FIXED pane), and marks the root with `data-has-sidebar`. A page built with
// `hasSidebar: false` has neither: no attribute and no `nav.sidebar` at all. The
// simulation removes both. Removing only the attribute is NOT enough: the fixed
// pane would stay painted over the reading pane, a shape that never ships.
// Research (docs/architecture/research/layout-guards-and-decisions.md, #199):
// measured against a real `hasSidebar={false}` page at 1152, 1280, 1600, 1920 and
// 2560px, expanded and collapsed, all ten points matched this simulation within
// 1px (the column was 60rem; the toolkit overrides Starlight's 67.5rem
// no-sidebar width).
import { expect, type Page } from '@playwright/test';

/** The outermost sidebar element that takes layout; it contains the fixed pane. */
export const SIDEBAR_WRAPPER = 'nav.sidebar';

/**
 * Turn the loaded rail page into its no-sidebar twin, wait for layout, and
 * assert the result is honest: no sidebar left in the DOM, the rail kept.
 */
export async function simulateNoSidebar(page: Page): Promise<void> {
  const state = await page.evaluate(async (wrapper) => {
    const root = document.documentElement;
    const hadAttribute = root.hasAttribute('data-has-sidebar');
    const removed = document.querySelectorAll(wrapper).length;
    root.removeAttribute('data-has-sidebar');
    document.querySelectorAll(wrapper).forEach((el) => el.remove());
    // A stray pane outside the wrapper would still cover the reading pane.
    document.querySelectorAll('.sidebar-pane, #starlight__sidebar').forEach((el) => el.remove());
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    return {
      hadAttribute,
      removed,
      hasAttribute: root.hasAttribute('data-has-sidebar'),
      sidebar: document.querySelectorAll('#starlight__sidebar').length,
      pane: document.querySelectorAll('.sidebar-pane').length,
      hasToc: root.hasAttribute('data-has-toc'),
    };
  }, SIDEBAR_WRAPPER);

  // Non-vacuity: the page really had a sidebar to remove.
  expect(state.hadAttribute, 'simulation: the page had data-has-sidebar before').toBe(true);
  expect(state.removed, `simulation: exactly one "${SIDEBAR_WRAPPER}" was removed`).toBe(1);
  // The result is the no-sidebar shape.
  expect(state.hasAttribute, 'simulation: data-has-sidebar is gone').toBe(false);
  expect(state.sidebar, 'simulation: no #starlight__sidebar is left').toBe(0);
  expect(state.pane, 'simulation: no .sidebar-pane is left').toBe(0);
  // ... and the rail stays: without it this is not the FR-010 page.
  expect(state.hasToc, 'simulation: data-has-toc is still present').toBe(true);
}
