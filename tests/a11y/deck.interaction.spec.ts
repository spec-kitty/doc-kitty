// Deck interaction a11y (WP05 T024/T025 — IX-1/IX-2/IX-3a/IX-3b).
//
// The static axe scan (axe.spec.ts, the `deck` shell in AXE_PAGES) covers what axe
// CAN check on the deck: accessible section names, labelled nav <button>s, a single
// labelled main, and size-aware AA contrast, in both colour modes. It cannot
// exercise the things a keyboard user actually does — arrow/space/Esc navigation,
// keyboard traps, focus visibility, or the reduced-motion transition state — because
// axe reads a static snapshot (squad R-01). This spec is that complementary layer:
// it drives the LIVE, reveal-enhanced deck and asserts the interactive contract, plus
// the no-JS fallback that proves the deck degrades to readable content.
//
// Deck DOM (DeckLayout.astro, verified against the built dist):
//   main.reveal[aria-label] > div.slides > <section> per slide (the WP02 transform's
//   output; a `##`→horizontal, a `###`→vertical inner stack, a `---`→headingless
//   `<section aria-label>`), plus a fixed nav.dk-deck-controls with two real,
//   labelled <button>s. reveal only ENHANCES this pre-rendered DOM in the browser.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, WCAG_TAGS, DECK_SLIDES_ROOT } from './routes';
import { modeOf, type Mode } from './mode';

const DECK = ROUTES.deck;
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

// A leaf slide is a `.slides` <section> that does NOT itself contain a nested
// <section> — i.e. an actual slide, not the wrapper of a vertical stack. reveal
// marks the current leaf (and, for a stack, its parent) with `.present`.
const LEAF_SLIDE = `${DECK_SLIDES_ROOT} section:not(:has(section))`;

// Wait until reveal has finished enhancing the deck. reveal core adds the `ready`
// class to the `.reveal` root once `initialize()` resolves; the labelled control
// buttons are wired in the same tick (DeckLayout's client script).
async function gotoLiveDeck(page: Page): Promise<void> {
  await page.goto(DECK, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.reveal.ready', { timeout: 15_000 });
  // A leaf slide must be the current one before we start driving.
  await page.waitForSelector(`${LEAF_SLIDE}.present`, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// IX-1 — keyboard reaches every slide, focus is visible, no keyboard trap.
// ---------------------------------------------------------------------------
test.describe('Deck keyboard interaction (IX-1)', () => {
  test('arrow/space/Esc reach every slide; visible focus; no keyboard trap', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    // Tag every leaf slide with a stable index in document order so we can track
    // which ones reveal makes active as we navigate.
    const leafCount = await page.evaluate((sel) => {
      const leaves = Array.from(document.querySelectorAll<HTMLElement>(sel));
      leaves.forEach((el, i) => el.setAttribute('data-testslide', String(i)));
      return leaves.length;
    }, LEAF_SLIDE);
    expect(leafCount, 'the showcase deck must render multiple leaf slides').toBeGreaterThan(1);

    const currentLeaf = async (): Promise<string | null> =>
      page.evaluate(() => {
        const present = document.querySelector<HTMLElement>(
          '.slides section.present[data-testslide]',
        );
        return present ? present.getAttribute('data-testslide') : null;
      });

    // Collect the set of leaf slides that become active as we drive forward with
    // Space (reveal advances through horizontals AND descends vertical stacks,
    // revealing the single fragment along the way). Start from the initial slide.
    const visited = new Set<string>();
    const first = await currentLeaf();
    if (first !== null) visited.add(first);

    // Bounded key presses: leaves + fragment + headroom. Space is reveal's
    // "advance" key (arrow keys are also live; Space is enough to traverse all).
    for (let i = 0; i < leafCount + 6; i += 1) {
      await page.keyboard.press('Space');
      const leaf = await currentLeaf();
      if (leaf !== null) visited.add(leaf);
    }

    const expected = Array.from({ length: leafCount }, (_, i) => String(i));
    expect(
      [...visited].sort(),
      'every leaf slide must become the active slide under keyboard navigation',
    ).toEqual(expected.sort());

    // ArrowLeft must navigate backward (reveal's ArrowLeft/ArrowUp), proving the
    // arrow keys — not just Space — drive the deck.
    const beforeBack = await currentLeaf();
    await page.keyboard.press('ArrowLeft');
    const afterBack = await currentLeaf();
    expect(afterBack, 'ArrowLeft must move to a different slide').not.toEqual(beforeBack);

    // Esc toggles reveal's slide OVERVIEW and must be releasable (no trap): the
    // `.reveal` root gains `overview` on Esc and loses it on a second Esc.
    await page.keyboard.press('Escape');
    await expect(page.locator('.reveal')).toHaveClass(/overview/, { timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.reveal')).not.toHaveClass(/overview/, { timeout: 5_000 });

    // Visible focus (:focus-visible): keyboard-focus a nav control and assert the
    // browser exposes the visible-focus state (our theme paints an outline +
    // focus ring on it). Programmatic .focus() would NOT set :focus-visible, so we
    // reach the button by Tab.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.locator('body').focus();
    let focusVisibleOnButton = false;
    const focusTrail: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return { id: 'null', isNavButton: false, focusVisible: false };
        const cls = el.className && typeof el.className === 'string' ? el.className : '';
        const isNavButton =
          el.tagName === 'BUTTON' && /dk-deck-(prev|next)/.test(cls);
        return {
          id: `${el.tagName}.${cls}`.trim(),
          isNavButton,
          focusVisible: el.matches(':focus-visible'),
        };
      });
      focusTrail.push(info.id);
      if (info.isNavButton && info.focusVisible) focusVisibleOnButton = true;
    }
    expect(
      focusVisibleOnButton,
      'a keyboard-focused nav control must expose :focus-visible',
    ).toBe(true);

    // No keyboard trap: both labelled controls are reachable by Tab AND focus
    // returns to the document body at some point in the trail (Tab wraps out of the
    // controls rather than being pinned inside the deck).
    const sawPrev = focusTrail.some((s) => s.includes('dk-deck-prev'));
    const sawNext = focusTrail.some((s) => s.includes('dk-deck-next'));
    const focusEscaped = focusTrail.some((s) => s.startsWith('BODY'));
    expect(sawPrev && sawNext, 'both nav controls must be reachable by Tab').toBe(true);
    expect(
      focusEscaped,
      'focus must be able to leave the deck controls (no keyboard trap)',
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// IX-2 — under prefers-reduced-motion: reduce, the current slide's transition is 0s.
// ---------------------------------------------------------------------------
test.describe('Deck reduced motion (IX-2)', () => {
  test('current slide transition-duration is 0s under prefers-reduced-motion: reduce', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoLiveDeck(page);

    const transitionDuration = await page.evaluate(() => {
      const current = document.querySelector<HTMLElement>('.slides section.present');
      if (!current) throw new Error('no active slide to measure');
      return getComputedStyle(current).transitionDuration;
    });
    expect(
      transitionDuration,
      'reduced motion must disable slide transitions (dk-reveal-theme + reveal-init)',
    ).toBe('0s');
  });
});

// ---------------------------------------------------------------------------
// IX-3a — no-JS fallback: every slide's text is present in document order.
//
// Mechanism: a `javaScriptEnabled: false` browser context. reveal never runs, so
// `page.content()` is the pre-enhancement SSR HTML exactly as a no-JS reader (or a
// crawler) sees it. axe cannot run here (axe-core executes as injected page JS,
// RT-04), so this check is text-only; the axe half is IX-3b below.
// ---------------------------------------------------------------------------
test.describe('Deck no-JS text fallback (IX-3a)', () => {
  test('every slide’s text is present in the SSR HTML in document order', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto(DECK, { waitUntil: 'domcontentloaded' });
      const html = await page.content();

      // One distinctive phrase per slide, in the deck's authored order.
      const slideSentinels = [
        'Showcase Deck', // slide 1 (title, h1) + carries the quokka sentinel
        'Horizontal slide with directives', // slide 2 (h2)
        'Slide that becomes a vertical stack', // slide 3, inner stack slide one (h2)
        'Inner stack slide', // slide 3, inner stack slide two (h3)
        'A thematic break opens this headingless slide', // slide 4 (aria-label)
      ];

      let lastIndex = -1;
      for (const phrase of slideSentinels) {
        const at = html.indexOf(phrase);
        expect(at, `slide text "${phrase}" must be present in the no-JS HTML`).toBeGreaterThan(-1);
        expect(
          at,
          `slide text "${phrase}" must appear AFTER the previous slide's text`,
        ).toBeGreaterThan(lastIndex);
        lastIndex = at;
      }

      // The indexed slide sentinel is in the readable SSR body too.
      expect(html).toContain('quokka showcase sentinel');
    } finally {
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// IX-3b — axe over the PRE-ENHANCEMENT SSR DOM (both modes), no serious/critical.
//
// Mechanism: a normal JS-enabled context with every page script aborted, so reveal
// never initializes and the DOM stays the served SSR structure — while page.evaluate
// and AxeBuilder (which injects axe-core's source directly, no network) still run.
// This proves the deck is accessible BEFORE JS enhances it, complementing the
// enhanced-DOM scan in axe.spec.ts. Dark is driven by the deck's own `data-theme`
// attribute (theme.css defines dark tokens only under `:root[data-theme='dark']`).
// This block also discharges the AX-2 structural claim on the transform's own output.
// ---------------------------------------------------------------------------
test.describe('Deck pre-enhancement SSR axe (IX-3b / AX-2)', () => {
  test('SSR DOM has no serious/critical violations and every leaf slide is named', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);

    // Freeze the deck at its SSR DOM: abort every page script so reveal-init never
    // imports reveal. axe still injects + runs (it does not fetch over the network).
    await page.route('**/*.js', (route) => route.abort());
    await page.goto(DECK, { waitUntil: 'domcontentloaded' });

    // Seed the design's theme attribute per mode. DeckLayout now links the base
    // `--dk-*` catalog (theme.css) itself, so the out-of-frame deck IS themed: the
    // brand background/ink apply even here, where every page SCRIPT is aborted but
    // the `<link>`ed stylesheets still load. The brand computed-style values are
    // locked directly in T023 (FR-001); this block asserts the SSR DOM's axe
    // cleanliness under each project's colorScheme, so it does not re-assert the
    // palette — it only drives `data-theme` so dark tokens (`:root[data-theme=…]`)
    // resolve for the dark project's scan.
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);

    // Non-vacuity: reveal did NOT run, so no `.reveal.ready` — the DOM is SSR — and
    // the deck's labelled main region genuinely rendered.
    await expect(page.locator('.reveal.ready')).toHaveCount(0);
    await expect(page.locator('main.reveal')).toHaveCount(1);

    // AX-2 (transform output): every LEAF slide <section> has an accessible name —
    // a heading descendant OR an aria-label/aria-labelledby. The vertical-stack
    // wrapper is a nameless container (not a leaf, not an exposed landmark).
    const unnamed = await page.evaluate((sel) => {
      const leaves = Array.from(document.querySelectorAll<HTMLElement>(sel));
      return leaves
        .filter((el) => {
          const hasHeading = !!el.querySelector('h1,h2,h3,h4,h5,h6');
          const hasAriaLabel =
            (el.getAttribute('aria-label') ?? '').trim().length > 0 ||
            !!el.getAttribute('aria-labelledby');
          return !hasHeading && !hasAriaLabel;
        })
        .map((el) => el.outerHTML.slice(0, 120));
    }, LEAF_SLIDE);
    expect(unnamed, 'every leaf slide section must have an accessible name').toEqual([]);

    // axe over the whole SSR document, WCAG 2.2 AA, both modes.
    const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact && BLOCKING_IMPACTS.has(v.impact),
    );
    if (blocking.length > 0) {
      const report = blocking
        .map((v) => {
          const nodes = v.nodes
            .map((n) => `      • ${n.target.join(' ')}\n        ${n.failureSummary ?? ''}`)
            .join('\n');
          return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
        })
        .join('\n\n');
      // eslint-disable-next-line no-console
      console.error(`axe on the deck SSR DOM (${mode}) found violations:\n${report}`);
    }
    expect(
      blocking,
      `serious/critical WCAG violations on the deck SSR DOM (${mode})`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Colour normalization for the FR-001 token assertions (T023, finding F3).
//
// `getComputedStyle(...).backgroundColor` returns `rgb(r, g, b)` (or
// `rgba(r, g, b, a)`), while `getPropertyValue('--dk-color-bg')` returns the
// authored `#rrggbb`. A raw string `===` would FALSELY fail on correct styling,
// so both sides are parsed to a canonical `r,g,b` triple before comparing.
// ---------------------------------------------------------------------------
function toRgbTriple(value: string): string {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }
  const rgb = /rgba?\(([^)]+)\)/i.exec(v);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((n) => Math.round(parseFloat(n.trim())));
    return `${r},${g},${b}`;
  }
  throw new Error(`Cannot parse colour '${value}'`);
}

// ---------------------------------------------------------------------------
// FR-002 (T017, contract C1) — the front-matter `description` is metadata ONLY:
// present in `<head> meta[name="description"]` (its correct usage), and ABSENT
// from the `.slides` text (it must NOT leak onto the title slide, deck-split
// deliberately does not synthesize it into the body).
// ---------------------------------------------------------------------------
test.describe('Deck description is metadata, not slide text (FR-002 / T017)', () => {
  test('the description is in <head> meta and absent from .slides text', async ({ page }) => {
    await gotoLiveDeck(page);

    // The deck's OWN description, read from its identity (the meta tag) — not a
    // hardcoded literal — and required to be non-empty (the correct metadata use).
    const description = await page
      .locator('head meta[name="description"]')
      .getAttribute('content');
    expect(
      (description ?? '').trim().length,
      'the deck must carry a non-empty meta description',
    ).toBeGreaterThan(0);
    const desc = (description ?? '').trim();

    // …and that exact string must NOT appear anywhere in the slide DOM's text
    // (textContent covers hidden slides too, so a leak onto ANY slide fails — not
    // just the visible title slide). FR-002: description is metadata, not content.
    const slidesText = await page.locator(DECK_SLIDES_ROOT).evaluate(
      (el) => el.textContent ?? '',
    );
    expect(
      slidesText.includes(desc),
      'the front-matter description must not leak into the slide text (FR-002)',
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FR-003 (T018, contract C2, finding C5) — the deck footer is a real, visible,
// title-bearing bottom band that survives navigation (it is a `<body>`-scope
// sibling of `.slides`, so reveal never sweeps it into the per-slide DOM).
// ---------------------------------------------------------------------------
test.describe('Deck footer visible, titled, positioned, stable (FR-003 / T018)', () => {
  const DECK_TITLE = 'Showcase Deck'; // entry.data.title of the showcase deck.

  test('.dk-deck-footer is visible, carries the deck title, sits at the bottom, and is stable across nav', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    const footer = page.locator('footer.dk-deck-footer');

    // VISIBLE — not merely present. An empty/`display:none` footer must FAIL here
    // (a hidden-but-present footer would pass a bare `toHaveCount(1)`).
    await expect(footer, 'the deck footer must be visible').toBeVisible();

    // TITLED by IDENTITY — the footer text must contain the deck's own title, not
    // "some footer" (C5): bind the assertion to `entry.data.title`.
    const footerText = ((await footer.textContent()) ?? '').trim();
    expect(footerText.length, 'the footer must have non-empty text').toBeGreaterThan(0);
    expect(
      footerText,
      'the footer must carry the deck title (bound identity, not "some footer")',
    ).toContain(DECK_TITLE);

    // POSITIONED at the bottom (geometry) — its top edge sits in the lower region
    // of the viewport (a fixed bottom band), proving it is a real bottom banner.
    const viewportHeight = page.viewportSize()?.height ?? 800;
    const box = await footer.boundingBox();
    expect(box, 'the footer must have a bounding box').not.toBeNull();
    expect(
      box!.y,
      'the footer top edge must be in the lower region of the viewport',
    ).toBeGreaterThan(viewportHeight * 0.7);
    // Its bottom edge reaches (near) the frame bottom.
    expect(
      box!.y + box!.height,
      'the footer must extend to the bottom of the frame',
    ).toBeGreaterThan(viewportHeight * 0.9);

    // STABLE across navigation — advance past slide 1 and re-assert visibility +
    // title. If the footer lived INSIDE `.slides`, reveal would re-render slides
    // and the footer would not survive a slide change; being outside `.slides`, it
    // does. This is the non-fakeable half of C5.
    await page.keyboard.press('ArrowRight');
    await expect(
      footer,
      'the footer must remain visible after navigating to slide 2+',
    ).toBeVisible();
    expect(
      ((await footer.textContent()) ?? '').trim(),
      'the footer title must be unchanged after navigation (not re-rendered per slide)',
    ).toContain(DECK_TITLE);
  });
});

// ---------------------------------------------------------------------------
// FR-001 promoted (T023, findings C6/F3, NO screenshots per C-001) — the deck is
// themed with the brand `--dk-*` catalog. Each observed computed style is
// asserted EQUAL to the token it must resolve to (read from `:root` in the SAME
// evaluate and normalized hex↔rgb, F3) — never a weak "≠ #000". The brand
// resolved VALUES were recorded by WP02's T006 against the BUILT deck (light):
//   --dk-color-bg          = #ffffff  → rgb(255, 255, 255)  (viewport background)
//   --dk-color-text-strong = #101828  → rgb(16, 24, 40)     (active heading)
//   --dk-color-surface-1   = #f7f8fa  → rgb(247, 248, 250)  (footer band)
// The deck carries no `data-theme` here, so it renders in its light palette in
// BOTH projects; the token-equality form is mode-agnostic and holds either way.
// ---------------------------------------------------------------------------
test.describe('Deck computed-style brand tokens (FR-001 / T023)', () => {
  test('viewport bg, heading ink, footer band, font, and hero-fit resolve to brand tokens', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    // Read the observed computed value AND the resolved `:root` token in ONE
    // evaluate, so the comparison is against the LIVE token, not a guessed literal.
    const bg = await page.evaluate(() => {
      const root = document.documentElement;
      // reveal makes <body> (or `.reveal-viewport`) the deck viewport; the theme
      // sheet paints both, so `body`'s computed background IS the deck background.
      const observed = getComputedStyle(document.body).backgroundColor;
      const token = getComputedStyle(root).getPropertyValue('--dk-color-bg').trim();
      return { observed, token };
    });
    // The contract is "resolves to the BRAND token", not "equals a recorded literal":
    // the example brand overrides --dk-color-bg (spec-kitty tokens.css → #FBFAF7), so
    // a hardcoded #ffffff pins the wrong constant. Assert observed == the RUNTIME-
    // resolved token (normalized). `toRgbTriple` throws on an empty/unparseable token,
    // so this stays non-vacuous — a missing token fails loudly rather than passing.
    expect(
      toRgbTriple(bg.observed),
      'the viewport background must equal the resolved --dk-color-bg brand token',
    ).toBe(toRgbTriple(bg.token));

    // Active-slide heading ink == resolved --dk-color-text-strong.
    const heading = await page.evaluate(() => {
      const root = document.documentElement;
      const h = document.querySelector<HTMLElement>('.slides section.present :is(h1,h2,h3,h4,h5,h6)');
      if (!h) throw new Error('no heading on the active slide');
      const observed = getComputedStyle(h).color;
      const token = getComputedStyle(root).getPropertyValue('--dk-color-text-strong').trim();
      return { observed, token };
    });
    // Resolved-token equality only (same reasoning as the bg above): the brand
    // overrides --dk-color-text-strong (#0D0E11), so the old #101828 literal was
    // also a wrong pinned constant.
    expect(
      toRgbTriple(heading.observed),
      'the active heading colour must equal the resolved --dk-color-text-strong brand token',
    ).toBe(toRgbTriple(heading.token));

    // `.reveal` font-family CONTAINS the brand sans (the first family of the
    // --dk-font-sans stack) — the deck uses the brand type, not reveal's default.
    const font = await page.evaluate(() => {
      const root = document.documentElement;
      const reveal = document.querySelector<HTMLElement>('.reveal');
      if (!reveal) throw new Error('no .reveal root');
      const observed = getComputedStyle(reveal).fontFamily;
      // First concrete family in the --dk-font-sans stack (strip quotes).
      const stack = getComputedStyle(root).getPropertyValue('--dk-font-sans').trim();
      const firstFamily = stack.split(',')[0].trim().replace(/['"]/g, '');
      return { observed, firstFamily };
    });
    expect(
      font.observed.replace(/['"]/g, ''),
      'the deck font-family must contain the brand sans (--dk-font-sans first family)',
    ).toContain(font.firstFamily);

    // Footer band background resolves to the brand surface token --dk-color-surface-1.
    const footerBg = await page.evaluate(() => {
      const root = document.documentElement;
      const footer = document.querySelector<HTMLElement>('footer.dk-deck-footer');
      if (!footer) throw new Error('no deck footer');
      const observed = getComputedStyle(footer).backgroundColor;
      const token = getComputedStyle(root).getPropertyValue('--dk-color-surface-1').trim();
      return { observed, token };
    });
    // Resolved-token equality only (same reasoning as the bg above): the brand
    // overrides --dk-color-surface-1 (#FFFFFF), so the old #f7f8fa literal was also
    // a wrong pinned constant.
    expect(
      toRgbTriple(footerBg.observed),
      'the footer band background must equal the resolved --dk-color-surface-1 brand token',
    ).toBe(toRgbTriple(footerBg.token));

    // Hero fit (R4): the title-slide image height must NOT overflow the reveal
    // stage — the CSS caps it at 65vh, so it stays within the `.reveal` stage box.
    const heroImg = page.locator('.slides section.present img').first();
    await expect(heroImg, 'the title slide must render its hero image').toBeVisible();
    const imgBox = await heroImg.boundingBox();
    const stageHeight = await page.evaluate(() => {
      const reveal = document.querySelector<HTMLElement>('.reveal');
      return reveal ? reveal.getBoundingClientRect().height : 0;
    });
    expect(imgBox, 'the hero image must have a bounding box').not.toBeNull();
    expect(stageHeight, 'the reveal stage must have a measurable height').toBeGreaterThan(0);
    expect(
      imgBox!.height,
      'the title-slide hero image must fit inside the reveal stage (R4 hero-overflow gap)',
    ).toBeLessThanOrEqual(stageHeight);
  });
});
