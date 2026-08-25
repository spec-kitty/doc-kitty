// Diagram a11y — the DIRECT (Playwright, not axe) half of the render contract, on
// BOTH shells (WP06 T019/T021; contract render-token-and-assertions DX-2/DX-4/FP-1;
// FR-011, NFR-001, NFR-006, NFR-007).
//
// axe (axe.spec.ts) scans the surrounding HTML for WCAG violations, but it cannot be
// trusted for the SVG's accessible NAME: axe's `svg-img-alt` does not reliably fire
// on the runtime Mermaid SVG. So the NAME, the `<figure>`/`<figcaption>` structure,
// the single-render-loop guarantee, the `[data-theme]` re-render, and the network
// footprint are asserted here, DIRECTLY.
//
// Rendered DOM (rehype `diagram-figure` + the client render owner):
//   <figure class="dk-diagram" role="group">
//     <pre class="mermaid" data-processed="true"><svg aria-labelledby="chart-title-…">…</svg></pre>
//     <figcaption class="dk-diagram__caption"><span class="dk-diagram__desc">…</span>…</figcaption>
//   </figure>
// Mermaid sets `aria-labelledby` ONLY when an `accTitle` was injected; the remark
// pass injects `accTitle = title ?? description`, so a description-only diagram is
// named by its description (the R-01 name fallback) — proven directly below.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, gotoDeckInMode, modeOf, type Mode } from './mode';

// The description-only (title-ABSENT) diagram on the demonstrator: a SEQUENCE
// diagram whose caption/description is this exact sentence. Selecting the figure by
// this text targets that diagram BY ITS OWN IDENTITY — not `.first()` / "some svg",
// which would let the all-fields flowchart discharge the fallback vacuously.
const SEQ_DESC =
  'A reader requests a page and the static host returns pre-rendered HTML, with no server in the loop.';

// The deck's first-slide diagram (title + description present).
const DECK_DIAGRAM_TITLE = 'Out-of-frame deck pipeline';

const DIAGRAM_SVG = 'figure.dk-diagram svg[aria-labelledby]';

/** The accessible NAME of an `aria-labelledby` element: the concatenated text of
 * the elements its id-list references (the ARIA name-from-labelledby computation). */
async function accessibleName(svg: Locator): Promise<string> {
  return svg.first().evaluate((el) => {
    const ids = (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean);
    const doc = el.ownerDocument;
    return ids
      .map((id) => doc.getElementById(id)?.textContent ?? '')
      .join(' ')
      .trim();
  });
}

/** Per `pre.mermaid`, the current `<svg>` markup (empty string when none) — the
 * single-loop probe: one non-empty entry per node means exactly one `<svg>` each. */
async function svgMarkupPerNode(page: Page): Promise<string[]> {
  return page.$$eval('pre.mermaid', (pres) =>
    pres.map((p) => {
      const svgs = p.querySelectorAll('svg');
      // Encode the count so a stray second render (NFR-007 breach) is detectable.
      return `${svgs.length}::${svgs[0]?.outerHTML ?? ''}`;
    }),
  );
}

// ---------------------------------------------------------------------------
// DX-2 (doc shell) — direct accessible name on the TITLE-ABSENT diagram, by
// identity; figure role=group + figcaption present.
// ---------------------------------------------------------------------------
test.describe('Diagram accessible figure — doc shell (DX-2)', () => {
  test('the description-only diagram is named by its description; figure/figcaption present', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.diagram, mode);

    // Render-gate: both demonstrator diagrams have rendered before we assert.
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(2);

    // The title-absent figure, BY IDENTITY: the figure whose caption carries the
    // sequence diagram's description (not `.first()`).
    const seqFigure = page.locator('figure.dk-diagram', {
      has: page.locator('.dk-diagram__desc', { hasText: SEQ_DESC }),
    });
    await expect(seqFigure, 'the description-only figure must be uniquely located').toHaveCount(1);

    // Accessible figure structure (direct, not axe).
    await expect(seqFigure).toHaveAttribute('role', 'group');
    await expect(
      seqFigure.locator('figcaption.dk-diagram__caption'),
      'the figure must carry a caption',
    ).toHaveCount(1);

    // The rendered SVG carries a NON-EMPTY accessible name…
    const svg = seqFigure.locator('svg[aria-labelledby]');
    await expect(svg, 'the title-absent diagram must still render a named <svg>').toHaveCount(1);
    const name = await accessibleName(svg);
    expect(name.length, 'the SVG accessible name must be non-empty').toBeGreaterThan(0);

    // …and — the point of the fallback (R-01) — that name IS the description, since
    // this diagram has no `title`. Proven on a non-flowchart (sequence) type.
    expect(
      name,
      'a title-absent diagram is named by its description (accTitle → description fallback)',
    ).toContain(SEQ_DESC);
  });
});

// ---------------------------------------------------------------------------
// DX-2/DX-5 (deck shell) — the out-of-frame deck's first-slide diagram is a named
// accessible figure too.
// ---------------------------------------------------------------------------
test.describe('Diagram accessible figure — deck shell (DX-2/DX-5)', () => {
  test('the deck first-slide diagram is a named figure with a caption', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckInMode(page, ROUTES.deck, mode);

    // Render-gate: the single first-slide diagram has rendered.
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(1);

    const figure = page.locator('figure.dk-diagram');
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute('role', 'group');
    await expect(figure.locator('figcaption.dk-diagram__caption')).toHaveCount(1);

    const name = await accessibleName(page.locator(DIAGRAM_SVG));
    expect(name.length, 'the deck SVG accessible name must be non-empty').toBeGreaterThan(0);
    // This diagram DOES carry a title, so the name is the title (not the fallback).
    expect(name, 'the deck diagram is named by its title').toContain(DECK_DIAGRAM_TITLE);
  });
});

// ---------------------------------------------------------------------------
// NFR-007 (single render loop) + DX-4 ([data-theme] re-render) — exactly one
// `<svg>` per node after the initial render AND after a theme toggle; the toggle
// re-renders in the OTHER mode's colours, leaving no orphaned/stale duplicate.
// ---------------------------------------------------------------------------
test.describe('Diagram single render loop + theme re-render (NFR-007 / DX-4)', () => {
  test('one <svg> per pre.mermaid, before and after a [data-theme] toggle', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.diagram, mode);
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(2);

    // Exactly one <svg> under EACH pre.mermaid after the initial render. A stray
    // astro-mermaid render (the NFR-007 breach the single owner prevents) would
    // double the SVG under a node — Mermaid's per-run random ids dodge axe's
    // duplicate-id rule, so this direct count is the real guard.
    const before = await svgMarkupPerNode(page);
    expect(before.length, 'the demonstrator renders two diagrams').toBe(2);
    for (const node of before) {
      expect(node.startsWith('1::'), 'exactly one <svg> per pre.mermaid').toBe(true);
      expect(node.length, 'each rendered <svg> is non-empty').toBeGreaterThan(3);
    }

    // The other mode's palette really differs (so a re-render is observable).
    const fillOf = (): Promise<string> =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-node-fill').trim(),
      );
    const fillBefore = await fillOf();

    // Toggle the design's theme attribute; the single render loop's MutationObserver
    // restores each source, clears data-processed, and re-runs — one code path.
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);

    // Wait for the re-render to settle: each node again has exactly one <svg>, and
    // its markup CHANGED (redrawn with the other mode's inlined colours).
    await expect
      .poll(
        async () => {
          const after = await svgMarkupPerNode(page);
          if (after.length !== before.length) return false;
          return after.every(
            (node, i) => node.startsWith('1::') && node.length > 3 && node !== before[i],
          );
        },
        { message: 'each node must re-render to exactly one, changed <svg>' },
      )
      .toBe(true);

    // The palette actually switched — the re-render used the OTHER mode's colours.
    const fillAfter = await fillOf();
    expect(fillAfter, 'the node-fill token must change with the mode').not.toBe(fillBefore);
  });
});

// ---------------------------------------------------------------------------
// FP-1 (footprint, NFR-006) — a diagram page fetches the mermaid library chunk; a
// diagram-free control route does NOT. No external/CDN host in either trace.
// ---------------------------------------------------------------------------
test.describe('Diagram footprint (FP-1 / NFR-006)', () => {
  const MERMAID_CHUNK = /mermaid/i;

  // Collect every http(s) request URL a navigation makes, settle the network, and
  // (for a diagram page) wait for the render so the dynamic import has resolved.
  async function traceRoute(page: Page, path: string, waitForDiagram: boolean): Promise<string[]> {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await page.goto(path, { waitUntil: 'load' });
    if (waitForDiagram) {
      await expect(page.locator(DIAGRAM_SVG).first()).toBeVisible();
    }
    await page.waitForLoadState('networkidle');
    return urls;
  }

  test('a diagram page loads the mermaid chunk; a control route does not; no CDN', async ({
    page,
  }) => {
    // Diagram page: the mermaid chunk IS requested.
    const diagramUrls = await traceRoute(page, ROUTES.diagram, true);
    const pageOrigin = new URL(page.url()).origin;
    expect(
      diagramUrls.some((u) => MERMAID_CHUNK.test(u)),
      'the diagram page must request the mermaid library chunk',
    ).toBe(true);

    // Control route: a diagram-free page NEVER resolves the chunk (the render owner
    // short-circuits before `import('mermaid')`).
    const controlUrls = await traceRoute(page, ROUTES.prose, false);
    expect(
      controlUrls.some((u) => MERMAID_CHUNK.test(u)),
      'a diagram-free control route must NOT request the mermaid chunk',
    ).toBe(false);

    // No external/CDN host in EITHER trace: every http(s) request is same-origin
    // (the static dist served locally) — the whole runtime is self-hosted (BD-4).
    for (const u of [...diagramUrls, ...controlUrls]) {
      if (!u.startsWith('http')) continue; // ignore data:/blob: (no host)
      expect(
        new URL(u).origin,
        `unexpected off-origin request (possible CDN): ${u}`,
      ).toBe(pageOrigin);
    }
  });
});
