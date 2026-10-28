/**
 * The diagram integrations: the Mermaid fence transform, the build/client mode
 * seam, the build-time Mermaid and PlantUML stages, the sentinel theme rewrite
 * and `diagramsIntegration`. Moved out of `config.ts` (#115); `config.ts`
 * re-exports every public symbol.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroIntegration } from 'astro';
import diagramMeta from '../remark/diagram-meta.js';
import plantumlMeta from '../remark/plantuml-meta.js';
import diagramFigure from '../rehype/diagram-figure.js';
import { withMermaidDiskCache, beoeDiskCache, BEOE_CACHE_DIR } from '../diagram/beoe-cache.js';

/** Minimal structural mdast node — enough to find mermaid fences and recurse. */
interface FenceMdastNode {
  type: string;
  lang?: string | null;
  value?: string;
  data?: Record<string, unknown>;
  children?: FenceMdastNode[];
}

/**
 * The **fence transform** (the single-render fallback, ADR-0023 F5 spike):
 * astro-mermaid@2.1.0 injects its render script UNCONDITIONALLY (`autoTheme:
 * false` disables its theme-watch, NOT its render), so adopting it would give
 * two render loops with the wrong (non-token) colours — a straight NFR-007
 * violation. We therefore drop astro-mermaid's runtime and do the fence→
 * `<pre class="mermaid">` transform ourselves; the token-aware render owner
 * (`diagram-render.client`) becomes the ONLY `mermaid.run` on the page.
 *
 * This runs at the mdast level (AFTER `diagramMeta`, which has already injected
 * `accTitle`/`accDescr` into the fence body and stripped the `%%` metadata). It
 * RETYPES each `lang === 'mermaid'` code node OFF `code` (to `dkMermaid`) before
 * projecting `data.hName`/`hProperties`/`hChildren` onto it, so `mdast-util-to-
 * hast` emits a real, SINGLE `<pre class="mermaid">…source…</pre>` ELEMENT — the
 * exact shape `diagramFigure` (rehype) matches to build the `<figure>`.
 *
 * **Truth about the retype (#59, C-001, verified against `mdast-util-to-hast`
 * 13.2.1 `handlers/code.js:43,46`)**: a node LEFT typed `code` still runs through
 * that package's own `code` handler, which applies the projected `data.*` to the
 * element it builds and then UNCONDITIONALLY wraps that element in its OWN outer
 * `<pre>` — so a still-`code`-typed node carrying `hName:'pre'` double-wraps
 * (`<pre><pre class="mermaid">…`), and rehype's `diagramFigure` then nests that
 * inside `<figure>`, producing the stray `<pre><figure class="dk-diagram">…
 * </figure></pre>` this fixes. Retyping the node routes it through the generic/
 * unknown-node handler instead, which honours `data.hName`/`hProperties`/
 * `hChildren` VERBATIM with no extra wrapper — emitting the single clean
 * `<pre class="mermaid">` `diagramFigure` expects. Rewriting the hast projection
 * (not emitting a raw `html` node) keeps it a first-class element for the rehype
 * pass AND sidesteps Starlight's expressive-code, which only claims `<pre><code>`
 * blocks — a node whose projected tag is a bare `<pre class="mermaid">` is never
 * a code block it recognises (the retype only strengthens that sidestep: it is
 * no longer even `type: 'code'`). `diagramMeta` runs BEFORE this transform
 * (pinned plugin order) and keys on `type === 'code' && lang === 'mermaid'`, so
 * it still sees the node in its original shape — unaffected by the retype.
 *
 * Exported (only) so `src/tests/diagram-pipeline.test.ts` (T007) can run this
 * EXACT function through the real `diagramMeta → mermaidFenceTransform →
 * mdast-util-to-hast → diagramFigure` chain — a hand-built hast fixture (as
 * `diagram-figure.test.ts` uses) cannot exercise this remark→hast boundary,
 * where the #59 defect actually lives.
 */
export function mermaidFenceTransform() {
  return function transformer(tree: FenceMdastNode): void {
    const walk = (node: FenceMdastNode): void => {
      if (node.type === 'code' && node.lang === 'mermaid') {
        // Retype OFF `code` FIRST (see the header note above) — otherwise
        // mdast-util-to-hast's own `code` handler double-wraps the projection
        // in an extra `<pre>` (#59). `diagram-render.client`'s `pre.mermaid`
        // selector is unaffected (it matches on the emitted class, not the
        // mdast node type).
        node.type = 'dkMermaid';
        node.data = {
          ...(node.data ?? {}),
          hName: 'pre',
          hProperties: { className: ['mermaid'] },
          hChildren: [{ type: 'text', value: node.value ?? '' }],
        };
        return; // leaf — a retyped mermaid node has no meaningful children to walk.
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    };
    walk(tree);
  };
}

// ===========================================================================
// Build-render dual-mode seam (#13, WP01 — FR-001..005/010, C-005, NFR-002).
//
// A ```mermaid fence can render TWO ways under the same `diagrams` opt-in:
//   - **build** — `@beoe/rehype-mermaid` renders the fence to an inline, themed,
//     accessible `<svg>` at build time (Playwright/Chromium); no client render
//     owner ships. Selected when Chromium is resolvable (or forced on).
//   - **client** — the pre-#13 path: `mermaidFenceTransform` → `pre.mermaid` +
//     the single client render owner. The dual-mode FALLBACK, byte-identical to
//     pre-#13 (NFR-002), so `pnpm build` never hard-fails for lack of a browser.
// The selection is deterministic and gate-observable: the built figure's shape
// (inline `<svg>` vs `pre.mermaid`) is the mode marker the artifact gate reads.
// ===========================================================================

/** The resolved diagram render mode for a build. */
export type DiagramMode = 'build' | 'client';

const BUILD_FLAG_TRUE = new Set(['1', 'true', 'on', 'yes', 'build']);
const BUILD_FLAG_FALSE = new Set(['0', 'false', 'off', 'no', 'client']);

/** Playwright surfaces we probe for a resolvable Chromium (any one is enough).
 * `@beoe`'s `mermaid-isomorphic` renders through `playwright`; we detect the
 * SAME browser install it will drive. `executablePath()` respects
 * `PLAYWRIGHT_BROWSERS_PATH`, so CI's pinned container and a local
 * `~/.cache/ms-playwright` both resolve. */
const PLAYWRIGHT_CANDIDATES = ['playwright', 'playwright-core', '@playwright/test'];

/** True when a Playwright Chromium is installed and resolvable at build — the
 * capability the build-render stage requires. Purely synchronous (no launch):
 * resolve a Playwright package and confirm its computed Chromium binary is on
 * disk. Any failure (package absent, browser not installed) → false → the build
 * falls back to the client render (US2, never a hard fail). */
function chromiumResolvable(): boolean {
  const require = createRequire(import.meta.url);
  for (const name of PLAYWRIGHT_CANDIDATES) {
    try {
      const mod = require(name) as {
        chromium?: { executablePath?: () => string };
        default?: { chromium?: { executablePath?: () => string } };
      };
      const chromium = mod.chromium ?? mod.default?.chromium;
      const exe = chromium?.executablePath?.();
      if (typeof exe === 'string' && exe.length > 0 && existsSync(exe)) return true;
    } catch {
      // try the next candidate
    }
  }
  return false;
}

/**
 * Resolve the diagram render mode for this build (FR-005). Deterministic and
 * observable: an explicit `DK_DIAGRAM_BUILD_RENDER` env (`1/on/build` →
 * build, `0/off/client` → client) always wins; absent/unrecognised it
 * AUTO-DETECTS a resolvable Playwright Chromium (build when present, else the
 * client fallback). Exported so it is unit-testable and the resolved mode is a
 * first-class, gate-observable value (not a hidden branch). */
export function resolveDiagramMode(env: NodeJS.ProcessEnv = process.env): DiagramMode {
  const flag = (env.DK_DIAGRAM_BUILD_RENDER ?? '').trim().toLowerCase();
  if (BUILD_FLAG_TRUE.has(flag)) return 'build';
  if (BUILD_FLAG_FALSE.has(flag)) return 'client';
  return chromiumResolvable() ? 'build' : 'client';
}

/**
 * The build-render sentinel table (ADR-0023/0024 D2/D7). Each of the six
 * `--dk-diagram-*` tokens gets ONE distinct, non-shortenable sentinel hex handed
 * to Mermaid as a `themeVariable`; {@link sentinelThemeRewrite} maps each
 * sentinel back to its `var(--dk-diagram-*)` in the baked SVG so the static
 * figure is light/dark aware with ZERO client JS (a `[data-theme]` toggle just
 * re-resolves the vars). This is the build-time analogue of
 * `diagram-render.client`'s `dkThemeVars()`; it themes the SAME six tokens.
 *
 * Sentinels are deliberately not near Mermaid's fixed built-in decoration
 * greys (`#666`/`#999`/`#eaeaea`/`#000`, the sequence actor/arrowhead/shadow
 * colours Mermaid hardcodes and the client render also leaves un-themed) and are
 * non-shortenable so SVGO never collapses them to a 3-digit form the rewrite
 * would miss. */
export const DIAGRAM_SENTINELS = {
  'node-fill': '#e1f0c1',
  'node-border': '#c14f8a',
  'node-text': '#1a2b3c',
  edge: '#7a3ff0',
  'subgraph-title': '#0f9d58',
  'cluster-fill': '#f4b400',
} as const;

/**
 * Every Mermaid `themeVariable` that surfaces as a themeable colour in the
 * flowchart/sequence corpus, pinned to its token's sentinel. Mermaid DERIVES
 * extra shades from the primaries (research D7), but its `calculate()`
 * RE-APPLIES the supplied overrides AFTER `updateColors()` runs — so pinning
 * each LEAF variable directly makes it win over derivation and NO derived shade
 * escapes the rewrite (verified against the emitted SVG: the only non-sentinel
 * fills/strokes are Mermaid's fixed built-in greys, identical in client mode).
 * A superset of `dkThemeVars()`'s eleven entries, extended across the
 * sequence-diagram leaves (actor/note/signal/activation) so a sequence figure is
 * themed by the same six tokens as a flowchart. */
export const SENTINEL_THEME_VARIABLES: Readonly<Record<string, string>> = {
  // node-fill — node/actor/label/note/edge-label BACKGROUNDS
  primaryColor: DIAGRAM_SENTINELS['node-fill'],
  mainBkg: DIAGRAM_SENTINELS['node-fill'],
  nodeBkg: DIAGRAM_SENTINELS['node-fill'],
  edgeLabelBackground: DIAGRAM_SENTINELS['node-fill'],
  labelBackground: DIAGRAM_SENTINELS['node-fill'],
  actorBkg: DIAGRAM_SENTINELS['node-fill'],
  labelBoxBkgColor: DIAGRAM_SENTINELS['node-fill'],
  noteBkgColor: DIAGRAM_SENTINELS['node-fill'],
  activationBkgColor: DIAGRAM_SENTINELS['node-fill'],
  // node-border — node/actor/label/note BORDERS
  primaryBorderColor: DIAGRAM_SENTINELS['node-border'],
  nodeBorder: DIAGRAM_SENTINELS['node-border'],
  border1: DIAGRAM_SENTINELS['node-border'],
  actorBorder: DIAGRAM_SENTINELS['node-border'],
  clusterBorder: DIAGRAM_SENTINELS['node-border'],
  labelBoxBorderColor: DIAGRAM_SENTINELS['node-border'],
  noteBorderColor: DIAGRAM_SENTINELS['node-border'],
  activationBorderColor: DIAGRAM_SENTINELS['node-border'],
  // node-text — all diagram TEXT
  primaryTextColor: DIAGRAM_SENTINELS['node-text'],
  nodeTextColor: DIAGRAM_SENTINELS['node-text'],
  textColor: DIAGRAM_SENTINELS['node-text'],
  actorTextColor: DIAGRAM_SENTINELS['node-text'],
  labelTextColor: DIAGRAM_SENTINELS['node-text'],
  loopTextColor: DIAGRAM_SENTINELS['node-text'],
  noteTextColor: DIAGRAM_SENTINELS['node-text'],
  signalTextColor: DIAGRAM_SENTINELS['node-text'],
  classText: DIAGRAM_SENTINELS['node-text'],
  sequenceNumberColor: DIAGRAM_SENTINELS['node-text'],
  // edge — links, arrowheads, signals, actor lifelines
  lineColor: DIAGRAM_SENTINELS.edge,
  defaultLinkColor: DIAGRAM_SENTINELS.edge,
  arrowheadColor: DIAGRAM_SENTINELS.edge,
  signalColor: DIAGRAM_SENTINELS.edge,
  actorLineColor: DIAGRAM_SENTINELS.edge,
  // subgraph-title
  titleColor: DIAGRAM_SENTINELS['subgraph-title'],
  // cluster-fill — subgraph/cluster BACKGROUND
  clusterBkg: DIAGRAM_SENTINELS['cluster-fill'],
  secondBkg: DIAGRAM_SENTINELS['cluster-fill'],
};

/** The `mermaidConfig` handed to `@beoe/rehype-mermaid` in build mode: the
 * `base` theme, `securityLevel: 'strict'` (client-parity), and the full sentinel
 * `themeVariables`. */
export const BUILD_MERMAID_CONFIG = {
  theme: 'base',
  securityLevel: 'strict',
  themeVariables: SENTINEL_THEME_VARIABLES,
} as const;

/**
 * SVGO overrides for the build-rendered SVG. `@beoe/rehype-mermaid`'s default
 * SVGO preset STRIPS `<title>` (`removeTitle`) — which would silently destroy
 * the accessible NAME while `aria-labelledby` still points at the removed id, a
 * broken-name a11y regression (NFR-004). We keep SVGO's optimisation but disable
 * `removeTitle`/`removeDesc` (the accessible name/description come from Mermaid's
 * `<title>`/`<desc>`, injected by `diagramMeta`) and `cleanupIds` (the
 * `aria-labelledby`/`aria-describedby` id references must survive), and preserve
 * the viewBox (responsive inline SVG). */
export const BUILD_SVGO_CONFIG = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeViewBox: false,
          convertShapeToPath: false,
          removeTitle: false,
          removeDesc: false,
          cleanupIds: false,
        },
      },
    },
  ],
} as const;

/**
 * The options tuple handed to `@beoe/rehype-mermaid` in build mode (T001): inline
 * strategy, the title-preserving SVGO override, and the sentinel `themeVariables`.
 * Exported so the preset gate can assert the exact registered build-render config.
 *
 * NOTE (#13 WP03 / FR-009): the disk cache is NOT plumbed through here — the pinned
 * `@beoe/rehype-code-hook-img@0.4.1` (transitive via `@beoe/rehype-mermaid@0.4.2`)
 * destructures a `cache` option but never forwards it to its base hook, so an
 * options-level cache is a no-op in this exact-pinned version. Caching is therefore
 * a THIN WRAPPER (`withMermaidDiskCache`, `./diagram/beoe-cache`) registered AROUND
 * this plugin: it restores cache-hit figures BEFORE `@beoe` runs (so Chromium never
 * launches for an unchanged diagram) and stores freshly-rendered ones after — no
 * new dependency (DIRECTIVE_051).
 */
export const BUILD_MERMAID_OPTS = {
  strategy: 'inline',
  svgo: BUILD_SVGO_CONFIG,
  mermaidConfig: BUILD_MERMAID_CONFIG,
} as const;

/**
 * Load `@beoe/rehype-mermaid` from an absolute `file://` URL. In the Astro build
 * the config module runs inside a Vite SSR runner that is already CLOSED when
 * hooks run, so a normal `import()` here fails ("Vite module runner has been
 * closed"); `new Function('u','return import(u)')` builds the import from a
 * runtime string Vite never transforms → Node's OWN loader runs it. Some test
 * runners (vitest) give that `new Function` no dynamic-import callback, so on
 * failure we fall back to a standard dynamic import, which works there. Only the
 * build branch calls this, so a client/diagram-free build never loads `@beoe`
 * (or its static `playwright` dep) — C-004.
 */
async function loadBeoe(beoeUrl: string): Promise<unknown> {
  try {
    const nativeImport = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
    return await nativeImport(beoeUrl);
  } catch {
    return import(/* @vite-ignore */ beoeUrl);
  }
}

// ===========================================================================
// PlantUML build stage (#13 WP02 — FR-006, C-001/C-002).
// ===========================================================================

/**
 * The default self-hosted PlantUML server for the EXAMPLE build (the D8 spike's
 * `plantuml/plantuml-server:jetty` on :8091, SVG endpoint). NEVER plantuml.com
 * (C-001, privacy — the public endpoint uploads the source off-site). CI/deploy
 * (WP03) overrides it via `DK_PLANTUML_SERVER_URL` to point at its own service
 * container. The trailing `/svg/` is required: `astro-plantuml` builds the
 * request URL as `serverUrl + <encoded>`.
 */
export const DEFAULT_PLANTUML_SERVER_URL = 'http://localhost:8091/svg/';

/** C-001 hard guard: the public plantuml.com endpoint may NEVER be contacted. */
function assertSelfHostedPlantuml(url: string): void {
  if (/plantuml\.com/i.test(url)) {
    throw new Error(
      `[doc-kitty] refusing to render PlantUML against "${url}" — the public ` +
        `plantuml.com endpoint uploads diagram source off-site (privacy, #13 C-001). ` +
        `Point DK_PLANTUML_SERVER_URL at a self-hosted PlantUML server (SVG endpoint).`,
    );
  }
}

/**
 * Resolve the PlantUML `serverUrl` for a build (FR-006, C-001). An explicit
 * `DK_PLANTUML_SERVER_URL` env wins (CI/deploy point it at their service
 * container); absent, the self-hosted example default is used. Either way the
 * resolved URL is asserted self-hosted — a plantuml.com URL throws, so the
 * public endpoint can never be reached even by env misconfiguration. Exported so
 * it is unit-testable and the gate can assert the resolved value.
 */
export function resolvePlantumlServerUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.DK_PLANTUML_SERVER_URL ?? '').trim();
  const url = raw !== '' ? raw : DEFAULT_PLANTUML_SERVER_URL;
  assertSelfHostedPlantuml(url);
  return url;
}

/**
 * Per-request ceiling for a PlantUML render, in milliseconds. `astro-plantuml`
 * defaults to 10 seconds, and that clock starts when the request is sent. A
 * single-threaded server queues the whole set, so a diagram it will render is
 * reported as a failure once the wait exceeds 10 seconds. One minute is the
 * default. A larger set sets `DK_PLANTUML_TIMEOUT_MS`.
 */
export const DEFAULT_PLANTUML_TIMEOUT_MS = 60_000;

/**
 * Resolve the PlantUML request timeout. Blank uses {@link DEFAULT_PLANTUML_TIMEOUT_MS}.
 * Any other value must be a positive whole number of milliseconds.
 */
export function resolvePlantumlTimeout(env: NodeJS.ProcessEnv = process.env): number {
  const raw = (env.DK_PLANTUML_TIMEOUT_MS ?? '').trim();
  if (raw === '') return DEFAULT_PLANTUML_TIMEOUT_MS;
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(
      `[doc-kitty] DK_PLANTUML_TIMEOUT_MS must be a positive whole number of milliseconds, got "${raw}"`,
    );
  }
  const timeout = Number(raw);
  if (!Number.isSafeInteger(timeout)) {
    throw new Error(
      `[doc-kitty] DK_PLANTUML_TIMEOUT_MS must be a positive whole number of milliseconds, got "${raw}"`,
    );
  }
  return timeout;
}

/**
 * Resolve the `astro-plantuml` ESM entry to an absolute `file://` URL. The
 * package ships an `exports`-only manifest (no CJS main), so `require.resolve`
 * cannot reach it — instead walk up `node_modules` from this module, read the
 * package's `exports['.'].import`, and build the URL. Deterministic and
 * Vite-safe (pure filesystem, no `import()`), then loaded through {@link loadBeoe}
 * so, like `@beoe`, it is pulled ONLY in the build branch (never a diagrams-off
 * or client build — C-004).
 */
function resolvePlantumlEntry(baseUrl: string): string {
  let dir = path.dirname(fileURLToPath(baseUrl));
  for (;;) {
    const pkgDir = path.join(dir, 'node_modules', 'astro-plantuml');
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (existsSync(pkgJsonPath)) {
      const exp = (JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
        exports?: { '.'?: { import?: string; default?: string } };
      }).exports?.['.'];
      const entry = exp?.import ?? exp?.default ?? './dist/index.js';
      return pathToFileURL(path.join(pkgDir, entry)).href;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('[doc-kitty] astro-plantuml is not resolvable — is it installed?');
}

/**
 * Build `astro-plantuml`'s remark plugin against the self-hosted server.
 * A diagrams-off build never calls this. A client-mode build calls it only when
 * JSON Schema pages asked for the diagram, so a Mermaid-only client build stays
 * free of the package.
 */
async function loadPlantumlRemark(): Promise<typeof diagramMeta> {
  const plantumlUrl = resolvePlantumlEntry(import.meta.url);
  const { createRemarkPlugin } = (await loadBeoe(plantumlUrl)) as {
    createRemarkPlugin: (opts: unknown) => typeof diagramMeta;
  };
  return createRemarkPlugin({
    serverUrl: resolvePlantumlServerUrl(),
    format: 'svg',
    language: 'plantuml',
    addWrapperClasses: true,
    // Includes queue wait. A site raises this with DK_PLANTUML_TIMEOUT_MS.
    timeout: resolvePlantumlTimeout(),
  });
}

/** sentinel hex (lowercase) → `var(--dk-diagram-*)`. */
const SENTINEL_TO_VAR: ReadonlyMap<string, string> = new Map(
  Object.entries(DIAGRAM_SENTINELS).map(([token, hex]) => [
    hex.toLowerCase(),
    `var(--dk-diagram-${token})`,
  ]),
);

/** Replace every sentinel hex occurrence in `value` with its `var(--dk-diagram-*)`.
 * Case-insensitive whole-hex match; a non-sentinel hex passes through untouched. */
function rewriteSentinels(value: string): string {
  let out = value;
  for (const [hex, cssVar] of SENTINEL_TO_VAR) {
    if (out.toLowerCase().includes(hex)) {
      out = out.replace(new RegExp(hex, 'gi'), cssVar);
    }
  }
  return out;
}

/** Minimal structural hast node — enough to walk the build-rendered SVG. */
interface RewriteHastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: RewriteHastNode[];
  value?: string;
  [key: string]: unknown;
}

/**
 * The sentinel → `var(--dk-diagram-*)` theme rewrite (T003, FR-002). A rehype
 * pass that runs AFTER `@beoe/rehype-mermaid` has baked the inline `<svg>`: it
 * walks every node and rewrites each sentinel hex to its CSS var, in BOTH places
 * Mermaid emits colour —
 *   - element property strings (`fill=`/`stroke=`/`stop-color=`/inline `style=`),
 *   - text nodes inside the SVG's `<style>` element (the `.node rect{fill:…}` CSS).
 * So the baked SVG references the six tokens and re-themes on `[data-theme]` with
 * zero JS. A blanket per-string replacement is safe because the sentinels are
 * globally-unique hexes we control (no non-colour value collides).
 *
 * Exported so `diagram-pipeline.test.ts` can assert the emitted SVG carries only
 * `var(--dk-diagram-*)` themeable colours and NO raw sentinel hex. */
export function sentinelThemeRewrite() {
  return function transformer(tree: RewriteHastNode): void {
    const walk = (node: RewriteHastNode): void => {
      // `text` — the CSS inside a mermaid `<svg>`'s `<style>`; `raw` — the whole
      // PlantUML `<figure><svg>…` HTML string `astro-plantuml` emits (still a raw
      // node at rehype time, before Astro's terminal `rehype-raw`). Both carry
      // sentinel hexes to rewrite (#13 WP02 reuses this one shared pass for both
      // engines).
      if ((node.type === 'text' || node.type === 'raw') && typeof node.value === 'string') {
        node.value = rewriteSentinels(node.value);
      }
      const props = node.properties;
      if (props) {
        for (const key of Object.keys(props)) {
          const v = props[key];
          if (typeof v === 'string') props[key] = rewriteSentinels(v);
          else if (Array.isArray(v)) {
            props[key] = v.map((item) => (typeof item === 'string' ? rewriteSentinels(item) : item));
          }
        }
      }
      for (const child of node.children ?? []) walk(child);
    };
    walk(tree);
  };
}

/**
 * The opt-in diagrams seam, registered when `diagrams: true` or when `jsonSchema`
 * is set and `diagrams` is not `false` (ADR-0067). It wires the markdown pipeline —
 * `remarkPlugins: [diagramMeta, mermaidFenceTransform]` (metadata parse BEFORE
 * the fence transform) and `rehypePlugins: [diagramFigure]` (figure wrap AFTER)
 * — and injects the single client render owner page-wide.
 *
 * **Footprint (NFR-006/FP-1)**: the injected module is loaded on every page, but
 * it early-returns before touching `mermaid` on any page with no `pre.mermaid`,
 * and pulls the `mermaid` chunk only via a dynamic `import()` inside that guard —
 * so a diagram-free route never requests the library. The module is referenced
 * by its absolute on-disk path (Astro's documented `injectScript` pattern) so it
 * resolves without a package-exports entry.
 *
 * **Out-of-frame deck (NFR-001/NFR-007)**: `injectScript('page', …)` also lands
 * on the deck route (a normal Astro page), but the deck must NOT render diagrams
 * from here. A page-level render fires CONCURRENTLY with reveal.js's initialise,
 * and a diagram drawn into a still-settling slide loses its injected
 * `accTitle`/`accDescr` (Mermaid's `<title>`/`<desc>` insertion throws mid-render
 * → a graph with no accessible name); it would also add a SECOND render loop
 * (breaking NFR-007's one-loop-per-node). So the deck's page-level trigger is
 * skipped — `DeckLayout` owns the deck's single, reveal-ready-ordered render.
 * The guard keys on `main.reveal`, which exists only on the out-of-frame deck
 * document; every in-frame doc page has no such element and renders as before.
 */
/**
 * @param renderPlantuml Render ```plantuml fences even when Mermaid stays on the
 * client renderer. JSON Schema pages set this so their JSON diagrams become SVG
 * during dev and build. A missing PlantUML server fails that build.
 */
export function diagramsIntegration(renderPlantuml = false): AstroIntegration {
  return {
  name: 'doc-kitty:diagrams',
  hooks: {
    // Async so the BUILD branch can `await import('@beoe/rehype-mermaid')` HERE, at
    // config:setup — the only safe point to load it. Two constraints force this:
    //   - C-004: `@beoe`'s `mermaid-isomorphic` STATICALLY imports `playwright`, so
    //     a top-level import would break a diagrams-off/client/no-Playwright build.
    //     Importing inside the `build` branch keeps it out of every other build.
    //   - A transform-time `import()` FAILS ("Vite module runner has been closed")
    //     because Astro renders content after the dev SSR runner is torn down —
    //     config:setup runs while it is still open, so the import must happen here.
    // Astro awaits integration setup hooks, so an async hook is fully supported.
    'astro:config:setup': async ({ updateConfig, injectScript }) => {
      const mode = resolveDiagramMode();

      if (mode === 'build') {
        // BUILD mode (FR-001/002/003): the standard ```mermaid fence survives to
        // hast as `code.language-mermaid` (NO `mermaidFenceTransform`), where
        // `@beoe/rehype-mermaid` renders it to an inline `<svg>`; the sentinel
        // theme rewrite maps colours to `var(--dk-diagram-*)`; `diagramFigure`
        // wraps the `<svg>` in the shared accessible `<figure>`. `diagramMeta`
        // still runs FIRST so the SVG carries `<title>`/`<desc>` (the accessible
        // name). NO client render owner is injected — the figure is fully static.
        //
        // Load `@beoe` through Node's NATIVE loader, NOT Vite's SSR module runner.
        // Astro loads this config module inside a short-lived Vite SSR runner that
        // is already CLOSED by the time integration hooks run, so ANY `import()`
        // written here (bare or a `file://` URL, `@vite-ignore` included) is
        // intercepted by that dead runner and fails ("Vite module runner has been
        // closed"). `new Function('u','return import(u)')` builds the import
        // expression from a runtime string Vite never transforms, so it is Node's
        // OWN dynamic import — it loads the resolved `file://` URL directly. Kept
        // in this build branch only, so a client/diagram-free build never touches
        // `@beoe` (or its static `playwright` dep) — C-004.
        const require = createRequire(import.meta.url);
        const beoeUrl = pathToFileURL(require.resolve('@beoe/rehype-mermaid')).href;
        const { rehypeMermaid } = (await loadBeoe(beoeUrl)) as {
          rehypeMermaid: (opts?: unknown) => (tree: unknown, file: unknown) => void | Promise<void>;
        };

        // Disk-cache wrapper (#13 WP03 / FR-009): restore cache-hit figures BEFORE
        // @beoe so an unchanged diagram never relaunches Chromium, and store fresh
        // renders after. The salt folds in the render config (sentinel table + svgo
        // + strategy), so any config change invalidates the cache. See
        // `./diagram/beoe-cache` for why this is a wrapper, not the @beoe option.
        const cachedMermaid = withMermaidDiskCache(
          rehypeMermaid,
          beoeDiskCache(BEOE_CACHE_DIR),
          JSON.stringify({
            mermaidConfig: BUILD_MERMAID_CONFIG,
            svgo: BUILD_SVGO_CONFIG,
            strategy: BUILD_MERMAID_OPTS.strategy,
            v: 1,
          }),
        );

        // PlantUML renders ```plantuml against the self-hosted server. `plantumlMeta`
        // parses the `'`-metadata and injects the skinparam preamble first. The same
        // `sentinelThemeRewrite` + `diagramFigure` passes theme and wrap the SVG.
        const plantumlRemark = await loadPlantumlRemark();

        updateConfig({
          markdown: {
            remarkPlugins: [diagramMeta, plantumlMeta, plantumlRemark],
            rehypePlugins: [
              [cachedMermaid, BUILD_MERMAID_OPTS],
              sentinelThemeRewrite,
              diagramFigure,
            ],
          },
        });
        return;
      }

      // CLIENT mode (FR-004, NFR-002): the pre-#13 path — the
      // `diagramMeta` + `mermaidFenceTransform` remark stage, `diagramFigure`
      // rehype wrap, and the single client render owner injected page-wide.
      // JSON Schema pages also render their PlantUML fences here, because that
      // engine has no client renderer. A Mermaid-only client build does not.
      const remarkPlugins = renderPlantuml
        ? [diagramMeta, mermaidFenceTransform, plantumlMeta, await loadPlantumlRemark()]
        : [diagramMeta, mermaidFenceTransform];
      const rehypePlugins = renderPlantuml
        ? [sentinelThemeRewrite, diagramFigure]
        : [diagramFigure];
      updateConfig({
        markdown: {
          remarkPlugins,
          rehypePlugins,
        },
      });
      const renderOwner = fileURLToPath(
        new URL('../diagram/diagram-render.client.ts', import.meta.url),
      );
      injectScript(
        'page',
        `import { initDiagrams } from ${JSON.stringify(renderOwner)};\n` +
          // The out-of-frame deck (main.reveal) is rendered by DeckLayout AFTER
          // reveal is ready; a page-level render here races reveal and drops the
          // SVG's accessible name. Doc pages have no main.reveal and run normally.
          // DR-2: `.catch` mirrors DeckLayout's pattern — a malformed diagram must
          // surface a console warning, not an unhandled promise rejection.
          `if (!document.querySelector('main.reveal')) {\n` +
          `  initDiagrams().catch((e) => console.warn('[dk-diagram] render failed', e));\n` +
          `}`,
      );
    },
  },
};
}
