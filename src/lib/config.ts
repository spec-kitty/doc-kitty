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
import { readmeToIndexId, sectionOf, type IndexBasenameOption } from './metadata.js';
import {
  loadSectionRegistry,
  registryToSidebar,
  sectionFeeds,
  feedsSurface,
} from './sections.js';
import { resolveTheme, DEFAULT_TOKEN_SHEET, type DocKittyTheme } from './theme.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';
import { docKittyFavicon, faviconHref } from './favicon.js';
import deckSplit from './remark/deck-split.js';
import diagramMeta from './remark/diagram-meta.js';
import diagramFigure from './rehype/diagram-figure.js';
import baseAbsoluteLinks from './rehype/base-absolute-links.js';
import remarkDirective from 'remark-directive';
import markuaNormalise from './remark/markua-normalise.js';
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
  const registry = loadSectionRegistry(docsRoot);
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
  const registry = loadSectionRegistry(path.resolve(process.cwd(), docsDir));
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
            // `.map(guardDeck)` makes EVERY member a deck no-op (C36a/C36f) —
            // never `deckSplit`/`remarkDirective` (out of scope).
            remarkPlugins: [markuaNormalise, markuaAttributes, markuaCallouts].map(guardDeck),
            // Rehype (user stage, before `rehypeImages`/`rehypeHeadingIds`).
            rehypePlugins: [markuaFigure, markuaTocDemote].map(guardDeck),
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
    // Guarded slide-split remark transform (ADR-0012): a global markdown plugin
    // that only acts on `kind: Presentation` pages and no-ops everywhere else.
    deckSplitIntegration,
    // Always-on authored-content base-prefix seam (review-cycle-1, FR-004/
    // SC-002): base-prefixes every root-absolute internal `<a href>` a rendered
    // markdown page emits. No-ops when no `base` is configured.
    baseAbsoluteLinksIntegration(base),
    // INV-1: draft pages are unpublished, so their URLs are excluded here.
    sitemap({ filter: sitemapDraftFilter(docsDir, base, indexBasename) }),
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
