# Contract: render owner, token map, and assertions

## Render owner — `src/lib/diagram/diagram-render.client.ts`

The single client render loop (astro-mermaid `autoTheme` off; it does the fence transform
only). Imported by the doc pipeline and by `DeckLayout` (out-of-frame deck).

```ts
import mermaid from 'mermaid';
function dkThemeVars() {
  const s = getComputedStyle(document.documentElement);
  const v = (n) => s.getPropertyValue(`--dk-diagram-${n}`).trim();
  return {
    primaryColor: v('node-fill'), mainBkg: v('node-fill'), edgeLabelBackground: v('node-fill'),
    primaryBorderColor: v('node-border'), nodeBorder: v('node-border'), clusterBorder: v('node-border'),
    primaryTextColor: v('node-text'), nodeTextColor: v('node-text'),
    lineColor: v('edge'), titleColor: v('subgraph-title'), clusterBkg: v('cluster-fill'),
  };
}
export function initDiagrams() {
  const nodes = document.querySelectorAll('pre.mermaid');
  if (!nodes.length) return;                       // load-only-where-needed
  const render = () => { mermaid.initialize({ startOnLoad:false, theme:'base', securityLevel:'strict', themeVariables: dkThemeVars() }); mermaid.run({ nodes }); };
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
}
```

- **One render loop** per `pre.mermaid` (NFR-007); re-renders on `[data-theme]` toggle.
- Deck: `DeckLayout` loads this via a browser-only `<script>` (like `reveal-init.client`);
  tokens ride DeckLayout's existing base-token link (no new deck token wiring).

## Token → Mermaid `themeVariables` map (ADR-0024 D4)

| `--dk-diagram-*` | Mermaid `themeVariables` |
|---|---|
| `node-fill` | `primaryColor`, `mainBkg`, `edgeLabelBackground` |
| `node-border` | `primaryBorderColor`, `nodeBorder`, `clusterBorder` |
| `node-text` | `primaryTextColor`, `nodeTextColor` |
| `edge` | `lineColor` |
| `subgraph-title` | `titleColor` |
| `cluster-fill` | `clusterBkg` |

## a11y (extend `tests/a11y/{routes.ts,axe.spec.ts}`)

| ID | Check | Tool |
|---|---|---|
| DX-1 | **render-gate**: `await expect(locator('figure.dk-diagram svg[aria-labelledby]')).toBeVisible()` AND `pre.mermaid` no longer holds the raw source, before `analyze()` | Playwright (per shell: starlight + deck) |
| DX-2 | **direct** non-empty accessible name on the rendered `<svg>` (from accTitle / description fallback); `<figure role="group">` + `<figcaption>` present | Playwright (direct, not axe) |
| DX-3 | zero serious/critical axe violations on the surrounding HTML, **both** modes | axe |
| DX-4 | `[data-theme]` toggle → the diagram re-renders in the other mode's colours (single loop, no flash) | Playwright |
| DX-5 | deck diagram on the **active first slide** renders + themed; showcase-deck scan (render-wait updated) green both modes | Playwright |
| CT-1 | `--dk-diagram-*` pairs (node-text/node-fill; edge/subgraph-title vs cluster-fill) meet AA (size-aware) **both** modes | **vitest** (not axe — SVG contrast) |

## build/chrome assertions (extend `assert-build-artifacts.mjs` / `assert-chrome-artifacts.mjs`)

| ID | Assertion | Discharges |
|---|---|---|
| BD-1 | demonstrator emits `<figure class="dk-diagram">` + `<pre class="mermaid">` + injected `accTitle`/`accDescr` in the source | FR-005/FR-004 |
| BD-2 | no-JS: the built HTML contains the raw diagram source **and** the caption in document order | FR-008/NFR-003 |
| BD-3 | `EXPECTED_INDEX_ENTRY_COUNT`/`EXPECTED_SITEMAP_URL_COUNT` re-pinned for the new demonstrator page (+ any deck-added published route) | FR-012 |
| BD-4 | pinned `astro-mermaid@2.1.0` + `mermaid@11.17.1`, no external runtime request, no CDN (lockfile/manifest diff) | NFR-004 |
| BD-5 | catalog/CSS-signature assertion updated for the promoted `--dk-diagram-*` (Default + brand); orphan absent | ADR-0024 |
| FP-1 | **footprint**: a diagram page requests the `mermaid` library chunk; a diagram-free control route does not | NFR-006 (Playwright network) |
| PR-1 | opt-in **off**: `defineDocKittyIntegrations({ diagrams:false })` omits `mermaid()`; on prepends it before `starlight()` | FR-001 (vitest) |
