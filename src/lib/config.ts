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
import matter from 'gray-matter';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { readmeToIndexId } from './metadata.js';
import { resolveTheme, type DocKittyTheme } from './theme.js';
import { docKittyManifest, THEME_CSS_MODULE_ID } from './manifest.js';

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
}

/** `<head>` links advertising the feeds and agent-API on every page. */
const discoveryHead: NonNullable<StarlightUserConfig['head']> = [
  {
    tag: 'link',
    attrs: {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: 'RSS',
      href: '/rss.xml',
    },
  },
  // Advertise the agent index so crawlers/agents can find it from any page.
  {
    tag: 'link',
    attrs: { rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: '/llms.txt' },
  },
];

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

export function defineDocKittyIntegrations(options: DocKittyOptions) {
  const {
    title,
    description,
    social,
    sidebar,
    docsDir = 'docs',
    base = '/',
    theme,
    starlight: overrides,
  } = options;

  // Resolve the default → brand → consumer merge (WP01). `undefined` yields the
  // byte-compatible M1 path: `generated === false`, `customCss` the single static
  // entry, the Default catalog. Any theme yields `generated === true`.
  const resolved = resolveTheme(theme);
  const { assets } = resolved;

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

  const starlightConfig: StarlightUserConfig = {
    title,
    ...(description ? { description } : {}),
    ...(social ? { social } : {}),
    ...(sidebar ? { sidebar } : {}),
    // Theme assets ride Starlight-native config (ADR-0015 decision 4/5): no
    // Header/SiteTitle override, no components-map expansion. A consumer's own
    // `starlight` escape hatch still wins (spread after these).
    ...(assets.logo ? { logo: { src: assets.logo } } : {}),
    ...(assets.favicon ? { favicon: assets.favicon } : {}),
    head: [...discoveryHead, ...fontHead],
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

  return [
    starlight(starlightConfig),
    // INV-1: draft pages are unpublished, so their URLs are excluded here.
    sitemap({ filter: sitemapDraftFilter(docsDir, base) }),
    // Transport the merged `kind → layout` + `dk:slot → component` maps to the
    // carriers as `virtual:doc-kitty/manifest` (synchronous `resolveLayout`, no
    // dynamic import — C-006). Present in EVERY build: `kind-layouts.ts` imports
    // the manifest even on the no-theme path (Hub registered, else Default).
    docKittyManifest(resolved),
  ];
}
