// Starlight cascade-layer parity (#144, spike B19).
//
// Starlight 0.34 moved all of its CSS into the `starlight` cascade layer. An
// unlayered DocKitty rule now beats every Starlight rule, whatever the
// specificity, so a DocKitty declaration that used to LOSE to Starlight starts
// to apply. A computed-style audit of the example against the Starlight 0.32
// build found five such declarations, beaten by Starlight's Markdown flow gap
// (`.sl-markdown-content :not(…) + :not(…) { margin-top: 1rem }`) or its
// list-item gap (`… > li > :last-child { margin-bottom: 1.25rem }`):
//
//   .dk-callout                    margin-top    24px instead of 16px
//   .dk-diagram                    margin-top    24px instead of 16px
//   .dk-diagram__caption           margin-top     8px instead of 16px
//   .dk-gherkin                    margin-top    24px instead of 16px
//   last block in a Gherkin step   margin-bottom  8px instead of 20px
//
// This spec pins the 0.32 values. Each subject is the element itself measured
// in the built page; the first-child case keeps the component's own margin.
import { test, expect, type Page } from '@playwright/test';

const FLOW_GAP = '16px';

/** margin-top of every element matching `selector` inside the Markdown content
 * that follows an element sibling, with its index for the message. */
async function marginsAfterSibling(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll<HTMLElement>(`.sl-markdown-content ${sel}`)]
      .filter((el) => el.previousElementSibling !== null)
      .map((el) => getComputedStyle(el).marginTop);
  }, selector);
}

test('a theme callout after a sibling keeps the Markdown flow gap', async ({ page }) => {
  await page.goto('/doc-kitty/guides/markua-showcase/');
  const margins = await marginsAfterSibling(page, 'aside.dk-callout');
  expect(margins.length, 'the showcase renders theme callouts').toBeGreaterThan(5);
  expect(new Set(margins)).toEqual(new Set([FLOW_GAP]));
});

test('a diagram figure and its caption keep the Markdown flow gap', async ({ page }) => {
  await page.goto('/doc-kitty/architecture/diagram-demonstrator/');
  const figures = await marginsAfterSibling(page, 'figure.dk-diagram');
  expect(figures.length, 'the demonstrator renders diagram figures').toBeGreaterThan(0);
  expect(new Set(figures)).toEqual(new Set([FLOW_GAP]));
  const captions = await marginsAfterSibling(page, 'figcaption.dk-diagram__caption');
  expect(captions.length, 'the demonstrator renders diagram captions').toBeGreaterThan(0);
  expect(new Set(captions)).toEqual(new Set([FLOW_GAP]));
});

test('an in-page Gherkin block keeps the flow gap and its step blocks the list gap', async ({ page }) => {
  await page.goto('/doc-kitty/guides/scenarios-in-pages/');
  const blocks = await marginsAfterSibling(page, 'div.dk-gherkin');
  expect(blocks.length, 'the page renders in-page Gherkin').toBeGreaterThan(0);
  expect(new Set(blocks)).toEqual(new Set([FLOW_GAP]));
  // The last block of a step, ignoring trailing scripts (Starlight's own rule).
  const stepBlocks = await page.evaluate(() => {
    const isLastBlock = (el: Element): boolean => {
      for (let n = el.nextElementSibling; n; n = n.nextElementSibling) {
        if (n.tagName !== 'SCRIPT') return false;
      }
      return true;
    };
    return [...document.querySelectorAll<HTMLElement>(
      '.sl-markdown-content .dk-gherkin__steps > li > :is(table, .expressive-code)',
    )]
      .filter(isLastBlock)
      .map((el) => getComputedStyle(el).marginBottom);
  });
  expect(stepBlocks.length, 'the page renders step tables or doc strings').toBeGreaterThan(0);
  expect(new Set(stepBlocks)).toEqual(new Set(['20px']));
});
