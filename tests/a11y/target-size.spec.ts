// NFR-004 guard: every interactive target in the page chrome (header, sidebar,
// rail, footer) is at least 24 x 24 CSS px or meets the WCAG 2.2 SC 2.5.8 spacing
// exception (layout-guards-decisions WP06 T033/T034; issue #202; mission
// sidebar-frame-header-carrier-01M4T3CB NFR-004).
//
// Matrix: three routes (the home page; a long sidebar; a dense outline) at 1280
// and 1920px, rail expanded and collapsed, plus 390 x 800 with the mobile menu
// open (sidebar region only). One page load per cell. Each region that should be
// there must hold at least one target, so a moved selector fails instead of
// passing on nothing. Measured on 2026-10-19 (research for #202): header 32 x 32,
// sidebar links at least 28 tall, outline links exactly 24.0 tall, toggle
// 32 x 32, footer pagination 320 x 92.
//
// FAIL-FIRST (T035): with `.right-sidebar-panel a{min-block-size:0;min-height:0;
// padding-block:0}` injected (the `MUTATION` hook below), all six expanded cells
// went red with `rail ...` messages (outline links 15px tall, centres 15px
// apart); the collapsed cells stay green, as the outline is not rendered there
// (recorded in the WP06 history).
//
// Element boxes only, no text metrics. Geometry does not depend on the colour
// scheme, so this spec runs in the `light` project and skips in `dark`.
import { test, expect, type Page } from '@playwright/test';
import { ROUTES, TOC_RAIL_TOGGLE, isLightProject } from './routes';
import { settle } from './helpers/geometry';
import { collectTargets, targetSizeFailures, type Region, type Target } from './helpers/targets';

const HEIGHT = 900;
const COLLAPSED_KEY = 'dk-toc-collapsed';
const TOGGLE_ID = TOC_RAIL_TOGGLE.replace(/^#/, '');
/** Temporary fail-first hook (T035): CSS injected into every desktop cell. Empty when committed. */
const MUTATION = '';

const MATRIX_ROUTES = [
  ['home', ROUTES.home],
  ['long sidebar', `${ROUTES.rhetoricChapter.replace(/chapter-01\/$/, '')}chapter-15/`],
  ['dense outline', ROUTES.behaviourFeature],
] as const;
const DESKTOP_WIDTHS = [1280, 1920] as const;
const ALL_REGIONS: readonly Region[] = ['header', 'sidebar', 'rail', 'footer'];

test.beforeEach(({}, testInfo) => {
  test.skip(!isLightProject(testInfo), 'geometry is identical in both colour schemes');
});

function report(targets: readonly Target[], where: string): void {
  for (const failure of targetSizeFailures(targets)) {
    expect.soft(failure, `${where}: ${failure}`).toBe('');
  }
}

function count(targets: readonly Target[], region: Region): number {
  return targets.filter((t) => t.region === region).length;
}

/** `region N (min WxH)`, for the run's annotations. */
function summary(targets: readonly Target[], regions: readonly Region[]): string {
  return regions
    .map((r) => {
      const own = targets.filter((t) => t.region === r);
      if (own.length === 0) return `${r} 0`;
      const w = Math.min(...own.map((t) => t.rect.width));
      const h = Math.min(...own.map((t) => t.rect.height));
      return `${r} ${own.length} (min ${w}x${h})`;
    })
    .join(', ');
}

async function loadDesktop(page: Page, path: string, width: number, collapsed: boolean): Promise<void> {
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
  await page.goto(path, { waitUntil: 'load' });
  await page.locator(TOC_RAIL_TOGGLE).waitFor({ state: 'visible', timeout: 15_000 });
  const html = page.locator('html');
  if (collapsed) await expect(html).toHaveAttribute('data-toc-collapsed', '');
  else await expect(html).not.toHaveAttribute('data-toc-collapsed', /.*/);
  if (MUTATION) await page.addStyleTag({ content: MUTATION });
  await settle(page);
}

test.describe('NFR-004: chrome targets are at least 24 x 24 or spaced (SC 2.5.8)', () => {
  for (const [name, path] of MATRIX_ROUTES) {
    for (const width of DESKTOP_WIDTHS) {
      for (const collapsed of [false, true]) {
        const state = collapsed ? 'collapsed' : 'expanded';
        test(`${name} at ${width}px, rail ${state}`, async ({ page }) => {
          await loadDesktop(page, path, width, collapsed);
          const targets = await collectTargets(page, ALL_REGIONS);
          const where = `${name} ${width}px ${state}`;
          // Every route here has a sidebar, an outline and a site footer.
          for (const region of ALL_REGIONS) {
            expect(count(targets, region), `${where}: the ${region} region has targets`).toBeGreaterThan(0);
          }
          const rail = targets.filter((t) => t.region === 'rail');
          expect(rail.some((t) => t.id === TOGGLE_ID), `${where}: the rail includes the toggle`).toBe(true);
          if (collapsed) {
            // The outline panel is `display: none`; only the toggle is left.
            expect(rail.map((t) => t.label), `${where}: collapsed, the rail holds the toggle only`).toHaveLength(1);
          } else {
            expect(rail.length, `${where}: expanded, the rail holds outline links besides the toggle`).toBeGreaterThan(1);
          }
          test.info().annotations.push({
            type: 'measured',
            description: `${where}: ${summary(targets, ALL_REGIONS)}`,
          });
          report(targets, where);
        });
      }
    }

    test(`${name} at 390 x 800, mobile menu open: sidebar targets`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(path, { waitUntil: 'load' });
      // Starlight 0.42: the mobile menu is a popover button.
      await page.locator('button[popovertarget="starlight__sidebar"]').click();
      await expect(page.locator('#starlight__sidebar')).toBeVisible();
      await settle(page);
      const targets = await collectTargets(page, ['sidebar']);
      expect(count(targets, 'sidebar'), `${name} mobile: the sidebar region has targets`).toBeGreaterThan(0);
      test.info().annotations.push({ type: 'measured', description: `${name} mobile: ${summary(targets, ['sidebar'])}` });
      report(targets, `${name} 390px menu open`);
    });
  }
});

// ---------------------------------------------------------------------------
// T033 — the spacing check itself, on synthetic targets (no page).
// ---------------------------------------------------------------------------
test.describe('SC 2.5.8 spacing check (synthetic)', () => {
  let n = 0;
  const target = (x: number, y: number, width: number, height: number, label?: string): Target => {
    n += 1;
    const rect = { x, y, width, height };
    return { region: 'rail', label: label ?? `t${n}`, rect, rects: [rect], path: `0/${n}`, id: '' };
  };

  test('a 24 x 24 target passes', () => {
    expect(targetSizeFailures([target(0, 0, 24, 24)])).toEqual([]);
  });

  test('an isolated 20 x 20 target passes under the spacing exception', () => {
    expect(targetSizeFailures([target(0, 0, 20, 20), target(100, 0, 24, 24)])).toEqual([]);
  });

  test('a 20 x 20 target with a neighbour 10px from its centre fails', () => {
    // Centre at x 10; the neighbour's rect starts at x 20, inside the 12px radius.
    const failures = targetSizeFailures([target(0, 0, 20, 20, 'small'), target(20, 0, 24, 24, 'big')]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('rail "small" 20x20');
    expect(failures[0]).toContain('"big"');
  });

  test('two undersized targets 20px apart fail', () => {
    // Centres 20px apart (x 8 and 28): their 24px circles overlap. Each centre is
    // exactly 12px from the other's rect, so only the circle rule catches it.
    const failures = targetSizeFailures([target(0, 0, 16, 16, 'a'), target(20, 0, 16, 16, 'b')]);
    expect(failures).toHaveLength(2);
    expect(failures.join('\n')).toContain('between its centre and undersized');
  });

  test('nested targets are one target', () => {
    const outer = target(0, 0, 20, 20, 'outer');
    const inner = { ...target(2, 2, 16, 16, 'inner'), path: `${outer.path}/0` };
    expect(targetSizeFailures([outer, inner])).toEqual([]);
  });
});
