/**
 * Shared plumbing for the Doc Kitty route handlers: read the `docs` collection
 * and adapt Astro entries to the framework-agnostic `DocEntry` shape used by
 * the metadata helpers.
 */
import { getCollection } from 'astro:content';
import type { DocEntry, DocKittyFrontmatter, DocsIndex } from '../metadata.js';
import { slugFromEntryId } from '../metadata.js';

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
