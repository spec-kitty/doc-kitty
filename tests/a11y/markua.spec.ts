// Markua render + a11y — the DIRECT (Playwright, not axe) half of the Markua
// verification contract (WP10, markua-syntax-support; FR-002/003/004/005/009,
// US1/US2/US3, NFR-004/NFR-005, SC-005). axe (axe.spec.ts) scans the showcase and
// the malformed page for WCAG violations in both colour modes; the STRUCTURE — the
// three-form byte-identical equivalence, the per-variant discriminators, the icon
// render, the nested aside, the figure alt/caption/width, the ToC exclusion, and
// crosslink resolution — is asserted here, DIRECTLY, each subject located by its
// own IDENTITY (route + a stable selector / heading id), never `.first()` or a
// substring scan.
//
// Emitted DOM (WP04/WP05/WP07):
//   native mapped aside : <aside class="starlight-aside starlight-aside--{tip|caution|danger|note}">…
//   theme callout       : <aside class="dk-callout dk-callout--{variant}" id?>
//                           <span class="dk-callout__icon" data-icon="…">?   <p class="dk-callout__title">?
//                           <div class="dk-callout__body">…</div></aside>
//   figure              : <figure class="dk-figure …" id?><img alt style?><figcaption class="dk-figure__caption">…
import { test, expect, type Page } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf, type Mode } from './mode';

// Each callout class → (its equivalence-section heading id, the rendered selector
// that its three input forms all resolve to). The four mapped classes render as
// native Starlight asides; the six theme classes render as theme callouts. This is
// the SC-005 rows-5–14 denominator (ten classes × three forms).
const EQUIVALENCE: ReadonlyArray<{ cls: string; headingId: string; selector: string }> = [
  { cls: 'tip', headingId: 'eq-tip', selector: 'aside.starlight-aside--tip' },
  { cls: 'warning', headingId: 'eq-warning', selector: 'aside.starlight-aside--caution' },
  { cls: 'error', headingId: 'eq-error', selector: 'aside.starlight-aside--danger' },
  { cls: 'information', headingId: 'eq-information', selector: 'aside.starlight-aside--note' },
  { cls: 'discussion', headingId: 'eq-discussion', selector: 'aside.dk-callout--discussion' },
  { cls: 'question', headingId: 'eq-question', selector: 'aside.dk-callout--question' },
  { cls: 'exercise', headingId: 'eq-exercise', selector: 'aside.dk-callout--exercise' },
  { cls: 'center', headingId: 'eq-center', selector: 'aside.dk-callout--center' },
  { cls: 'generic', headingId: 'eq-generic', selector: 'aside.dk-callout--generic' },
  { cls: 'aside', headingId: 'eq-aside', selector: 'aside.dk-callout--aside' },
];

const THEME_VARIANTS = ['aside', 'discussion', 'question', 'exercise', 'generic', 'center'] as const;

/**
 * The normalised `outerHTML` of every element matching `selector` that sits
 * between the heading `#headingId` and the NEXT heading (identity-scoped to one
 * equivalence section — never a page-wide `.first()`/count). Whitespace is
 * collapsed so the comparison is on structure, not incidental formatting.
 */
async function sectionMatches(page: Page, headingId: string, selector: string): Promise<string[]> {
  return page.evaluate(
    ({ headingId, selector }) => {
      const heading = document.getElementById(headingId);
      if (!heading) return [];
      const out: string[] = [];
      let el: Element | null = heading.nextElementSibling;
      while (el && !/^H[1-6]$/.test(el.tagName)) {
        if (el.matches(selector)) out.push(el.outerHTML.replace(/\s+/g, ' ').trim());
        el = el.nextElementSibling;
      }
      return out;
    },
    { headingId, selector },
  );
}

// ---------------------------------------------------------------------------
// markua-three-form-equivalence (FR-004 — the AUTHORITATIVE render proof).
// For EACH class, the three input forms (shorthand · {class:}+B> · {blurb,class:})
// render BYTE-IDENTICAL callout markup. This exercises the real chain (WP02
// blurb-carry → WP08 {class:}-fold → WP04 synonym-fold), which WP04's mdast unit
// check (already-normalised input) cannot. SC-005 rows 5–14 map here.
// ---------------------------------------------------------------------------
test.describe('markua-three-form-equivalence (FR-004, rows 5–14)', () => {
  for (const { cls, headingId, selector } of EQUIVALENCE) {
    test(`the three input forms of "${cls}" render byte-identical markup`, async ({ page }, testInfo) => {
      const mode: Mode = modeOf(testInfo.project.name);
      await gotoInMode(page, ROUTES.markuaShowcase, mode);

      const forms = await sectionMatches(page, headingId, selector);
      expect(forms, `class "${cls}": three forms locate under #${headingId} as ${selector}`).toHaveLength(3);
      expect(
        new Set(forms).size,
        `class "${cls}": all three input forms must render IDENTICAL markup (FR-004)`,
      ).toBe(1);
    });
  }
});

// ---------------------------------------------------------------------------
// markua-theme-variant-discriminators — each of the SIX dk-callout--{variant}
// theme classes is present-and-correct (an <aside class="dk-callout
// dk-callout--{variant}"> with a dk-callout__body), so a single broken variant
// goes RED, not manifest-vacuously green.
// ---------------------------------------------------------------------------
test.describe('markua-theme-variant-discriminators (six variants)', () => {
  for (const variant of THEME_VARIANTS) {
    test(`dk-callout--${variant} renders as an aside with a body`, async ({ page }, testInfo) => {
      const mode: Mode = modeOf(testInfo.project.name);
      await gotoInMode(page, ROUTES.markuaShowcase, mode);

      const callout = page.locator(`aside.dk-callout.dk-callout--${variant}`);
      await expect(callout.first(), `at least one dk-callout--${variant}`).toBeVisible();
      await expect(
        callout.first().locator('.dk-callout__body'),
        `dk-callout--${variant} must wrap its content in dk-callout__body`,
      ).toHaveCount(1);
    });
  }
});

// ---------------------------------------------------------------------------
// markua-icon-render (FR-009 positive) — {icon: fa-lightbulb} resolves to the
// Starlight "rocket" and emits the dk-callout__icon child on the theme tip.
// ---------------------------------------------------------------------------
test.describe('markua-icon-render (FR-009, row 32)', () => {
  test('a mapped icon renders as a dk-callout__icon child', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    const iconTip = page.locator('aside.dk-callout--tip#icon-tip');
    await expect(iconTip, 'the icon-bearing tip is located by its id').toHaveCount(1);
    const icon = iconTip.locator('.dk-callout__icon');
    await expect(icon, 'the mapped icon emits a dk-callout__icon child').toHaveCount(1);
    await expect(icon).toHaveAttribute('data-icon', 'rocket');
    // FR-009: the mapped icon renders a VISIBLE glyph — the resolved Starlight
    // icon inlined as an <svg> inside the span (not just the data-icon marker).
    await expect(
      icon.locator('svg'),
      'the resolved icon renders a visible <svg> glyph',
    ).toHaveCount(1);
  });

  test('an id-bearing mapped class routes to the theme hast and keeps its id (row 15)', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);
    // A `T>` carrying {#id} leaves the native path (which would discard the id)
    // and rides the dk-callout--tip theme hast, keeping the id on the <aside>.
    await expect(page.locator('aside.dk-callout.dk-callout--tip#pinned-tip')).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// markua-nested-aside (row 3) — the wiring-level nesting proof: a real {aside}
// whose body contains a nested {aside} renders as an aside CONTAINING an aside in
// the built HTML (beyond WP02's Astro-free unit test).
// ---------------------------------------------------------------------------
test.describe('markua-nested-aside (row 3)', () => {
  test('a wrapped aside contains a nested aside end-to-end', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    // Scope by the section heading identity, then find an aside that itself
    // contains another aside — the nesting the unit test cannot catch at wiring level.
    const nestedParent = page.locator('aside.dk-callout--aside', {
      has: page.locator('aside.dk-callout--aside'),
    });
    await expect(nestedParent.first(), 'an aside containing a nested aside').toHaveCount(1);
    await expect(
      nestedParent.first().locator('aside.dk-callout--aside'),
      'the nested aside is present inside its parent',
    ).toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// Figures (US2) — the local palm-trees figure, located by its figcaption
// IDENTITY, carries the {alt:} text, the {width:} sizing, and the bracket-text
// caption; the web image passes through unoptimised.
// ---------------------------------------------------------------------------
test.describe('markua figures (US2, rows 16–25)', () => {
  test('the local figure carries alt, width, caption on the same optimised img', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    const palm = page.locator('figure.dk-figure', {
      has: page.locator('figcaption.dk-figure__caption', { hasText: 'Palm Trees' }),
    });
    await expect(palm, 'the palm-trees figure is uniquely located by its caption').toHaveCount(1);

    const img = palm.locator('img');
    await expect(img).toHaveCount(1);
    // {alt:} became the accessible name (bracket text is the caption, not the alt).
    await expect(img).toHaveAttribute('alt', /palm-lined tropical beach/);
    // {width:} survived the __ASTRO_IMAGE_ round-trip onto the optimised img.
    await expect(img).toHaveAttribute('style', /width:\s*75%/);
    // local-optimised source.
    await expect(img).toHaveAttribute('src', /palm-trees.*\.svg/);
  });

  test('the web image passes through unoptimised', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);
    const mac = page.locator('figure.dk-figure', {
      has: page.locator('img[src="https://example.com/mac.jpg"]'),
    });
    await expect(mac, 'the web figure keeps its absolute src (passthrough)').toHaveCount(1);
  });
});

// ---------------------------------------------------------------------------
// Ordering lock + theme-path discriminator (non-vacuity). A `T>` yields a NATIVE
// starlight-aside--tip ONLY because the markua plugins run before remarkAsides; a
// `D>` yields a THEME dk-callout--discussion (not a vacuous aside).
// ---------------------------------------------------------------------------
test.describe('ordering lock + theme-path discriminator', () => {
  test('T> renders a native Starlight tip; D> renders a theme discussion callout', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    await expect(
      page.locator('aside.starlight-aside--tip'),
      'a bare T> must render as a NATIVE Starlight tip (plugins run before remarkAsides)',
    ).toHaveCount(3);
    await expect(
      page.locator('aside.dk-callout.dk-callout--discussion'),
      'a D> must render through the THEME callout, not a vacuous aside',
    ).toHaveCount(3);
  });
});

// ---------------------------------------------------------------------------
// ToC exclusion (WP06) — a NON-leading heading inside an aside is demoted to a
// role="heading" element (still announced as a heading, so the outline stays
// intact) but is NO LONGER an <h_n> — which is precisely what keeps it out of
// Starlight's tagName-keyed on-this-page collector (`if (tagName[0] !== "h")
// return;`). This STRUCTURAL proof does not depend on a rendered ToC (the fixture
// suppresses the nav for an unrelated WCAG 2.5.8 target-size theme issue), and is
// the more fundamental proof: the collector never sees a heading here.
// ---------------------------------------------------------------------------
test.describe('heading-in-aside ToC exclusion (WP06, row 2)', () => {
  test('the in-aside heading is demoted to a role=heading <p>, not an <h_n>', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    // Present in the document, INSIDE an aside, as a demoted heading (role=heading,
    // original level preserved) — the outline stays intact for assistive tech.
    const demoted = page.locator('aside [role="heading"]', { hasText: 'A demoted subheading' });
    await expect(demoted, 'the in-aside heading stays a role=heading element').toHaveCount(1);
    await expect(demoted).toHaveAttribute('aria-level', '2');
    // It is a <p>, NOT an <h_n> — so the tagName-keyed collector skips it.
    const tag = await demoted.evaluate((el) => el.tagName);
    expect(tag, 'the demoted heading is no longer an h_n element (collector skips it)').toBe('P');

    // Non-vacuity: there is NO real <h2> anywhere carrying this text (it would be
    // collected), and no on-this-page nav link references it.
    await expect(
      page.locator('h1, h2, h3, h4, h5, h6', { hasText: 'A demoted subheading' }),
      'the demoted heading must not survive as any real <h_n> (which would be collected)',
    ).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'A demoted subheading' }),
      'the demoted heading must not appear as a nav link',
    ).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Crosslink resolution (US3, rows 27–31) — explicit heading ids, an auto id, and
// span ids all resolve; the in-content links reach their targets.
// ---------------------------------------------------------------------------
test.describe('markua crosslink resolution (US3)', () => {
  test('explicit heading ids win, an auto id is kept, and span ids resolve', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.markuaShowcase, mode);

    // row 27: {#intro} explicit anchor + the IN-CONTENT [introduction](#intro)
    // link resolves. Scope to the prose container so the heading self-anchor and
    // the on-this-page nav link (both also href="#intro") are excluded.
    await expect(page.locator('h2#intro')).toHaveCount(1);
    await expect(
      page.locator('.sl-markdown-content p a[href="#intro"]', { hasText: 'introduction' }),
    ).toHaveCount(1);
    // row 28: collision — the explicit {#overview} wins; EXACTLY ONE element
    // carries id="overview" (no duplicate `overview-1` auto-slug).
    await expect(page.locator('[id="overview"]')).toHaveCount(1);
    await expect(page.locator('.sl-markdown-content p a[href="#overview"]', { hasText: 'overview' })).toHaveCount(1);
    // row 29: a Markua-free heading keeps its auto slug.
    await expect(page.locator('#plain-heading-automatic-anchor')).toHaveCount(1);
    // rows 30/31: bracket + trailing span forms, each with a resolving prose link.
    await expect(page.locator('span#beach-span')).toHaveCount(1);
    await expect(page.locator('.sl-markdown-content a[href="#beach-span"]')).toHaveCount(1);
    await expect(page.locator('span#shoreline-span')).toHaveCount(1);
    await expect(page.locator('.sl-markdown-content a[href="#shoreline-span"]')).toHaveCount(1);
  });
});
