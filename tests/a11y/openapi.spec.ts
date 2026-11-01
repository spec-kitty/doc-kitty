// OpenAPI reference pages (mission openapi-reference-pages, WP03): chrome, theming and
// static-only, in BOTH colour modes. Axe over the pages is in axe.spec.ts (the pages
// are in AXE_PAGES); this file pins what axe cannot see.
//
//   FR-003  every page links to every other version, through the site base
//   FR-004  the unreleased version says "unreleased" in text; the released one does not
//   FR-005  a branding override of a `--dk-*` token reaches the badges in both modes,
//           and the renderer's own stylesheet is not loaded
//   FR-009  no request for the document, no request console, with scripts on or off
//   NFR-002 no external origin; only the pinned renderer's inline scripts
import { test, expect } from '@playwright/test';
import { BASE, ROUTES } from './routes';
import { gotoInMode, modeOf } from './mode';
import { OPENAPI_INLINE_ALLOWLIST, cspAdditions } from '../../src/scripts/assert-openapi-artifacts.mjs';

// The raw document is published next to the pages; a page must never fetch it.
const DOCUMENT_REQUEST = /\/openapi\.(ya?ml|json)(\.sha256)?(\?|$)/;
const FIXTURE_OPERATION_TEXT = 'Create a parcel';

/**
 * Signs of a request console in the served HTML: a form, a "try" control, or the
 * renderer's code-sample widgets (which the integration switches off).
 */
export function consoleSignals(page: string): string[] {
  // The site search form is chrome; the console would be in the content.
  const html = /<main[\s>][\s\S]*<\/main>/i.exec(page)?.[0] ?? page;
  const signals: string[] = [];
  if (/<form[\s>]/i.test(html)) signals.push('form');
  if (/\bsl-openapi-snippet(s|-picker)?\b/.test(html)) signals.push('code samples');
  if (/\b(try[- ]?it|send[- ]request|api-?console)\b/i.test(html)) signals.push('try control');
  return signals;
}

test.describe('version links and badge (FR-003, FR-004)', () => {
  test('the released version links to main, says nothing is unreleased about itself', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiV1, modeOf(testInfo.project.name));
    const nav = page.locator('.dk-openapi-nav');
    await expect(nav).toHaveCount(1);
    await expect(nav.locator('.dk-openapi-nav__current')).not.toContainText('unreleased');
    const link = nav.getByRole('link', { name: 'main' });
    await expect(link).toHaveAttribute('href', `${BASE}/reference/api/main/`);
    // The other version's badge is next to its link, in text.
    await expect(nav.locator('li').filter({ has: page.getByRole('link', { name: 'main' }) })).toContainText('unreleased');
    // The current version is not a link to itself.
    await expect(nav.getByRole('link', { name: 'v1' })).toHaveCount(0);
  });

  test('the unreleased version carries the text badge and links to v1', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiMain, modeOf(testInfo.project.name));
    const nav = page.locator('.dk-openapi-nav');
    await expect(nav.locator('.dk-openapi-nav__current .dk-openapi-badge')).toHaveText('unreleased');
    await expect(nav.getByRole('link', { name: 'v1' })).toHaveAttribute('href', `${BASE}/reference/api/v1/`);
    await expect(nav.getByRole('link', { name: 'v1' }).locator('..')).not.toContainText('unreleased');
  });

  test('an operation page has the same nav', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiOperation, modeOf(testInfo.project.name));
    await expect(page.locator('.dk-openapi-nav a[href$="/reference/api/main/"]')).toHaveCount(1);
  });

  test('an ordinary page has no version nav', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.prose, modeOf(testInfo.project.name));
    await expect(page.locator('.dk-openapi-nav')).toHaveCount(0);
  });
});

test.describe('theming (FR-005)', () => {
  test('the renderer stylesheet is not loaded: its own custom properties are undefined', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiOperation, modeOf(testInfo.project.name));
    const hue = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--sl-openapi-method-hue-get'),
    );
    expect(hue.trim(), 'the renderer stylesheet defines --sl-openapi-method-hue-get').toBe('');
  });

  test('a branding override of --dk-color-warning-bg reaches the unreleased badge', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiMain, modeOf(testInfo.project.name));
    const badge = page.locator('.dk-openapi-nav__current .dk-openapi-badge');
    const before = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.evaluate(() => document.documentElement.style.setProperty('--dk-color-warning-bg', 'rgb(1, 2, 3)'));
    const after = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).toBe('rgb(1, 2, 3)');
    expect(before, 'the override must change something').not.toBe(after);
  });

  test('a branding override of --dk-color-success-bg reaches the POST method badge', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiOperation, modeOf(testInfo.project.name));
    const badge = page.locator('main .sl-openapi-operation-method-badge').first();
    await expect(badge).toContainText(/post/i);
    await page.evaluate(() => document.documentElement.style.setProperty('--dk-color-success-bg', 'rgb(4, 5, 6)'));
    expect(await badge.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(4, 5, 6)');
  });

  test('the method badge text is the body colour token, not the renderer white', async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.openApiOperation, modeOf(testInfo.project.name));
    const badge = page.locator('main .sl-openapi-operation-method-badge').first();
    await page.evaluate(() => document.documentElement.style.setProperty('--dk-color-text-strong', 'rgb(7, 8, 9)'));
    expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(7, 8, 9)');
  });
});

test.describe('static only (FR-009, NFR-002)', () => {
  test('no request for the document, no console, no external origin (scripts on)', async ({ page, baseURL }, testInfo) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await gotoInMode(page, ROUTES.openApiOperation, modeOf(testInfo.project.name));
    await page.waitForLoadState('networkidle');
    expect(requests.filter((u) => DOCUMENT_REQUEST.test(u)), 'a page fetched the raw document').toEqual([]);
    const origin = new URL(baseURL ?? 'http://localhost').origin;
    expect(requests.filter((u) => !u.startsWith(origin) && !u.startsWith('data:')), 'external requests').toEqual([]);
    expect(consoleSignals(await page.content())).toEqual([]);
    // NFR-002 as waived: the inline hashes of the SERVED HTML equal an ordinary page's,
    // plus ONLY the pinned allowlist (the renderer's picker script and the overview style
    // attribute). A CSP hash covers served markup, not the style a script sets on an
    // element afterwards, so the DOM after scripts is the wrong thing to hash.
    const served = async (url: string) => (await page.request.get(url)).text();
    const reference = await served(page.url());
    // Several ordinary pages, since Starlight's own inline style attributes vary with the
    // page (a nested table of contents adds `--depth: 1`); the build gate compares with
    // every ordinary page of the site.
    const ordinary = await Promise.all(
      [ROUTES.prose, ROUTES.blocks, ROUTES.glossaryDemo, ROUTES.hub, ROUTES.markuaShowcase].map((route) => served(new URL(route, page.url()).href)),
    );
    const additions = cspAdditions([reference], ordinary);
    expect(additions.problems, 'inline additions beyond the pinned allowlist').toEqual([]);
    expect(additions.scripts, 'the renderer script is the pinned one').toEqual([...OPENAPI_INLINE_ALLOWLIST.scripts]);
  });

  test('the allowlist bites: an unpinned inline script is reported (negative control)', () => {
    const ordinary = '<html><body><main>x</main></body></html>';
    const withSnippets = `<main><script type="module">customElements.define('sl-openapi-snippet-picker', class {})</script></main>`;
    const picker = `<script type="module">${'x'.repeat(3)}</script>`;
    expect(cspAdditions([withSnippets], [ordinary]).problems).toHaveLength(1);
    // A script that an ordinary page also carries is not an addition.
    expect(cspAdditions([picker], [picker]).problems).toEqual([]);
    // A style attribute is an addition too, and is not pinned unless it is the overview one.
    expect(cspAdditions(['<p style="color: red">x</p>'], [ordinary]).problems).toHaveLength(1);
  });

  test('the console detector bites: a console in the HTML is reported (negative control)', () => {
    expect(consoleSignals('<main><form action="x"><button>Send</button></form></main>')).toContain('form');
    expect(consoleSignals('<div class="sl-openapi-snippets"></div>')).toContain('code samples');
    expect(consoleSignals('<main><p>plain</p></main>')).toEqual([]);
  });
});

test.describe('static only, scripts off (FR-009)', () => {
  test.use({ javaScriptEnabled: false });

  test('the operation text is in the served HTML and the document is never requested', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.goto(ROUTES.openApiOperation, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(FIXTURE_OPERATION_TEXT);
    await expect(page.locator('main')).toContainText('recipient');
    await expect(page.locator('.dk-openapi-nav a[href$="/reference/api/main/"]')).toHaveCount(1);
    expect(requests.filter((u) => DOCUMENT_REQUEST.test(u))).toEqual([]);
  });
});
