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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import matter from 'gray-matter';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import type { AstroIntegration } from 'astro';
import { readmeToIndexId, sectionOf, type IndexBasenameOption } from './metadata.js';
import {
  resolveSectionRegistry,
  registryToSidebar,
  sectionFeeds,
  feedsSurface,
} from './sections.js';
import { resolveTheme, DEFAULT_TOKEN_SHEET, type DocKittyTheme } from './theme.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';
import { docKittyFavicon, faviconHref } from './favicon.js';
import sitemapOrderIntegration from './sitemap-order.js';
import { PRE_PAINT_SCRIPT } from './toc-rail/pre-paint.js';
import deckSplit from './remark/deck-split.js';
import diagramMeta from './remark/diagram-meta.js';
import plantumlMeta from './remark/plantuml-meta.js';
import diagramFigure from './rehype/diagram-figure.js';
import { withMermaidDiskCache, beoeDiskCache, BEOE_CACHE_DIR } from './diagram/beoe-cache.js';
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
export const DK_DOCS_ROOT_ENV = 'DK_DOCS_ROOT';

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
   * The section-index basename(s) (FR-001/FR-002, D-01). Defaults to
   * `"README"` only — byte-identical to today's behaviour (NFR-003). MUST
   * match the `indexBasename` passed to `docKittyDocsLoader` in
   * `content.config.ts` (the same invariant `docsDir` already carries): the
   * sitemap draft filter here and the content loader there derive routes
   * independently, and a mismatch would make a drafted `index.md` page's URL
   * disagree between the two.
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
function draftRoutes(docsDir: string, indexBasename?: IndexBasenameOption): Set<string> {
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
      // Same basename config as the content loader (FR-003) — an `index.md`
      // draft under an opted-in basename must exclude the SAME route the
      // loader would give it a slug for.
      const slug = readmeToIndexId(rel, { indexBasename });
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
  const groups = registryToSidebar(registry, topLevelContentDirs(docsRoot), {
    directoryPrefix: docsDir,
  });
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
 *      the pre-feeds sitemap (the example corpus declares no `feeds`, so this gate
 *      drops nothing there).
 *
 * Exported so the composed draft+feeds gate is unit-testable without spinning up
 * the whole Astro integrations array.
 */
export function sitemapDraftFilter(
  docsDir: string,
  base: string,
  indexBasename?: IndexBasenameOption,
): (page: string) => boolean {
  const routes = draftRoutes(docsDir, indexBasename);
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
function baseAbsoluteLinksIntegration(base: string): AstroIntegration {
  return {
    name: 'doc-kitty:base-absolute-links',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          markdown: {
            rehypePlugins: [[baseAbsoluteLinks, { base: normalizeBasePrefix(base) }]],
          },
        });
      },
    },
  };
}

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

        // PlantUML (build-only, #13 WP02): resolve `astro-plantuml` (exports-only
        // package) and build its remark plugin against the SELF-HOSTED server
        // (NEVER plantuml.com — `resolvePlantumlServerUrl` throws on a public
        // endpoint, C-001). It renders ```plantuml → a raw `<figure><svg>` HTML
        // node; `plantumlMeta` (remark, BEFORE it) parses the `'`-metadata and
        // injects the skinparam sentinel preamble, and the SAME
        // `sentinelThemeRewrite` + `diagramFigure` rehype passes below theme and
        // wrap its SVG (the rehype array is unchanged — both now handle the
        // PlantUML raw node too). Loaded via `loadBeoe`, so a client / diagrams-
        // off build never pulls `astro-plantuml` (or its `axios` dep) — C-004.
        const plantumlUrl = resolvePlantumlEntry(import.meta.url);
        // `createRemarkPlugin` returns a unified remark plugin (a `Plugin<[],
        // Root>` factory); type its result as our own `diagramMeta` factory so it
        // slots into `remarkPlugins` without a bare `unknown` (which the markdown
        // config's plugin-tuple union rejects).
        const { createRemarkPlugin } = (await loadBeoe(plantumlUrl)) as {
          createRemarkPlugin: (opts: unknown) => typeof diagramMeta;
        };
        const plantumlRemark = createRemarkPlugin({
          serverUrl: resolvePlantumlServerUrl(),
          format: 'svg',
          language: 'plantuml',
          addWrapperClasses: true,
        });

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

      // CLIENT mode (FR-004, NFR-002): the pre-#13 path, byte-identical — the
      // `diagramMeta` + `mermaidFenceTransform` remark stage, `diagramFigure`
      // rehype wrap, and the single client render owner injected page-wide.
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
 * than overriding a `components` carrier (the four-carrier lock, DIRECTIVE_001).
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
function glossaryIntegration(docsDir: string, base: string): AstroIntegration {
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
    markua = false,
    indexBasename,
    starlight: overrides,
  } = options;

  // Publish the ONE authoritative docs root (F3/F5). This is the exact value the
  // sitemap draft filter resolves internally (`path.resolve(process.cwd(),
  // docsDir)` in both `draftRoutes` and its registry read), so writing it here
  // guarantees the standalone routes' `docsRoot()` reads the section registry from
  // the identical absolute path — not a separately-derived one. Set unconditionally
  // so the signal always reflects the docsDir THIS integration was configured with
  // (a single-site build calls this once; a later call with a different docsDir
  // should win). Absent this call (standalone route render, route unit tests) the
  // env stays unset and `docsRoot()` keeps #22's content-layer fallback verbatim.
  process.env[DK_DOCS_ROOT_ENV] = path.resolve(process.cwd(), docsDir);

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
    ],
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
    ...(glossaryActive ? [glossaryIntegration(docsDir, base)] : []),
    starlight(starlightConfig),
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
    baseAbsoluteLinksIntegration(base),
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
