/**
 * Starlight configuration preset for Doc Kitty.
 *
 * `defineDocKittyIntegrations()` returns the Astro integrations array a docs
 * site needs: Starlight (themed, with the convention's head links and the four
 * chrome carriers) plus `@astrojs/sitemap` (with the draft-exclusion filter). A
 * site's `astro.config.mjs` spreads it and can override anything.
 *
 * Signature stays `(options)` in M1 — no `theme` parameter, no default→brand→
 * consumer merge, no virtual manifest. Those are Mission M2 (ADR-0013).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import matter from 'gray-matter';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import type { StarlightUserConfig } from '@astrojs/starlight/types';
import { readmeToIndexId } from './metadata.js';

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
  /** Escape hatch: deep overrides merged over the Starlight defaults. */
  starlight?: Partial<StarlightUserConfig>;
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
 * Build the `@astrojs/sitemap` `filter`. It receives each candidate page's full
 * absolute URL; drop it when its path ends with a draft route. Suffix matching
 * is base-agnostic (works whether or not the site sets an Astro `base`) and safe
 * because doc route slugs are unique whole paths from the docs root.
 */
function sitemapDraftFilter(docsDir: string): (page: string) => boolean {
  const routes = draftRoutes(docsDir);
  return (page: string): boolean => {
    let pathname: string;
    try {
      pathname = new URL(page).pathname;
    } catch {
      pathname = page;
    }
    const normalized = pathname.endsWith('/') ? pathname : `${pathname}/`;
    for (const route of routes) {
      if (normalized.endsWith(route)) return false;
    }
    return true;
  };
}

export function defineDocKittyIntegrations(options: DocKittyOptions) {
  const {
    title,
    description,
    social,
    sidebar,
    docsDir = 'docs',
    starlight: overrides,
  } = options;

  const starlightConfig: StarlightUserConfig = {
    title,
    ...(description ? { description } : {}),
    ...(social ? { social } : {}),
    ...(sidebar ? { sidebar } : {}),
    head: discoveryHead,
    components: carriers,
    // Token sheet FIRST (C-007, tokens-before-overrides): it declares the
    // complete --dk-* catalog + the --dk-*→--sl-* bridge. Any future override
    // sheet (M2 brand/consumer) is appended AFTER it so it wins by source order.
    customCss: ['@commondocs-kitty/toolkit/styles/theme.css'],
    ...overrides,
  };

  return [
    starlight(starlightConfig),
    // INV-1: draft pages are unpublished, so their URLs are excluded here.
    sitemap({ filter: sitemapDraftFilter(docsDir) }),
  ];
}
