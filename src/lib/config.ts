/**
 * Starlight configuration preset for DocKitty.
 *
 * `defineDocKittyIntegrations()` returns the Astro integrations array a docs
 * site needs: Starlight (themed, with the convention's head links and the six
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
 * the six carriers in both cases (seam 3, ADR-0063); theme `assets` ride Starlight-native
 * `logo`/`favicon`/`title`, never a components override (ADR-0015 decision 4/5).
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import type { IndexBasenameOption } from './metadata.js';
import {
  resolveSectionRegistry,
  registryToSidebar,
  BUILD_GENERATED_SECTION_IDS,
} from './sections.js';
import { resolveTheme, DEFAULT_TOKEN_SHEET, type DocKittyTheme } from './theme.js';
import {
  ROUTE_MIDDLEWARE,
  routeShapingIntegration,
  sitemapDraftFilter,
  type RouteShapingOptions,
} from './integrations/route-shaping.js';
import { draftPublicationIntegration } from './integrations/draft-publication.js';
import { legacyHtmlRedirectsIntegration } from './integrations/legacy-html-redirects.js';
import {
  gherkinIntegration,
  gherkinFenceIntegration,
  resolveGherkinOptions,
} from './integrations/gherkin.js';
import { glossaryIntegration } from './integrations/glossary.js';
import { markuaIntegration } from './integrations/markua.js';
import { diagramsIntegration, resolveDiagramMode } from './integrations/diagrams.js';
import { schematicIntegration } from './integrations/schematic.js';
import { compressHtmlIntegration } from './integrations/compress-html.js';
import {
  deckSplitIntegration,
  singleH1Integration,
  baseAbsoluteLinksIntegration,
  directiveIntegration,
  markdownProcessorIntegration,
} from './integrations/markdown-pipeline.js';
import { tocRailIntegration } from './integrations/toc-rail.js';
import { lightboxIntegration } from './integrations/lightbox.js';
import { contentGraphIntegration } from './integrations/content-graph.js';
import { createBuildState } from './build-state.js';
import {
  normalizeBasePrefix,
  type DocKittyGherkinOption,
} from './integrations/shared.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';
import { docKittyFavicon, faviconHref } from './favicon.js';
import sitemapOrderIntegration from './sitemap-order.js';
import { okfExportIntegration } from './okf-export/integration.js';
import { DOC_KITTY_I18N_PLUGIN } from './i18n-plugin.js';
import { PRE_PAINT_SCRIPT } from './toc-rail/pre-paint.js';
import { normalizeIndexBasenames } from './vocabulary-core.mjs';
import { isGlossaryActive } from './glossary/load.js';
import { validateIndexBasenames } from './gherkin/options.mjs';
import {
  DK_DOCS_ROOT_ENV,
  DK_GHERKIN_RESULTS_ENV,
  DK_INDEX_BASENAME_ENV,
  DK_MARKUA_ENV,
  clearInternalEnv,
  setInternalEnv,
} from './internal-env.mjs';

/**
 * Internal cross-boundary signal (integration → standalone routes), NOT a public
 * API. `defineDocKittyIntegrations` resolves `docsDir` to an absolute path and
 * publishes it here at setup; the discovery routes' `docsRoot()` PREFERS it so the
 * sitemap filter and the llms.txt/RSS/agent-index routes resolve the section
 * registry from the SAME root (F3/F5 — closes #22's cross-surface split, where a
 * consumer with `docsDir` ≠ the loader `base` could otherwise filter against two
 * different `sections.yaml` files). Deliberately un-exported from `index.ts`: it is
 * a runtime handoff between two config surfaces, never something a consumer sets.
 */
export { DK_DOCS_ROOT_ENV };

/**
 * Internal handoff of the site's index names (FR-007), written by
 * `defineDocKittyIntegrations` as a JSON `string[]` and read by the docs loader
 * (`schema.ts`, which must not import this module) and by the CLIs that evaluate
 * the site config (`scripts/site-index-names.mjs`). Adopters never set it: the
 * `indexBasename` option of the integration is the one place to say it.
 */
export { DK_INDEX_BASENAME_ENV };

/** The object form of {@link DocKittyOptions.sidebar} (#161). */
export interface DocKittySidebarOptions {
  /** Label of a group's index entry that repeats the group label; a non-empty string. */
  indexLabel?: string;
}

/**
 * Split the `sidebar` option into the consumer's Starlight sidebar (array) and
 * the generated-sidebar options (object), validating the latter eagerly.
 */
function splitSidebarOption(sidebar: DocKittyOptions['sidebar']): {
  starlightSidebar: StarlightUserConfig['sidebar'];
  indexLabel: string | undefined;
} {
  if (sidebar === undefined || Array.isArray(sidebar)) {
    return { starlightSidebar: sidebar as StarlightUserConfig['sidebar'], indexLabel: undefined };
  }
  if (typeof sidebar !== 'object' || sidebar === null) {
    throw new Error('[dk-config] sidebar must be a Starlight sidebar array or an object with indexLabel');
  }
  const { indexLabel, ...unknown } = sidebar as DocKittySidebarOptions & Record<string, unknown>;
  const [extra] = Object.keys(unknown);
  if (extra !== undefined) throw new Error(`[dk-config] unknown key "${extra}" under sidebar; expected indexLabel`);
  if (indexLabel !== undefined && (typeof indexLabel !== 'string' || indexLabel.trim() === '')) {
    throw new Error('[dk-config] sidebar.indexLabel must be a non-empty string');
  }
  return { starlightSidebar: undefined, indexLabel };
}

export interface DocKittyOptions {
  /** Site title shown in the header. */
  title: string;
  /** Optional tagline / description. */
  description?: string;
  /** Social + repo links, forwarded to Starlight. */
  social?: StarlightUserConfig['social'];
  /**
   * Sidebar config. An ARRAY is a Starlight sidebar written by the consumer and
   * is used as written (never reshaped). Omit it to let Starlight autogenerate
   * from the tree. An OBJECT configures the generated sidebar instead; its one
   * key, `indexLabel`, sets the label of a group's index entry that repeats the
   * group label (#161) and wins over the `dockitty.sidebar.indexLabel` UI
   * string (default "Overview").
   */
  sidebar?: StarlightUserConfig['sidebar'] | DocKittySidebarOptions;
  /**
   * Directory (relative to the site root) holding the Common Docs tree — the
   * source of truth for which pages are drafts. Defaults to the convention's
   * `docs/`, matching `docKittyDocsLoader`'s default.
   *
   * INVARIANT: this MUST equal the `base` passed to `docKittyDocsLoader` in
   * `content.config`. The registry-driven sidebar prefixes each autogenerate
   * directory with this value to line up with Starlight's loader-base-relative
   * route paths (see {@link SidebarAutogenGroup}); if `docsDir` and the loader
   * `base` diverge, every nav group silently renders empty. It must be a plain
   * root-relative path (not absolute); Astro's `root` must be the project root.
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
   * the `components` map is FIXED at the six carriers regardless of theme (seam
   * 3, ADR-0063); the `starlight` escape hatch cannot add a seventh carrier
   * override.
   */
  theme?: DocKittyTheme;
  /**
   * `false` (default): diagram blocks are shown as code, not drawn. A
   * ```mermaid or ```plantuml fence renders as a plain code block. `false` does
   * not mean "render in the browser"; the render mode is picked separately, by
   * `DK_DIAGRAM_BUILD_RENDER` or Chromium auto-detection ({@link resolveDiagramMode}).
   *
   * Opt-in Mermaid + PlantUML diagrams (M5, ADR-0023/0024/0040; FR-001).
   * **Default off** — with it absent or `false` the integrations array carries
   * ZERO diagram cost: no diagram integration, no markdown plugins, no injected
   * render module (a diagram-free site stays byte-identical). Set `true` to wire
   * the full seam: the WP02 `diagramMeta` (remark) + `diagramFigure` (rehype)
   * plugins that turn a `%%`-annotated ```mermaid fence into an accessible
   * `<figure>`, plus, per the resolved mode, EITHER the build-time renderers
   * (build: Mermaid and PlantUML to inline SVG, no client script) OR the single
   * client render owner (`diagram-render.client`) injected page-wide (client:
   * Mermaid only; a ```plantuml fence stays code).
   */
  diagrams?: boolean;
  /**
   * Opt-in Markua syntax support (ADR-0030; FR-005/006/007/011). **Default off** —
   * the byte-identical twin of `diagrams: false`. With it absent or `false` the
   * whole Markua seam is omitted: no `remark-directive` owner (unless the glossary
   * needs it), no `markuaNormalise → markuaAttributes → markuaCallouts` remark
   * stage, no `markuaFigure`/`markuaTocDemote` rehype stage, so a Markua-free site
   * stays byte-identical (NFR-001). Set `true` to wire the full seam; WP10 flips it
   * on for the example.
   */
  markua?: boolean;
  /**
   * Opt-in Gherkin (ADR-0046, widened by ADR-0051). **Default off**, the
   * byte-identical twin of `diagrams: false`. With it absent the integrations
   * array carries ZERO Gherkin cost: no `doc-kitty:gherkin` (codegen) or
   * `doc-kitty:gherkin-fence` (in-page stage) integration, no markdown plugins,
   * and the registry sidebar's `generatedIds` stay the default seed.
   *
   * Two forms:
   *  - `true`: Gherkin fences only (ADR-0051): a ```` ```gherkin ```` fence on a
   *    docs page renders as a structured scenario. There are no include roots,
   *    so a `::gherkin{src=…}` include is refused (set `includeRoots` or
   *    `sources` to allow includes). No generated pages, no `behaviour` section.
   *  - an object: the same, tuned by the keys below. Setting `sources` ALSO turns
   *    on generated feature pages (ADR-0046): `sources` is walked for `*.feature`
   *    in `astro:config:setup` and one `kind: Specification` page per feature
   *    (plus directory hubs) is codegen'd into `<docsDir>/<section>/`, before the
   *    content-layer glob runs.
   *
   * Why an explicit option and NOT presence detection like the glossary: the
   * glossary has ONE canonical file (`.contextive/definitions.yaml`), so its
   * presence is an unambiguous signal. `.feature` files have no canonical location
   * (`features/`, `tests/features/`, `src/test/resources/…`), so presence cannot be
   * inferred safely; the consumer names the directories.
   *
   * Turning generated pages OFF (removing `sources` or the option) FREEZES the
   * committed pages rather than deleting them: with no integration registered
   * nothing prunes `<section>/`, so the last generated output keeps rendering as
   * ordinary content until it is deleted by hand. Only an active run removes pages
   * whose source is gone.
   *
   * Misconfiguration is build-fatal (`[dk-gherkin]` errors): any value other than
   * `true` or an object, an unknown key, a non-boolean `fences`, `includeRoots`
   * that are not relative paths, `section`, `allowEmpty` or `titles` without `sources`; with
   * `sources`, `sources` must be a non-empty string array, `section` a single safe
   * path segment that is not another generator's section (e.g. `glossary`), and a
   * malformed `.feature` fails `config:setup` with `file:line:col`.
   */
  gherkin?: DocKittyGherkinOption;
  /**
   * The section-index basename(s) (FR-001/FR-002, D-01). Defaults to
   * `"README"` only — byte-identical to today's behaviour (NFR-003). This is
   * the ONE place to set it: the docs loader and the `dockitty-*` CLIs read the
   * value from here (FR-007), so `docKittyDocsLoader` needs no `indexBasename`
   * of its own, and one that disagrees is a build error.
   */
  indexBasename?: IndexBasenameOption;
  /**
   * Old `.html` URLs to keep working after a move from an `.html`-URL generator
   * such as DocFX (issue #249, ADR-0068): `{ '/guides/a.html': '/guides/a/' }`.
   * Sources and targets are site paths WITHOUT the base; a target may also be an
   * absolute URL. Each entry is written after the build as a flat meta-refresh
   * page at `<dist>/<source>` (`noindex`, canonical to the target, absent from
   * the sitemap, `llms.txt` and the agent API), the file a static host such as
   * GitHub Pages serves for that exact URL. Chains inside the map are flattened.
   * `/x/index.html -> /x/` is accepted and needs no file while `/x/` is a page.
   *
   * Astro's own `redirects` must not carry `.html` keys: the build refuses them
   * and names this option. `generate-legacy-redirects.mjs` builds the mechanical
   * map from a committed list of the old site's URLs.
   */
  legacyHtmlRedirects?: Record<string, string>;
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
 * The six chrome carriers doc-kitty registers with Starlight (ADR-0013, as
 * amended by ADR-0044, which adds `Header`, and ADR-0063, which adds `Sidebar`).
 * A theme targets the carriers' `dk:` slot names, never Starlight's `components`
 * map. `Header` hosts the single `dk:site-header` slot and renders Starlight's
 * stock header when no theme fills it, with no wrapper, so a site without a theme
 * header is unchanged. `Sidebar` composes Starlight's sidebar unchanged and ships
 * the current-entry reveal right after it, so the entry is in view before the
 * sidebar is first painted (FR-004). Paths are
 * package-export specifiers so a consuming site resolves the `.astro` carriers
 * from the `@spec-kitty/doc-toolkit` workspace dependency.
 */
const carriers: NonNullable<StarlightUserConfig['components']> = {
  Head: '@spec-kitty/doc-toolkit/components/Head.astro',
  PageTitle: '@spec-kitty/doc-toolkit/components/PageTitle.astro',
  MarkdownContent: '@spec-kitty/doc-toolkit/components/MarkdownContent.astro',
  Footer: '@spec-kitty/doc-toolkit/components/Footer.astro',
  Header: '@spec-kitty/doc-toolkit/components/Header.astro',
  Sidebar: '@spec-kitty/doc-toolkit/components/Sidebar.astro',
};

/**
 * The carriers handed to Starlight for THIS config, read at config time (not at
 * import time). `DK_INTERNAL_STOCK_HEADER=on` drops only `Header`, so the build
 * renders Starlight's stock header. It is a test-only input, used solely by
 * `src/scripts/capture-stock-header.mjs` (research D-01, owner decision
 * 01M59CR08D2F8D3P8T3D0GN9VD); consumers must not set it. Only exactly `on`
 * counts. It is read here, not an internal handoff, so it is deliberately absent
 * from `INTERNAL_ENV_NAMES` (which would clear it).
 */
function carriersForBuild(): NonNullable<StarlightUserConfig['components']> {
  if (process.env.DK_INTERNAL_STOCK_HEADER !== 'on') return carriers;
  // Say so in the build output: a stray setting would otherwise drop a theme's
  // `dk:site-header` without a trace, because `Header` emits no marker.
  console.warn(
    '[dk-config] DK_INTERNAL_STOCK_HEADER=on: the Header carrier is disabled (test-only; used by pnpm fixture:stock-header).',
  );
  return Object.fromEntries(Object.entries(carriers).filter(([name]) => name !== 'Header'));
}

/**
 * The top-level CONTENT folders under the docs root (the candidate sidebar
 * sections). Excludes the reserved, non-content `_meta/` (the registry's home)
 * and any dotfolder (the same `_meta` rule as the shared walk, decision
 * 01M4WE30W61BS7CG5D0KH99T0T). Returns `[]` if the docs root is absent, so sidebar
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
 * ordered groups (glossary → "Reference"), and any section can be relabelled or
 * reordered by a `sections.yaml` edit alone (the id is bound to the folder name,
 * so moving a section's content is still a file move). Per-page `sidebar`
 * frontmatter (e.g. a deck's
 * `sidebar: { hidden: true }`) is still honored inside each `autogenerate` group.
 *
 * Each group's `autogenerate.directory` is prefixed with `docsDir` (`docs/<id>`)
 * so it matches Starlight's un-stripped `filePath` (`docs/<id>/…`) under the
 * repo-`docs/` layout — without the prefix every group renders EMPTY (no hub link
 * AND no child pages; see `SidebarAutogenGroup`). This restores each section's hub
 * `/<id>/` (presentations, glossary) AND all its child pages, while `treeify`
 * keeps hidden deck nodes out (BA-10 15c deck-absent; FR-013 15d glossary hub).
 */
function registrySidebar(
  docsDir: string,
  gherkinSection?: string,
): StarlightUserConfig['sidebar'] | undefined {
  const docsRoot = path.resolve(process.cwd(), docsDir);
  const registry = resolveSectionRegistry(docsRoot);
  if (!registry) return undefined;
  // `topLevelContentDirs` is a SNAPSHOT of the on-disk dirs taken here, BEFORE the
  // glossary integration codegens `<docsDir>/glossary/**` in its config:setup hook.
  // `registryToSidebar` defaults to seeding the build-generated ids
  // (BUILD_GENERATED_SECTION_IDS) so the glossary's "Reference" group survives even
  // when a consumer `.gitignore`s the generated output (issue #23); a registered
  // section that is neither on disk nor generated warns loudly instead of vanishing.
  // `directoryPrefix` is the docsDir itself: routes' `filePath` is
  // `<docsDir>/<id>/…` (astro-root-relative, un-stripped — Starlight assumes
  // `src/content/docs`), so the autogenerate directory must carry the same prefix.
  //
  // With the opt-in gherkin seam on, its (configurable) section is build-generated
  // too: `doc-kitty:gherkin` writes `<docsDir>/<section>/**` in config:setup, AFTER
  // this snapshot. It is appended to the seed at call time (not to the constant,
  // since the id is per-site), so a first build with no committed output does not
  // warn. With gherkin off the call is exactly the pre-gherkin one (default seed).
  const groups = registryToSidebar(
    registry,
    topLevelContentDirs(docsRoot),
    gherkinSection === undefined
      ? { directoryPrefix: docsDir }
      : {
          directoryPrefix: docsDir,
          generatedIds: [...BUILD_GENERATED_SECTION_IDS, gherkinSection],
        },
  );
  return groups as unknown as StarlightUserConfig['sidebar'];
}

// The route-shaping and draft-publication integrations live in `integrations/`;
// every public symbol is re-exported here so the `./config` entry is unchanged.
export {
  ROUTE_SHAPING_MODULE_ID,
  ROUTE_MIDDLEWARE,
  routeShapingSource,
  routeShapingIntegration,
  sitemapDraftFilter,
  type RouteShapingOptions,
} from './integrations/route-shaping.js';
export { draftPublicationIntegration } from './integrations/draft-publication.js';
export {
  SCENARIO_INDEX_MODULE_ID,
  hasOwnScenarioIndexPage,
  findOwnScenarioIndexPage,
} from './integrations/gherkin.js';
export {
  mermaidFenceTransform,
  resolveDiagramMode,
  DIAGRAM_SENTINELS,
  SENTINEL_THEME_VARIABLES,
  BUILD_MERMAID_CONFIG,
  BUILD_SVGO_CONFIG,
  BUILD_MERMAID_OPTS,
  DEFAULT_PLANTUML_SERVER_URL,
  resolvePlantumlServerUrl,
  sentinelThemeRewrite,
  type DiagramMode,
} from './integrations/diagrams.js';

export function defineDocKittyIntegrations(options: DocKittyOptions) {
  // First, before anything can throw: a config starts from no internal handoffs,
  // so nothing an earlier config in this process wrote leaks into this one.
  clearInternalEnv();
  const {
    title,
    description,
    social,
    sidebar: sidebarOption,
    docsDir = 'docs',
    base = '/',
    theme,
    diagrams = false,
    markua = false,
    indexBasename,
    gherkin,
    legacyHtmlRedirects,
    starlight: overrides,
  } = options;
  const { starlightSidebar: sidebar, indexLabel } = splitSidebarOption(sidebarOption);

  // Opt-in gherkin seam (ADR-0046/0051): normalised + validated EAGERLY here, so a
  // bad option throws a `[dk-gherkin]` Error at config time, before any hook runs.
  // `undefined` when the option is absent — every gherkin branch below then
  // contributes nothing (byte-identical array, sidebar call and corpus).
  const gherkinOpts = gherkin === undefined ? undefined : resolveGherkinOptions(gherkin);
  // Always validated (FR-007): the list is now published to the loader and the
  // CLIs, so a bad entry must fail here whether or not `gherkin` is on.
  validateIndexBasenames(indexBasename, 'indexBasename');
  // Publish the one list every consumer reads (config order = priority, so the
  // first name decides `generatedIndexBasename`). Stale values from an earlier
  // config are already gone: see clearInternalEnv() above and ADR-0057.
  setInternalEnv(DK_INDEX_BASENAME_ENV, JSON.stringify(normalizeIndexBasenames(indexBasename)));
  // Everything generated-pages (codegen integration, `behaviour` sidebar section)
  // hangs off `sources`, i.e. `pages`: `gherkin: true` or an object without
  // `sources` adds none of it (ADR-0051).
  const gherkinPages = gherkinOpts?.pages;
  // The report the docs loader folds into the digest of every page that shows
  // results (ADR-0055 decision 10), published like DK_INDEX_BASENAME; absent
  // (cleared above) when no results are configured. DK_GHERKIN_ROUTE is
  // re-published by the fence stage's setup hook when an own route is mounted.
  if (gherkinOpts?.results) setInternalEnv(DK_GHERKIN_RESULTS_ENV, gherkinOpts.results.report);

  // Publish the ONE authoritative docs root (F3/F5). This is the exact value the
  // sitemap draft filter resolves internally (`path.resolve(process.cwd(),
  // docsDir)` in both `siteDraftRoutes` and its registry read), so writing it here
  // guarantees the standalone routes' `docsRoot()` reads the section registry from
  // the identical absolute path — not a separately-derived one. Set unconditionally
  // so the signal always reflects the docsDir THIS integration was configured with
  // (a single-site build calls this once; a later call with a different docsDir
  // should win). Absent this call (standalone route render, route unit tests) the
  // env stays unset and `docsRoot()` keeps #22's content-layer fallback verbatim.
  setInternalEnv(DK_DOCS_ROOT_ENV, path.resolve(process.cwd(), docsDir));

  // Resolve the default → brand → consumer merge (WP01). `undefined` yields the
  // M1-degenerate path: `generated === false`, `customCss` the Default layer's
  // two static entries (token sheet + component sheet, NFR-004). Any theme
  // yields `generated === true`.
  const resolved = resolveTheme(theme);
  const { assets } = resolved;
  const faviconPath = faviconHref(assets.favicon);

  // Cascade order (seam 2, C-007 tokens-before-overrides):
  //  - No theme  → the Default layer's two static entries verbatim: the token
  //    sheet (`theme.css`) then the component sheet (`dk-components.css`).
  //  - A theme   → the generated token sheet (virtual CSS module emitted by the
  //    manifest integration, substituting `theme.css`) FIRST, then the merged
  //    brand/consumer `customCss` unchanged. The replacement is IDENTITY-based
  //    (whichever entry === `DEFAULT_TOKEN_SHEET` becomes `THEME_CSS_MODULE_ID`),
  //    not positional — `resolveTheme`'s `DEFAULT_LAYER.customCss` shape is an
  //    internal detail of `theme.ts` (see `GLOBAL_COMPONENT_SHEETS`), so this
  //    must not assume the token sheet sits at a fixed index. Every other entry
  //    — the component sheet (`DK_COMPONENTS_CSS_SHEET`) and any brand/consumer
  //    sheet — rides through untouched, so the component sheet survives the
  //    brand replacement and reaches branded docs (#68/C-002); `DeckLayout`
  //    links it explicitly for the out-of-frame deck route, which gets no
  //    global `customCss` injection.
  const customCss = resolved.generated
    ? resolved.customCss.map((sheet) => (sheet === DEFAULT_TOKEN_SHEET ? THEME_CSS_MODULE_ID : sheet))
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
  // With generated gherkin pages on, their section id is threaded in as
  // build-generated (see `registrySidebar`); off (no `sources`) → the call is the
  // unchanged single-argument form.
  const resolvedSidebar = sidebar ?? registrySidebar(docsDir, gherkinPages?.section);

  // C-004: a sidebar the consumer wrote — through `sidebar` or the `starlight`
  // escape hatch — is authoritative and is never reshaped. Only a sidebar the
  // toolkit (registry groups) or Starlight (bare autogeneration) generated is.
  const sidebarIsGenerated = sidebar === undefined && overrides?.sidebar === undefined;

  // Options for the route-shaping seam, resolved once here, and the ONE build
  // state of this config. `draftPublicationIntegration` writes the withheld
  // drafts into it when its setup hook has resolved DK_PUBLISH_DRAFTS; the
  // route-shaping module source is generated later, on load, and reads it.
  const buildState = createBuildState();
  const routeShaping: RouteShapingOptions = {
    docsDir,
    base,
    indexBasename,
    shapeSidebar: sidebarIsGenerated,
    pagination: overrides?.pagination !== false,
    ...(indexLabel ? { indexLabel } : {}),
  };

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
    head: [
      ...discoveryHead(normalizeBasePrefix(base)),
      ...fontHead,
      // No-flash pre-paint (FR-005/NFR-001, contract C-1/C-5): a Starlight
      // `head[]` entry with `content` renders as a SYNCHRONOUS CLASSIC inline
      // `<script>` (no `type=module`/`defer`/`async`), so it executes during
      // `<head>` parse — BEFORE `<body>` — and sets `data-toc-collapsed` on
      // `<html>` for a returning reader with a collapsed preference, so the
      // outline never flashes expanded then collapses. The SOURCE lives in
      // WP01's `toc-rail/pre-paint` (blocked-storage-safe `try/catch`).
      { tag: 'script', content: PRE_PAINT_SCRIPT },
      // The current-sidebar-entry reveal (FR-022) is not a head entry: the
      // `Sidebar` carrier ships it right after Starlight's sidebar, so it runs
      // before the sidebar is first painted (FR-004, ADR-0063).
    ],
    customCss,
    ...overrides,
    // Starlight's own Markdown options (#144), merged so a consumer override
    // keeps its keys. Applied after `...overrides` for the same reason as
    // `routeMiddleware`.
    markdown: {
      // Starlight 0.34 turned heading links on by default. Operator decision
      // 2026-10-18: parity (off); adopting anchors is a separate later change.
      // A consumer can still opt in through `starlight.markdown.headingLinks`.
      headingLinks: false,
      ...overrides?.markdown,
      // Starlight 0.41+ runs its Markdown transforms (asides, heading links, RTL
      // code, which Markua `T>` tips rely on) only on `src/content/docs` and
      // these directories. The docs root is always one of them.
      // A consumer entry that resolves to the docs root is not listed twice.
      processedDirs: [
        docsDir,
        ...(overrides?.markdown?.processedDirs ?? []).filter(
          (dir) => path.resolve(dir) !== path.resolve(docsDir),
        ),
      ],
    },
    // Route middleware is MERGED, not replaced (C-004): the toolkit's runs first
    // and whatever the consumer lists under `starlight.routeMiddleware` runs
    // after it, on the already shaped route data, so the consumer has the last
    // word. Applied after `...overrides` for the same reason as `components`.
    routeMiddleware: [ROUTE_MIDDLEWARE, ...[overrides?.routeMiddleware ?? []].flat()],
    // The toolkit's UI strings (#161) ride a Starlight plugin. It is listed FIRST:
    // Starlight merges injected translations in plugin order, so an adopter's
    // plugin (kept, after ours) can still override the `en` default.
    plugins: [DOC_KITTY_I18N_PLUGIN, ...(overrides?.plugins ?? [])],
    // Seam 3 (ADR-0013/ADR-0015 decision 3): the components map is FIXED at the
    // six carriers, in EVERY case (with or without a theme; ADR-0044 added
    // `Header` to the original four, ADR-0063 added `Sidebar`). The exactly-six
    // invariant is established HERE by config ordering — `components` is
    // applied AFTER `...overrides`, so a consumer's escape hatch cannot silently
    // add a seventh carrier override (a theme addresses the carriers' `dk:`
    // slots, never this map). `assert-chrome-artifacts.mjs` proves the five
    // marker-emitting carriers are live in the built output (`Header` emits no
    // marker, by design); the ordering below is what makes these the only six.
    // The one exception is the test-only `DK_INTERNAL_STOCK_HEADER=on`, which
    // drops `Header` (see `carriersForBuild`).
    components: carriersForBuild(),
  };

  // Presence-gate (NFR-002): the glossary seam is added ONLY when a definitions
  // file exists under the site root — the byte-identical twin of `diagrams: false`.
  // Read once here (a cheap `existsSync`) so the array shape is decided BEFORE the
  // build hooks run; the authoritative parse happens once inside the hook.
  const glossaryActive = isGlossaryActive(process.cwd());

  // Opt-in Markua seam (FR-011): the byte-identical twin of `diagrams: false`.
  // With `markua` absent/false the whole seam below is omitted, so the array +
  // corpus stay byte-identical (NFR-001). WP10 flips it on for the example.
  const markuaActive = markua === true;
  // The render-time glossary re-derive (OnThisPage.astro) runs in a separate module
  // graph, so it learns the Markua opt-in through this handoff (#113). Absent when off.
  if (markuaActive) setInternalEnv(DK_MARKUA_ENV, 'on');

  return [
    // Markdown processor pin (ADR-0060, #119): ALWAYS FIRST. Astro 7 defaults to
    // Sätteri, which drops every remark/rehype plugin; the `unified()` processor
    // must be set before the first integration below (or Starlight) appends one.
    // It registers no plugin, so every order comment below still holds.
    markdownProcessorIntegration,
    // HTML whitespace parity (#145, B11): `compressHTML: true`, operator
    // decision 2026-10-18. Registers no plugin, so no order pin moves.
    compressHtmlIntegration,
    // Always-on `kind: Schematic` seam (ADR-0067). BEFORE the diagrams seam: its remark
    // plugin adds the ```plantuml fence that the diagram plugins then render. The
    // fence is added only when build-mode diagrams will render it (PlantUML has no
    // client renderer). A page without `kind: Schematic` is untouched.
    schematicIntegration(docsDir, indexBasename, diagrams === true && resolveDiagramMode() === 'build', base),
    // Opt-in diagrams seam (FR-001): PREPENDED before Starlight when
    // `diagrams: true`, so the diagram machinery sits ahead of `starlight()` in
    // the integrations array (ordering contract). Omitted entirely when off —
    // the spread below is then byte-identical to the pre-M5 array (zero cost).
    ...(diagrams ? [diagramsIntegration] : []),
    // SINGLE `remark-directive` owner (ADR-0030 D-07): registered EXACTLY ONCE,
    // gated on (glossary OR markua), and PREPENDED before BOTH the markua and
    // glossary integrations. `updateConfig` APPENDS to `markdown.remarkPlugins`,
    // so prepending this owner makes `remarkDirective` lead the combined order —
    // ahead of Markua's `normalise → attributes → callouts` AND the glossary's
    // `term → autolink` (identical to the pre-hoist glossary order). A double
    // registration or a silent non-registration is the exact ownership bug the
    // squad flagged; the `glossary-active / markua-inactive` counting assertion
    // (markua-attributes.test.ts) locks it. Omitted when both features are off →
    // byte-identical array (FR-011/NFR-001).
    ...(glossaryActive || markuaActive ? [directiveIntegration] : []),
    // Opt-in Markua seam (ADR-0030; FR-005/006/007/011): PREPENDED before
    // Starlight when `markua: true`, mirroring the diagrams shape, so its remark
    // plugins run BEFORE Starlight's `remarkAsides` — WP04's mapped-directive
    // asides must already be present when `remarkAsides` visits (the native-aside
    // consumption ordering; WP10's `T>`→`starlight-aside--tip` assertion fails
    // loudly on a reorder). Omitted entirely when off — byte-identical (NFR-001).
    ...(markuaActive ? [markuaIntegration()] : []),
    // Presence-gated glossary seam (M4, ADR-0025/0026/0027/0028): PREPENDED before
    // Starlight when `.contextive/definitions.yaml` exists, mirroring the diagrams
    // shape. Omitted entirely when absent — the spread contributes NOTHING, so a
    // glossary-free array + corpus is byte-identical to pre-M4 (NFR-002). WP09 lands
    // the example definitions file; until then this is inert on the example.
    ...(glossaryActive ? [glossaryIntegration(docsDir, base, indexBasename)] : []),
    // Opt-in gherkin seam (ADR-0046): PREPENDED before Starlight, immediately AFTER
    // the glossary, ONLY when `gherkin.sources` is set. Every `config:setup` hook runs
    // before the content-layer sync, so its array position relative to the
    // glossary is not a correctness constraint; it sits after it so build logs
    // read glossary → gherkin. It registers NO remark/rehype plugins (generated
    // pages are plain Markdown on the existing stack), so no plugin-order pin
    // moves. Omitted entirely when absent — byte-identical array.
    ...(gherkinPages ? [gherkinIntegration(gherkinPages, docsDir, indexBasename, gherkinOpts?.results, gherkinOpts?.lint)] : []),
    // Opt-in in-page Gherkin stage (ADR-0051): PREPENDED immediately before
    // Starlight, AFTER the glossary and the codegen hook, whenever the option is
    // set and `fences` is not `false`, or `results` is set (ADR-0055: it adds
    // results to generated pages, and with `fences: false` does only that).
    // Here the position IS a correctness constraint, because this integration
    // registers a remark plugin and `updateConfig` APPENDS: after the glossary
    // means step text is not auto-linked (Q1); before Starlight means Expressive
    // Code and the directive restoration run after it. Omitted when absent, or
    // with `fences: false` and no `results`, so such a site's plugin lists are
    // byte-identical.
    ...(gherkinOpts?.fences || gherkinOpts?.results ? [gherkinFenceIntegration(gherkinOpts)] : []),
    starlight(starlightConfig),
    // Always-on draft-publication seam (FR-013..FR-018): resolves
    // DK_PUBLISH_DRAFTS for this build and hands the draft slugs to the
    // build state below, so it sits BEFORE that integration.
    draftPublicationIntegration(routeShaping, buildState),
    // Always-on legacy `.html` redirects seam (ADR-0068): refuses Astro
    // `redirects` keys ending in `.html` and, after the build, writes the
    // `legacyHtmlRedirects` map as flat stubs. AFTER the draft-publication
    // seam, whose setup hook records DK_PUBLISH_DRAFTS for this build.
    legacyHtmlRedirectsIntegration(legacyHtmlRedirects, docsDir, indexBasename),
    // Always-on route-shaping seam (FR-011, FR-019..FR-023): serves the data the
    // toolkit's route middleware (registered in `starlightConfig` above) reads,
    // and prints the shaping warnings once when the build is done.
    routeShapingIntegration(routeShaping, buildState),
    // Always-on collapsible-TOC-rail client seam (FR-006, IC-04, D2): appended
    // UNCONDITIONALLY — the TOC rail is baseline chrome, so it is NOT gated on a
    // `DocKittyOptions` toggle. Its `injectScript('page', …)` island early-returns
    // on any TOC-free page, so a non-TOC route stays cost-free.
    tocRailIntegration,
    // Always-on diagram/image lightbox (#185): like the TOC rail, baseline reading
    // behaviour with no toggle; its island returns early on a page with no target.
    lightboxIntegration,
    // Always-on content-graph route (#176, FR-010): injects `/api/content-graph.json`
    // UNCONDITIONALLY, like the TOC rail, so no adopter adds a page file and the
    // agent index's `_links.contentGraph` never dangles. Registers no remark/rehype
    // plugin, so no plugin-order pin moves.
    contentGraphIntegration(docsDir, indexBasename),
    // Guarded slide-split remark transform (ADR-0012): a global markdown plugin
    // that only acts on `kind: Presentation` pages and no-ops everywhere else.
    deckSplitIntegration,
    // One <h1> per page (#191): drops a leading body H1 that repeats the title and
    // demotes any other body H1, so Starlight's title stays the only <h1>.
    singleH1Integration,
    // Always-on authored-content base-prefix seam (review-cycle-1, FR-004/
    // SC-002): base-prefixes every root-absolute internal `<a href>` a rendered
    // markdown page emits. No-ops when no `base` is configured.
    baseAbsoluteLinksIntegration(base, docsDir, indexBasename),
    // INV-1: draft pages are unpublished, so their URLs are excluded here.
    sitemap({ filter: sitemapDraftFilter(docsDir, base, indexBasename) }),
    // Make the built sitemap reproducible (#87, FR-001/NFR-001): an
    // `astro:build:done` step that rewrites each `dist/sitemap-N.xml` with its
    // `<url>` blocks `<loc>`-sorted (code-unit asc), preserving every byte
    // outside the contiguous `<url>` run. Registered AFTER `sitemap(...)` so the page files already exist when
    // the hook runs; the `sitemap-index.xml` is left untouched.
    sitemapOrderIntegration(),
    // Always-on OKF export (#178, FR-018): an `astro:build:done` step that writes
    // `dist/okf/` from the graph file the content-graph route already built. No
    // option disables it. Registered AFTER the graph route and the sitemap step.
    okfExportIntegration(docsDir, indexBasename),
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
