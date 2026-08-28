/**
 * Starlight configuration preset for Doc Kitty.
 *
 * `defineDocKittyIntegrations()` returns the Astro integrations array a docs
 * site needs: Starlight (themed, with the convention's head links and the four
 * chrome carriers) plus `@astrojs/sitemap` (with the draft-exclusion filter). A
 * site's `astro.config.mjs` spreads it and can override anything.
 *
 * M2 (ADR-0013/0015) adds an optional `theme`: `defineDocKittyIntegrations({
 * theme })` resolves the `default → brand → consumer` merge (WP01's
 * `resolveTheme`), emits the generated token sheet + `--dk-*→--sl-*` bridge
 * (`emitTokenSheet`, delivered as a virtual CSS module by the manifest
 * integration), and layers brand/consumer `customCss` AFTER it (seam 2). With NO
 * theme the call is byte-compatible with M1 — the single static `theme.css`
 * `customCss` entry and no generated sheet (NFR-002). The `components` map stays
 * the four carriers in both cases (seam 3); theme `assets` ride Starlight-native
 * `logo`/`favicon`/`title`, never a components override (ADR-0015 decision 4/5).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import type { AstroIntegration } from 'astro';
import { readmeToIndexId } from './metadata.js';
import { loadSectionRegistry, registryToSidebar } from './sections.js';
import { resolveTheme, type DocKittyTheme } from './theme.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';
import { docKittyFavicon, faviconHref } from './favicon.js';
import deckSplit from './remark/deck-split.js';
import diagramMeta from './remark/diagram-meta.js';
import diagramFigure from './rehype/diagram-figure.js';
import remarkDirective from 'remark-directive';
import { isGlossaryActive, loadGlossary } from './glossary/load.js';
import { generateGlossaryPages } from './glossary/generate.js';
import glossaryTerm from './remark/glossary-term.js';
import glossaryAutolink from './remark/glossary-autolink.js';
import { DEFAULT_IGNORE_LIST } from './glossary/ignore-list.js';
import {
  serializeDefinitionsPayload,
  glossaryDefinitions,
} from './glossary/definitions-payload.js';

export interface DocKittyOptions {
  /** Site title shown in the header. */
  title: string;
  /** Optional tagline / description. */
  description?: string;
  /** Social + repo links, forwarded to Starlight. */
  social?: StarlightUserConfig['social'];
  /** Sidebar config; omit to let Starlight autogenerate from the tree. */
  sidebar?: StarlightUserConfig['sidebar'];
  /**
   * Directory (relative to the site root) holding the Common Docs tree — the
   * source of truth for which pages are drafts. Defaults to the convention's
   * `docs/`, matching `docKittyDocsLoader`'s default.
   */
  docsDir?: string;
  /**
   * The site's Astro `base` (path prefix, e.g. `/doc-kitty`). The sitemap draft
   * filter strips it from each page's pathname before comparing routes, so the
   * comparison is ANCHORED to the exact doc route (not a suffix match). Pass the
   * SAME value as `astro.config`'s `base`. Defaults to `/` (no prefix).
   */
  base?: string;
  /** Escape hatch: deep overrides merged over the Starlight defaults. */
  starlight?: Partial<StarlightUserConfig>;
  /**
   * Optional theme: the `default → brand → consumer` layer resolved by WP01's
   * `resolveTheme`. Omit for the byte-compatible M1 path (single static
   * `theme.css`, no generated sheet). Providing a theme emits the merged token
   * sheet + bridge and layers brand/consumer `customCss` after it (seam 2). Note
   * the `components` map is FIXED at the four carriers regardless of theme (seam
   * 3); the `starlight` escape hatch cannot add a fifth carrier override.
   */
  theme?: DocKittyTheme;
  /**
   * Opt-in Mermaid diagrams (M5, ADR-0023/0024; FR-001). **Default off** — with
   * it absent or `false` the integrations array carries ZERO diagram cost: no
   * diagram integration, no markdown plugins, no injected render module (a
   * diagram-free site stays byte-identical). Set `true` to wire the full seam:
   * the WP02 `diagramMeta` (remark) + `diagramFigure` (rehype) plugins that turn
   * a `%%`-annotated ```mermaid fence into an accessible `<figure>`, and the
   * single client render owner (`diagram-render.client`) injected page-wide.
   */
  diagrams?: boolean;
}

/** `<head>` links advertising the feeds and agent-API on every page. */
// These hrefs MUST carry the site `base`: they are emitted verbatim into
// `<head>` (Starlight does not rewrite `head` entries the way it does `favicon`),
// so a hardcoded `/rss.xml` 404s on every based deployment — which is exactly
// what the nightly link smoke caught on the published `/doc-kitty/` site.
function discoveryHead(basePrefix: string): NonNullable<StarlightUserConfig['head']> {
  return [
    {
      tag: 'link',
      attrs: {
        rel: 'alternate',
        type: 'application/rss+xml',
        title: 'RSS',
        href: `${basePrefix}/rss.xml`,
      },
    },
    // Advertise the agent index so crawlers/agents can find it from any page.
    {
      tag: 'link',
      attrs: {
        rel: 'alternate',
        type: 'text/plain',
        title: 'llms.txt',
        href: `${basePrefix}/llms.txt`,
      },
    },
  ];
}

/**
 * The four chrome carriers doc-kitty registers with Starlight (ADR-0013). This
 * map is already complete at M1 and does not change in M2 — a theme targets the
 * carriers' `dk:` slot names, never Starlight's `components` map. Paths are
 * package-export specifiers so a consuming site resolves the `.astro` carriers
 * from the `@commondocs-kitty/toolkit` workspace dependency.
 */
const carriers: NonNullable<StarlightUserConfig['components']> = {
  Head: '@commondocs-kitty/toolkit/components/Head.astro',
  PageTitle: '@commondocs-kitty/toolkit/components/PageTitle.astro',
  MarkdownContent: '@commondocs-kitty/toolkit/components/MarkdownContent.astro',
  Footer: '@commondocs-kitty/toolkit/components/Footer.astro',
};

/**
 * Compute the set of draft page ROUTES (leading + trailing slash, no base) from
 * the docs tree — a build-free frontmatter read, the same `gray-matter` +
 * README-as-index rule the loader and the standalone validator use. INV-1: a
 * page is published iff `doc_status !== 'draft'`, so a draft's URL must not
 * appear in the sitemap.
 */
function draftRoutes(docsDir: string): Set<string> {
  const root = path.resolve(process.cwd(), docsDir);
  const routes = new Set<string>();

  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // docsDir absent → no drafts to exclude
    }
    for (const name of entries) {
      const abs = path.join(dir, name);
      const info = statSync(abs);
      if (info.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.mdx?$/i.test(name) || /(^|\/)log\.md$/i.test(name)) continue;
      const data = matter(readFileSync(abs, 'utf8')).data as {
        doc_status?: string;
      };
      // Mirror the schema default: absent status is treated as draft.
      if ((data.doc_status ?? 'draft') !== 'draft') continue;
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const slug = readmeToIndexId(rel);
      // The bundle root is never a draft; skip the root ('') to avoid a
      // catch-all '/' suffix that would match every URL.
      if (slug === '') continue;
      routes.add(`/${slug}/`);
    }
  };

  walk(root);
  return routes;
}

/**
 * The top-level CONTENT folders under the docs root (the candidate sidebar
 * sections). Excludes the reserved, non-content `_meta/` (the registry's home)
 * and any dotfolder. Returns `[]` if the docs root is absent, so sidebar
 * synthesis degrades to nothing rather than throwing.
 */
function topLevelContentDirs(docsRoot: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(docsRoot);
  } catch {
    return [];
  }
  return entries.filter((name) => {
    if (name.startsWith('.') || name === '_meta') return false;
    try {
      return statSync(path.join(docsRoot, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

/**
 * Synthesize the DEFAULT Starlight `sidebar` from the section registry (FR-013,
 * issue #18). Returns `undefined` when there is no `sections.yaml` under the docs
 * root, so a registry-free site keeps Starlight's bare tree-autogeneration
 * (byte-identical to before — NFR-002). With a registry, the sidebar is named,
 * ordered groups (glossary → "Reference"), and any section is relocatable by a
 * `sections.yaml` edit alone. Per-page `sidebar` frontmatter (e.g. a deck's
 * `sidebar: { hidden: true }`) is still honored inside each `autogenerate` group.
 */
function registrySidebar(
  docsDir: string,
): StarlightUserConfig['sidebar'] | undefined {
  const docsRoot = path.resolve(process.cwd(), docsDir);
  const registry = loadSectionRegistry(docsRoot);
  if (!registry) return undefined;
  const groups = registryToSidebar(registry, topLevelContentDirs(docsRoot));
  return groups as unknown as StarlightUserConfig['sidebar'];
}

/**
 * Normalize an Astro `base` to a leading-slash, no-trailing-slash prefix.
 * `'/'` (or empty) → `''` (nothing to strip); `'/doc-kitty'`, `'doc-kitty'` and
 * `'/doc-kitty/'` all → `'/doc-kitty'`.
 */
function normalizeBasePrefix(base: string): string {
  return `/${base}/`.replace(/\/{2,}/g, '/').replace(/\/$/, '');
}

/**
 * Build the `@astrojs/sitemap` `filter`. It receives each candidate page's full
 * absolute URL. INV-1: drop a page iff its route (the pathname with the site
 * `base` stripped) EQUALS a draft route exactly. The match is ANCHORED — a
 * plain `endsWith` would over-exclude a published page whose slug tail coincides
 * with a draft's (e.g. `/architecture/overview/` vs a draft `/overview/`).
 */
function sitemapDraftFilter(
  docsDir: string,
  base: string,
): (page: string) => boolean {
  const routes = draftRoutes(docsDir);
  const basePrefix = normalizeBasePrefix(base);
  return (page: string): boolean => {
    let pathname: string;
    try {
      pathname = new URL(page).pathname;
    } catch {
      pathname = page;
    }
    let normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
    // Strip the site base prefix so what remains is the base-free doc route.
    if (basePrefix && normalized.startsWith(`${basePrefix}/`)) {
      normalized = normalized.slice(basePrefix.length) || '/';
    }
    // Anchored equality: the route must BE a draft route, not merely end with one.
    return !routes.has(normalized);
  };
}

/**
 * Register the guarded slide-split remark transform globally (ADR-0012, FR-001).
 * This is NET-NEW markdown plumbing — the preset had no `remarkPlugins` seam
 * before decks. `updateConfig` APPENDS to `markdown.remarkPlugins`, so the plugin
 * lands AFTER Astro's built-in remark-gfm (headings + thematic breaks already
 * parsed) and before `mdast-util-to-hast`. The plugin itself is a strict no-op on
 * any page whose `kind !== 'Presentation'` (its frontmatter guard), so this
 * global registration leaves every documentation page byte-identical (C-005).
 */
const deckSplitIntegration: AstroIntegration = {
  name: 'doc-kitty:deck-split',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ markdown: { remarkPlugins: [deckSplit] } });
    },
  },
};

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
 * rewrites each `lang === 'mermaid'` code node's hast projection via
 * `data.hName`/`hProperties`/`hChildren` so `mdast-util-to-hast` emits a real
 * `<pre class="mermaid">…source…</pre>` ELEMENT — the exact shape `diagramFigure`
 * (rehype) matches to build the `<figure>`. Rewriting the hast projection (not
 * emitting a raw `html` node) keeps it a first-class element for the rehype pass
 * AND sidesteps Starlight's expressive-code, which only claims `<pre><code>`
 * blocks — a node whose projected tag is a bare `<pre class="mermaid">` is never
 * a code block it recognises.
 */
function mermaidFenceTransform() {
  return function transformer(tree: FenceMdastNode): void {
    const walk = (node: FenceMdastNode): void => {
      if (node.type === 'code' && node.lang === 'mermaid') {
        node.data = {
          ...(node.data ?? {}),
          hName: 'pre',
          hProperties: { className: ['mermaid'] },
          hChildren: [{ type: 'text', value: node.value ?? '' }],
        };
        return; // code nodes are leaves.
      }
      if (Array.isArray(node.children)) {
        for (const child of node.children) walk(child);
      }
    };
    walk(tree);
  };
}

/**
 * The opt-in diagrams seam, registered ONLY when `defineDocKittyIntegrations({
 * diagrams: true })` (FR-001). It wires the markdown pipeline —
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
const diagramsIntegration: AstroIntegration = {
  name: 'doc-kitty:diagrams',
  hooks: {
    'astro:config:setup': ({ updateConfig, injectScript }) => {
      updateConfig({
        markdown: {
          remarkPlugins: [diagramMeta, mermaidFenceTransform],
          rehypePlugins: [diagramFigure],
        },
      });
      const renderOwner = fileURLToPath(
        new URL('./diagram/diagram-render.client.ts', import.meta.url),
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

/**
 * The presence-gated glossary seam (M4, the single integration owner — ADR-0025/
 * 0026/0027/0028, contract `autolink-and-term.md`). It is added to the integrations
 * array ONLY when a `.contextive/definitions.yaml` exists under the site root
 * (`isGlossaryActive`), mirroring the `diagrams ? [diagramsIntegration] : []` shape:
 * a glossary-free site contributes NOTHING here, so the array + corpus stay
 * byte-identical to pre-M4 (NFR-002). There is deliberately **no** config toggle —
 * the feature is presence-driven (C-005), so nothing in `DocKittyOptions` gates it.
 *
 * When active, its single `astro:config:setup` hook (pinned here — the content-layer
 * glob `sync` runs after all config hooks, so generated files are on disk before
 * `getCollection('docs')`, the sitemap filter, the sidebar, the agent API, and
 * `llms.txt` read them):
 *   (a) parses the definitions ONCE (`loadGlossary`, the single parse site INV-G1)
 *       and codegens the hub + per-context pages into `<docsDir>/glossary/**`
 *       (`generateGlossaryPages`). The generator is deterministic + idempotent
 *       (no timestamp/`generated:` field), so a dev-watcher re-run rewrites
 *       byte-identical files and never loops.
 *   (b) registers the remark plugins in the PINNED order (`updateConfig` APPENDS
 *       after Astro's built-in remark-gfm): `remarkDirective → glossary-term →
 *       glossary-autolink`, threading the ONE shared index + `DEFAULT_IGNORE_LIST`
 *       into both factories (FR-008), plus the `glossaryDefinitions` rehype plugin
 *       that emits the hover-preview payload `<script>` (the WP06 island contract).
 *   (c) injects the preview island page-wide (M5 `injectScript('page', …)` pattern),
 *       referenced by absolute on-disk path; its own early-return keeps a
 *       glossary-free page cost-free (NFR-003) and it is a no-op on the out-of-frame
 *       deck (it keys on `a[data-glossary-term]`), so no `main.reveal` guard is
 *       needed (unlike the diagram render). `.catch` mirrors the diagram owner.
 */
function glossaryIntegration(docsDir: string): AstroIntegration {
  return {
    name: 'doc-kitty:glossary',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript }) => {
        const root = process.cwd();
        const loaded = loadGlossary(root);
        // Defensive: the array-build gate already checked presence, but a file
        // deleted between the two reads must still no-op cleanly.
        if (!loaded.present) return;
        const { index } = loaded;

        // (a) Generate-before-glob: write docs/glossary/** now, in config:setup,
        // resolved against the same cwd the sitemap draft-filter uses.
        generateGlossaryPages(index, path.resolve(root, docsDir));

        // (b) Pinned remark order (append after remark-gfm) + payload rehype.
        // The shared index + DEFAULT_IGNORE_LIST thread into BOTH factories so the
        // pipeline and WP07's render-time re-derive resolve identically (FR-008).
        updateConfig({
          markdown: {
            remarkPlugins: [
              remarkDirective,
              [glossaryTerm, { index, ignoreList: DEFAULT_IGNORE_LIST }],
              [glossaryAutolink, { index, ignoreList: DEFAULT_IGNORE_LIST }],
            ],
            rehypePlugins: [
              [glossaryDefinitions, { json: serializeDefinitionsPayload(index) }],
            ],
          },
        });

        // (c) Inject the hover-preview island page-wide (absolute on-disk path).
        const previewOwner = fileURLToPath(
          new URL('./glossary/preview.client.ts', import.meta.url),
        );
        injectScript(
          'page',
          `import { initGlossaryPreview } from ${JSON.stringify(previewOwner)};\n` +
            // `.catch` mirrors the diagram owner: a preview-init failure must surface
            // a console warning, not an unhandled promise rejection. No `main.reveal`
            // guard — the island keys on `a[data-glossary-term]`, so a deck with no
            // glossary links is already a no-op and one with `:term` links gets it.
            `initGlossaryPreview().catch((e) => console.warn('[dk-glossary] preview init failed', e));`,
        );
      },
    },
  };
}

export function defineDocKittyIntegrations(options: DocKittyOptions) {
  const {
    title,
    description,
    social,
    sidebar,
    docsDir = 'docs',
    base = '/',
    theme,
    diagrams = false,
    starlight: overrides,
  } = options;

  // Resolve the default → brand → consumer merge (WP01). `undefined` yields the
  // byte-compatible M1 path: `generated === false`, `customCss` the single static
  // entry, the Default catalog. Any theme yields `generated === true`.
  const resolved = resolveTheme(theme);
  const { assets } = resolved;
  const faviconPath = faviconHref(assets.favicon);

  // Cascade order (seam 2, C-007 tokens-before-overrides):
  //  - No theme  → the single static `theme.css` entry, byte-identical to M1.
  //  - A theme   → the generated token sheet (virtual CSS module emitted by the
  //    manifest integration, substituting `theme.css`) FIRST, then the merged
  //    brand/consumer `customCss` (resolved.customCss[0] is the Default
  //    `theme.css`, replaced here by the emitted sheet).
  const customCss = resolved.generated
    ? [THEME_CSS_MODULE_ID, ...resolved.customCss.slice(1)]
    : resolved.customCss;

  // FR-009 font forwarding (MECHANISM, not a brand mandate): each `assets.fonts`
  // entry a theme declares is forwarded to Starlight's `<head>` as a
  // `<link rel="stylesheet">`, so a theme that ships a (self-hosted or CDN) font
  // stylesheet URL gets it loaded on every page. The Spec Kitty brand deliberately
  // ships NO font URL — a remote @import/link would make the build non-deterministic
  // for the visual baseline, and its faces render fine on fallback stacks — so this
  // list is EMPTY there and no font <link> is emitted. The mechanism stays for
  // downstream themes that DO choose to ship font URLs (self-contained/deterministic
  // is a brand CHOICE, not a toolkit limitation).
  const fontHead: NonNullable<StarlightUserConfig['head']> = (assets.fonts ?? []).map(
    (href) => ({ tag: 'link', attrs: { rel: 'stylesheet', href } }),
  );

  // FR-013 (issue #18): with NO explicit `sidebar`, synthesize a named, ordered,
  // relocatable sidebar from the section registry (glossary → "Reference"). The
  // caller's explicit `sidebar` still wins; a registry-free site keeps Starlight's
  // bare tree-autogeneration (registrySidebar → undefined). Resolved once here so
  // the value is decided BEFORE the build hooks run.
  const resolvedSidebar = sidebar ?? registrySidebar(docsDir);

  const starlightConfig: StarlightUserConfig = {
    title,
    ...(description ? { description } : {}),
    ...(social ? { social } : {}),
    ...(resolvedSidebar ? { sidebar: resolvedSidebar } : {}),
    // Theme assets ride Starlight-native config (ADR-0015 decision 4/5): no
    // Header/SiteTitle override, no components-map expansion. A consumer's own
    // `starlight` escape hatch still wins (spread after these).
    ...(assets.logo ? { logo: { src: assets.logo } } : {}),
    // `favicon` is NOT a specifier Starlight can resolve — it is a served path.
    // `faviconHref` maps the theme's package asset to the one path
    // `docKittyFavicon` emits below (Starlight applies `base` itself).
    ...(faviconPath ? { favicon: faviconPath } : {}),
    head: [...discoveryHead(normalizeBasePrefix(base)), ...fontHead],
    customCss,
    ...overrides,
    // Seam 3 (ADR-0013/ADR-0015 decision 3): the components map is FIXED at the
    // four carriers, in EVERY case (with or without a theme). The exactly-four
    // invariant is established HERE by config ordering — `components: carriers` is
    // applied AFTER `...overrides`, so a consumer's escape hatch cannot silently add
    // a fifth carrier override (a theme addresses the carriers' `dk:` slots, never
    // this map). WP08's assertion proves the four are live in the built output; the
    // ordering below is what makes them the only four.
    components: carriers,
  };

  // Presence-gate (NFR-002): the glossary seam is added ONLY when a definitions
  // file exists under the site root — the byte-identical twin of `diagrams: false`.
  // Read once here (a cheap `existsSync`) so the array shape is decided BEFORE the
  // build hooks run; the authoritative parse happens once inside the hook.
  const glossaryActive = isGlossaryActive(process.cwd());

  return [
    // Opt-in diagrams seam (FR-001): PREPENDED before Starlight when
    // `diagrams: true`, so the diagram machinery sits ahead of `starlight()` in
    // the integrations array (ordering contract). Omitted entirely when off —
    // the spread below is then byte-identical to the pre-M5 array (zero cost).
    ...(diagrams ? [diagramsIntegration] : []),
    // Presence-gated glossary seam (M4, ADR-0025/0026/0027/0028): PREPENDED before
    // Starlight when `.contextive/definitions.yaml` exists, mirroring the diagrams
    // shape. Omitted entirely when absent — the spread contributes NOTHING, so a
    // glossary-free array + corpus is byte-identical to pre-M4 (NFR-002). WP09 lands
    // the example definitions file; until then this is inert on the example.
    ...(glossaryActive ? [glossaryIntegration(docsDir)] : []),
    starlight(starlightConfig),
    // Guarded slide-split remark transform (ADR-0012): a global markdown plugin
    // that only acts on `kind: Presentation` pages and no-ops everywhere else.
    deckSplitIntegration,
    // INV-1: draft pages are unpublished, so their URLs are excluded here.
    sitemap({ filter: sitemapDraftFilter(docsDir, base) }),
    // Transport the merged `kind → layout` + `dk:slot → component` maps to the
    // carriers as `virtual:doc-kitty/manifest` (synchronous `resolveLayout`, no
    // dynamic import — C-006). Present in EVERY build: `kind-layouts.ts` imports
    // the manifest even on the no-theme path (Hub registered, else Default).
    docKittyManifest(resolved),
    // Make the theme's package-asset favicon actually servable at the path
    // handed to Starlight above (no-op with no theme favicon, or when the theme
    // points at a `public/` path the consumer already ships).
    docKittyFavicon(assets.favicon, {}, base),
  ];
}
