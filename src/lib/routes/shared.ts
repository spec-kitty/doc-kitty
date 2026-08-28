/**
 * Shared plumbing for the Doc Kitty route handlers: read the `docs` collection
 * and adapt Astro entries to the framework-agnostic `DocEntry` shape used by
 * the metadata helpers.
 */
import path from 'node:path';
import process from 'node:process';
import { getCollection } from 'astro:content';
import type { DocEntry, DocKittyFrontmatter, DocsIndex } from '../metadata.js';
import { readmeToIndexId, slugFromEntryId } from '../metadata.js';

/**
 * Load every docs entry as a `DocEntry`. With the README-as-index loader, an
 * entry's `id` is already the route slug ("" for the root, "how-to/pages", …).
 */
export async function collectDocEntries(): Promise<DocEntry[]> {
  const entries = await getCollection('docs');
  return entries.map((entry) => ({
    slug: slugFromEntryId(entry.id),
    data: entry.data as unknown as DocKittyFrontmatter,
  }));
}

/**
 * Flatten `DocEntry`s into the `DocsIndex` shape the resolvers consume: a map
 * keyed by route slug whose values are `{ slug, title, kind, doc_status,
 * description }`. Built from the FULL collection (not the discoverable subset)
 * so a `related` ref to a non-discoverable page still resolves — a dangling ref
 * is build-fatal by design (FR-004), never silently dropped.
 */
export function buildDocsIndex(entries: DocEntry[]): DocsIndex {
  const index: DocsIndex = {};
  for (const { slug, data } of entries) {
    index[slug] = {
      slug,
      title: data.title,
      kind: data.kind ?? '',
      doc_status: data.doc_status ?? 'draft',
      ...(data.description !== undefined ? { description: data.description } : {}),
    };
  }
  return index;
}

/**
 * The minimal content-layer entry shape the docs-root resolver reads: the store
 * `id` (→ route slug) and the glob loader's `filePath` (relative to the project
 * root). Kept local so the pure derivation is testable without pulling in Astro.
 */
export interface DocsRootSignal {
  id: string;
  filePath?: string;
}

/**
 * Derive the absolute docs root from ONE content entry's `filePath` + store id,
 * applying the same README-as-index rule the loader uses. Pure and fs-free, so
 * it is unit-testable without Astro. Returns `null` when the entry carries no
 * `filePath` signal (e.g. a non-glob loader), letting the caller fall back.
 *
 * The store id maps to the route slug (`slugFromEntryId`), and `filePath` is
 * `<docsRoot>/<original path>` — so `readmeToIndexId(filePath)` yields
 * `<docsRoot>/<slug>`, and stripping the slug tail leaves the docs root. This
 * holds uniformly for `README.md` (index) and plain `.md` files because
 * `readmeToIndexId` collapses both to the same slug the id already carries.
 */
export function docsRootFromSignal(signal: DocsRootSignal): string | null {
  if (!signal.filePath) return null;
  const slug = slugFromEntryId(signal.id);
  // Normalize any OS separators to '/' so readmeToIndexId's '/'-anchored regex
  // works, then strip the '<slug>' tail (plus its joining '/').
  const normalized = readmeToIndexId(signal.filePath.split(/[\\/]/).join('/'));
  const rootRel =
    slug === ''
      ? normalized
      : normalized.slice(0, Math.max(0, normalized.length - slug.length - 1));
  // rootRel === '' means the docs tree IS the project root (docsDir '.').
  return path.resolve(process.cwd(), rootRel || '.');
}

/**
 * Resolve the docs root the discovery routes read the section registry from.
 *
 * WHY (issue #22): the sidebar registry (config.ts) is resolved against the
 * configurable `docsDir` option, but the three routes historically hardcoded
 * `path.join(process.cwd(), 'docs')`. A consumer with a non-default docs
 * directory therefore got a registry-driven SIDEBAR but DEFAULT-ordered/labeled
 * llms.txt/RSS/agent-index — the registry authority split across surfaces.
 *
 * A standalone `APIRoute` cannot read `docsDir`: it is passed to
 * `defineDocKittyIntegrations` in `astro.config`, and the loader's content root
 * is a SEPARATE `base` passed to `docKittyDocsLoader` in `content.config` — two
 * independent config surfaces with NO shared runtime handle (no env var, no
 * virtual module the integration exports for a route to read). The one signal a
 * route can trust is the content layer itself: `getCollection('docs')` already
 * honors the loader `base`, and each glob-loaded entry carries a `filePath`
 * reflecting the ACTUAL on-disk content root. Deriving the root from that keeps
 * the registry read from the SAME directory the content came from — correct for
 * any custom docs directory (a consumer sets loader `base` and `docsDir` to the
 * same folder by convention) with NO change to config.ts.
 *
 * CONSTRAINT: fully unifying `docsDir` and the loader `base` behind ONE option
 * would require a config.ts change (out of this op's lane); this resolver is the
 * cleanest correct fix that stays in the routes. If no entry exposes a
 * `filePath` (older loaders, an empty corpus), we fall back to the convention
 * default `<cwd>/docs` — byte-identical to the previous hardcoded behavior.
 */
export async function docsRoot(): Promise<string> {
  const entries = (await getCollection('docs')) as unknown as DocsRootSignal[];
  for (const entry of entries) {
    const root = docsRootFromSignal(entry);
    if (root) return root;
  }
  return path.join(process.cwd(), 'docs');
}

/** Resolve an absolute URL for a route against the configured site. */
export function absolute(site: URL | undefined, path: string): string {
  const base = site ?? new URL('http://localhost:4321');
  return new URL(path, base).href;
}

/** Minimal XML text escaping for feed content. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
