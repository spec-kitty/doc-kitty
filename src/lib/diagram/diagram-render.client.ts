/**
 * `diagram-render.client` — the SINGLE client-side Mermaid render owner (ADR-0023
 * decision 3, contract `render-token-and-assertions`; FR-002/FR-007, NFR-006,
 * NFR-007). It is the ONLY module in the toolkit that renders Mermaid: exactly
 * one `mermaid.run` code path exists, driven from here.
 *
 * ## Why this owns rendering (the F5 spike outcome)
 * astro-mermaid@2.1.0 injects its own render script UNCONDITIONALLY — `autoTheme:
 * false` disables its *theme-watch*, not its *render* — and renders with Mermaid's
 * stock `default`/`dark` themes, not our `--dk-diagram-*` tokens. Adopting it would
 * mean two render loops in the wrong colours (an NFR-007 violation). So the preset
 * (`config.ts`) drops astro-mermaid's runtime, does the fence→`<pre class="mermaid">`
 * transform itself, and this module becomes the single, token-aware renderer.
 *
 * ## Footprint (NFR-006 / FP-1)
 * `config.ts` injects this page-wide (`injectScript('page', …)`), so it MUST NOT
 * pull the heavy `mermaid` library onto diagram-free routes. The guard
 * (`if (!nodes.length) return;`) runs BEFORE the dynamic `import('mermaid')`, so a
 * page with no `pre.mermaid` never resolves the chunk. A top-level
 * `import mermaid` would defeat this by resolving the chunk on every page.
 *
 * ## Theme re-render (DX-4) with exactly one `<svg>` (NFR-007)
 * `mermaid.run` replaces each node's text with its rendered `<svg>` and marks it
 * `data-processed`; a second bare `run` would skip every node (no colour change).
 * So on each render we restore the ORIGINAL source (cached in a closure Map, kept
 * out of the DOM) and clear `data-processed` before re-running — the same single
 * `render()` closure re-runs on a `[data-theme]` toggle, leaving exactly one
 * `<svg>` per node in the current mode's colours. A rapid toggle can fire the
 * observer again before the previous async `run` settles; an in-flight guard
 * (DR-4) coalesces that into a single follow-up render instead of letting two
 * runs overlap on the same nodes.
 *
 * ## Slide-aware scope (#15 / FR-004 / FR-005 / INV-SCOPE)
 * On a doc page every `pre.mermaid` is on-screen at load, so a single render over
 * the whole set is correct. On a DECK, slides 2+ are `display:none` (zero-box) at
 * deck-ready; rendering them then mis-renders into a zero-box container (#15). So
 * the `render()` closure is parameterized by a **scope** — the exact node set to
 * restore + clear + run. Given a `DeckController` (deck mode) the driver renders
 * the current leaf at ready and each leaf on its `slidechanged` — but only AFTER a
 * layout-settle gate (INV-SETTLE, `whenBoxed`): reveal fires `slidechanged` /
 * `.ready` a beat before the shown slide's transform (and, in print, the per-page
 * print layout) has flushed, and `mermaid.run` measured against a still-width:0
 * container collapses every internal node to 0×0 (#15). The `[data-theme]`
 * observer re-runs ONLY the VISITED set (never the whole cache) so a theme toggle
 * never re-renders an unvisited hidden slide (which would re-open #15). Crucially,
 * "cache all sources up front" (the `sources` map) and "run only the active scope"
 * are DISTINCT sets and are never conflated. There is still exactly ONE
 * `mermaid.run` call site (INV-SINGLE-OWNER); only the scope varies.
 *
 * Shared surface: `initDiagrams()` is called with NO argument for doc pages
 * (`config.ts` injects it page-wide) — backward-compatible, renders the whole
 * document once. `DeckLayout` (WP02) passes a `DeckController` for deck mode. Called
 * with `undefined` on a deck (WP02's reveal-failure fallback) it degrades to one
 * whole-document render — the intended no-controller behaviour, not a #15 regression.
 */

// Type-only import: the `DeckController` facade owned by `reveal-init.client`. A
// `type` import emits NO runtime code, so the footprint guard is unaffected (a
// diagram-free page still resolves zero extra chunks).
import type { DeckController } from '../deck/reveal-init.client';

/** The token → Mermaid `themeVariables` map (ADR-0024 D4). Read live off
 * `:root` so a `[data-theme]` toggle re-derives the other mode's palette. */
function dkThemeVars(): Record<string, string> {
  const styles = getComputedStyle(document.documentElement);
  const v = (name: string): string =>
    styles.getPropertyValue(`--dk-diagram-${name}`).trim();
  return {
    primaryColor: v('node-fill'),
    mainBkg: v('node-fill'),
    edgeLabelBackground: v('node-fill'),
    primaryBorderColor: v('node-border'),
    nodeBorder: v('node-border'),
    clusterBorder: v('node-border'),
    primaryTextColor: v('node-text'),
    nodeTextColor: v('node-text'),
    lineColor: v('edge'),
    titleColor: v('subgraph-title'),
    clusterBkg: v('cluster-fill'),
  };
}

/** The thin slice of the Mermaid API this loop uses — declared locally so the
 * module does not depend on Mermaid's exported types (it is dynamic-imported). */
interface MermaidLike {
  initialize(config: Record<string, unknown>): void;
  run(options: { nodes: ArrayLike<Element> }): Promise<void>;
}

/**
 * Render `pre.mermaid` nodes with token-derived `themeVariables`, and re-render on
 * a `[data-theme]` toggle — a single render loop. No-op (and no `mermaid` chunk)
 * when the page has no diagrams.
 *
 * Called with NO argument on doc pages: renders the whole document once (the
 * existing, backward-compatible path `config.ts` injects). Given a `DeckController`
 * it drives a DECK slide-by-slide (#15): the current leaf at ready, each leaf on
 * `slidechanged`, or — in print view — every node in one pass. With `undefined` on a
 * deck (WP02's reveal-failure fallback) it degrades to one whole-document render.
 */
export async function initDiagrams(controller?: DeckController): Promise<void> {
  // INV-FOOTPRINT: query the WHOLE document and return BEFORE `import('mermaid')`
  // when there are none. A deck whose slide 1 is diagram-free but a later slide has
  // one STILL imports Mermaid and wires the per-slide renderer; a genuinely
  // diagram-free deck resolves 0 Mermaid chunks (NFR-002, both directions).
  const nodes = document.querySelectorAll<HTMLElement>('pre.mermaid');
  if (!nodes.length) return; // load-only-where-needed (NFR-006/FP-1)

  // Dynamic import INSIDE the guard: diagram-free pages never resolve this chunk.
  const { default: mermaid } = (await import('mermaid')) as unknown as {
    default: MermaidLike;
  };

  // Cache each diagram's ORIGINAL definition once — `mermaid.run` overwrites the
  // node's text with the rendered SVG, so a re-render must restore it first. NOTE
  // (finding B2): this "all sources up front" set is DISTINCT from the per-render
  // "active scope" — the two are never conflated in one variable.
  const sources = new Map<HTMLElement, string>();
  nodes.forEach((node) => sources.set(node, node.textContent ?? ''));

  // INV-SCOPE: the nodes `render()` has actually processed. The `[data-theme]`
  // observer re-runs ONLY this set — never the whole cache — so a theme toggle
  // never re-renders a hidden, unvisited (zero-box) slide and re-opens #15.
  const visited = new Set<HTMLElement>();

  // INV-COALESCE (DR-4): a rapid trigger can fire again before the previous async
  // `mermaid.run` settles. Overlapping runs on the same node could double the
  // `<svg>` (NFR-007) or throw. Guard with an in-flight flag; a request arriving
  // mid-render accumulates into `pendingScope` — the UNION (F5) of every requested
  // node set (a safe superset), so no requested node is dropped by a later request
  // — and runs once, after the current one settles.
  let isRendering = false;
  let pendingScope: Set<HTMLElement> | null = null;

  const render = (scope: ArrayLike<HTMLElement>): void => {
    const scopeNodes = Array.from(scope);
    if (!scopeNodes.length) return; // nothing requested → no-op (either state).
    if (isRendering) {
      // Accumulate the UNION of requested sets, never overwrite the pending scope.
      if (!pendingScope) pendingScope = new Set<HTMLElement>();
      for (const node of scopeNodes) pendingScope.add(node);
      return;
    }

    // CLASS-CLOSURE (#15): for the per-slide/theme paths, render ONLY nodes whose
    // container is boxed RIGHT NOW. A node still at width:0 at run time — `whenBoxed`
    // fell through after MAX_SETTLE_FRAMES, a rapid-nav re-hid the slide in the one
    // frame between `whenBoxed` resolving and this running, or a `[data-theme]`
    // toggle re-ran the `visited` set which includes navigated-away (display:none)
    // slides — is SKIPPED and left UNPROCESSED, so a later `slidechanged` retries it,
    // instead of being
    // laid out collapsed and marked `data-processed` forever (which re-opens #15).
    // The per-slide paths already gate on `whenBoxed`; this closes the residual
    // races and the un-gated theme-observer path by construction, in the one place
    // that ever calls `mermaid.run`. Discriminator is `getClientRects().length`, NOT
    // `width > 0`: a `display:none` (navigated-away / unvisited hidden) slide has NO
    // client rect → skipped; a VISIBLE node that is only momentarily 0-width (a
    // just-shown slide mid-layout, or every slide under `?print-pdf`) still has a
    // client rect → rendered. A `width > 0` test conflated the two and dropped
    // visible-but-settling diagrams (deck navigation + print) in slower renderers.
    const runNodes = scopeNodes.filter((node) => node.getClientRects().length > 0);
    if (!runNodes.length) return;
    isRendering = true;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      themeVariables: dkThemeVars(),
    });
    // Reset each in-scope node to its source + clear `data-processed` so `run`
    // re-renders it in the current mode's colours, ending with exactly one `<svg>`
    // per node. Mark it VISITED so a later theme toggle re-renders it (and only it).
    for (const node of runNodes) {
      node.textContent = sources.get(node) ?? node.textContent ?? '';
      node.removeAttribute('data-processed');
      visited.add(node);
    }
    // DR-2: a rejected run (a malformed diagram) must surface a console warning
    // instead of an unhandled promise rejection — the raw `<pre>` source stays
    // visible for that node rather than silently vanishing.
    mermaid
      .run({ nodes: runNodes })
      .catch((e) => console.warn('[dk-diagram] render failed', e))
      .finally(() => {
        isRendering = false;
        if (pendingScope) {
          const next = pendingScope;
          pendingScope = null;
          render(Array.from(next)); // coalesced union run, after this one settled.
        }
      });
  };

  // `pre.mermaid` nodes inside `slide` that are NOT yet rendered — so a revisit is
  // a no-op (FR-005 / INV-ONE-SVG) and only newly-shown diagrams render.
  const unprocessedIn = (slide: Element): HTMLElement[] =>
    Array.from(slide.querySelectorAll<HTMLElement>('pre.mermaid')).filter(
      (node) => !node.hasAttribute('data-processed'),
    );

  // INV-SETTLE (#15 ROOT CAUSE, finding F1): a SCOPED render must not call
  // `mermaid.run` until every target container has a NON-ZERO layout width. reveal
  // 6 dispatches `slidechanged` — and flips `.reveal.ready` — a beat BEFORE the
  // newly-shown slide's transform/scale (and, in print view, reveal's per-page
  // print layout) has flushed. `mermaid.run` measures each node's text against its
  // container at run time, so a run against a still-width:0 container lays the
  // diagram out at width 0: the `<svg>` is emitted (it gets width:100% + a viewBox,
  // so its OUTER box is non-zero once the slide paints) but every INTERNAL node
  // collapses to a 0×0 box — the #15 defect the T019/T021 measured-geometry proofs
  // catch — and in the whole-batch print pass a zero-box node can abort the run
  // mid-way, leaving a later node with NO `<svg>` at all (the T020 missing-4th-svg
  // symptom). The INITIAL whole-deck render is gated on `whenRevealReady()`
  // (DeckLayout) but these per-slide / print scopes are NOT, so we gate them here.
  // We poll rAF-by-rAF until the boxes are non-zero — deliberately NOT
  // `slidetransitionend`, which never fires under `prefers-reduced-motion: reduce`
  // (research rejected it) — bounded by MAX_SETTLE_FRAMES so a genuinely hidden
  // element still proceeds rather than hanging the render forever.
  const MAX_SETTLE_FRAMES = 30;
  const whenBoxed = (els: ArrayLike<Element>): Promise<void> =>
    new Promise((resolve) => {
      const list = Array.from(els);
      if (!list.length) {
        resolve(); // nothing to settle (e.g. a diagram-free slide) — don't burn frames.
        return;
      }
      let frames = 0;
      const tick = (): void => {
        frames += 1;
        const allBoxed = list.every((el) => el.getBoundingClientRect().width > 0);
        if (allBoxed || frames >= MAX_SETTLE_FRAMES) {
          // One extra frame so the settled width is in place before mermaid measures.
          requestAnimationFrame(() => resolve());
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

  if (controller?.isPrintView) {
    // T004/T020: print view lays EVERY slide out at once (no `slidechanged` walk),
    // so render every node — read the print flag off the controller, never recompute
    // `/print-pdf/gi` here (INV-PRINT-OWNER). Reveal builds the print pages around
    // `.ready` and can ADD a cloned diagram page a beat AFTER our first pass; with no
    // navigation in print mode there is nothing to retrigger a render, so a single
    // pass drops the clone (raw Mermaid source in the exported PDF). Run a few
    // BOUNDED re-passes: each re-queries `pre.mermaid`, caches any new clone's raw
    // source, and renders whatever is still unprocessed (idempotent — a processed
    // node is skipped), so the exported PDF holds every page's diagram (C3).
    const renderPrintPass = async (): Promise<void> => {
      const printNodes = document.querySelectorAll<HTMLElement>('pre.mermaid');
      printNodes.forEach((node) => {
        if (!sources.has(node)) sources.set(node, node.textContent ?? '');
      });
      const pending = Array.from(printNodes).filter(
        (node) => !node.hasAttribute('data-processed'),
      );
      if (!pending.length) return;
      await whenBoxed(pending);
      render(pending);
    };
    await renderPrintPass();
    for (let pass = 0; pass < 4; pass += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await renderPrintPass();
    }
  } else if (controller) {
    // T003: deck mode. Render the CURRENT leaf at ready — NOT slide 1 — so a
    // `hash:true` deep-link (`…/#/2`) that lands on slide 2 (no `slidechanged`
    // fires) still renders (finding D4). A null current slide renders nothing now;
    // the first `slidechanged` drives it. Gate each render on the slide's own
    // layout settling (INV-SETTLE) so the newly-shown, still-transforming slide is
    // never measured at width 0.
    const initial = controller.currentSlide();
    if (initial) {
      const initialNodes = unprocessedIn(initial);
      // Gate on the DIAGRAM NODES themselves, not the slide: a slide can report a
      // non-zero width while the `pre.mermaid` inside it is still collapsed (reveal
      // sizes/positions the leaf a beat after it flips `.present`), and mermaid
      // measures each node's own box — so a slide-width gate can still run into a
      // width:0 node and lay the internals out at 0 (the residual T019/T021 symptom).
      await whenBoxed(initialNodes);
      render(initialNodes);
    }
    // Each activated leaf renders its unprocessed nodes AFTER those nodes' own layout
    // settles. A vertical/nested leaf works automatically because
    // `event.currentSlide` is the inner `<section>`.
    controller.onSlideChange((slide) => {
      const slideNodes = unprocessedIn(slide);
      void whenBoxed(slideNodes).then(() => render(slideNodes));
    });
  } else {
    // Doc-page path (no controller), OR a deck's reveal-failure fallback: every
    // node is on-screen, so render the whole document once (backward-compatible).
    render(nodes);
  }

  // The SAME `render` closure re-runs on a theme toggle — one loop, one code path
  // that ever calls `mermaid.run` (NFR-007). Scope = the VISITED set only
  // (INV-SCOPE); on a doc page that is all nodes (they all render at load), so
  // behaviour there is unchanged.
  new MutationObserver(() => render(Array.from(visited))).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ['data-theme'] },
  );
}
