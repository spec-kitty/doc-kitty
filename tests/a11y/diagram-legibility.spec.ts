// Diagram legibility (#369 items 1–2, #370) — every build-rendered label fits its box
// and is readable against what is painted behind it, in BOTH themes, at desktop and
// phone width.
//
// The fixture page (`ROUTES.diagramContrast`) carries the shapes that broke on a
// consumer site: long labels, a diagram whose `%%{init}%%` sets its own font, nodes
// with author-set fills (with and without an author label colour), and an ArchiMate
// view whose layer fills stay pale in dark mode. `measureLegibility` reads the
// backdrop from screenshot pixels with the labels and edges hidden.
//
// Thresholds (WCAG 2.2 AA): text 4.5:1 (1.4.3), non-text 3:1 (1.4.11) for every
// edge, themed or author-coloured (`%%{init}%%` lineColor, `linkStyle`): an author
// colour that fails in one theme must give way there (#369 item 1). The defects are
// build-render only; a client-mode dist (no Chromium at build) skips.
import { test, expect } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, modeOf, renderModeOf } from './mode';
import { measureLegibility } from './helpers/legibility';

const LABEL_MIN = 4.5;
const EDGE_MIN = 3;
const WIDTHS = [1280, 390] as const;

test.describe('Diagram legibility (#369, #370)', () => {
  for (const width of WIDTHS) {
    test(`labels fit and contrast; edges contrast — ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoInMode(page, ROUTES.diagramContrast, modeOf(testInfo.project.name));
      test.skip((await renderModeOf(page)) === 'client', 'build-render defects; this dist renders diagrams client-side');
      await page.evaluate(() => document.fonts.ready);

      const report = await measureLegibility(page);
      await testInfo.attach('legibility.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });

      // Non-vacuity: the five fixture diagrams, with their labels and edges, were measured.
      expect(report.figures, 'all five fixture diagrams render as build-time SVG').toBe(5);
      expect(report.labels.length, 'labels were measured').toBeGreaterThanOrEqual(20);
      // Edges per figure, in page order: long labels 3, author font 2, author colours 3
      // (one linkStyle), author edge colours 3 (init lineColor, one linkStyle),
      // ArchiMate 3. A lost edge fails here rather than passing quietly.
      expect(report.edgesPerFigure, 'edges measured per figure').toEqual([3, 2, 3, 3, 3]);
      expect(report.skippedEdges, 'edges found but not measured').toEqual([]);
      expect(report.skippedLabels, 'labels found but not measured').toEqual([]);

      const lowLabels = report.labels.filter((l) => l.ratio < LABEL_MIN);
      expect.soft(lowLabels, `labels below ${LABEL_MIN}:1 against their backdrop`).toEqual([]);

      const lowEdges = report.edges.filter((e) => e.ratio < EDGE_MIN);
      expect.soft(lowEdges, `edges below ${EDGE_MIN}:1 against their backdrop`).toEqual([]);

      expect.soft(report.overflow, 'labels whose content overflows the box Mermaid sized for it').toEqual([]);
    });
  }
});
