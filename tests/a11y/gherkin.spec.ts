// In-page Gherkin — the DIRECT (Playwright, not axe) half of the a11y contract
// for ```gherkin fences on docs pages (gherkin-in-any-page, ADR-0051; rendering
// contract 03 §4).
//
// axe (axe.spec.ts) scans the demonstrator for WCAG 2.2 AA violations in both
// colour modes, with `main .dk-gherkin ul li` as a non-vacuity guard root. axe
// does not check what the reader of a scenario relies on, so this spec asserts it
// directly, in both modes:
//   - the page's heading outline never skips a level, counting the in-container
//     `p[role=heading]` stand-ins at their `aria-level`;
//   - steps are an UNORDERED list of list items, each opening with its keyword;
//   - the keyword is set apart without colour (bold against the step text) and
//     its colour still clears 4.5:1 against the background it sits on;
//   - data tables and Examples tables expose real column headers;
//   - the fence inside the `:::note` exposes its scenario as a level-3 heading
//     by ROLE, not as an `<h3>` that would enter the TOC;
//   - the `gherkin raw` fence stays a code block;
//   - each `::gherkin` include ends in its source line naming the file, and no
//     include is left as literal `::gherkin` text;
//   - a quoted step argument is code, exactly as written, so a reader can copy
//     the command a step runs.
//
// Emitted DOM (gherkin/mdast.mjs, GHERKIN_CLASSES):
//   <div class="dk-gherkin">
//     <h3>…</h3> | <p role="heading" aria-level="N">…</p>
//     <ul class="dk-gherkin__steps"><li><strong class="dk-gherkin__kw">Given</strong> …</li></ul>
//   </div>
import { test, expect } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf } from './mode';

const CONTENT = 'main .sl-markdown-content';
const BLOCK = `${CONTENT} .dk-gherkin`;
const STEP_KEYWORDS = /^(Given|When|Then|And|But|\*)$/;

test.describe('In-page Gherkin (/guides/scenarios-in-pages/)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await gotoInMode(page, ROUTES.scenariosInPages, modeOf(testInfo.project.name));
    // Non-vacuity: every check below runs against rendered blocks, never a page
    // whose fences fell back to code. The demonstrator has four structured fences
    // (blocks 0-3) followed by three `::gherkin` includes (blocks 4-6).
    await expect(
      page.locator(BLOCK),
      'the four structured fences and three includes render as .dk-gherkin',
    ).toHaveCount(7);
  });

  test('the heading outline never skips a level, role=heading stand-ins included', async ({ page }) => {
    const outline = await page.evaluate((root) => {
      const content = document.querySelector(root);
      if (!content) return [];
      return [...content.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].map((el) => ({
        level: el.hasAttribute('aria-level') ? Number(el.getAttribute('aria-level')) : Number(el.tagName.slice(1)),
        text: (el.textContent ?? '').trim(),
        inGherkin: el.closest('.dk-gherkin') !== null,
      }));
    }, CONTENT);

    expect(outline.filter((h) => h.inGherkin).length, 'the Gherkin blocks contribute headings').toBeGreaterThan(0);
    for (let i = 1; i < outline.length; i += 1) {
      const prev = outline[i - 1];
      const cur = outline[i];
      expect(
        cur.level,
        `heading "${cur.text}" (level ${cur.level}) follows "${prev.text}" (level ${prev.level}): no skipped level`,
      ).toBeLessThanOrEqual(prev.level + 1);
    }

    // The whole-feature fence sits under an H2, so its Feature title is an H3 and
    // its scenarios H4 (B = max(2, d + 1), 03 §4.2).
    const feature = page.locator(BLOCK).nth(0);
    await expect(feature.getByRole('heading', { level: 3, name: 'Initialise a project' })).toHaveCount(1);
    await expect(
      feature.getByRole('heading', { level: 4, name: 'Scenario: Refuse to initialise twice' }),
    ).toHaveCount(1);
    // A scenario inside a Rule sits one level below the Rule.
    const ruled = page.locator(BLOCK).nth(2);
    await expect(ruled.getByRole('heading', { level: 4, name: /^Rule: / })).toHaveCount(1);
    await expect(
      ruled.getByRole('heading', { level: 5, name: 'Scenario: Declare a consignment with two lines' }),
    ).toHaveCount(1);
  });

  test('steps are an unordered list of list items, each opening with its keyword', async ({ page }) => {
    const lists = page.locator(`${BLOCK} .dk-gherkin__steps`);
    expect(await lists.count(), 'step lists render').toBeGreaterThanOrEqual(8);
    for (const list of await lists.all()) {
      await expect(list, 'a step list is a <ul>, never numbered').toHaveJSProperty('tagName', 'UL');
      await expect(list).toHaveRole('list');
      const items = list.locator(':scope > *');
      const n = await items.count();
      expect(n, 'a step list has steps').toBeGreaterThan(0);
      for (const item of await items.all()) {
        await expect(item).toHaveRole('listitem');
        const kw = item.locator(':scope > strong.dk-gherkin__kw');
        await expect(kw, 'each step carries exactly one keyword element').toHaveCount(1);
        await expect(kw).toHaveText(STEP_KEYWORDS);
      }
    }
    // The steps-only fragment is one list of four steps and nothing else.
    const fragment = page.locator(BLOCK).nth(1);
    await expect(fragment.getByRole('listitem')).toHaveCount(4);
    await expect(fragment.getByRole('heading')).toHaveCount(0);
  });

  test('the keyword is set apart without colour and its colour clears 4.5:1', async ({ page }) => {
    const keywords = page.locator(`${BLOCK} .dk-gherkin__kw`);
    expect(await keywords.count()).toBeGreaterThan(0);
    const measured = await keywords.evaluateAll((els) => {
      const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const lin = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      // The first ancestor with an opaque background is what the keyword sits on.
      const background = (el: Element) => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = rgba(getComputedStyle(n).backgroundColor);
          if (c.length >= 3 && (c.length < 4 || c[3] === 1)) return c;
        }
        return [255, 255, 255];
      };
      return els.map((el) => {
        const kw = getComputedStyle(el);
        const step = getComputedStyle(el.parentElement as Element);
        const [a, b] = [lum(rgba(kw.color)), lum(background(el))].sort((x, y) => y - x);
        return {
          text: el.textContent,
          kwWeight: Number(kw.fontWeight),
          stepWeight: Number(step.fontWeight),
          ratio: (a + 0.05) / (b + 0.05),
        };
      });
    });
    for (const m of measured) {
      expect(m.kwWeight, `keyword "${m.text}" is bolder than its step text (no colour-only cue)`).toBeGreaterThan(
        m.stepWeight,
      );
      expect(m.kwWeight, `keyword "${m.text}" is bold`).toBeGreaterThanOrEqual(600);
      expect(m.ratio, `keyword "${m.text}" contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('data tables and Examples tables expose column headers', async ({ page }) => {
    const ruled = page.locator(BLOCK).nth(2);
    const dataTable = ruled.locator('.dk-gherkin__steps li table');
    await expect(dataTable, 'the step data table renders inside its step').toHaveCount(1);
    await expect(dataTable.getByRole('columnheader')).toHaveText(['sku', 'description', 'value']);
    await expect(dataTable.getByRole('row')).toHaveCount(3);

    const examples = ruled.locator(':scope > table');
    await expect(examples, 'the Examples table follows its outline').toHaveCount(1);
    await expect(examples.getByRole('columnheader')).toHaveText(['value', 'outcome']);

    // The doc string is a code block inside its step, not prose.
    await expect(ruled.locator('.dk-gherkin__steps li pre[data-language="json"]')).toHaveCount(1);
  });

  test('a fence inside an aside exposes its scenario as a heading by role, not an <hN>', async ({ page }) => {
    const block = page.locator(`${CONTENT} aside.starlight-aside--note .dk-gherkin`);
    await expect(block).toHaveCount(1);
    await expect(block.locator('h1, h2, h3, h4, h5, h6'), 'no real heading inside the aside').toHaveCount(0);
    const heading = block.getByRole('heading', { level: 3, name: 'Scenario: Track a consignment in transit' });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveJSProperty('tagName', 'P');
    await expect(block.getByRole('listitem')).toHaveCount(3);
  });

  test('each include renders under the host outline and ends in its source line', async ({ page }) => {
    const includes = page.locator(BLOCK).filter({ has: page.locator('.dk-gherkin__source') });
    await expect(includes, 'three include blocks carry a source line').toHaveCount(3);
    const sources = page.locator(`${BLOCK} > p.dk-gherkin__source:last-child`);
    await expect(sources, 'the source line is the last thing in its block').toHaveText([
      'Source: scenarios/init/init.feature',
      'From Declare a consignment to customs, features/shipping/declare-customs.feature',
      'From Book a consignment, features/shipping/book-consignment.feature',
    ]);
    // The path is code, so a reader can copy it.
    await expect(sources.locator('code')).toHaveCount(3);

    // The whole-file include sits under an H3, so its Feature title is an H4.
    const whole = includes.nth(0);
    await expect(whole.getByRole('heading', { level: 4, name: 'Set up Spec Kitty in a repository' })).toHaveCount(1);
    await expect(whole.getByRole('heading', { level: 5, name: /^Scenario: / })).toHaveCount(2);
    // A quoted step argument is code with its quotes and `--` flags as written
    // (typography would curl the quotes and turn `--` into a dash).
    await expect(whole.locator('.dk-gherkin__steps li code', { hasText: 'spec-kitty init --non-interactive' })).toHaveText(
      '"spec-kitty init --non-interactive --ai claude,codex"',
    );
    // A selected include renders only what it selects, under no Feature heading.
    const byName = includes.nth(1);
    await expect(byName.getByRole('heading', { name: /^Scenario/ })).toHaveText([
      'Scenario: Hold a declaration lodged after the cut-off',
    ]);

    // No include fell back to a literal directive line.
    const leaked = await page.evaluate((root) => {
      const content = document.querySelector(root);
      if (!content) return [];
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      const hits: string[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.parentElement?.closest('pre, code')) continue;
        if ((n.textContent ?? '').includes('::gherkin')) hits.push((n.textContent ?? '').trim());
      }
      return hits;
    }, CONTENT);
    expect(leaked, 'no ::gherkin text outside code').toEqual([]);
  });

  test('the raw fence stays a code block and no structured fence leaks as code', async ({ page }) => {
    const pres = page.locator(`${CONTENT} pre[data-language="gherkin"]`);
    await expect(pres, 'exactly one gherkin code block: the raw fence').toHaveCount(1);
    await expect(pres).toContainText('Scenario: Show the source');
    await expect(pres.locator('xpath=ancestor::*[contains(@class, "dk-gherkin")]')).toHaveCount(0);
  });
});
