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
import { AXE_PAGES, WCAG_TAGS } from './routes';
import { gotoInMode, gotoDeckInMode, modeOf } from './mode';

const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

for (const pageDef of AXE_PAGES) {
  test.describe(pageDef.name, () => {
    test(`no serious/critical WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
      const mode = modeOf(testInfo.project.name);

      // Drive + ASSERT the colour mode before doing anything else. The Starlight
      // shell resolves the mode through its ThemeProvider (localStorage +
      // data-theme); the out-of-frame deck has no such resolver, so its dark
      // palette is driven by the design's own `data-theme` attribute. Either way
      // the drive ASSERTS the mode genuinely rendered (non-vacuity).
      if (pageDef.shell === 'deck') {
        await gotoDeckInMode(page, pageDef.path, mode);
      } else {
        await gotoInMode(page, pageDef.path, mode);
      }

      // --- Render-gate (DX-1): a diagram renders CLIENT-SIDE, so on a route that
      //     declares `renderWait` we WAIT for that render before anything else.
      //     Awaited UNCONDITIONALLY (not "if a figure exists, wait" — a gate that
      //     fires only when the element is already there can never fail: a diagram
      //     that silently failed to render would leave the bare `<pre>` and axe
      //     would pass vacuously). COUNT-AWARE: the demonstrator renders two
      //     diagrams, so we assert the exact count (a bare `.toBeVisible()` would
      //     strict-throw on >1 and `.first()` would gate only one), that EACH is
      //     visible, and that no `pre.mermaid` still holds its raw source (Mermaid
      //     marks a node `data-processed` only AFTER it has replaced the source
      //     text with the rendered `<svg>`). This precedes the guardRoots check
      //     below so the rendered-svg guard root reads a non-zero count. ----------
      if (pageDef.renderWait !== undefined) {
        const expectedCount = pageDef.renderCount ?? 0;
        const rendered = page.locator(pageDef.renderWait);
        await expect(
          rendered,
          `render-gate '${pageDef.renderWait}' must resolve to ${expectedCount} diagram(s) on ${pageDef.path}`,
        ).toHaveCount(expectedCount);
        for (const svg of await rendered.all()) {
          await expect(svg, `each gated diagram must be visible on ${pageDef.path}`).toBeVisible();
        }
        // Raw source consumed IN THE CURRENT VIEW: every VISIBLE `pre.mermaid` is
        // `data-processed` (its source text replaced by the rendered `<svg>`), so no
        // raw mermaid source is exposed to the axe scan on the view being scanned.
        //
        // SLIDE-AWARE RECONCILIATION (#15): this file is not WP05-owned, but it must
        // adapt to the shipped slide-aware deck render. On a DECK, slides 2+ are
        // `display:none` at load and their diagrams render only on `slidechanged`
        // (INV-SCOPE, diagram-render.client) — so a page-wide
        // `:not([data-processed]) === 0` is now false BY DESIGN (those hidden nodes
        // are the #15 fix, not a regression). Scoping to `:visible` preserves the
        // test's real purpose — no raw source on the CURRENT view — while allowing
        // the hidden, deliberately-unrendered slides. On a doc page every diagram is
        // visible at load, so this stays exactly as strong as before (a diagram that
        // silently failed to render would be visible AND unprocessed → still fails).
        // Scope precisely: on a DECK, reveal keeps an adjacent slide in the DOM
        // at a size Playwright counts as `:visible` even though it is not the
        // slide the user sees — and that adjacent slide's diagram is deliberately
        // unrendered until navigated to (slide-aware #15). So assert the raw-source
        // guard on the PRESENT leaf only (`.reveal section.present`); on a doc page
        // there is no `.reveal`, so fall back to the page-wide `:visible` scope.
        const isDeck = (await page.locator('.reveal').count()) > 0;
        const unprocessed = isDeck
          ? page.locator(
              '.reveal section.present pre.mermaid:not([data-processed="true"])',
            )
          : page.locator('pre.mermaid:not([data-processed="true"]):visible');
        await expect(
          unprocessed,
          `no raw-source pre.mermaid may remain on the current view of ${pageDef.path}`,
        ).toHaveCount(0);
      }

      // --- Non-vacuity scope guard: the surfaces axe must cover really exist. -----
      // axe scans the whole page (below); this guard proves the page rendered the
      // regions the coverage claims. The set is per-shell (routes.ts `guardRoots`):
      // header/main/sidebar/footer for the Starlight shell; main.reveal/.slides/a
      // rendered <section>/labelled nav buttons for the chrome-free deck.
      for (const root of pageDef.guardRoots) {
        const count = await page.locator(root).count();
        expect(
          count,
          `axe scope surface '${root}' must exist on ${pageDef.path}`,
        ).toBeGreaterThanOrEqual(1);
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
