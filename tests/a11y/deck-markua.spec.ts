// Deck-Markua a11y/behaviour gate (WP04 T015 — mission markua-decks #47,
// contract `deck-markua-gate.md` G1-G5). Mirrors `deck.interaction.spec.ts`'s
// harness (axe-core/playwright, SSR pre-enhancement scan + live reveal-enhanced
// scan per IX-3b, both colour schemes) but proves a DIFFERENT contract: that the
// four Markua content passes (`markuaNormalise`/`markuaAttributes`/
// `markuaCallouts`/`markuaFigure`), now unwrapped from `guardDeck` for a
// `kind: Presentation` page, render their constructs ON A SLIDE — composed with
// `deckSplit` — without ever swallowing a `##`/`###` slide boundary.
//
// Fixture (`example/docs/presentations/markua-deck.md`) slide-by-slide (deck
// DOM: `main.reveal > .slides > section` per horizontal position; a nested
// `###` turns that `<section>` into a vertical stack of two LEAF `<section>`s):
//   h=0 (title, synthesized from `hero_image`)  — flat, 1 leaf. Hero `<img>` —
//       untouched by markuaFigure (INV-2; the internal `data-deck-hero` hast
//       discriminator that decision reads does not survive Astro's image
//       optimizer into the final DOM, so this spec identifies the hero
//       structurally instead — see the G2 test below).
//   h=1 "A slide aside that respects its boundary" — a `W>` caution aside on
//       v=0, a `###` opens v=1 "The stack boundary still opens" (US1 AS-1).
//   h=2 "A wrapped aside groups a longer note" — flat, 1 leaf. An
//       `{aside}…{/aside}` wrapper fully inside it (US1 AS-2).
//   h=3 "Attributes target a slide element precisely" — a `{#attr-target}`
//       line on the paragraph immediately below it (v=0); a `###` opens v=1
//       "The heading keeps its own identity" (US3 AS-1, the heading-adjacency
//       hazard).
//   h=4 "A body figure renders as an accessible figure" — flat, 1 leaf. A
//       Markua `![…](…){alt:…}` figure, distinct from the title-slide hero
//       (US2 AS-1).
// Total LEAF sections: 1 + 2 + 1 + 2 + 1 = 7 (G4).
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES, WCAG_TAGS, DECK_SLIDES_ROOT } from './routes';
import { modeOf, gotoDeckInMode, type Mode } from './mode';

const DECK = ROUTES.markuaDeck;
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

// A leaf slide is a `.slides` <section> that does NOT itself contain a nested
// <section> — i.e. an actual rendered slide, not the wrapper of a vertical
// stack (mirrors deck.interaction.spec.ts's `LEAF_SLIDE`).
const LEAF_SLIDE = `${DECK_SLIDES_ROOT} section:not(:has(section))`;
const TOP_LEVEL_SLIDE = `${DECK_SLIDES_ROOT} > section`;

// The authored slide/boundary shape (G4) — one entry per LEAF, in document
// order, keyed by a phrase unique to that leaf's own heading text so a merged
// or dropped boundary is caught by BOTH the count and the identity/order.
const EXPECTED_LEAF_HEADINGS = [
  'Markua-Capable Deck', // h=0, title slide (h1, synthesized from frontmatter `title`)
  'A slide aside that respects its boundary', // h=1 v=0
  'The stack boundary still opens', // h=1 v=1
  'A wrapped aside groups a longer note', // h=2
  'Attributes target a slide element precisely', // h=3 v=0
  'The heading keeps its own identity', // h=3 v=1
  'A body figure renders as an accessible figure', // h=4
];

// Wait until reveal has finished enhancing the deck (mirrors
// deck.interaction.spec.ts's `gotoLiveDeck`).
async function gotoLiveDeck(page: Page): Promise<void> {
  await page.goto(DECK, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.reveal.ready', { timeout: 15_000 });
  await page.waitForSelector(`${LEAF_SLIDE}.present`, { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// G4 — no slide boundary swallowed: the leaf count AND the per-leaf heading
// identity/order match the authored fixture exactly. A merged stack (the aside
// or the attribute line absorbing the following `###`) would collapse two
// leaves into one and fail the count; a dropped/relabelled boundary would fail
// the order/identity check even if the count coincidentally held.
// ---------------------------------------------------------------------------
test.describe('Deck-Markua slide boundaries preserved (G4)', () => {
  test('leaf count and heading order match the authored fixture', async ({ page }) => {
    await gotoLiveDeck(page);

    expect(
      await page.locator(TOP_LEVEL_SLIDE).count(),
      'five top-level horizontal slide positions (title + 4 authored `##` groups)',
    ).toBe(5);

    const leaves = page.locator(LEAF_SLIDE);
    await expect(leaves, 'seven leaf slides — no vertical stack merged/dropped').toHaveCount(
      EXPECTED_LEAF_HEADINGS.length,
    );

    const headings = await leaves.evaluateAll((sections) =>
      sections.map((el) => {
        const heading = el.querySelector('h1,h2,h3,h4,h5,h6');
        return (heading?.textContent ?? '').trim();
      }),
    );
    expect(
      headings,
      'each leaf’s own heading, in document order, must match the authored fixture',
    ).toEqual(EXPECTED_LEAF_HEADINGS);
  });
});

// ---------------------------------------------------------------------------
// G1 — the `W>` aside and the `{aside}…{/aside}` wrapper each render a
// `.dk-callout` on THEIR OWN slide, and the aside never bleeds into the next
// slide the boundary opens.
// ---------------------------------------------------------------------------
test.describe('Deck-Markua callouts render on the correct slide (G1)', () => {
  test('the W> aside renders dk-callout--caution on v=0, not on the v=1 boundary slide', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    const asideLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'A slide aside that respects its boundary',
    });
    await expect(asideLeaf, 'the W> aside’s own slide must exist exactly once').toHaveCount(1);
    const caution = asideLeaf.locator('aside.dk-callout.dk-callout--caution');
    await expect(caution, 'the W> aside must render as a dk-callout--caution').toHaveCount(1);
    expect(
      (await caution.textContent()) ?? '',
      'the callout must carry its authored body text',
    ).toContain('caution aside authored with the');

    // FIX 1 (a11y/contract, C-COMPOSE-04, WCAG 1.4.1): on a deck, a mapped
    // callout forced through the theme path must convey its severity
    // textually, not by accent colour alone. The bare `W>` aside carries no
    // explicit/extracted title, so it gets the default humanized-variant
    // title, giving the `<aside>` a non-empty accessible name.
    const title = caution.locator('.dk-callout__title');
    await expect(
      title,
      'a bare mapped callout on a deck must render a default dk-callout__title',
    ).toHaveCount(1);
    expect((await title.textContent())?.trim(), 'the default title names the variant').toBe(
      'Caution',
    );
    // FIX B (a11y/contract, NFR-001/US1): the `.dk-callout__title` is a SIBLING
    // `<p>`, not a label — a sibling never gives an element its accessible name
    // (that requires `aria-label`/`aria-labelledby`/a native labelling
    // relationship), so the `<aside>` computed to role=generic with no name
    // before this fix. `emitThemeCallout` now mirrors the title onto the
    // aside's own `aria-label`, matching how Starlight names its own native
    // asides off-deck.
    expect(
      (await caution.getAttribute('aria-label')) ?? '',
      'the aside itself must carry aria-label = its title, giving it a real accessible name',
    ).toBe('Caution');

    const boundaryLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'The stack boundary still opens',
    });
    await expect(boundaryLeaf, 'the boundary slide must exist exactly once').toHaveCount(1);
    await expect(
      boundaryLeaf.locator('.dk-callout'),
      'the boundary slide must NOT contain the previous slide’s callout (no swallowed boundary)',
    ).toHaveCount(0);
  });

  test('the {aside}…{/aside} wrapper renders dk-callout--aside fully inside its own slide', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    const wrapperLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'A wrapped aside groups a longer note',
    });
    await expect(wrapperLeaf, 'the wrapper’s own slide must exist exactly once').toHaveCount(1);
    const themeAside = wrapperLeaf.locator('aside.dk-callout.dk-callout--aside');
    await expect(themeAside, 'the {aside} wrapper must render as a dk-callout--aside').toHaveCount(1);
    expect(
      (await themeAside.textContent()) ?? '',
      'the callout must carry its authored body text',
    ).toContain('wrapped as a Markua aside');

    // The paragraph AFTER the wrapper is still on the SAME slide (the wrapper
    // closed at its own `{/aside}`, not at the slide boundary).
    expect(
      (await wrapperLeaf.textContent()) ?? '',
      'the closing paragraph after the wrapper must still be on this slide',
    ).toContain('closing paragraph sits after the wrapper');
  });
});

// ---------------------------------------------------------------------------
// G2 — a body Markua figure renders as an accessible <figure>; the
// title-slide hero <img> is untouched (non-empty alt, no injected caption).
// ---------------------------------------------------------------------------
test.describe('Deck-Markua figure wraps the body image, hero stays intact (G2)', () => {
  test('body figure is figure.dk-figure > img[alt] + figcaption; hero has alt and no figcaption', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    // Hero (title slide, h=0): a lone, caption-less <img> carrying its own alt.
    // NOT selected via `[data-deck-hero]` — that hast-only discriminator (read by
    // markuaFigure at build time, BEFORE Astro's image optimizer runs) does not
    // survive into the optimized `<img>`'s final DOM attributes (verified against
    // this very build; only asserted at the pure-hast unit-test layer, e.g.
    // `src/tests/deck-split.test.ts`). Structural identity — the title slide's
    // only image, unwrapped — is the real, DOM-observable contract instead,
    // mirroring `deck.interaction.spec.ts`'s own hero lookup (`.slides
    // section.present img`).
    const heroLeaf = page.locator(LEAF_SLIDE, { hasText: 'Markua-Capable Deck' });
    const hero = heroLeaf.locator('img');
    await expect(hero, 'the title slide must render exactly one hero image').toHaveCount(1);
    const heroAlt = (await hero.getAttribute('alt')) ?? '';
    expect(heroAlt.trim().length, 'the hero image must keep a non-empty alt').toBeGreaterThan(0);
    await expect(
      heroLeaf.locator('figure.dk-figure'),
      'the title slide image must NOT be wrapped as a dk-figure (no injected caption, INV-2)',
    ).toHaveCount(0);
    await expect(
      heroLeaf.locator('figcaption'),
      'the title slide must carry no figcaption',
    ).toHaveCount(0);

    // Body figure (h=4, a non-title slide): a real <figure class="dk-figure">
    // with img[alt] immediately followed by a figcaption.
    const figureLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'A body figure renders as an accessible figure',
    });
    await expect(figureLeaf, 'the body-figure slide must exist exactly once').toHaveCount(1);
    const figure = figureLeaf.locator('figure.dk-figure');
    await expect(figure, 'the body image must be wrapped as a dk-figure').toHaveCount(1);
    await expect(
      figure.locator('> img[alt] + figcaption'),
      'the figure must be img[alt] immediately followed by a figcaption',
    ).toHaveCount(1);
    const bodyAlt = (await figure.locator('> img').getAttribute('alt')) ?? '';
    expect(bodyAlt.trim().length, 'the body figure image must have a non-empty alt').toBeGreaterThan(0);
    const captionText = (await figure.locator('> figcaption').textContent()) ?? '';
    expect(
      captionText.trim(),
      'the figcaption must carry the authored bracket-text caption',
    ).toBe('The out-of-frame deck pipeline, captioned on a body slide');
  });
});

// ---------------------------------------------------------------------------
// G3 — the `{#attr-target}` attribute list attaches to the paragraph that
// follows it (never to the nearby `###` heading), and is consumed (no literal
// `{…}` text anywhere on the deck).
// ---------------------------------------------------------------------------
test.describe('Deck-Markua attribute list attaches to its target (G3)', () => {
  test('the {#attr-target} paragraph carries the id; the adjacent heading is unaffected; no literal {…} text', async ({
    page,
  }) => {
    await gotoLiveDeck(page);

    const attrLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'Attributes target a slide element precisely',
    });
    await expect(attrLeaf, 'the attribute-list slide must exist exactly once').toHaveCount(1);

    const target = page.locator('#attr-target');
    await expect(target, 'the {#attr-target} id must land on exactly one element').toHaveCount(1);
    expect(
      await target.evaluate((el) => el.tagName),
      'the id must land on the paragraph, not the heading',
    ).toBe('P');
    expect(
      (await target.textContent()) ?? '',
      'the targeted paragraph must carry its authored text',
    ).toContain('This paragraph carries an id');
    await expect(
      attrLeaf,
      'the attribute-targeted paragraph must be on the SAME leaf as its own slide heading',
    ).toContainText('This paragraph carries an id');

    // The heading two blocks below the attribute line opens its own slide,
    // unaffected — proving the `{…}` line did not retarget or swallow it.
    const boundaryLeaf = page.locator(LEAF_SLIDE, {
      hasText: 'The heading keeps its own identity',
    });
    await expect(boundaryLeaf, 'the adjacent heading’s own slide must exist exactly once').toHaveCount(
      1,
    );
    await expect(
      boundaryLeaf.locator('h1,h2,h3,h4,h5,h6', { hasText: 'The heading keeps its own identity' }),
      'the heading must render as a real heading, not literal/merged text',
    ).toHaveCount(1);
    await expect(boundaryLeaf.locator('#attr-target'), 'the id must not leak onto the boundary slide').toHaveCount(
      0,
    );

    // No literal Markua marker survives as an UNCONSUMED, standalone paragraph
    // (the actual failure mode this fixture caught during authoring: an
    // attribute-list paragraph with no blank line before its target merges into
    // that target's text and is never recognised, so `parseAttrList` never sees
    // the whole-paragraph `{…}` string). This checks each `<p>`'s OWN trimmed
    // text against the raw marker lines — not a substring scan — because this
    // fixture's prose legitimately DISCUSSES the syntax in `<code>` spans inside
    // full sentences (e.g. "An `{aside}…{/aside}` wrapper groups…"), which must
    // not false-positive a marker-mention as a marker-leak.
    const paragraphTexts = await page.locator(`${DECK_SLIDES_ROOT} p`).allTextContents();
    const unconsumedMarkers = ['{#attr-target}', '{aside}', '{/aside}'];
    for (const marker of unconsumedMarkers) {
      expect(
        paragraphTexts.map((t) => t.trim()),
        `the marker '${marker}' must not survive as its own unconsumed paragraph`,
      ).not.toContain(marker);
    }
  });
});

// ---------------------------------------------------------------------------
// G5a — axe over the PRE-ENHANCEMENT SSR DOM (both modes), mirroring
// deck.interaction.spec.ts's IX-3b: abort every script so reveal never
// initializes, seed `data-theme` for the mode, and scan the served markup.
// ---------------------------------------------------------------------------
test.describe('Deck-Markua pre-enhancement SSR axe (G5a)', () => {
  test('SSR DOM has no serious/critical WCAG violations', async ({ page }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);

    await page.route('**/*.js', (route) => route.abort());
    await page.goto(DECK, { waitUntil: 'domcontentloaded' });
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);

    await expect(page.locator('.reveal.ready')).toHaveCount(0);
    await expect(page.locator('main.reveal')).toHaveCount(1);
    // Non-vacuity: the constructs under test really rendered pre-enhancement.
    await expect(page.locator('aside.dk-callout--caution')).toHaveCount(1);
    await expect(page.locator('aside.dk-callout--aside')).toHaveCount(1);
    await expect(page.locator('figure.dk-figure')).toHaveCount(1);

    const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
    const blocking = results.violations.filter((v) => v.impact && BLOCKING_IMPACTS.has(v.impact));
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
      console.error(`axe on the Markua deck SSR DOM (${mode}) found violations:\n${report}`);
    }
    expect(blocking, `serious/critical WCAG violations on the Markua deck SSR DOM (${mode})`).toEqual(
      [],
    );
  });
});

// ---------------------------------------------------------------------------
// G5b — axe over the LIVE, reveal-enhanced DOM (both modes). Complements the
// enumerated `AXE_PAGES` scan (routes.ts `markuaDeck` entry / axe.spec.ts) with
// a scan driven through this spec's own harness, per T015's "mirrors
// deck.interaction.spec.ts" instruction.
// ---------------------------------------------------------------------------
test.describe('Deck-Markua post-enhancement live axe (G5b)', () => {
  test('live reveal-enhanced DOM has no serious/critical WCAG violations', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckInMode(page, DECK, mode);
    await page.waitForSelector('.reveal.ready', { timeout: 15_000 });

    const results = await new AxeBuilder({ page }).withTags([...WCAG_TAGS]).analyze();
    const blocking = results.violations.filter((v) => v.impact && BLOCKING_IMPACTS.has(v.impact));
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
      console.error(`axe on the Markua deck live DOM (${mode}) found violations:\n${report}`);
    }
    expect(blocking, `serious/critical WCAG violations on the Markua deck live DOM (${mode})`).toEqual(
      [],
    );
  });
});
