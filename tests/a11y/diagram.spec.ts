// Diagram a11y — the DIRECT (Playwright, not axe) half of the render contract, on
// BOTH shells (WP06 T019/T021; contract render-token-and-assertions DX-2/DX-4/FP-1;
// FR-011, NFR-001, NFR-006, NFR-007) and now MODE-AWARE (#13 WP03).
//
// axe (axe.spec.ts) scans the surrounding HTML for WCAG violations, but it cannot be
// trusted for the SVG's accessible NAME: axe's `svg-img-alt` does not reliably fire
// on the runtime Mermaid SVG. So the NAME, the `<figure>`/`<figcaption>` structure,
// the single-render-loop guarantee, the `[data-theme]` re-theme, and the network
// footprint are asserted here, DIRECTLY.
//
// MODE-AWARE (#13 WP03). The e2e runs against whatever mode the consumed dist was
// built in (CI's build-example is now BUILD mode). Each test DETECTS the render mode
// from the served dist (`renderModeOf`: a `pre.mermaid` ⇒ client fallback, none ⇒
// build render) and branches — never assuming client render:
//   • CLIENT — the pre-#13 path: `<figure class="dk-diagram"><pre class="mermaid">
//     <svg aria-labelledby>…</svg></pre><figcaption>…`. The client render owner draws
//     the SVG in the browser (deck: slide-by-slide, INV-SETTLE/SCOPE), the mermaid
//     chunk IS fetched, and a `[data-theme]` toggle RE-RENDERS the SVG.
//   • BUILD — `<figure class="dk-diagram"><svg aria-labelledby><title>/<desc></svg>
//     <figcaption>…`. The SVG is baked at build (NO `pre.mermaid`), every deck slide
//     carries its static SVG at LOAD (no slide-by-slide machinery), NO mermaid chunk
//     is fetched (NFR-001), and `[data-theme]` re-themes by PURE CSS (the fills are
//     `var(--dk-diagram-*)`) with NO re-render — exactly one `<svg>` per figure.
// T022 (diagram-free deck ships zero mermaid) holds in BOTH modes.
import { test, expect, type Page, type Locator } from '@playwright/test';
import { ROUTES } from './routes';
import { gotoInMode, gotoDeckInMode, modeOf, renderModeOf, type Mode, type RenderMode } from './mode';
import { toRgbTriple, nodeFill, EMPTY_COLOUR_SENTINEL } from './helpers/colour';

// The description-only (title-ABSENT) diagram on the demonstrator: a SEQUENCE
// diagram whose caption/description is this exact sentence. Selecting the figure by
// this text targets that diagram BY ITS OWN IDENTITY — not `.first()` / "some svg",
// which would let the all-fields flowchart discharge the fallback vacuously.
const SEQ_DESC =
  'A reader requests a page and the static host returns pre-rendered HTML, with no server in the loop.';

// The deck's first-slide diagram (title + description present).
const DECK_DIAGRAM_TITLE = 'Out-of-frame deck pipeline';

// The mermaid figure's SVG carries `aria-labelledby` in BOTH modes (Mermaid emits it
// when an accTitle was injected; the build bakes that same SVG). So this selector
// locates the rendered SVG whether it was drawn client-side or baked at build.
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

/** Per figure, the current `<svg>` markup + count — the single-loop probe (one
 * non-empty entry per figure means exactly one `<svg>` each). MODE-AGNOSTIC:
 * `figure.dk-diagram svg` matches the client `pre.mermaid > svg` AND the build
 * `figure > svg`, so a stray second render (NFR-007 breach) is detectable in
 * either mode. */
async function svgMarkupPerFigure(page: Page): Promise<string[]> {
  return page.$$eval('figure.dk-diagram', (figs) =>
    figs.map((f) => {
      const svgs = f.querySelectorAll('svg');
      // Encode the count so a stray second render (NFR-007 breach) is detectable.
      return `${svgs.length}::${svgs[0]?.outerHTML ?? ''}`;
    }),
  );
}

// ---------------------------------------------------------------------------
// DX-2 (doc shell) — direct accessible name on the TITLE-ABSENT diagram, by
// identity; figure role=group + figcaption present. MODE-AGNOSTIC: the figure
// shape, the accessible name (from aria-labelledby → the SVG's referenced text),
// and the caption are IDENTICAL in both modes — the SVG is baked at build or drawn
// client-side, but named the same way.
// ---------------------------------------------------------------------------
test.describe('Diagram accessible figure — doc shell (DX-2)', () => {
  test('the description-only diagram is named by its description; figure/figcaption present', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.diagram, mode);

    // Render-gate: both demonstrator diagrams are present (build: baked; client:
    // rendered). `toHaveCount` retries, so a client render still in flight settles.
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
// diagram (slide 2) is a named accessible figure. MODE-AWARE render-gate: in build
// mode ALL THREE deck slides carry their static SVG at load (count 3); in client
// mode only the visited slide-2 diagram has rendered (count 1). Both then assert
// the slide-2 figure is named + captioned. Also covers the PlantUML build page.
// ---------------------------------------------------------------------------
test.describe('Diagram accessible figure — deck shell (DX-2/DX-5)', () => {
  test("the deck 'Out-of-frame deck pipeline' diagram (slide 2) is a named figure with a caption", async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Deep-link straight to slide 2 (h=1): the title slide (h=0) carries NO diagram.
    await gotoDeckInMode(page, `${ROUTES.deck}#/1`, mode);
    const renderMode: RenderMode = await renderModeOf(page);

    // Render-gate, mode-aware. Build: all three deck diagrams are static SVGs at
    // load (count 3). Client: only the visited slide-2 diagram has rendered (count
    // 1) — slides 3+/inner-stack stay hidden until their own `slidechanged`.
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(renderMode === 'build' ? 3 : 1);

    // Scope to SLIDE 2's figure (index 1) and assert its OWN shape/name — in build
    // there are two other static figures on the page, so scope by slide, not page.
    const figure = page.locator('.reveal .slides > section').nth(1).locator('figure.dk-diagram');
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute('role', 'group');
    await expect(figure.locator('figcaption.dk-diagram__caption')).toHaveCount(1);
    // Exactly one <svg> for this figure (build: the baked one; client: the rendered one).
    await expect(figure.locator('svg')).toHaveCount(1);

    const name = await accessibleName(figure.locator('svg[aria-labelledby]'));
    expect(name.length, 'the deck SVG accessible name must be non-empty').toBeGreaterThan(0);
    // This diagram DOES carry a title, so the name is the title (not the fallback).
    expect(name, 'the deck diagram is named by its title').toContain(DECK_DIAGRAM_TITLE);
  });
});

// ---------------------------------------------------------------------------
// PlantUML build page (#13 WP02/WP03, DX-2/DX-5) — BUILD-ONLY: PlantUML has no
// client renderer, so this figure exists only in build mode. The build `<svg>` is
// named via its injected `<title>`/`<desc>` (no `aria-labelledby` on the SVG) and
// wrapped in the shared `<figure role=group aria-labelledby>` + `<figcaption>`.
// ---------------------------------------------------------------------------
test.describe('PlantUML accessible figure — build only (DX-2/DX-5)', () => {
  test('the plantuml demonstrator is a named, captioned static figure in build mode (absent in client)', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    // Detect the dist's render mode from the DIAGRAM demonstrator (which always has a
    // Mermaid diagram) — the plantuml page has NO mermaid, so `renderModeOf` cannot
    // read the mode there. The artifact gate guarantees the mode is homogeneous, so
    // the plantuml page below is in the SAME mode.
    await gotoInMode(page, ROUTES.diagram, mode);
    const renderMode: RenderMode = await renderModeOf(page);

    await gotoInMode(page, ROUTES.plantuml, mode);
    const figure = page.locator('figure.dk-diagram');
    if (renderMode === 'client') {
      // PlantUML is build-only — in client mode the fence is a plain code block, so
      // NO dk-diagram figure exists on the page. That IS the client-mode contract.
      await expect(
        figure,
        'PlantUML is build-only: a client-mode plantuml page carries no dk-diagram figure',
      ).toHaveCount(0);
      return;
    }

    // Build mode: exactly one static, named, captioned figure.
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute('role', 'group');
    await expect(figure.locator('figcaption.dk-diagram__caption')).toHaveCount(1);
    const svg = figure.locator('svg');
    await expect(svg, 'the plantuml build figure holds one static <svg>').toHaveCount(1);
    // Named via the injected <title> (the PlantUML SVG has no aria-labelledby of its
    // own — the accessible name is the <title> text).
    const title = await svg.evaluate((el) => el.querySelector('title')?.textContent?.trim() ?? '');
    expect(title.length, 'the plantuml <svg> must carry a non-empty <title> (accessible name)').toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// NFR-007 (single render loop) + DX-4 ([data-theme] re-theme) — exactly one
// `<svg>` per figure, and the theme toggle switches the node fill to the OTHER
// mode's `--dk-diagram-node-fill`:
//   • CLIENT — the toggle RE-RENDERS (svg markup changes), still one <svg>.
//   • BUILD — the toggle re-themes by PURE CSS: the svg markup is UNCHANGED (no
//     re-render), only the computed fill follows the var. Still exactly one <svg>.
// ---------------------------------------------------------------------------
test.describe('Diagram single render loop + theme re-theme (NFR-007 / DX-4)', () => {
  test('one <svg> per figure, and a [data-theme] toggle switches the node fill', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoInMode(page, ROUTES.diagram, mode);
    await expect(page.locator(DIAGRAM_SVG)).toHaveCount(2);
    const renderMode: RenderMode = await renderModeOf(page);

    // Exactly one <svg> under EACH figure after the initial render/bake. A stray
    // render (the NFR-007 breach) would double the SVG under a figure — Mermaid's
    // per-run random ids dodge axe's duplicate-id rule, so this direct count is the
    // real guard.
    const before = await svgMarkupPerFigure(page);
    expect(before.length, 'the demonstrator renders two diagrams').toBe(2);
    for (const node of before) {
      expect(node.startsWith('1::'), 'exactly one <svg> per figure').toBe(true);
      expect(node.length, 'each <svg> is non-empty').toBeGreaterThan(3);
    }

    // The other mode's palette really differs (so the re-theme is observable).
    const fillOf = (): Promise<string> =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-node-fill').trim(),
      );
    const fillBefore = await fillOf();

    // Toggle the design's theme attribute.
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);

    if (renderMode === 'client') {
      // CLIENT: the single render loop's MutationObserver restores each source,
      // clears data-processed, and RE-RENDERS — one code path. Each node again has
      // exactly one <svg>, and its markup CHANGED (redrawn with the other mode's
      // inlined colours).
      await expect
        .poll(
          async () => {
            const after = await svgMarkupPerFigure(page);
            if (after.length !== before.length) return false;
            return after.every(
              (node, i) => node.startsWith('1::') && node.length > 3 && node !== before[i],
            );
          },
          { message: 'each node must re-render to exactly one, changed <svg>' },
        )
        .toBe(true);
    } else {
      // BUILD: PURE-CSS re-theme. The svg markup is UNCHANGED (no re-render), but
      // the resolved node fill follows the `var(--dk-diagram-node-fill)`. Assert the
      // markup is byte-identical AND still exactly one <svg> per figure.
      const after = await svgMarkupPerFigure(page);
      expect(after.length).toBe(before.length);
      after.forEach((node, i) => {
        expect(node.startsWith('1::'), 'exactly one <svg> per figure after toggle (no re-render)').toBe(true);
        expect(
          node,
          'the build SVG markup is UNCHANGED by a theme toggle (pure-CSS re-theme, no re-render)',
        ).toBe(before[i]);
      });
      // The computed node fill followed the var to the OTHER mode's token.
      const figure = page.locator('figure.dk-diagram').first();
      const tokenAfter = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-node-fill').trim(),
      );
      await expect(async () => {
        const f = toRgbTriple(await nodeFill(figure));
        expect(f).toBe(toRgbTriple(tokenAfter));
      }).toPass({ timeout: 5_000 });
    }

    // The palette actually switched (both modes).
    const fillAfter = await fillOf();
    expect(fillAfter, 'the node-fill token must change with the mode').not.toBe(fillBefore);
  });
});

// ---------------------------------------------------------------------------
// FP-1 (footprint, NFR-006/NFR-001) — MODE-AWARE inversion:
//   • CLIENT — a diagram page FETCHES the mermaid library chunk; a diagram-free
//     control route does NOT.
//   • BUILD — a diagram page fetches NO `/mermaid/i` chunk at all (the figure is a
//     static SVG, no client render owner); the control route still fetches none.
// No external/CDN host in either trace, in either mode.
// ---------------------------------------------------------------------------
test.describe('Diagram footprint (FP-1 / NFR-006 / NFR-001)', () => {
  const MERMAID_CHUNK = /mermaid/i;

  // Collect every http(s) request URL a navigation makes, settle the network, and
  // (for a diagram page) wait for the figure so any dynamic import has resolved.
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

  test('a diagram page: client fetches the mermaid chunk / build fetches none; a control route never does; no CDN', async ({
    page,
  }) => {
    // Diagram page.
    const diagramUrls = await traceRoute(page, ROUTES.diagram, true);
    const pageOrigin = new URL(page.url()).origin;
    const renderMode: RenderMode = await renderModeOf(page);
    const fetchedMermaid = diagramUrls.some((u) => MERMAID_CHUNK.test(u));
    if (renderMode === 'client') {
      expect(fetchedMermaid, 'the client diagram page must request the mermaid library chunk').toBe(true);
    } else {
      expect(
        fetchedMermaid,
        `the BUILD diagram page must NOT request any /mermaid/i chunk (static SVG, no client render owner) — ` +
          `saw: ${diagramUrls.filter((u) => MERMAID_CHUNK.test(u)).join(', ')}`,
      ).toBe(false);
    }

    // Control route: a diagram-free page NEVER resolves the chunk in either mode.
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
// WP05 — the #15 render lock on the LIVE, reveal-enhanced deck. These proofs are
// CLIENT-mode contracts (the slide-by-slide render machinery only exists in the
// client fallback). In BUILD mode every deck slide carries its static SVG at LOAD,
// so the build branch asserts the STATIC alternative: the distinguishable figures
// are present + named without any client render machinery.
//
// WP04 gave the showcase deck two NEW diagrams beyond the title-slide one, each
// with a DISTINGUISHABLE `%% description` sentence so the assertion targets THAT
// node by its own identity — never `.first()`/"some svg".
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
 * a rendered INTERNAL NODE SHAPE (`g.node`) inside the figure's `<svg>`. NON-fakeable
 * — a diagram drawn into a `display:none` (zero-box) slide lays its internals out at
 * 0×0. Uses `getBBox()` (SVG user-space, transform-invariant under reveal's stage
 * scale). MODE-AGNOSTIC svg locator. */
async function measuredInnerBox(figure: Locator): Promise<{ w: number; h: number }> {
  return figure.locator('svg').first().evaluate((svg) => {
    const inner = svg.querySelector('g.node');
    if (!inner) return { w: -1, h: -1 };
    try {
      const b = (inner as SVGGraphicsElement).getBBox();
      return { w: b.width, h: b.height };
    } catch {
      return { w: -1, h: -1 };
    }
  });
}

// ---------------------------------------------------------------------------
// T019 — FR-004: the DISTINGUISHABLE non-first AND inner-stack diagrams.
//   • CLIENT — hidden at load, render only on navigation, with measured internal
//     geometry (the #15 non-fakeable proof).
//   • BUILD — present as STATIC named SVGs at load (no slide-by-slide machinery);
//     asserted present + named + exactly one <svg> + no `pre.mermaid`.
// ---------------------------------------------------------------------------
test.describe('Deck non-first + inner-stack diagram (FR-004 / T019)', () => {
  test('the slide-two + inner-stack diagrams render/bake with a named <svg>', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, ROUTES.deck, mode);
    const renderMode: RenderMode = await renderModeOf(page);

    const slideTwo = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    const innerStack = deckFigureByDesc(page, DECK_INNER_STACK_DESC);
    await expect(slideTwo, 'the slide-two figure must be uniquely located by its identity').toHaveCount(1);
    await expect(innerStack, 'the inner-stack figure must be uniquely located by its identity').toHaveCount(1);

    if (renderMode === 'build') {
      // BUILD: both figures carry a STATIC named <svg> at LOAD (no client deferral,
      // no `pre.mermaid`), exactly one each.
      for (const figure of [slideTwo, innerStack]) {
        await expect(figure.locator('svg'), 'a build deck figure holds exactly one static <svg>').toHaveCount(1);
        await expect(figure.locator('pre.mermaid'), 'a build deck figure has NO pre.mermaid').toHaveCount(0);
        const title = await figure
          .locator('svg')
          .evaluate((el) => el.querySelector('title')?.textContent?.trim() ?? '');
        expect(title.length, 'the build deck <svg> carries a non-empty <title> (accessible name)').toBeGreaterThan(0);
      }
      return;
    }

    // CLIENT: reproduce #15 the way it OCCURS — hidden at load, then navigate.
    await expect(
      slideTwo.locator('pre.mermaid svg'),
      'the slide-two diagram must be unrendered while its slide is hidden',
    ).toHaveCount(0);

    // Navigate to slide 2 (h=0 → h=1 → h=2). The render owner draws it on the
    // slidechanged that lands there.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const svg = slideTwo.locator('pre.mermaid svg');
    await expect(
      svg,
      'the slide-two diagram must render its <svg> once navigated to (not at load)',
    ).toBeVisible({ timeout: 10_000 });

    // MEASURED internal-node geometry (#31): `getBBox()` on `g.node` reads nonzero
    // for a correct render, 0×0 for a collapsed (#15) mis-render. Retry the reads —
    // reveal settles the slide transform a beat after `toBeVisible`.
    await expect(async () => {
      const box = await svg.first().boundingBox();
      expect(box, 'the slide-two <svg> must have a bounding box').not.toBeNull();
      expect(box!.width, 'slide-two <svg> width > 0 (NFR-001)').toBeGreaterThan(0);
      expect(box!.height, 'slide-two <svg> height > 0 (NFR-001)').toBeGreaterThan(0);
      const inner = await measuredInnerBox(slideTwo);
      expect(inner.w, 'slide-two measured internal-node width > 0 (#31)').toBeGreaterThan(0);
      expect(inner.h, 'slide-two measured internal-node height > 0 (#31)').toBeGreaterThan(0);
    }).toPass({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// T020 — FR-004 print-pdf completeness:
//   • CLIENT — print view lays EVERY slide out at once, so the all-nodes path must
//     render EVERY `pre.mermaid` with box>0 in one pass.
//   • BUILD — every deck diagram is already a static SVG, so `?print-pdf` shows all
//     of them; assert one static <svg> per figure.
// ---------------------------------------------------------------------------
test.describe('Deck print-pdf renders every diagram (FR-004 / T020)', () => {
  test('every deck diagram is present with box>0 under ?print-pdf', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, `${ROUTES.deck}?print-pdf`, mode);
    const renderMode: RenderMode = await renderModeOf(page);

    if (renderMode === 'build') {
      // Every deck figure already carries its static <svg> — exactly one each.
      const perFigure = await svgMarkupPerFigure(page);
      expect(perFigure.length, 'the showcase deck carries multiple diagram figures').toBeGreaterThan(1);
      for (const node of perFigure) {
        expect(node.startsWith('1::'), 'exactly one static <svg> per deck figure in print view').toBe(true);
      }
      return;
    }

    // CLIENT: reveal can ADD a print-page clone (an extra pre.mermaid) after
    // `.ready`; every such node is a real print page and must render.
    const nodeCount = await page.locator('pre.mermaid').count();
    expect(nodeCount, 'the showcase deck must carry multiple diagram nodes').toBeGreaterThan(1);
    await expect(
      page.locator('pre.mermaid svg'),
      'every diagram node must render its <svg> in print view (one pass)',
    ).toHaveCount(nodeCount, { timeout: 12_000 });
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
// T021 — FR-005 render-once + theme invariants:
//   • CLIENT — away-and-back → one <svg>; theme toggle → one <svg> AND node fill ==
//     the OTHER mode token; toggle-while-unvisited then navigate → correct render
//     (INV-SCOPE); rapid nav → one <svg> per node (coalescing guard).
//   • BUILD — the deck SVGs are static: navigation never re-renders, and a theme
//     toggle re-themes by pure CSS. Assert the invariant that matters in build: the
//     node fill switches to the OTHER mode token by pure CSS, still exactly one
//     static <svg> per figure, markup unchanged.
// ---------------------------------------------------------------------------
test.describe('Deck render-once + theme invariants (FR-005 / T021)', () => {
  test('away-and-back / static leaves exactly one <svg> for the slide-two node', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, `${ROUTES.deck}#/2`, mode);
    const renderMode: RenderMode = await renderModeOf(page);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);

    if (renderMode === 'build') {
      // Static: exactly one <svg> at load, and away-and-back navigation cannot
      // change that (no client render path to double it).
      await expect(figure.locator('svg')).toHaveCount(1);
      await page.evaluate(() => (window.location.hash = '#/0'));
      await expect(page.locator('.slides section.present')).toBeVisible();
      await page.evaluate(() => (window.location.hash = '#/2'));
      await expect(page.locator('.slides section.present')).toBeVisible();
      await expect(
        figure.locator('svg'),
        'a static build deck figure stays exactly one <svg> across navigation',
      ).toHaveCount(1);
      return;
    }

    await expect(figure.locator('pre.mermaid svg')).toHaveCount(1);
    // Away (back to the title slide) …
    await page.evaluate(() => (window.location.hash = '#/0'));
    await expect(page.locator('.slides section.present')).toBeVisible();
    // … and back to slide 2 (h=2). `unprocessedIn` skips the already-processed node,
    // so a revisit is a no-op: still exactly ONE <svg> (INV-ONE-SVG).
    await page.evaluate(() => (window.location.hash = '#/2'));
    await expect(figure.locator('pre.mermaid svg')).toBeVisible();
    await expect(
      figure.locator('pre.mermaid svg'),
      'away-and-back must leave exactly one <svg> for the slide-two node',
    ).toHaveCount(1);
  });

  test('theme toggle switches the node fill to the other mode token, still one <svg>', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, `${ROUTES.deck}#/2`, mode);
    const renderMode: RenderMode = await renderModeOf(page);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);
    await expect(figure.locator('svg')).toHaveCount(1);

    // Rendered in the current mode: the node fill IS the current --dk-diagram-node-fill.
    let fillBefore = '';
    await expect(async () => {
      fillBefore = await nodeFill(figure);
      expect(
        toRgbTriple(fillBefore),
        'the pre-toggle baseline fill must resolve to a real, parsed colour',
      ).not.toBe(EMPTY_COLOUR_SENTINEL);
    }).toPass({ timeout: 10_000 });
    const resolvedToken = (): Promise<string> =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--dk-diagram-node-fill').trim(),
      );
    const tokenBefore = await resolvedToken();
    expect(
      toRgbTriple(fillBefore),
      'the node fill must equal the current-mode --dk-diagram-node-fill',
    ).toBe(toRgbTriple(tokenBefore));

    // Capture the build svg markup so we can prove it is UNCHANGED by the toggle.
    const markupBefore =
      renderMode === 'build'
        ? await figure.locator('svg').first().evaluate((el) => el.outerHTML)
        : '';

    // Toggle to the OTHER mode.
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);
    const tokenAfter = await resolvedToken();
    expect(
      toRgbTriple(tokenAfter),
      'the two modes must resolve DIFFERENT node-fill tokens (a no-op toggle must fail)',
    ).not.toBe(toRgbTriple(tokenBefore));

    // The node fill follows the token to the OTHER mode (both modes) …
    await expect(async () => {
      const f = toRgbTriple(await nodeFill(figure));
      expect(f).toBe(toRgbTriple(tokenAfter));
    }).toPass({ timeout: 10_000 });
    // … still exactly one <svg> …
    await expect(
      figure.locator('svg'),
      'the theme toggle must leave exactly one <svg> (no orphaned duplicate)',
    ).toHaveCount(1);

    if (renderMode === 'build') {
      // BUILD: the re-theme is PURE CSS — the svg markup is byte-unchanged (no re-render).
      const markupAfter = await figure.locator('svg').first().evaluate((el) => el.outerHTML);
      expect(
        markupAfter,
        'the build deck SVG markup is UNCHANGED by a theme toggle (pure-CSS re-theme)',
      ).toBe(markupBefore);
    }

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

  test('[client] toggle-while-unvisited then navigate renders correctly (INV-SCOPE / B3)', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, ROUTES.deck, mode);
    const renderMode: RenderMode = await renderModeOf(page);
    const figure = deckFigureByDesc(page, DECK_SLIDE_TWO_DESC);

    if (renderMode === 'build') {
      // No client render path: the slide-two SVG is static and present at load,
      // regardless of visits or theme toggles (INV-SCOPE is a client-only concern).
      await expect(figure.locator('svg')).toHaveCount(1);
      const other: Mode = mode === 'dark' ? 'light' : 'dark';
      await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);
      await expect(figure.locator('svg'), 'the static build svg is unaffected by a toggle').toHaveCount(1);
      return;
    }

    // CLIENT: load on the TITLE slide — slide 2 is UNVISITED (hidden, zero-box).
    await expect(
      figure.locator('pre.mermaid svg'),
      'the slide-two diagram must be unrendered while unvisited',
    ).toHaveCount(0);
    // Toggle the theme while slide 2 is STILL unvisited — INV-SCOPE: the observer
    // re-runs ONLY the VISITED set, so it must NOT run Mermaid over the hidden node.
    const other: Mode = mode === 'dark' ? 'light' : 'dark';
    await page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), other);
    await expect(
      figure.locator('pre.mermaid svg'),
      'the toggle must NOT render the hidden unvisited node (INV-SCOPE)',
    ).toHaveCount(0);
    // NOW navigate to slide 2 → a CORRECT render.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(figure.locator('pre.mermaid svg')).toBeVisible({ timeout: 10_000 });
    const box = await figure.locator('pre.mermaid svg').first().boundingBox();
    expect(box, 'the post-toggle render must have a bounding box').not.toBeNull();
    expect(box!.width, 'post-toggle slide-two <svg> width > 0').toBeGreaterThan(0);
    expect(box!.height, 'post-toggle slide-two <svg> height > 0').toBeGreaterThan(0);
    const inner = await measuredInnerBox(figure);
    expect(inner.w, 'post-toggle measured internal-node width > 0 (#31)').toBeGreaterThan(0);
    expect(inner.h, 'post-toggle measured internal-node height > 0 (#31)').toBeGreaterThan(0);
  });

  test('rapid navigation leaves exactly one <svg> per diagram node (E3)', async ({
    page,
  }, testInfo) => {
    const mode: Mode = modeOf(testInfo.project.name);
    await gotoDeckReady(page, ROUTES.deck, mode);

    // Page rapidly across every slide and back. In client mode this stress-tests the
    // in-flight coalescing guard; in build mode the static SVGs are simply invariant.
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('Space');
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('ArrowLeft');
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('Space');

    // Every diagram figure settles to EXACTLY one <svg> — never a doubled render.
    await expect
      .poll(
        async () => {
          const perFigure = await svgMarkupPerFigure(page);
          return perFigure.length > 0 && perFigure.every((n) => n.startsWith('1::'));
        },
        {
          message: 'every diagram figure must settle to exactly one <svg> after rapid nav',
          timeout: 15_000,
        },
      )
      .toBe(true);
  });
});

// ---------------------------------------------------------------------------
// T008 (diagram-component-css WP01, #60) — the caption READS AS PROSE, not code:
// computed `font-family` is non-monospace, computed `white-space` is not `pre`, and
// the figure is not nested inside a `<pre>` ("code-card") — on BOTH the in-frame docs
// shell and the out-of-frame deck. MODE-AGNOSTIC (the caption is server-rendered in
// both modes); only the deck render-gate is mode-aware.
// ---------------------------------------------------------------------------
test.describe('Diagram caption typography (#60) — docs + deck', () => {
  const MONOSPACE_RE = /mono|consolas|menlo|courier|sfmono|sf mono/i;

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
    await gotoDeckInMode(page, `${ROUTES.deck}#/1`, mode);

    // Scope to SLIDE 2's caption (server-rendered in both modes) — no diagram-render
    // gate needed here (the caption exists regardless of render mode).
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
// T022 — NFR-002/NFR-001 footprint on the diagram-free PUBLISHED deck (finding C7).
// A deck with NO `mermaid` fence must resolve ZERO Mermaid runtime chunks in BOTH
// modes: client — the render owner's `if (!nodes.length) return;` short-circuits
// before `import('mermaid')`; build — DeckLayout never imports the render owner at
// all. This is the ONLY observable NFR proof at deck level.
// ---------------------------------------------------------------------------
test.describe('Deck diagram-free footprint (NFR-002 / NFR-001 / T022)', () => {
  const MERMAID_CHUNK = /mermaid/i;

  test('the diagram-free roadmap deck resolves zero /mermaid/i requests', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));

    await page.goto(ROUTES.deckNoDiagram, { waitUntil: 'load' });
    // Wait past reveal-ready AND the 3s whenRevealReady fallback + settle so the
    // render decision has definitely executed before we assert nothing was fetched.
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
