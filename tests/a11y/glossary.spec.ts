// Glossary — the DIRECT (Playwright, not axe) half of the WP06 hover-preview
// contract, plus the footprint twin, the JS-off fallback, and the observable
// count-pins (WP09 T033/T034; FR-009/FR-010/FR-014, NFR-001/NFR-003/NFR-005).
//
// axe (axe.spec.ts) scans the demonstrator route for WCAG violations and its
// non-vacuity guardRoots prove BOTH an auto-link and a `:term`-only link exist,
// but axe cannot assert WCAG 2.2 1.4.13 (Content on Hover or Focus): that the
// popover is HOVERABLE, DISMISSIBLE, and PERSISTENT. Those three are asserted
// here, directly, in BOTH colour modes. The network footprint (a glossary page
// pulls the preview chunk; a term-free control route does not) and the no-JS
// fallback (the "On this page" block + plain glossary anchors are in the served
// HTML) are asserted here too.
//
// Rendered popover (preview-popover.client.ts):
//   <div id="dk-glossary-popover" class="dk-glossary-popover" role="tooltip">…</div>
// It is hidden until an anchor is hovered/focused, shows the definition via
// textContent, stays open while the pointer is on it or the anchor holds focus,
// and closes only on pointer-leave (after a short bridge delay), blur, or Escape —
// never on an auto-hide timer.
import { test, expect, type Page } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf, type Mode } from './mode';

// A single-context term, so this anchor can ONLY be an auto-link; it carries a
// definition in the payload, so hovering it must reveal the popover.
const CARGO_LINK = 'a[data-glossary-term="cargo"]';
// The `:term`-only forced link on the context-free page (its own context is not hr).
const HR_POLICY_LINK = 'a[data-glossary-context="hr"][href*="/glossary/hr/#policy"]';
const POPOVER = '#dk-glossary-popover';
// The dynamic-import chunk the island pulls only where glossary links exist.
const PREVIEW_CHUNK = /preview-popover/i;
// Longer than the island's 160ms close-delay bridge — proves no auto-hide timer.
const PAST_CLOSE_DELAY_MS = 500;

/** Wait until the preview island has mounted (its shared popover is in the DOM).
 * The popover element only exists AFTER the dynamic preview chunk resolved and
 * `mountGlossaryPreview` ran, so this also proves the chunk loaded. */
async function waitForIslandMounted(page: Page): Promise<void> {
  await page.locator(POPOVER).waitFor({ state: 'attached' });
}

// ---------------------------------------------------------------------------
// NFR-001 / WCAG 2.2 1.4.13 — hoverable, persistent, dismissible, BOTH modes.
// ---------------------------------------------------------------------------
test.describe('Glossary hover preview — WCAG 2.2 1.4.13 (both modes)', () => {
  test('the popover is hoverable, persistent, and Esc-dismissible', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.glossaryDemo, mode);
    await waitForIslandMounted(page);

    const link = page.locator(CARGO_LINK).first();
    const popover = page.locator(POPOVER);

    // Hover the term → the popover opens with the term's definition text.
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await expect(popover, 'hovering a glossary link reveals the popover').toBeVisible();
    const text = (await popover.textContent())?.trim() ?? '';
    expect(text.length, 'the popover shows the definition text').toBeGreaterThan(0);

    // HOVERABLE (1.4.13): move the pointer from the link onto the popover; it must
    // NOT vanish (the close-delay bridge lets the pointer cross the gap).
    await popover.hover();
    await expect(popover, 'the popover survives the pointer moving onto it').toBeVisible();

    // PERSISTENT (1.4.13): with the pointer resting on the popover, wait well past
    // the bridge delay — there is no auto-hide timer, so it stays open.
    await page.waitForTimeout(PAST_CLOSE_DELAY_MS);
    await expect(popover, 'the popover does not auto-hide while hovered').toBeVisible();

    // DISMISSIBLE (1.4.13): Escape closes it without moving the pointer.
    await page.keyboard.press('Escape');
    await expect(popover, 'Escape dismisses the popover').toBeHidden();
  });

  test('keyboard focus reveals the popover and it persists while focused', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.glossaryDemo, mode);
    await waitForIslandMounted(page);

    const link = page.locator(CARGO_LINK).first();
    const popover = page.locator(POPOVER);

    // Focus (not hover) reveals it — the keyboard path of 1.4.13.
    await link.scrollIntoViewIfNeeded();
    await link.focus();
    await expect(popover, 'focusing a glossary link reveals the popover').toBeVisible();

    // PERSISTENT while focused: no auto-hide fires as long as the anchor holds
    // focus, so it is still open well past the bridge delay.
    await page.waitForTimeout(PAST_CLOSE_DELAY_MS);
    await expect(popover, 'the popover stays open while the link is focused').toBeVisible();

    // Escape dismisses the focus-revealed popover too.
    await page.keyboard.press('Escape');
    await expect(popover, 'Escape dismisses the focus-revealed popover').toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Popover placement + caret regression guard (#78, guarding #64 T004/T005).
// `position()` (preview-popover.client.ts) sets `data-placement` to 'bottom'
// (ample room below) or 'top' (viewport-bottom flip: spaceBelow < popoverHeight
// && spaceAbove > spaceBelow), and draws the caret via ::before/::after
// pseudo-elements keyed on `[data-placement]` — there is NO caret element, so
// the caret is asserted through two observable proxies: the popover's own
// `--dk-glossary-caret-left` custom property, and the active-placement
// pseudo-element's non-transparent border colour (border-bottom-color for
// 'bottom', border-top-color for 'top'). Both modes, per the sibling pattern.
// ---------------------------------------------------------------------------
test.describe('Glossary popover placement + caret (#78)', () => {
  type BorderSide = 'borderBottomColor' | 'borderTopColor';

  /** Read a pseudo-element's computed border colour for one side. Chromium
   * resolves the sheet's `border-color: transparent` base to the literal
   * `'rgba(0, 0, 0, 0)'`, so a real, placement-specific override reads as a
   * distinct (non-transparent) colour string. */
  async function pseudoBorderColor(
    page: Page,
    pseudo: '::before' | '::after',
    side: BorderSide,
  ): Promise<string> {
    return page.evaluate(
      ({ selector, pseudo, side }) => {
        const el = document.querySelector(selector);
        if (el === null) throw new Error(`element not found: ${selector}`);
        return getComputedStyle(el, pseudo)[side as BorderSide];
      },
      { selector: POPOVER, pseudo, side },
    );
  }

  /** Read the popover's own `--dk-glossary-caret-left` custom property (the
   * caret's horizontal-offset proxy) straight off its computed style. */
  async function caretLeftProperty(page: Page): Promise<string> {
    return page.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el === null) throw new Error(`element not found: ${selector}`);
      return getComputedStyle(el).getPropertyValue('--dk-glossary-caret-left').trim();
    }, POPOVER);
  }

  test('a term high in the viewport places the popover below, with an upward caret', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.glossaryDemo, mode);
    await waitForIslandMounted(page);

    // High in the viewport (first H2 section): ample space below at the default
    // viewport size, so position() must NOT flip.
    const link = page.locator(CARGO_LINK).first();
    const popover = page.locator(POPOVER);
    await link.scrollIntoViewIfNeeded();
    await link.hover();
    await expect(popover).toBeVisible();
    await expect(
      popover,
      'ample space below places the popover below the term',
    ).toHaveAttribute('data-placement', 'bottom');

    // Caret proxy 1: the horizontal-offset custom property is set.
    expect(
      await caretLeftProperty(page),
      '--dk-glossary-caret-left is set for the bottom-placed popover',
    ).not.toBe('');

    // Caret proxy 2: the 'bottom' placement's ::after fill draws a real
    // border-bottom-color (the caret triangle pointing UP at the term); the
    // unused border-top-color stays the sheet's transparent default.
    expect(
      await pseudoBorderColor(page, '::after', 'borderBottomColor'),
      '::after border-bottom-color is drawn (not transparent) for placement=bottom',
    ).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      await pseudoBorderColor(page, '::after', 'borderTopColor'),
      '::after border-top-color stays transparent for placement=bottom',
    ).toBe('rgba(0, 0, 0, 0)');
  });

  test('a term forced low in the viewport flips the popover above, with a downward caret', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.glossaryDemo, mode);
    await waitForIslandMounted(page);

    // Force position()'s flip condition (spaceBelow < popoverHeight &&
    // spaceAbove > spaceBelow): a short viewport, with the LAST cargo term
    // (final H2 section) scrolled to the viewport's bottom edge.
    const VIEWPORT_HEIGHT = 400;
    await page.setViewportSize({ width: 1000, height: VIEWPORT_HEIGHT });
    const link = page.locator(CARGO_LINK).last();
    await link.evaluate((el) => el.scrollIntoView({ block: 'end' }));

    // HONEST precondition (T008): the anchor really is low in the (short)
    // viewport BEFORE we open the popover, so a layout change that stops
    // reproducing this "low term" condition fails loudly here rather than
    // silently re-testing the 'bottom' case.
    const rectBottom = await link.evaluate((el) => el.getBoundingClientRect().bottom);
    expect(
      rectBottom,
      'precondition: the anchor sits in the bottom slice of the short viewport',
    ).toBeGreaterThan(VIEWPORT_HEIGHT * 0.85);
    expect(
      rectBottom,
      'precondition: the anchor has not been scrolled past the viewport',
    ).toBeLessThanOrEqual(VIEWPORT_HEIGHT + 1); // +1px: sub-pixel layout rounding

    const popover = page.locator(POPOVER);
    await link.hover();
    await expect(popover).toBeVisible();
    await expect(
      popover,
      'insufficient space below flips the popover above the term',
    ).toHaveAttribute('data-placement', 'top');

    // Caret proxy 1: the horizontal-offset custom property is still set for
    // the flipped popover.
    expect(
      await caretLeftProperty(page),
      '--dk-glossary-caret-left is set for the top-placed (flipped) popover',
    ).not.toBe('');

    // Caret proxy 2: the 'top' placement's ::after fill draws a real
    // border-top-color (the caret triangle pointing DOWN at the term); the
    // unused border-bottom-color stays the sheet's transparent default.
    expect(
      await pseudoBorderColor(page, '::after', 'borderTopColor'),
      '::after border-top-color is drawn (not transparent) for placement=top',
    ).not.toBe('rgba(0, 0, 0, 0)');
    expect(
      await pseudoBorderColor(page, '::after', 'borderBottomColor'),
      '::after border-bottom-color stays transparent for placement=top',
    ).toBe('rgba(0, 0, 0, 0)');
  });
});

// ---------------------------------------------------------------------------
// NFR-003 / FP-1 (footprint twin) + R-6 (pinned term-free control route).
// ---------------------------------------------------------------------------
test.describe('Glossary preview footprint (NFR-003 / R-6)', () => {
  // Collect every http(s) request a navigation makes and settle the network.
  async function traceRoute(page: Page, path: string, waitForIsland: boolean): Promise<string[]> {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto(path, { waitUntil: 'load' });
    if (waitForIsland) await waitForIslandMounted(page);
    await page.waitForLoadState('networkidle');
    return urls;
  }

  test('a glossary page pulls the preview chunk; a term-free control route does not; no CDN', async ({
    page,
  }) => {
    // Glossary page: the island mounts, so the preview chunk IS requested.
    const glossaryUrls = await traceRoute(page, ROUTES.glossaryDemo, true);
    const pageOrigin = new URL(page.url()).origin;
    expect(
      glossaryUrls.some((u) => PREVIEW_CHUNK.test(u)),
      'the glossary page must request the preview-popover chunk',
    ).toBe(true);

    // R-6: the control route is a PINNED, term-free page. Guard it FIRST — if the
    // definitions file ever grows a term this page happens to use, the auto-linker
    // would silently add a link and rot the negative direction of the twin. This
    // asserts the control route carries ZERO glossary anchors before trusting it.
    await page.goto(ROUTES.prose, { waitUntil: 'load' });
    await expect(
      page.locator('a[data-glossary-term]'),
      'the control route must carry no glossary links (term-free)',
    ).toHaveCount(0);

    // Control route: with no glossary anchors the island short-circuits BEFORE the
    // dynamic import, so the preview chunk is never resolved.
    const controlUrls = await traceRoute(page, ROUTES.prose, false);
    expect(
      controlUrls.some((u) => PREVIEW_CHUNK.test(u)),
      'a term-free control route must NOT request the preview-popover chunk',
    ).toBe(false);

    // No external/CDN host in EITHER trace — the whole runtime is self-hosted.
    for (const u of [...glossaryUrls, ...controlUrls]) {
      if (!u.startsWith('http')) continue; // ignore data:/blob: (no host)
      expect(
        new URL(u).origin,
        `unexpected off-origin request (possible CDN): ${u}`,
      ).toBe(pageOrigin);
    }
  });
});

// ---------------------------------------------------------------------------
// NFR-005 / R-5 — no-JS fallback: the "On this page" block and its plain glossary
// anchors are in the SERVED HTML, independent of the hover island.
// ---------------------------------------------------------------------------
test.describe('Glossary no-JS fallback (NFR-005 / R-5)', () => {
  test.use({ javaScriptEnabled: false });

  test('the On-this-page block and plain glossary anchors are served without JS', async ({
    page,
  }) => {
    await page.goto(ROUTES.glossaryDemo, { waitUntil: 'domcontentloaded' });

    // The block is server-rendered (no island needed): its container and the
    // "Glossary links used" panel are present in the static HTML.
    await expect(
      page.locator('.dk-on-this-page'),
      'the On-this-page block is server-rendered',
    ).toHaveCount(1);
    await expect(
      page.locator('.dk-panel--glossary'),
      'the glossary links-used panel is present with JS off',
    ).toHaveCount(1);

    // The block's plain glossary anchors point at real glossary routes and work
    // with JS off (the hover island is orthogonal).
    const blockLinks = page.locator('a.dk-glossary-links__link');
    await expect(blockLinks, 'the block lists the two distinct glossary links used').toHaveCount(2);
    await expect(blockLinks.first()).toHaveAttribute('href', /\/glossary\/[a-z]+\/#/);

    // The body auto-links / `:term` anchors are plain SSR links too — present, and
    // no popover element is mounted (JS is off).
    await expect(page.locator(CARGO_LINK).first()).toBeVisible();
    await expect(page.locator(POPOVER), 'no island mounts with JS off').toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// T034 count-pins — the observable numbers a regression would move.
// ---------------------------------------------------------------------------
test.describe('Glossary observable count-pins (T034)', () => {
  // The three generated glossary routes: the hub + one page per context.
  const GENERATED_ROUTES = [
    `${'/doc-kitty'}/glossary/`,
    `${'/doc-kitty'}/glossary/shipping/`,
    `${'/doc-kitty'}/glossary/hr/`,
  ];

  test('the demonstrator, control, and generated routes carry the pinned counts', async ({
    page,
  }) => {
    await page.goto(ROUTES.glossaryDemo, { waitUntil: 'domcontentloaded' });

    // Total glossary anchors on the context-free demonstrator: 3 auto-linked
    // `cargo` (first-per-section across three sections) + 1 forced `:term` `policy`.
    await expect(page.locator('a[data-glossary-term]')).toHaveCount(4);
    // Auto-link count: the single-context `cargo` links (the alias `consignment`
    // and the plain occurrences that head their sections all resolve to `cargo`).
    await expect(page.locator(CARGO_LINK)).toHaveCount(3);
    // `:term` resolution count: exactly the one forced hr link.
    await expect(page.locator(HR_POLICY_LINK)).toHaveCount(1);
    // The On-this-page block lists the two DISTINCT terms used (cargo, policy).
    await expect(page.locator('a.dk-glossary-links__link')).toHaveCount(2);

    // Exactly three generated routes serve (the hub + one page per context), each
    // a real 200 page with rendered content.
    for (const route of GENERATED_ROUTES) {
      const resp = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(resp?.status(), `generated route ${route} serves 200`).toBe(200);
      await expect(page.locator('main'), `generated route ${route} renders`).toBeVisible();
    }

    // The hub body links exactly the two generated context pages (pins the context
    // count). The hub uses relative hrefs (`./hr/`, `./shipping/`) that resolve
    // in-browser to the real routes, so match on the relative tail.
    await page.goto(GENERATED_ROUTES[0], { waitUntil: 'domcontentloaded' });
    const hubLinks = page.locator('main .sl-markdown-content a');
    await expect(hubLinks, 'the hub lists exactly the two context pages').toHaveCount(2);
    await expect(page.locator('main .sl-markdown-content a[href$="shipping/"]')).toHaveCount(1);
    await expect(page.locator('main .sl-markdown-content a[href$="hr/"]')).toHaveCount(1);

    // The pinned control route stays term-free (guards the footprint twin).
    await page.goto(ROUTES.prose, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('a[data-glossary-term]')).toHaveCount(0);
  });
});
