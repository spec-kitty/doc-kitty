/**
 * Starlight configuration preset for DocKitty.
 *
 * `defineDocKittyIntegrations()` returns the Astro integrations array a docs
 * site needs: Starlight (themed, with the convention's head links and the five
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
 * the five carriers in both cases (seam 3); theme `assets` ride Starlight-native
 * `logo`/`favicon`/`title`, never a components override (ADR-0015 decision 4/5).
 */
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import type { AstroIntegration } from 'astro';
import { sectionOf, type IndexBasenameOption } from './metadata.js';
import {
  resolveSectionRegistry,
  registryToSidebar,
  sectionFeeds,
  feedsSurface,
  BUILD_GENERATED_SECTION_IDS,
} from './sections.js';
import { resolveTheme, DEFAULT_TOKEN_SHEET, type DocKittyTheme } from './theme.js';
import {
  ROUTE_MIDDLEWARE,
  routeShapingIntegration,
  type RouteShapingOptions,
} from './integrations/route-shaping.js';
import { draftPublicationIntegration } from './integrations/draft-publication.js';
import { diagramsIntegration } from './integrations/diagrams.js';
import { createBuildState } from './build-state.js';
import { normalizeBasePrefix, siteDraftRoutes } from './integrations/shared.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';
import { docKittyFavicon, faviconHref } from './favicon.js';
import sitemapOrderIntegration from './sitemap-order.js';
import { DOC_KITTY_I18N_PLUGIN } from './i18n-plugin.js';
import { PRE_PAINT_SCRIPT } from './toc-rail/pre-paint.js';
import { REVEAL_CURRENT_SCRIPT } from './route-shaping.js';
import { buildRouteTable, formatRouteCollisions, normalizeIndexBasenames } from './vocabulary-core.mjs';
import { walkMarkdownPaths } from './docs-walk.mjs';
import { publishDraftsInForce, unpublishedDraftPaths } from './draft-publication.mjs';
import deckSplit from './remark/deck-split.js';
import relativeMdLinks from './remark/relative-md-links.js';
import baseAbsoluteLinks from './rehype/base-absolute-links.js';
import remarkDirective from 'remark-directive';
import markuaNormalise from './remark/markua-normalise.js';
import markuaFootnotes from './remark/markua-footnotes.js';
import markuaAttributes from './remark/markua-attributes.js';
import markuaCallouts from './remark/markua-callouts.js';
import markuaFigure from './rehype/markua-figure.js';
import markuaTocDemote from './rehype/markua-toc-demote.js';
import { guardDeck } from './markua/deck-guard.js';
import { isGlossaryActive, loadGlossary } from './glossary/load.js';
import { generateGlossaryPages } from './glossary/generate.js';
import glossaryTerm from './remark/glossary-term.js';
import glossaryAutolink from './remark/glossary-autolink.js';
import { DEFAULT_IGNORE_LIST } from './glossary/ignore-list.js';
import {
  serializeDefinitionsPayload,
  glossaryDefinitions,
} from './glossary/definitions-payload.js';
import { GHERKIN_LOG_PREFIX, loadFeatures } from './gherkin/load.mjs';
import { generateFeaturePages } from './gherkin/generate.mjs';
import { normalizeGherkinOptions, validateIndexBasenames } from './gherkin/options.mjs';
import { drainFatal, formatFatal, resetFatal } from './gherkin/errors.mjs';
import gherkinFence, { type GherkinFenceOptions } from './remark/gherkin-fence.js';
import { loadReport } from './gherkin/results-load.mjs';
import {
  DK_DOCS_ROOT_ENV,
  DK_GHERKIN_RESULTS_ENV,
  DK_GHERKIN_ROUTE_ENV,
  DK_INDEX_BASENAME_ENV,
  clearInternalEnv,
  deleteInternalEnv,
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
   * the `components` map is FIXED at the five carriers regardless of theme (seam
   * 3); the `starlight` escape hatch cannot add a sixth carrier override.
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
  gherkin?:
    | true
    | {
        /**
         * Render ```` ```gherkin ```` fences and `::gherkin{…}` includes on docs
         * pages (ADR-0051). Default `true`. `false` leaves fences as code blocks
         * and includes as literal text, so a generated-pages-only site
         * (`{ sources, fences: false }`) renders its authored pages unchanged.
         */
        fences?: boolean;
        /**
         * Directories an `::gherkin{src=…}` include may read from, relative to the
         * project root (`process.cwd()`). An include whose real path (symlinks
         * resolved) is outside every root is build-fatal. Default: `sources` when
         * set, else `[]` (every include is refused).
         */
        includeRoots?: string[];
        /**
         * Source directories, relative to the site root (`process.cwd()`), walked
         * for `*.feature`. Present ⇒ generated feature pages (ADR-0046); absent ⇒
         * none, and no `behaviour` sidebar section.
         */
        sources?: string[];
        /**
         * Section id (folder under `docsDir`) the pages are generated into.
         * Default `behaviour`. Only valid together with `sources`.
         */
        section?: string;
        /**
         * Optional repo browse-URL prefix (e.g. `https://github.com/o/r/blob/main/`),
         * prepended verbatim to the `sourceRoot`-relative source path to form each
         * generated page's `sources[0].resource` link and an include's source
         * link. Omitted → the bare relative path.
         */
        sourceUrlPrefix?: string;
        /**
         * Directory the reported source paths (`sources:` frontmatter, the agent
         * API, include source lines) are relative to, itself relative to the site
         * root. Default: the site root (`process.cwd()`). Set `'..'` when the site
         * lives in a sub-package and `sourceUrlPrefix` points at the repo root.
         */
        sourceRoot?: string;
        /**
         * Remove the generated pages when NONE of the `sources` yields a feature.
         * Default `false`: the build stops instead, because an uninitialised git
         * submodule looks exactly like "all features deleted". Set `true` to delete
         * the pages on purpose. Must be a boolean, and only valid together with
         * `sources` (build-fatal otherwise).
         */
        allowEmpty?: boolean;
        /**
         * Hub titles by source directory (#125): a key is a directory relative to
         * a source, as written on disk (`hr`, `shipping/edi`), and its value
         * replaces the humanised directory name as the hub's title, so the sidebar
         * group reads it too (`{ hr: 'HR' }` instead of "Hr"). A key that names no
         * directory holding a feature warns. Only valid together with `sources`.
         */
        titles?: Record<string, string>;
        /**
         * The Cucumber report whose results are shown next to every scenario the
         * site renders from a `.feature` file (ADR-0055): on generated feature
         * pages and in `::gherkin` includes, never on a ```` ```gherkin ```` fence.
         * Cucumber Messages (`--format message`, NDJSON) or Cucumber JSON
         * (`--format json`), read at build time; nothing is fetched or run.
         *
         * A path relative to the project root, or `{ report, root }` where `root`
         * is the directory Cucumber ran in (default the project root): the
         * report's relative `uri`s resolve against it, so a site that checks
         * another repository out into `vendor/x` sets `root: 'vendor/x'`.
         *
         * A missing report is a build warning locally (a local build has no CI
         * report) and build-fatal when the `CI` environment variable is set (not
         * empty, `false` or `0`), so a CI pipeline that forgot to produce the
         * report cannot publish a site without results. Set `required: false` to
         * keep it a warning in CI. One that cannot be read is build-fatal. Only statuses, counts, the run
         * date and the commit id reach a page.
         */
        results?: string | { report: string; root?: string; required?: boolean };
      };
  /**
   * The section-index basename(s) (FR-001/FR-002, D-01). Defaults to
   * `"README"` only — byte-identical to today's behaviour (NFR-003). This is
   * the ONE place to set it: the docs loader and the `dockitty-*` CLIs read the
   * value from here (FR-007), so `docKittyDocsLoader` needs no `indexBasename`
   * of its own, and one that disagrees is a build error.
   */
  indexBasename?: IndexBasenameOption;
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
 * The five chrome carriers doc-kitty registers with Starlight (ADR-0013, as
 * amended by ADR-0044, which adds `Header`). A theme targets the carriers' `dk:`
 * slot names, never Starlight's `components` map. `Header` hosts the single
 * `dk:site-header` slot and renders Starlight's stock header when no theme fills
 * it, with no wrapper, so a site without a theme header is unchanged. Paths are
 * package-export specifiers so a consuming site resolves the `.astro` carriers
 * from the `@spec-kitty/doc-toolkit` workspace dependency.
 */
const carriers: NonNullable<StarlightUserConfig['components']> = {
  Head: '@spec-kitty/doc-toolkit/components/Head.astro',
  PageTitle: '@spec-kitty/doc-toolkit/components/PageTitle.astro',
  MarkdownContent: '@spec-kitty/doc-toolkit/components/MarkdownContent.astro',
  Footer: '@spec-kitty/doc-toolkit/components/Footer.astro',
  Header: '@spec-kitty/doc-toolkit/components/Header.astro',
};

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


/**
 * Build the `@astrojs/sitemap` `filter`. It receives each candidate page's full
 * absolute URL and returns TRUE to keep the page. A page is kept iff BOTH gates
 * pass (INV-1 publication AND the section-level `feeds`):
 *
 *   1. **Draft gate.** Drop a page iff its route (the pathname with the site
 *      `base` stripped) EQUALS a draft route exactly. The match is ANCHORED — a
 *      plain `endsWith` would over-exclude a published page whose slug tail
 *      coincides with a draft's (e.g. `/architecture/overview/` vs a draft
 *      `/overview/`).
 *   2. **`feeds` gate.** Drop a page whose section does not feed `sitemap`.
 *      Resolved from `<docsDir>/_meta/sections.yaml`; a section that OMITS
 *      `feeds` feeds ALL FOUR surfaces (absent = all, {@link feedsSurface}), and
 *      an ABSENT registry means no feeds filtering at all — byte-compatible with
 *      the pre-feeds sitemap (a registry that declares no `feeds` drops nothing).
 *
 * The draft routes are read LAZILY, on the filter's first call (sitemap runs it
 * in `astro:build:done`), NOT when the integrations array is built: the opt-in
 * `doc-kitty:gherkin` integration (ADR-0046) writes `kind: Specification` pages
 * in `astro:config:setup`, which runs AFTER `defineDocKittyIntegrations`
 * returns. An eager read would gate the sitemap on the PRE-generation tree, so a
 * feature that had just gained `@wip` would leak its draft URL into the sitemap
 * (and one that just lost it would be wrongly dropped) for that build, while the
 * collection-backed surfaces (llms.txt, RSS, agent API) saw the fresh status.
 *
 * Exported so the composed draft+feeds gate is unit-testable without spinning up
 * the whole Astro integrations array.
 */
export function sitemapDraftFilter(
  docsDir: string,
  base: string,
  indexBasename?: IndexBasenameOption,
): (page: string) => boolean {
  let routes: Set<string> | undefined;
  const basePrefix = normalizeBasePrefix(base);
  // Load the registry from the SAME docs root the sidebar synthesis uses. Absent
  // registry → `feeds` undefined → `feedsSurface` is always true (no filtering).
  const registry = resolveSectionRegistry(path.resolve(process.cwd(), docsDir));
  const feeds = registry ? sectionFeeds(registry) : undefined;
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
    // Read once, at the first call (after every config:setup generator has run).
    routes ??= siteDraftRoutes(docsDir, indexBasename);
    if (routes.has(normalized)) return false;
    // `feeds` gate: derive the section from the base-free route (first path
    // segment; the root '/' → section '') and drop it if it does not feed sitemap.
    const slug = normalized.replace(/^\//, '').replace(/\/$/, '');
    if (!feedsSurface(feeds, sectionOf(slug), 'sitemap')) return false;
    return true;
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

/**
 * The always-on authored-content base-prefix seam (review-cycle-1, WP01
 * FR-004/SC-002). Unlike the diagrams/markua/glossary seams, this is NOT
 * opt-in and NOT presence-gated: every doc-kitty site can carry hand-authored,
 * root-absolute internal links in its markdown body (`/architecture/overview/`),
 * and on a based deployment those 404 verbatim unless something base-prefixes
 * them at the rendered-HTML seam (mirrors the diagram/glossary shape of a
 * global markdown plugin, but always registered — like `deckSplitIntegration`
 * below, whose no-op guard is per-page rather than per-config). With NO base
 * configured (`base: '/'`, the default) `normalizeBasePrefix` collapses to
 * `''` and the plugin's own guard makes it a strict no-op — a base-less site's
 * corpus stays byte-identical (NFR-001-shaped, even though this integration
 * itself is unconditional).
 */
function baseAbsoluteLinksIntegration(
  base: string,
  docsDir: string,
  indexBasename?: IndexBasenameOption,
): AstroIntegration {
  return {
    name: 'doc-kitty:base-absolute-links',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        const prefix = normalizeBasePrefix(base);
        // The route table for relative `.md`/`.mdx` links (FR-011, FR-021). Built here
        // because the glossary and gherkin integrations have written their pages by now
        // and the draft-publication integration has recorded the resolved setting. It is
        // plain JSON with code-unit-sorted keys, so Astro's config digest changes when a
        // target is renamed or its draft state flips, and the pages that link to it re-render.
        // An absent docs root walks to an empty table, which makes the plugin a no-op.
        const docsRoot = path.resolve(process.cwd(), docsDir);
        const { routes, collisions } = buildRouteTable(walkMarkdownPaths(docsRoot), {
          indexBasename,
          unpublishedPaths: unpublishedDraftPaths(docsRoot, publishDraftsInForce(), indexBasename),
        });
        // FR-004: two files served at one address stop the build. Drafts count whether or
        // not they are published, so the same tree fails the same way in every mode.
        if (collisions.length) throw new Error(formatRouteCollisions(collisions, { docsDir }));
        updateConfig({
          markdown: {
            remarkPlugins: [[relativeMdLinks, { routes, base: prefix, docsRoot }]],
            rehypePlugins: [[baseAbsoluteLinks, { base: prefix }]],
          },
        });
      },
    },
  };
}

/**
 * The collapsible-TOC-rail client seam (FR-006, IC-04, D2 always-on). It injects
 * WP02's collapse-toggle island page-wide via the documented `injectScript('page',
 * …)` pattern, mirroring ONLY the injection mechanics of `diagramsIntegration` /
 * `glossaryIntegration` — the module is referenced by its absolute on-disk path so
 * it resolves without a package-exports entry.
 *
 * Unlike the diagrams/glossary seams there is NO presence/opt-in gate: this is
 * appended UNCONDITIONALLY to the integrations array (D2 — the TOC rail is a
 * baseline chrome behavior on every site, so it must not sit behind a
 * `DocKittyOptions` toggle). The island itself early-returns on any page whose DOM
 * carries no `.right-sidebar` TOC, so a TOC-free page stays cost-free at runtime,
 * and it augments Starlight's rendered sidebar with one native `<button>` rather
 * than overriding a `components` carrier (the five-carrier lock, DIRECTIVE_001).
 */
const tocRailIntegration: AstroIntegration = {
  name: 'doc-kitty:toc-rail',
  hooks: {
    'astro:config:setup': ({ injectScript }) => {
      const clientPath = fileURLToPath(
        new URL('./toc-rail/toc-rail.client.ts', import.meta.url),
      );
      injectScript(
        'page',
        `import { initTocRail } from ${JSON.stringify(clientPath)};\ninitTocRail();`,
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
 *       after Astro's built-in remark-gfm): `glossary-term → glossary-autolink`,
 *       threading the ONE shared index + `DEFAULT_IGNORE_LIST` + the site's
 *       already-normalized base prefix (#61, C-001 — the same `normalizeBasePrefix`
 *       pattern `discoveryHead` uses for `/rss.xml`/`/llms.txt`) into both factories
 *       (FR-008), plus the `glossaryDefinitions` rehype plugin that emits the
 *       hover-preview payload `<script>` (the WP06 island contract). `remarkDirective`
 *       is registered ONCE by the shared `directiveIntegration` owner (ADR-0030),
 *       prepended before this integration so the combined order still leads with it.
 *   (c) injects the preview island page-wide (M5 `injectScript('page', …)` pattern),
 *       referenced by absolute on-disk path; its own early-return keeps a
 *       glossary-free page cost-free (NFR-003) and it is a no-op on the out-of-frame
 *       deck (it keys on `a[data-glossary-term]`), so no `main.reveal` guard is
 *       needed (unlike the diagram render). `.catch` mirrors the diagram owner.
 */
function glossaryIntegration(
  docsDir: string,
  base: string,
  indexBasename: IndexBasenameOption | undefined,
): AstroIntegration {
  return {
    name: 'doc-kitty:glossary',
    hooks: {
      'astro:config:setup': ({ updateConfig, injectScript, logger }) => {
        const root = process.cwd();
        const loaded = loadGlossary(root);
        // Defensive: the array-build gate already checked presence, but a file
        // deleted between the two reads must still no-op cleanly.
        if (!loaded.present) return;
        const { index } = loaded;

        // (a) Generate-before-glob: write docs/glossary/** now, in config:setup,
        // resolved against the same cwd the sitemap draft-filter uses.
        // The site's index-name setting decides the written file name (#129): the pages
        // must be a section index here, or the toolkit's own links to the hub point at
        // /glossary/index/ and the Hub layout and sidebar do not see it as the index.
        generateGlossaryPages(index, path.resolve(root, docsDir), indexBasename, (m) =>
          logger.warn(m),
        );

        // (b) Pinned remark order (append after remark-gfm) + payload rehype.
        // The shared index + DEFAULT_IGNORE_LIST + basePrefix thread into BOTH
        // factories so the pipeline and WP07's render-time re-derive resolve
        // identically (FR-008) and every emitted term href carries the site base
        // (#61) through the ONE shared `glossaryTermUrl` builder both factories call.
        // NOTE: `remarkDirective` is NO LONGER registered here — it is hoisted to
        // the single `directiveIntegration` owner (gated on glossary OR markua,
        // ADR-0030) and prepended BEFORE this integration, so the effective
        // combined order is still `remarkDirective → glossary-term →
        // glossary-autolink`. See the registration-site comment in
        // `defineDocKittyIntegrations`.
        const basePrefix = normalizeBasePrefix(base);
        updateConfig({
          markdown: {
            remarkPlugins: [
              [glossaryTerm, { index, ignoreList: DEFAULT_IGNORE_LIST, base: basePrefix }],
              [glossaryAutolink, { index, ignoreList: DEFAULT_IGNORE_LIST, base: basePrefix }],
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

/** The normalised `gherkin` option (see {@link resolveGherkinOptions}). */
type ResolvedGherkinOptions = ReturnType<typeof normalizeGherkinOptions>;

/** Its generated-pages part, present only when `sources` is set (ADR-0046). */
type ResolvedGherkinPages = NonNullable<ResolvedGherkinOptions['pages']>;

/**
 * Normalise + validate the `gherkin` option EAGERLY, at `defineDocKittyIntegrations`
 * time, so a misconfiguration fails before any hook runs (house posture: config
 * errors are build-fatal and name the feature). The rules (`true` or a known-key
 * object; with `sources`: non-empty `sources`, `section` ONE safe folder name, not
 * `_meta` and not another generator's section) live ONCE in
 * `./gherkin/options.mjs`, shared with the bare-Node `generate-feature-pages.mjs`
 * CLI; this passes the reserved list derived from `BUILD_GENERATED_SECTION_IDS`
 * (a parity test pins the CLI's default to it).
 */
function resolveGherkinOptions(
  raw: NonNullable<DocKittyOptions['gherkin']>,
): ResolvedGherkinOptions {
  return normalizeGherkinOptions(raw, {
    reservedSections: ['_meta', ...BUILD_GENERATED_SECTION_IDS],
  });
}

/**
 * The opt-in Gherkin feature-page seam (ADR-0046), registered ONLY when
 * `defineDocKittyIntegrations({ gherkin: { sources, … } })` is set (`gherkin:
 * true`, or an object without `sources`, generates no pages). It adds NO markdown
 * plugins: its single `astro:config:setup` hook (the glossary's generate-before-
 * glob seam — the content-layer `sync` runs after every config hook) does
 *   (a) `loadFeatures`: walk + parse every `*.feature` under `sources` (resolved
 *       against the site root, `process.cwd()`, like the glossary's root) exactly
 *       once. A malformed file throws ONE `[dk-gherkin] <path>:<line>:<col> …`
 *       Error; it is deliberately NOT caught, so the build fails.
 *   (b) `generateFeaturePages`: codegen into `<docsDir>/<section>/**`. The writer
 *       is deterministic and only rewrites changed bytes, so the dev-server restart
 *       triggered by (c) regenerates identically and never loops; stale OWNED pages
 *       are pruned, and an AUTHORED file in the section is fatal.
 *   (c) `addWatchFile` for every loaded source, in model (sorted) order, so editing
 *       a `.feature` in dev restarts the server and re-runs (a)–(b). A NEW file is
 *       only picked up on the next restart (documented limit).
 * One `[dk-gherkin]` info line reports the counts (when the logger supports it).
 *
 * (d) `injectRoute` mounts `/api/scenarios.json` (#126, ADR-0054), so the
 *     `llms.txt` line that advertises it never points at a 404 and a site adds no
 *     route file. A site that already mounts its own `src/pages/api/scenarios.json.*`
 *     (or `scenarios.json/index.*`) keeps it: the injection is skipped, so the two routes never meet at one
 *     address (`hasOwnScenarioIndexPage`). The route reads `sourceRoot` and
 *     `sourceUrlPrefix` (and `results`, ADR-0055) from
 *     `virtual:doc-kitty/gherkin-scenario-index`, so it resolves sources the way
 *     the generator did.
 */
function gherkinIntegration(
  opts: ResolvedGherkinPages,
  docsDir: string,
  indexBasename: IndexBasenameOption | undefined,
  results?: ResolvedGherkinOptions['results'],
): AstroIntegration {
  return {
    name: 'doc-kitty:gherkin',
    hooks: {
      'astro:config:setup': ({ addWatchFile, logger, injectRoute, updateConfig, config }) => {
        const root = process.cwd();
        const warn = (message: string) => logger.warn(message);
        const model = loadFeatures({ sources: opts.sources, root, warn });
        const docsRoot = path.resolve(root, docsDir);
        const { written, unchanged, removed } = generateFeaturePages(model, {
          sources: opts.sources,
          docsRoot,
          outDir: path.resolve(docsRoot, opts.section),
          section: opts.section,
          indexBasename,
          sourceRoot: path.resolve(root, opts.sourceRoot),
          sourceUrlPrefix: opts.sourceUrlPrefix,
          allowEmpty: opts.allowEmpty,
          titles: opts.titles,
          warn,
        });
        for (const file of model.files) addWatchFile(file.absPath);
        if (hasOwnScenarioIndexPage(config?.srcDir, root)) {
          if (typeof logger.info === 'function') {
            logger.info(
              `${GHERKIN_LOG_PREFIX} src/pages/api/scenarios.json.* is mounted by the site: not injecting the scenario index`,
            );
          }
        } else {
          const resolved = `\0${SCENARIO_INDEX_MODULE_ID}`;
          const options = {
            sourceRoot: opts.sourceRoot,
            ...(opts.sourceUrlPrefix !== undefined ? { sourceUrlPrefix: opts.sourceUrlPrefix } : {}),
            // ADR-0055: the injected index carries the same results as the pages.
            ...(results ? { results } : {}),
          };
          updateConfig({
            vite: {
              plugins: [
                {
                  name: 'doc-kitty:gherkin-scenario-index',
                  resolveId: (id: string) => (id === SCENARIO_INDEX_MODULE_ID ? resolved : null),
                  load: (id: string) =>
                    id === resolved
                      ? `export const scenarioIndexOptions = ${JSON.stringify(options)};\n`
                      : null,
                },
              ],
            },
          });
          // `prerender`: the route reads feature files at build, so it stays static
          // even when the site sets `output: 'server'`.
          injectRoute({
            pattern: '/api/scenarios.json',
            entrypoint: SCENARIO_INDEX_ENTRYPOINT,
            prerender: true,
          });
        }
        if (typeof logger.info === 'function') {
          logger.info(
            `${GHERKIN_LOG_PREFIX} ${model.files.length} feature file(s) → ${docsDir}/${opts.section}: ` +
              `${written.length} written, ${unchanged.length} unchanged, ${removed.length} removed`,
          );
        }
      },
    },
  };
}

/** The virtual module the injected scenario-index route reads its options from. */
export const SCENARIO_INDEX_MODULE_ID = 'virtual:doc-kitty/gherkin-scenario-index';

/** The injected route's entrypoint, a package export so a consuming site resolves it. */
const SCENARIO_INDEX_ENTRYPOINT = '@spec-kitty/doc-toolkit/routes/scenario-index-injected';

/** Page extensions Astro treats as an endpoint file. */
const ENDPOINT_EXTENSIONS = ['ts', 'js', 'mts', 'mjs', 'cts', 'cjs', 'tsx', 'jsx'];

/**
 * True when the site mounts its own `api/scenarios.json` endpoint under
 * `<srcDir>/pages` (the hand-mounted route older sites were told to add). Astro
 * fails on two routes for one address, so the integration then leaves the
 * site's route alone.
 */
export function hasOwnScenarioIndexPage(srcDir: URL | string | undefined, root: string): boolean {
  return findOwnScenarioIndexPage(srcDir, root) !== undefined;
}

/**
 * The site's own scenario-index endpoint, as a project-root-relative POSIX path
 * (`src/pages/api/scenarios.json.ts`), or `undefined` when it mounts none.
 */
export function findOwnScenarioIndexPage(srcDir: URL | string | undefined, root: string): string | undefined {
  const src = srcDir ? fileURLToPath(srcDir) : path.join(root, 'src');
  const api = path.join(src, 'pages', 'api');
  for (const ext of ENDPOINT_EXTENSIONS) {
    for (const candidate of [path.join(api, `scenarios.json.${ext}`), path.join(api, 'scenarios.json', `index.${ext}`)]) {
      if (existsSync(candidate)) return path.relative(root, candidate).split(path.sep).join('/');
    }
  }
  return undefined;
}

/** `CI` is set: trimmed and lower-cased, non-empty and not `false` or `0`. */
function isCiEnv(): boolean {
  const value = (process.env.CI ?? '').trim().toLowerCase();
  return value !== '' && value !== 'false' && value !== '0';
}

/**
 * Read the configured Cucumber report once at config time (ADR-0055 decision 9),
 * so a broken pipeline fails before any page renders:
 *  - missing: a warning, and the site builds without results (a local build has
 *    no CI report), unless CI is set and `required` is not `false`: THROWN;
 *  - not a file, too large, or not a Cucumber report: THROWN, so the build fails
 *    with the report's path (and line, for an NDJSON envelope);
 *  - every step skipped: a warning, since that is what `--dry-run` writes.
 * The report is also a watch file: replacing it restarts a dev server, whose
 * content layer then re-renders the pages that show results (`schema.ts`).
 */
function checkResultsReport(
  results: NonNullable<ResolvedGherkinOptions['results']>,
  { addWatchFile, logger }: { addWatchFile?: (path: string) => void; logger: { warn: (m: string) => void } },
): void {
  const root = process.cwd();
  addWatchFile?.(path.resolve(root, results.report));
  const loaded = loadReport(results, { projectRoot: root });
  if (!loaded.ok) {
    if (results.required !== false && isCiEnv()) {
      throw new Error(
        `${GHERKIN_LOG_PREFIX} gherkin.results report not found: ${results.report} ` +
          '(CI is set; set gherkin.results.required: false to build without results)',
      );
    }
    logger.warn(
      `${GHERKIN_LOG_PREFIX} gherkin.results report not found: ${results.report}; scenarios render without results`,
    );
    return;
  }
  if (loaded.report.allSkipped) {
    logger.warn(
      `${GHERKIN_LOG_PREFIX} every step in ${results.report} is skipped; it looks like a --dry-run, ` +
        `so every scenario shows Skipped`,
    );
  }
}

/**
 * The in-page Gherkin stage (ADR-0051 decisions 2, 3, 5), registered ONLY when the
 * `gherkin` option is set and `fences !== false`. A SEPARATE integration from the
 * `doc-kitty:gherkin` codegen hook: that one reads the filesystem in
 * `astro:config:setup` and is pinned as adding no markdown plugins, while this one
 * is a pure markdown stage (02 §Pipeline). Two hooks:
 *
 *  - `astro:config:setup` empties the process-wide error sink (a long-lived dev
 *    process must not carry errors across config reloads) and appends the
 *    `gherkinFence` remark plugin, with the normalised `includeRoots`,
 *    `sourceRoot` and `sourceUrlPrefix` the include directive needs. Its array
 *    position (after the glossary and the codegen hook, immediately before
 *    Starlight) puts it after Astro's smartypants and the glossary, and before
 *    Starlight's directive restoration, Expressive Code and `deckSplit`;
 *    `config-invariants.test.ts` pins it.
 *  - `astro:build:done` fails the build when any page recorded a fatal Gherkin
 *    error. Astro's content loader only LOGS a render error and stores the page
 *    with no HTML, so without this check a broken fence builds an empty page and
 *    exits 0 (02 §Making errors fatal). The thrown aggregate lists every page and
 *    message; `gherkin-fence-build.test.ts` proves the non-zero exit on a real
 *    build. In dev nothing exits: the throw in the stage already shows the
 *    page's error.
 *
 *    A failed render must not be cached as a hit, or a second build (or a build
 *    after `astro sync`) would skip the page and pass. Two mechanisms, because
 *    the content store is per collection but this integration is not:
 *     - primary: `docKittyDocsLoader` stores a failed Gherkin render under a
 *       digest that never matches (`createGherkinTracker` in `schema.ts`), so
 *       every later sync renders the page again and refills the sink. It also
 *       covers `astro sync`/`astro check` before a build and a build that died
 *       before this hook;
 *     - fallback: before throwing, this hook DELETES the build's content data
 *       store (`<cacheDir>/data-store.json`). That covers a page in a collection
 *       on any other loader (a plain `glob()`), which the loader-side digest
 *       never sees: the next build re-renders everything and fails again. It
 *       cannot cover an `astro sync` before the build for such a collection
 *       (the sync never reaches this hook). Dropping the store only costs the
 *       next build a full re-render, and only after a failure. It leans on
 *       Astro 5 internals, as decision 11 does (#119).
 *    `gherkin-fence-build.test.ts` pins both.
 */
function gherkinFenceIntegration(opts: ResolvedGherkinOptions): AstroIntegration {
  // What the include directive needs (03 §2.3, §4.6), resolved against the site
  // root at transform time, like `gherkin.sources`.
  const fenceOptions: GherkinFenceOptions = {
    includeRoots: opts.includeRoots,
    sourceRoot: opts.sourceRoot,
    ...(opts.sourceUrlPrefix !== undefined ? { sourceUrlPrefix: opts.sourceUrlPrefix } : {}),
    // `fences: false` with `results`: the stage runs for generated pages only.
    ...(opts.fences ? {} : { fences: false }),
    ...(opts.results ? { results: opts.results } : {}),
  };
  let cacheDir: URL | undefined;
  return {
    name: 'doc-kitty:gherkin-fence',
    hooks: {
      'astro:config:setup': ({ updateConfig, config, addWatchFile, logger }) => {
        resetFatal();
        cacheDir = config?.cacheDir;
        if (opts.results) checkResultsReport(opts.results, { addWatchFile, logger });
        // FR-008: a site's own scenario route is told apart from the injected
        // one HERE, not in the codegen hook, because that one exists only with
        // `gherkin.sources` while `results` can be set without it. The route
        // names the file in its warning when it is given no `results`. The path is
        // relative to the Astro project root (`--root`), not to the process cwd.
        const ownRoute = opts.results ? findOwnScenarioIndexPage(config?.srcDir, config?.root ? fileURLToPath(config.root) : process.cwd()) : undefined;
        if (ownRoute) setInternalEnv(DK_GHERKIN_ROUTE_ENV, ownRoute);
        else deleteInternalEnv(DK_GHERKIN_ROUTE_ENV);
        updateConfig({ markdown: { remarkPlugins: [[gherkinFence, fenceOptions]] } });
      },
      'astro:build:done': () => {
        const report = formatFatal(drainFatal());
        if (!report) return;
        // The fallback for collections not on `docKittyDocsLoader` (see above).
        if (cacheDir) rmSync(new URL('data-store.json', cacheDir), { force: true });
        throw new Error(report);
      },
    },
  };
}

/**
 * The SINGLE `remark-directive` owner (ADR-0030 D-07). Both the glossary (its
 * `:term` text-directive) and Markua (its `containerDirective` asides/callouts +
 * the `{aside}`/`{blurb}` wrappers) need `remark-directive` registered, but it
 * MUST be registered EXACTLY ONCE — a double registration (glossary + markua both
 * adding it) or a silent non-registration is the ownership bug the squad flagged.
 * So it is hoisted OUT of `glossaryIntegration` into this dedicated owner, added
 * to the array gated on `(glossaryActive || markuaActive)` and PREPENDED before
 * both the markua and glossary integrations. Because `updateConfig` APPENDS to
 * `markdown.remarkPlugins`, prepending this owner keeps the combined order leading
 * with `remarkDirective` — ahead of both Markua's `normalise → attributes →
 * callouts` and the glossary's `term → autolink`, identical to the pre-hoist
 * glossary order. With BOTH features off this integration is omitted entirely, so
 * the array stays byte-identical (FR-011/NFR-001).
 */
const directiveIntegration: AstroIntegration = {
  name: 'doc-kitty:remark-directive',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ markdown: { remarkPlugins: [remarkDirective] } });
    },
  },
};

/**
 * The opt-in Markua seam, registered ONLY when `defineDocKittyIntegrations({
 * markua: true })` (FR-011, ADR-0030). It wires the full Markua pipeline the
 * approved WP02/03/04/06/07 plugins compose:
 *   - **remark** (AFTER the shared `remarkDirective` owner, PINNED order):
 *     `markuaNormalise` (compiles `A>`/`W>`… line-prefix runs and `{aside}`/
 *     `{blurb}` wrappers into `containerDirective` nodes) → `markuaAttributes`
 *     (attaches `{…}` attribute lists to their target) → `markuaCallouts` (routes
 *     each container to its native-aside or theme-callout emission). This runs
 *     BEFORE Starlight's own `remarkAsides` — see the prepend note below.
 *   - **rehype** (USER stage, BEFORE Astro's built-in `rehypeImages` /
 *     `rehypeHeadingIds`): `markuaFigure` (wraps each image in an accessible
 *     `<figure>` reading the `hProperties` `markuaAttributes` wrote) and
 *     `markuaTocDemote` (keeps a figure/aside heading out of the on-page ToC).
 *     Running before `rehypeHeadingIds` lets an explicit `{#id}` win — that pass
 *     only slugs a heading with NO id already set (C-005, proven in WP09).
 *
 * FORWARD RULE: any surface that re-derives from the RAW `entry.body` string
 * (raw `A>`/`{blurb}`/`{…}` lines read as literal text there) must replay this
 * Markua normalisation before deriving. This is no longer enforced by prose:
 * the re-derive-parity guard (`glossary-substrate-parity.test.ts`, S-04) is the
 * authority — it reds if a build remark stage is not mirrored or consciously
 * excluded, so prose and gate cannot drift.
 */
function markuaIntegration(): AstroIntegration {
  return {
    name: 'doc-kitty:markua',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          markdown: {
            // Remark (after `remarkDirective`): normalise → attributes → callouts.
            // Registered BARE (#47, FR-003/FR-006): each of the four content
            // passes is now intentionally deck-capable — `markuaNormalise`
            // terminates a wrapper at a slide boundary instead of swallowing it
            // (D3/C-COMPOSE-03), `markuaAttributes` is boundary-safe by
            // construction (D2), and `markuaCallouts` forces the self-contained
            // `dk-callout` theme path on a deck (D5/C-COMPOSE-04) — their
            // deck-safety is proven by their own unit tests, not by a
            // registration-site guard. `deckSplit`/`remarkDirective` are NEVER
            // wrapped — both are out of scope for this guard by design.
            // `markuaFootnotes` sits AFTER `markuaNormalise`, BEFORE
            // `markuaAttributes` (ADR-0041, contract `footnote-feature.md`): it
            // normalises the double-caret footnote nodes `remark-gfm` already
            // parsed (`[^^N_M]` → clean id `N_M`, stripping the `^` that would
            // URL-encode into anchors as `%5E`). It is `guardDeck`-wrapped —
            // footnotes are deck-agnostic in v1, so it no-ops on a deck (mirrors
            // `markuaTocDemote`, the only other deck-agnostic Markua pass). Gated
            // by `markuaActive` like the rest: preset-off it is never registered,
            // so output stays byte-identical (NFR-001).
            remarkPlugins: [
              markuaNormalise,
              guardDeck(markuaFootnotes),
              markuaAttributes,
              markuaCallouts,
            ],
            // Rehype (user stage, before `rehypeImages`/`rehypeHeadingIds`).
            // `markuaFigure` is also registered BARE (D4/C-COMPOSE-05): it wraps
            // every slide body image as a `dk-figure` and skips only the
            // `data-deck-hero`-tagged synthesized title-slide hero via its own
            // structural discriminator. `markuaTocDemote` stays `guardDeck`-wrapped
            // (D6/C-COMPOSE-06): a deck has no on-page ToC, so the pass has
            // nothing to do there — this is the retained predicate/wrapper proof
            // (FR-006) for the one pass that stays deck-agnostic.
            rehypePlugins: [markuaFigure, guardDeck(markuaTocDemote)],
          },
        });
      },
    },
  };
}

// The route-shaping and draft-publication integrations live in `integrations/`;
// every public symbol is re-exported here so the `./config` entry is unchanged.
export {
  ROUTE_SHAPING_MODULE_ID,
  ROUTE_MIDDLEWARE,
  routeShapingSource,
  routeShapingIntegration,
  type RouteShapingOptions,
} from './integrations/route-shaping.js';
export { draftPublicationIntegration } from './integrations/draft-publication.js';
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
      // Reveal the current sidebar entry (FR-022): a classic inline script that
      // waits for `DOMContentLoaded`, so it runs after Starlight has restored
      // the sidebar's scroll position and only moves the sidebar pane.
      { tag: 'script', content: REVEAL_CURRENT_SCRIPT },
    ],
    customCss,
    ...overrides,
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
    // five carriers, in EVERY case (with or without a theme; ADR-0044 added
    // `Header` to the original four). The exactly-five invariant is established
    // HERE by config ordering — `components: carriers` is applied AFTER
    // `...overrides`, so a consumer's escape hatch cannot silently add a sixth
    // carrier override (a theme addresses the carriers' `dk:` slots, never this
    // map). `assert-chrome-artifacts.mjs` proves the four marker-emitting carriers
    // are live in the built output (`Header` emits no marker, by design); the
    // ordering below is what makes these the only five.
    components: carriers,
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

  return [
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
    ...(gherkinPages ? [gherkinIntegration(gherkinPages, docsDir, indexBasename, gherkinOpts?.results)] : []),
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
    // Always-on route-shaping seam (FR-011, FR-019..FR-023): serves the data the
    // toolkit's route middleware (registered in `starlightConfig` above) reads,
    // and prints the shaping warnings once when the build is done.
    // Always-on draft-publication seam (FR-013..FR-018): resolves
    // DK_PUBLISH_DRAFTS for this build and hands the draft slugs to the
    // build state below, so it sits BEFORE that integration.
    draftPublicationIntegration(routeShaping, buildState),
    routeShapingIntegration(routeShaping, buildState),
    // Always-on collapsible-TOC-rail client seam (FR-006, IC-04, D2): appended
    // UNCONDITIONALLY — the TOC rail is baseline chrome, so it is NOT gated on a
    // `DocKittyOptions` toggle. Its `injectScript('page', …)` island early-returns
    // on any TOC-free page, so a non-TOC route stays cost-free.
    tocRailIntegration,
    // Guarded slide-split remark transform (ADR-0012): a global markdown plugin
    // that only acts on `kind: Presentation` pages and no-ops everywhere else.
    deckSplitIntegration,
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
