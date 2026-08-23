// axe-core across the enumerated page set, in BOTH modes (WP09 T040).
//
// For each named route × each colour mode: drive+assert the mode, run axe-core with
// the WCAG 2.2 AA tag set over the WHOLE page — header, main, sidebar, TOC, and
// footer, everywhere the doc-kitty bridge tokens apply — and fail on any violation
// of impact `serious` or `critical` (NFR-001, SC-002).
//
// Non-vacuity guard: before analyzing we assert the covered surfaces actually exist
// (header/main/sidebar/footer), so an un-rendered region fails loudly instead of
// letting axe report a clean zero against a page it never really scanned.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  AXE_PAGES,
  WCAG_TAGS,
  CHROME_ROOT,
  CONTENT_ROOT,
  SIDEBAR_ROOT,
  FOOTER_ROOT,
} from './routes';
import { gotoInMode, modeOf } from './mode';

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

for (const pageDef of AXE_PAGES) {
  test.describe(pageDef.name, () => {
    test(`no serious/critical WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
      const mode = modeOf(testInfo.project.name);

      // Drive + ASSERT the colour mode before doing anything else.
      await gotoInMode(page, pageDef.path, mode);

      // --- Non-vacuity scope guard: the surfaces axe must cover really exist. -----
      // axe scans the whole page (below); this guard proves the page rendered the
      // regions the coverage claims — header, main, sidebar, AND footer (the F2
      // fix widened this past header + main). The TOC is not guarded (Starlight
      // omits it on heading-less pages).
      for (const [root, minCount] of [
        [CHROME_ROOT, 1],
        [CONTENT_ROOT, 1],
        [SIDEBAR_ROOT, 1],
        [FOOTER_ROOT, 1],
      ] as const) {
        const count = await page.locator(root).count();
        expect(
          count,
          `axe scope surface '${root}' must exist on ${pageDef.path}`,
        ).toBeGreaterThanOrEqual(minCount);
      }

      // --- Run axe over the WHOLE page (chrome + content + sidebar + TOC + footer),
      //     both modes. No narrowing `.include()` — the whole enumerated page is
      //     the coverage surface. ----------------------------------------------------
      const results = await new AxeBuilder({ page })
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
