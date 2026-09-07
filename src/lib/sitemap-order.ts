// Deterministic sitemap ordering (#87, FR-001/NFR-001/NFR-002).
//
// `@astrojs/sitemap` serializes pages in Astro's route-generation order, which
// for Starlight docs routes is the concurrent glob loader's completion order
// (the #85 root cause, unreachable from `collectDocEntries`). That makes the
// emitted `sitemap-0.xml` order-nondeterministic: two clean builds of the same
// tree differ. This module closes the last hole in the corpus byte-oracle with
// a toolkit-owned `astro:build:done` step that rewrites each built
// `sitemap-*.xml` with its `<url>` blocks sorted by `<loc>` (code-unit
// ascending), byte-preserving everything else.
//
// It mirrors the two dist-rewriting `astro:build:done` integrations the toolkit
// already owns (`favicon.ts`, `manifest.ts`): resolve `fileURLToPath(dir)`,
// read, rewrite in place. It is registered AFTER the `sitemap(...)` entry in
// `defineDocKittyIntegrations` so the page files already exist when the hook
// runs. The `sitemap-index.xml` is left untouched: it references the page files
// by name, which do not change.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { compareCodeUnit } from './vocabulary-core.mjs';

// The emitted sitemap is single-line with no inter-tag whitespace; each `<url>`
// carries only `<loc>`. We still parse defensively: match whole `<url>…</url>`
// blocks so any extra children (e.g. `<lastmod>`) ride along with their block,
// and key each block on its `<loc>` text.
const URL_BLOCK = /<url>[\s\S]*?<\/url>/g;
const LOC_KEY = /<loc>([\s\S]*?)<\/loc>/;

/**
 * Reorder the whole `<url>…</url>` blocks of a sitemap by their `<loc>` text,
 * code-unit ascending, preserving the XML prolog, the `<urlset …>` open tag
 * with all its `xmlns:*` attributes, the closing tag, and every byte OUTSIDE
 * the contiguous `<url>` run (the emitted sitemap has no inter-`<url>`
 * whitespace, so re-joining the reordered blocks reproduces that region
 * exactly; this helper is not intended for pretty-printed XML). Idempotent:
 * sorting an already-sorted sitemap returns it unchanged.
 *
 * A sitemap-index file (or any XML with no `<url>` blocks) is returned as-is.
 */
export function sortSitemapXml(xml: string): string {
  const blocks = xml.match(URL_BLOCK);
  if (!blocks || blocks.length < 2) return xml;

  // Everything before the first `<url>` (prolog + `<urlset …>`) and after the
  // last `</url>` (the closing tag) is preserved verbatim. The blocks are
  // contiguous in the emitted XML, so re-joining them with no separator
  // reproduces the original byte layout for that region.
  const firstStart = xml.indexOf(blocks[0]);
  const lastBlock = blocks[blocks.length - 1];
  const lastEnd = xml.lastIndexOf(lastBlock) + lastBlock.length;
  const prefix = xml.slice(0, firstStart);
  const suffix = xml.slice(lastEnd);

  const keyOf = (block: string): string => {
    const m = block.match(LOC_KEY);
    return m ? m[1] : '';
  };

  const sorted = [...blocks].sort((a, b) => compareCodeUnit(keyOf(a), keyOf(b)));
  return prefix + sorted.join('') + suffix;
}

/**
 * The toolkit `AstroIntegration` that makes the built sitemap reproducible.
 * Its `astro:build:done` hook sorts every `sitemap-N.xml` page file present
 * under `dist/` (never the `sitemap-index.xml`, which references those files by
 * unchanged name) with {@link sortSitemapXml}.
 */
export default function sitemapOrderIntegration(): AstroIntegration {
  return {
    name: 'doc-kitty:sitemap-order',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        // Key off the files actually present: handles pagination
        // (`sitemap-0.xml`, `sitemap-1.xml`, …) and excludes `sitemap-index.xml`.
        const pages = readdirSync(distDir).filter((name) => /^sitemap-\d+\.xml$/.test(name));
        for (const name of pages) {
          const file = path.join(distDir, name);
          const original = readFileSync(file, 'utf8');
          const ordered = sortSitemapXml(original);
          if (ordered !== original) {
            writeFileSync(file, ordered);
            logger.info(`sorted <url> entries in ${name} by <loc> (deterministic sitemap)`);
          }
        }
      },
    },
  };
}
