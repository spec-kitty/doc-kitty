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

    // Seed the design's theme attribute per mode (forward-compatible once the deck
    // loads the --dk-* catalog; see the theming-gap note in mode.ts). We do NOT
    // assert a brand-background luminance here — the deck is currently unthemed
    // (transparent viewport, UA-default text) so there is no brand background to
    // gate on; axe below still scores it clean under each project's colorScheme.
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
