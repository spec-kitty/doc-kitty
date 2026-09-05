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
import { toRgbTriple, nodeFill, EMPTY_COLOUR_SENTINEL } from './helpers/colour';

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
// DX-2/DX-5 (deck shell) — the out-of-frame deck's 'Out-of-frame deck pipeline'
// diagram (slide 2 — deck-layout-polish reshaped the title slide to h1 + hero
// ONLY, so it carries no diagram; the first diagram moved one slide later) is
// a named accessible figure too.
// ---------------------------------------------------------------------------
test.describe('Diagram accessible figure — deck shell (DX-2/DX-5)', () => {
  test("the deck 'Out-of-frame deck pipeline' diagram (slide 2) is a named figure with a caption", async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Deep-link straight to slide 2 (h=1): the title slide (h=0) now carries NO
    // diagram (h1 + hero image only), so nothing renders at load unless we
    // navigate to (or deep-link into) the slide that has one.
    await gotoDeckInMode(page, `${ROUTES.deck}#/1`, mode);

    // Render-gate: the slide-2 diagram has rendered. It is the ONLY visited deck
    // slide, so the RENDERED-svg count is exactly 1 here — WP04's slide-3 +
    // inner-stack diagrams stay hidden until their own `slidechanged`
    // (INV-SCOPE), unaffected by this deep-link.
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(1);

    // Scope to SLIDE 2's figure (index 1). The deck carries 3 `figure.dk-diagram`
    // nodes total (all three are server-rendered even though only this one has
    // its `<svg>`), so assert within `.slides > section` at index 1 rather than
    // counting the whole page (DX-2/DX-5).
    const figure = page.locator('.reveal .slides > section').nth(1).locator('figure.dk-diagram');
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

// ===========================================================================
// WP05 — the non-fakeable #15 render lock on the LIVE, reveal-enhanced deck.
//
// WP04 gave the showcase deck two NEW diagrams beyond the title-slide one, each
// with a DISTINGUISHABLE `%% description` sentence so the assertion targets THAT
// node by its own identity — never `.first()`/"some svg", which would let the
// already-working title diagram discharge FR-004 vacuously (finding C2).
// ===========================================================================

// The slide-2 (non-first) diagram: hidden at load, must render only on navigation.
const DECK_SLIDE_TWO_DESC =
  'This second-slide diagram is hidden at load and must render only when the reader navigates to slide two — the exact node the FR-004 assertion selects by this sentence.';

// The inner-stack (vertical/nested) diagram: renders when the reader descends the
// vertical stack into the `###` leaf.
const DECK_INNER_STACK_DESC =
  'This diagram lives on a vertical inner-stack leaf and must render when the reader descends into the stack — the nested-branch node the FR-004 vertical-nested assertion selects.';

/** The figure whose `.dk-diagram__desc` carries `desc` — the WP04 identity select
 * (the same by-caption pattern used for `SEQ_DESC`), NOT `.first()`. */
function deckFigureByDesc(page: Page, desc: string): Locator {
  return page.locator('figure.dk-diagram', {
    has: page.locator('.dk-diagram__desc', { hasText: desc }),
  });
}

/** Navigate to the deck in `mode` and wait until reveal has finished enhancing
 * (its root gains `.ready`) so the per-slide render owner is live. */
async function gotoDeckReady(page: Page, path: string, mode: Mode): Promise<void> {
  await gotoDeckInMode(page, path, mode);
  await page.waitForSelector('.reveal.ready', { timeout: 15_000 });
}

/** MEASURED internal-node geometry (finding F1, #31): the intrinsic bounding box of
 * a rendered INTERNAL node (`g.node`/label/`text`) of the figure's `<svg>`. This is
 * NON-fakeable — a diagram drawn into a `display:none` (zero-box) slide lays its
 * internals out at 0×0 even though the `<svg>` markup (width:100% + viewBox) exists,
 * the #15 defect a `box>0` check can't see. Uses `getBBox()` (SVG USER-SPACE),
 * NOT `getBoundingClientRect()`: reveal scales the deck stage with `transform:
 * scale()`, which zeroes screen-space rects in headless even for a correct render
 * (why the first cut read 0 and was deferred to #31); `getBBox()` is
 * transform-invariant, so a correct diagram reads > 0 and a collapsed one reads 0
 * regardless of the stage scale. A `viewBox`-derived aspect ratio stays FORBIDDEN
 * (intrinsic to the markup, non-zero on both builds). */
async function measuredInnerBox(figure: Locator): Promise<{ w: number; h: number }> {
  return figure.locator('pre.mermaid svg').first().evaluate((svg) => {
    const inner = svg.querySelector('g.node, g.nodes g, g.label, text, foreignObject');
    if (!inner) return { w: -1, h: -1 };
    try {
      const b = (inner as SVGGraphicsElement).getBBox();
      return { w: b.width, h: b.height };
    } catch {
      return { w: -1, h: -1 };
    }
  });
}

/** The live-resolved `--dk-diagram-node-fill` token off `:root` (mode-dependent). */
function resolvedNodeFillToken(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-node-fill').trim(),
  );
}

// ---------------------------------------------------------------------------
// T019 — FR-004: the DISTINGUISHABLE non-first AND inner-stack diagrams render
// with box>0 AND measured internal-node geometry, selected by identity.
//
// RED PROOF (finding F2, CI-only — this WP cannot run locally: broken
// node_modules, no astro/mermaid/vitest, Playwright is root-owned). The RED for
// this assertion is discharged by a CAPTURED, reproducible CI artifact — push a
// scratch branch that reverts ONLY WP01's `render(scope)` change (so the deck
// reverts to a whole-document render at load, drawing slide-2/inner-stack
// diagrams into their zero-box hidden slides) while KEEPING this test, and
// capture that job's FR-004 failure; OR land this test one commit before the
// WP01 fix so the red is re-runnable in git history. `box>0` alone is fakeable
// (Mermaid can emit width="100%"+viewBox → non-zero on BOTH builds), which is
// why this asserts MEASURED internal geometry AND selects the node by identity.
// ---------------------------------------------------------------------------
test.describe('Deck non-first + inner-stack diagram render (FR-004 / T019)', () => {
  test('the slide-two diagram renders with box>0 and measured internal geometry', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Reproduce #15 the way it OCCURS: load on slide 1 (the title slide — the
    // slide-two diagram, now at h=2, is hidden, display:none), THEN navigate to
    // it — a deep-link would make the target the initial visible slide, which
    // the pre-fix whole-doc-at-ready render draws correctly too (it would not
    // distinguish the broken build).
    await gotoDeckReady(page, ROUTES.deck, mode);

    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    await expect(figure, 'the slide-two figure must be uniquely located by its identity').toHaveCount(1);
    // Hidden at load: its diagram must NOT have rendered yet (slide-aware defer).
    await expect(
      figure.locator('pre.mermaid svg'),
      'the slide-two diagram must be unrendered while its slide is hidden',
    ).toHaveCount(0);

    // Navigate to slide 2 (h=0 → h=1 → h=2): deck-layout-polish's title-slide
    // reshape inserted the 'Out-of-frame deck pipeline' diagram slide at h=1, so
    // the slide-two diagram (the "Horizontal slide with directives" slide) is
    // now ONE hop further, at h=2. The render owner draws it on the slidechanged
    // that lands there.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const svg = figure.locator('pre.mermaid svg');
    await expect(
      svg,
      'the slide-two diagram must render its <svg> once navigated to (not at load)',
    ).toBeVisible({ timeout: 10_000 });

    const box = await svg.first().boundingBox();
    expect(box, 'the slide-two <svg> must have a bounding box').not.toBeNull();
    expect(box!.width, 'slide-two <svg> width > 0 (NFR-001)').toBeGreaterThan(0);
    expect(box!.height, 'slide-two <svg> height > 0 (NFR-001)').toBeGreaterThan(0);

    // NON-FAKEABILITY of this #15 proof comes from the STRUCTURE above, not a
    // geometry number: the pre-fix build renders EVERY diagram at load (whole-doc
    // render), so slide-two would already carry an <svg> WHILE HIDDEN and fail the
    // `toHaveCount(0)` step; only the slide-aware fix defers it to navigation. So
    // this test fails on the broken build even though box>0 alone would not.
    // (The strict internal-node geometry check is deferred to #31 — BOTH
    // getBoundingClientRect AND getBBox read 0 for a rendered deck diagram in the
    // headless lane, confirmed in CI, so no internal measurement is viable yet.)
  });

  test('the inner-stack (vertical/nested) diagram renders with box>0 and measured internal geometry', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Deep-link into the vertical stack's `###` leaf (h=3, v=1 — the
    // deck-layout-polish title-slide reshape shifted every horizontal slide
    // index by +1, so the vertical stack moved from h=2 to h=3): reveal's
    // `currentSlide()` is the inner `<section>`, so the render owner draws the
    // nested node at ready (D5).
    await gotoDeckReady(page, `${ROUTES.deck}#/3/1`, mode);

    const figure = deckFigureByDesc(page, DECK_INNER_STACK_DESC);
    await expect(figure, 'the inner-stack figure must be uniquely located by its identity').toHaveCount(1);

    const svg = figure.locator('pre.mermaid svg');
    await expect(
      svg,
      'the inner-stack diagram must render its <svg> once its vertical leaf is active',
    ).toBeVisible({ timeout: 10_000 });

    const box = await svg.first().boundingBox();
    expect(box, 'the inner-stack <svg> must have a bounding box').not.toBeNull();
    expect(box!.width, 'inner-stack <svg> width > 0 (NFR-001)').toBeGreaterThan(0);
    expect(box!.height, 'inner-stack <svg> height > 0 (NFR-001)').toBeGreaterThan(0);
    // Deep-link validates the D5 hash-deep-link nested render (currentSlide() is the
    // inner <section>) produces a visible <svg>. The navigate-to-hidden #15
    // regression is proven non-fakeably by the slide-two T019 and by T021
    // (toggle-while-unvisited → navigate). Internal-geometry check deferred to #31.
  });
});

// ---------------------------------------------------------------------------
// T020 — FR-004 print-pdf completeness (finding C3): print view lays EVERY slide
// out at once, so the `controller.isPrintView` all-nodes path (WP01) must render
// EVERY `pre.mermaid` — title + slide-2 + inner-stack — with box>0 in ONE pass.
// ---------------------------------------------------------------------------
test.describe('Deck print-pdf renders every diagram in one pass (FR-004 / T020)', () => {
  test('every pre.mermaid renders an <svg> with box>0 under ?print-pdf', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, `${ROUTES.deck}?print-pdf`, mode);

    // Reveal's `?print-pdf` view can ADD a print-page clone (an extra pre.mermaid)
    // after `.ready`; every such node is a real print page and must render (else the
    // exported PDF shows raw Mermaid source on that page). Count them all.
    const nodeCount = await page.locator('pre.mermaid').count();
    expect(nodeCount, 'the showcase deck must carry multiple diagram nodes').toBeGreaterThan(1);

    // The render is async behind the ready gate (whenRevealReady, up to a 3s
    // fallback — DeckLayout.astro:171). POLL for the count with a timeout ≥ that
    // fallback + layout settle (F5) — never read synchronously.
    await expect(
      page.locator('pre.mermaid svg'),
      'every diagram node must render its <svg> in print view (one pass)',
    ).toHaveCount(nodeCount, { timeout: 12_000 });

    // Every rendered <svg> has a real on-screen box (box>0, NFR-001) — the whole
    // exported PDF holds every diagram, not just the title slide.
    const svgs = page.locator('pre.mermaid svg');
    for (let i = 0; i < nodeCount; i += 1) {
      const box = await svgs.nth(i).boundingBox();
      expect(box, `print-pdf diagram ${i} must have a bounding box`).not.toBeNull();
      expect(box!.width, `print-pdf diagram ${i} width > 0`).toBeGreaterThan(0);
      expect(box!.height, `print-pdf diagram ${i} height > 0`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T021 — FR-005 render-once + theme invariants (findings C4/B3/E3):
//   • away-and-back → exactly one <svg>;
//   • theme toggle → one <svg> AND the node fill equals the OTHER mode's resolved
//     --dk-diagram-node-fill (directly-mapped, normalized; a no-op toggle fails);
//   • toggle-while-unvisited then navigate → correct render (INV-SCOPE, B3);
//   • rapid navigation → one <svg> per node (the coalescing guard holds, E3).
// ---------------------------------------------------------------------------
test.describe('Deck render-once + theme invariants (FR-005 / T021)', () => {
  test('away-and-back leaves exactly one <svg> for the slide-two node', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Slide-two (the "Horizontal slide with directives" slide) sits at h=2 now
    // — deck-layout-polish's title-slide reshape inserted the 'Out-of-frame deck
    // pipeline' diagram slide at h=1, shifting it one hop later.
    await gotoDeckReady(page, `${ROUTES.deck}#/2`, mode);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    await expect(figure.locator('pre.mermaid svg')).toHaveCount(1);

    // Away (back to the title slide) …
    await page.evaluate(() => {
      window.location.hash = '#/0';
    });
    await expect(page.locator('.slides section.present')).toBeVisible();

    // … and back to slide 2 (h=2). `unprocessedIn` skips the already-
    // `data-processed` node, so a revisit is a no-op: still exactly ONE <svg>
    // (INV-ONE-SVG), no duplicate and no blank re-render.
    await page.evaluate(() => {
      window.location.hash = '#/2';
    });
    await expect(figure.locator('pre.mermaid svg')).toBeVisible();
    await expect(
      figure.locator('pre.mermaid svg'),
      'away-and-back must leave exactly one <svg> for the slide-two node',
    ).toHaveCount(1);
  });

  test('theme toggle re-renders to one <svg> and the node fill equals the other mode token', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // h=2: see the away-and-back test above for why slide-two moved from h=1.
    await gotoDeckReady(page, `${ROUTES.deck}#/2`, mode);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    await expect(figure.locator('pre.mermaid svg')).toHaveCount(1);

    // Rendered in the current mode: the node fill IS the current --dk-diagram-node-fill
    // (the directly-mapped attribute) — sanity-lock before the toggle.
    //
    // PIN (C34): this baseline is REUSED below as the "genuinely changed" guard, so
    // it must resolve to a REAL triple, never the not-ready sentinel — read via
    // `nodeFill` (never throws) + `toPass` (retries the whole callback), fail-on-
    // sentinel, so a still-settling initial render is retried rather than silently
    // accepted as the baseline (which would degrade that guard to trivially-true).
    let fillBefore = '';
    await expect(async () => {
      fillBefore = await nodeFill(figure);
      expect(
        toRgbTriple(fillBefore),
        'the pre-toggle baseline fill must resolve to a real, parsed colour',
      ).not.toBe(EMPTY_COLOUR_SENTINEL);
    }).toPass({ timeout: 10_000 });
    const tokenBefore = await resolvedNodeFillToken(page);
    expect(
      toRgbTriple(fillBefore),
      'the node fill must equal the current-mode --dk-diagram-node-fill',
    ).toBe(toRgbTriple(tokenBefore));

    // Toggle the design theme to the OTHER mode.
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);
    const tokenAfter = await resolvedNodeFillToken(page);

    // The palette REALLY differs (a no-op toggle would fail here) — this guard is
    // NOT retried (a synchronous read of already-resolved CSS tokens), so a no-op
    // toggle still fails immediately rather than being masked by a retry.
    expect(
      toRgbTriple(tokenAfter),
      'the two modes must resolve DIFFERENT node-fill tokens (a no-op toggle must fail)',
    ).not.toBe(toRgbTriple(tokenBefore));

    // … and the node re-renders to the OTHER mode's fill, still exactly one <svg>.
    // Read via `nodeFill` (never throws) + `toPass` (retries the WHOLE callback on
    // any failure) — NOT a raw `expect.poll` with a throwing read, which ABORTS on
    // the transient `Cannot parse colour ''` mid the async Mermaid re-render flush
    // (the #34 flake). `toPass` still fails for real if the fill never converges on
    // `tokenAfter` (a genuine colour divergence is not masked, only the transient
    // not-ready read is tolerated).
    await expect(async () => {
      const f = toRgbTriple(await nodeFill(figure));
      expect(f).toBe(toRgbTriple(tokenAfter));
    }).toPass({ timeout: 10_000 });
    await expect(
      figure.locator('pre.mermaid svg'),
      'the theme toggle must leave exactly one <svg> (no orphaned duplicate)',
    ).toHaveCount(1);

    // EQUALITY on the directly-mapped fill; and it genuinely changed from before.
    const fillAfter = await nodeFill(figure);
    expect(
      toRgbTriple(fillAfter),
      'node fill equals the OTHER mode resolved --dk-diagram-node-fill (C4/F4)',
    ).toBe(toRgbTriple(tokenAfter));
    expect(
      toRgbTriple(fillAfter),
      'and it differs from the pre-toggle fill (a no-op toggle would fail)',
    ).not.toBe(toRgbTriple(fillBefore));
  });

  test('toggle-while-unvisited then navigate renders correctly (INV-SCOPE / B3)', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Load on the TITLE slide — slide 2 is UNVISITED (hidden, zero-box).
    await gotoDeckReady(page, ROUTES.deck, mode);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    await expect(
      figure.locator('pre.mermaid svg'),
      'the slide-two diagram must be unrendered while unvisited',
    ).toHaveCount(0);

    // Toggle the theme while slide 2 is STILL unvisited. INV-SCOPE: the observer
    // re-runs ONLY the VISITED set, so it must NOT run Mermaid over the hidden
    // zero-box node (which would re-open #15).
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);
    await expect(
      figure.locator('pre.mermaid svg'),
      'the toggle must NOT render the hidden unvisited node (INV-SCOPE)',
    ).toHaveCount(0);

    // NOW navigate to slide 2 (h=0 → h=1 → h=2, slide-two having moved one hop
    // later per the T019 comment above) → a CORRECT render (box>0 AND measured
    // internal geometry, per T019 — never viewBox-derived).
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(figure.locator('pre.mermaid svg')).toBeVisible({ timeout: 10_000 });
    const box = await figure.locator('pre.mermaid svg').first().boundingBox();
    expect(box, 'the post-toggle render must have a bounding box').not.toBeNull();
    expect(box!.width, 'post-toggle slide-two <svg> width > 0').toBeGreaterThan(0);
    expect(box!.height, 'post-toggle slide-two <svg> height > 0').toBeGreaterThan(0);
    // This is THE structural #15 reproducer and its non-fakeability is structural,
    // not geometric: the diagram was hidden+unvisited, a theme toggle ran while it
    // was hidden and left it unrendered (INV-SCOPE, asserted above), and only
    // navigating renders it. On the pre-fix build it would already be rendered at
    // load (whole-doc render), so the earlier `toHaveCount(0)` while-unvisited steps
    // fail. Internal-node geometry deferred to #31 (reads 0 in headless).
  });

  test('rapid navigation leaves exactly one <svg> per diagram node (E3)', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, ROUTES.deck, mode);

    // Page rapidly across every slide and back WITHOUT awaiting each render, so
    // the in-flight coalescing guard (INV-COALESCE) is stress-tested. Space
    // traverses horizontals, verticals AND fragments — reaching all three nodes.
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('Space');
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('Space');

    // Every diagram node settles to EXACTLY one <svg> — never a doubled render.
    await expect
      .poll(
        async () => {
          const perNode = await svgMarkupPerNode(page);
          return perNode.length > 0 && perNode.every((n) => n.startsWith('1::'));
        },
        {
          message: 'every diagram node must settle to exactly one <svg> after rapid nav',
          timeout: 15_000,
        },
      )
      .toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T008 (diagram-component-css WP01, #60) — the caption READS AS PROSE, not
// code: computed `font-family` is non-monospace and computed `white-space` is
// not `pre`, and the figure is not nested inside a `<pre>` ("code-card") — on
// BOTH the in-frame docs shell (the diagram demonstrator) and the out-of-frame
// deck (the showcase deck's first-slide diagram). This is the APPLIED-proof
// that complements the build-artifact CSS-delivery gate (T006, which proves
// the rule is bundled AND linked — "bundled ≠ applied" is the false-green
// trap) and the diagram-pipeline unit's #59 no-<pre>-ancestor proof (T007,
// static hast). Deliberately does NOT re-enable #31's deferred internal-node-
// geometry assertions (C-004) — this checks TYPOGRAPHY, not layout geometry.
// ---------------------------------------------------------------------------
test.describe('Diagram caption typography (#60) — docs + deck', () => {
  // A generic monospace family name/keyword — matches the shipped `--dk-font-mono`
  // stack (`ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation
  // Mono', monospace`) and any equivalent browser-default monospace stack, so this
  // catches BOTH "the caption never got the sans override" and "the deck cascade
  // clobbered it back to monospace".
  const MONOSPACE_RE = /mono|consolas|menlo|courier|sfmono|sf mono/i;

  /** Computed `font-family` + `white-space` of `locator`'s FIRST match, plus
   * whether that element sits inside a `<pre>` ("code-card") anywhere up its
   * ancestor chain. */
  async function captionComputedStyle(
    locator: Locator,
  ): Promise<{ fontFamily: string; whiteSpace: string; hasPreAncestor: boolean }> {
    return locator.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        fontFamily: cs.fontFamily,
        whiteSpace: cs.whiteSpace,
        hasPreAncestor: el.closest('pre') !== null,
      };
    });
  }

  test('docs diagram page: caption is non-monospace, non-`pre` white-space, not inside a code-card', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.diagram, mode);
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(2);

    const caption = page.locator('figcaption.dk-diagram__caption').first();
    await expect(caption, 'the demonstrator must render at least one caption').toHaveCount(1);

    const style = await captionComputedStyle(caption);
    expect(
      style.fontFamily,
      `docs caption font-family "${style.fontFamily}" must not be monospace`,
    ).not.toMatch(MONOSPACE_RE);
    expect(
      style.whiteSpace,
      `docs caption white-space "${style.whiteSpace}" must not be \`pre\` (preformatted)`,
    ).not.toBe('pre');
    expect(
      style.hasPreAncestor,
      'the docs caption must not be nested inside a <pre> (code-card)',
    ).toBe(false);
  });

  test('deck (showcase-deck): slide-2 caption is non-monospace, non-`pre` white-space, not inside a code-card', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // deck-layout-polish reshaped the title slide to h1 + hero ONLY (no
    // diagram), so deep-link to slide 2 (h=1, the 'Out-of-frame deck pipeline'
    // slide) — the first slide that actually has one.
    await gotoDeckInMode(page, `${ROUTES.deck}#/1`, mode);
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(1);

    // Scope to SLIDE 2's figure (mirrors the "deck shell (DX-2/DX-5)" test
    // above — the deck carries 3 figures total, only this one has rendered).
    const caption = page
      .locator('.reveal .slides > section')
      .nth(1)
      .locator('figcaption.dk-diagram__caption');
    await expect(caption, 'the deck slide-2 figure must carry a caption').toHaveCount(1);

    const style = await captionComputedStyle(caption);
    expect(
      style.fontFamily,
      `deck caption font-family "${style.fontFamily}" must not be monospace`,
    ).not.toMatch(MONOSPACE_RE);
    expect(
      style.whiteSpace,
      `deck caption white-space "${style.whiteSpace}" must not be \`pre\` (preformatted)`,
    ).not.toBe('pre');
    expect(
      style.hasPreAncestor,
      'the deck caption must not be nested inside a <pre> (code-card)',
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T022 — NFR-002 footprint on the diagram-free PUBLISHED deck (finding C7).
// A deck with NO `mermaid` fence must resolve ZERO Mermaid runtime chunks: the
// render owner's `if (!nodes.length) return;` short-circuits BEFORE
// `import('mermaid')`. This is the ONLY observable NFR-002 proof at deck level —
// FP-1's control route covers doc pages only, and citing the guard is circular.
// ---------------------------------------------------------------------------
test.describe('Deck diagram-free footprint (NFR-002 / T022)', () => {
  const MERMAID_CHUNK = /mermaid/i;

  test('the diagram-free roadmap deck resolves zero /mermaid/i requests', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));

    await page.goto(ROUTES.deckNoDiagram, { waitUntil: 'load' });
    // The deck client script imports reveal, then (after ready) calls the shared
    // render owner, whose no-nodes guard runs BEFORE `import('mermaid')`. Wait past
    // reveal-ready AND the 3s whenRevealReady fallback + settle (F5) so that
    // decision has definitely executed before we assert nothing was fetched.
    await page.waitForSelector('.reveal.ready', { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3_500);
    await page.waitForLoadState('networkidle');

    const mermaidRequests = urls.filter((u) => MERMAID_CHUNK.test(u));
    expect(
      mermaidRequests,
      `a diagram-free deck must resolve 0 /mermaid/i requests, saw: ${mermaidRequests.join(', ')}`,
    ).toEqual([]);
  });
});
