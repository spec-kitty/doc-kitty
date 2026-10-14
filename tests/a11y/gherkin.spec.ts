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
//     the command a step runs;
//   - a scenario's result (ADR-0052) is a WORD after its heading, never inside
//     it and never a colour alone, its text clears 4.5:1 on its badge, a screen
//     reader hears "Result:" before it, and an Examples table's results sit in a
//     column with a real header — on an include and on a generated page.
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
    // (blocks 0-3) followed by four `::gherkin` includes (blocks 4-7).
    await expect(
      page.locator(BLOCK),
      'the four structured fences and four includes render as .dk-gherkin',
    ).toHaveCount(8);
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
    await expect(includes, 'four include blocks carry a source line').toHaveCount(4);
    const sources = page.locator(`${BLOCK} > p.dk-gherkin__source:last-child`);
    await expect(sources, 'the source line is the last thing in its block').toHaveText([
      'Source: scenarios/init/init.feature',
      'From Declare a consignment to customs, features/shipping/declare-customs.feature',
      'From Book a consignment, features/shipping/book-consignment.feature',
      'Source: features/shipping/declare-customs.feature',
    ]);
    // The path is code, so a reader can copy it.
    await expect(sources.locator('code')).toHaveCount(4);

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

// ---------------------------------------------------------------------------
// Scenario results (ADR-0052)
// ---------------------------------------------------------------------------

const STATUS_WORDS = /^(?:Result: )?(?:Passed|Passed on retry|Failed|Ambiguous|Undefined|Pending|Skipped|Not run)$/;

for (const [name, route, examplesHeader] of [
  ['an include (/guides/scenarios-in-pages/)', ROUTES.scenariosInPages, ['size', 'reason', 'Result']],
  ['a generated feature page (/behaviour/shipping/book-consignment/)', ROUTES.behaviourFeature, ['size', 'reason', 'Result']],
] as const) {
  test.describe(`Scenario results on ${name}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await gotoInMode(page, route, modeOf(testInfo.project.name));
      await expect(page.locator(`${CONTENT} .dk-gherkin__status`).first(), 'results render').toBeVisible();
    });

    test('each result is a status word after its heading, announced as "Result:"', async ({ page }) => {
      const lines = page.locator(`${CONTENT} p.dk-gherkin__result`);
      expect(await lines.count()).toBeGreaterThan(0);
      for (const line of await lines.all()) {
        const placement = await line.evaluate((el) => {
          const prev = el.previousElementSibling;
          return {
            afterHeading: !!prev && (/^H[1-6]$/.test(prev.tagName) || prev.getAttribute('role') === 'heading'),
            inHeading: el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]') !== null,
          };
        });
        expect(placement, 'the result line directly follows its scenario heading').toEqual({
          afterHeading: true,
          inHeading: false,
        });
        const badge = line.locator('.dk-gherkin__status');
        await expect(badge).toHaveText(STATUS_WORDS);
        await expect(badge, 'a screen reader hears the lead').toContainText('Result:');
        await expect(badge.locator('.dk-gherkin__sr'), 'the lead is visually hidden').toHaveCSS('position', 'absolute');
      }
      // No heading (so no TOC entry) carries a status word.
      const headings = await page.locator(`${CONTENT} :is(h1, h2, h3, h4, h5, h6)`).allTextContents();
      expect(headings.filter((h) => /\b(Passed|Failed|Pending|Undefined|Not run)\b/.test(h))).toEqual([]);
    });

    test('a badge\'s text clears 4.5:1 on its own background', async ({ page }) => {
      const measured = await page.locator(`${CONTENT} .dk-gherkin__status`).evaluateAll((els) => {
        const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const lin = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        };
        return els.map((el) => {
          const style = getComputedStyle(el);
          const [a, b] = [lum(rgba(style.color)), lum(rgba(style.backgroundColor))].sort((x, y) => y - x);
          return { text: el.textContent, status: el.getAttribute('data-status'), ratio: (a + 0.05) / (b + 0.05) };
        });
      });
      expect(measured.length).toBeGreaterThan(0);
      for (const m of measured) {
        expect(m.status, `badge "${m.text}" names its status`).toMatch(/^(passed|failed|ambiguous|undefined|pending|skipped|not-run)$/);
        expect(m.ratio, `badge "${m.text}" contrast`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test('an Examples table carries its results in a Result column with a header', async ({ page }) => {
      const table = page.locator(`${CONTENT} table`).filter({ has: page.getByRole('columnheader', { name: 'Result' }) }).first();
      await expect(table.getByRole('columnheader')).toHaveText([...examplesHeader]);
      const cells = table.locator('tbody td:last-child .dk-gherkin__status');
      expect(await cells.count()).toBeGreaterThan(0);
      await expect(cells.first()).toHaveText(STATUS_WORDS);
    });

    test('the feature\'s results line names the run date', async ({ page }) => {
      const summary = page.locator(`${CONTENT} p.dk-gherkin__results`).first();
      await expect(summary).toContainText(/^Results: /);
      await expect(summary.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    });
  });
}
