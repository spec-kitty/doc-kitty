/**
 * Markdown-pipeline integrations: the always-on / hoisted remark and rehype
 * stages (deck split, relative-link + base-absolute-link rewriting, the single
 * `remark-directive` owner), and the processor pin that keeps that seam alive
 * on Astro 7. They share one seam (`markdown.remarkPlugins` / `rehypePlugins`
 * via `updateConfig`), so they live together.
 *
 * Imports nothing from `config.ts`.
 */
import path from 'node:path';
import process from 'node:process';
import type { AstroIntegration } from 'astro';
import remarkDirective from 'remark-directive';
import { unified } from '@astrojs/markdown-remark';
import type { IndexBasenameOption } from '../metadata.js';
import { buildRouteTable, formatRouteCollisions } from '../vocabulary-core.mjs';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { publishDraftsInForce, unpublishedDraftPaths } from '../draft-publication.mjs';
import deckSplit from '../remark/deck-split.js';
import relativeMdLinks from '../remark/relative-md-links.js';
import baseAbsoluteLinks from '../rehype/base-absolute-links.js';
import { normalizeBasePrefix } from './shared.js';

/**
 * Register the guarded slide-split remark transform globally (ADR-0012, FR-001).
 * This is NET-NEW markdown plumbing — the preset had no `remarkPlugins` seam
 * before decks. `updateConfig` APPENDS to `markdown.remarkPlugins`, so the plugin
 * lands AFTER Astro's built-in remark-gfm (headings + thematic breaks already
 * parsed) and before `mdast-util-to-hast`. The plugin itself is a strict no-op on
 * any page whose `kind !== 'Presentation'` (its frontmatter guard), so this
 * global registration leaves every documentation page byte-identical (C-005).
 */
export const deckSplitIntegration: AstroIntegration = {
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
export function baseAbsoluteLinksIntegration(
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
export const directiveIntegration: AstroIntegration = {
  name: 'doc-kitty:remark-directive',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ markdown: { remarkPlugins: [remarkDirective] } });
    },
  },
};

/**
 * Pin Astro's Markdown processor to `unified()` (ADR-0060, #119).
 *
 * Astro 7 renders Markdown with Sätteri by default, and Sätteri drops every
 * remark/rehype plugin with a warning. Astro folds the legacy
 * `markdown.remarkPlugins` / `rehypePlugins` keys into the processor after each
 * integration's `astro:config:setup`, in integration order, but only while the
 * processor is `unified()`. So this integration must run FIRST: before any
 * DocKitty stage, and before Starlight, appends a plugin. Plugin registration
 * itself is unchanged (every stage still appends through `updateConfig`), so the
 * resolved plugin order is the one the comments in `config.ts` describe.
 */
export const markdownProcessorIntegration: AstroIntegration = {
  name: 'doc-kitty:markdown-processor',
  hooks: {
    'astro:config:setup': ({ updateConfig }) => {
      updateConfig({ markdown: { processor: unified() } });
    },
  },
};
