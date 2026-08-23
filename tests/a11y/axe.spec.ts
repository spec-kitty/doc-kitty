// axe-core across the enumerated page set, in BOTH modes (WP09 T040).
//
// For each named route × each colour mode: drive+assert the mode, run axe-core with
// the WCAG 2.2 AA tag set scoped to the doc-kitty chrome + content, and fail on any
// violation of impact `serious` or `critical` (NFR-001, SC-002).
//
// Non-vacuity guard: before analyzing we assert the scope targets actually exist, so
// a mismatched `include` selector fails loudly instead of reporting a clean zero
// against nothing.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AXE_PAGES, WCAG_TAGS, CHROME_ROOT, CONTENT_ROOT } from './routes';
import { gotoInMode, modeOf } from './mode';

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

for (const pageDef of AXE_PAGES) {
  test.describe(pageDef.name, () => {
    test(`no serious/critical WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
      const mode = modeOf(testInfo.project.name);

      // Drive + ASSERT the colour mode before doing anything else.
      await gotoInMode(page, pageDef.path, mode);

      // --- Non-vacuity scope guard: the include targets must really exist. --------
      await expect(
        page.locator(CHROME_ROOT),
        `axe scope target '${CHROME_ROOT}' must exist on ${pageDef.path}`,
      ).toHaveCount(1);
      const contentCount = await page.locator(CONTENT_ROOT).count();
      expect(
        contentCount,
        `axe scope target '${CONTENT_ROOT}' must exist on ${pageDef.path}`,
      ).toBeGreaterThanOrEqual(1);

      // --- Run axe over the doc-kitty chrome + content, both modes. ---------------
      const results = await new AxeBuilder({ page })
        .include(CHROME_ROOT)
        .include(CONTENT_ROOT)
        .withTags([...WCAG_TAGS])
        .analyze();

      const blocking = results.violations.filter(
        (v) => v.impact && BLOCKING_IMPACTS.has(v.impact),
      );

      // Actionable failure output: rule id, impact, help URL, offending nodes.
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
        console.error(
          `axe found ${blocking.length} serious/critical violation(s) on ` +
            `${pageDef.path} (${mode}):\n${report}`,
        );
      }

      expect(
        blocking,
        `serious/critical WCAG violations on ${pageDef.path} (${mode})`,
      ).toEqual([]);
    });
  });
}
