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
 * Shared surface: exported so `DeckLayout` (WP05) drives the identical loop from
 * its own browser-only `<script>` (deck tokens ride DeckLayout's base-token link).
 */

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
 * Render every `pre.mermaid` on the page with token-derived `themeVariables`, and
 * re-render on a `[data-theme]` toggle — a single render loop. No-op (and no
 * `mermaid` chunk) when the page has no diagrams.
 */
export async function initDiagrams(): Promise<void> {
  const nodes = document.querySelectorAll<HTMLElement>('pre.mermaid');
  if (!nodes.length) return; // load-only-where-needed (NFR-006/FP-1)

  // Dynamic import INSIDE the guard: diagram-free pages never resolve this chunk.
  const { default: mermaid } = (await import('mermaid')) as unknown as {
    default: MermaidLike;
  };

  // Cache each diagram's ORIGINAL definition once — `mermaid.run` overwrites the
  // node's text with the rendered SVG, so a re-render must restore it first.
  const sources = new Map<HTMLElement, string>();
  nodes.forEach((node) => sources.set(node, node.textContent ?? ''));

  // DR-4: the `[data-theme]` observer below fires `render` synchronously, and a
  // rapid toggle can fire it again before the previous async `mermaid.run` has
  // settled. Overlapping runs would restore-and-rewrite a node's source while
  // the earlier run is mid-write — a possible double `<svg>` (NFR-007
  // violation) or a thrown run. Guard with an in-flight flag and coalesce any
  // request that arrives mid-render into a single follow-up run once the
  // current one finishes, so two runs never touch the same nodes at once.
  let isRendering = false;
  let rerenderPending = false;

  const render = (): void => {
    if (isRendering) {
      rerenderPending = true;
      return;
    }
    isRendering = true;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      themeVariables: dkThemeVars(),
    });
    // Reset each node to its source + clear `data-processed` so `run` re-renders
    // it with the current mode's colours, ending with exactly one `<svg>` per node.
    nodes.forEach((node) => {
      node.textContent = sources.get(node) ?? node.textContent ?? '';
      node.removeAttribute('data-processed');
    });
    // DR-2: a rejected run (a malformed diagram) must surface a console warning
    // instead of an unhandled promise rejection — the raw `<pre>` source stays
    // visible for that node rather than silently vanishing.
    mermaid
      .run({ nodes })
      .catch((e) => console.warn('[dk-diagram] render failed', e))
      .finally(() => {
        isRendering = false;
        if (rerenderPending) {
          rerenderPending = false;
          render(); // coalesced re-render, run once the current one has settled.
        }
      });
  };

  render();

  // The SAME `render` closure re-runs on a theme toggle — one loop, one code path
  // that ever calls `mermaid.run` (NFR-007).
  new MutationObserver(render).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}
