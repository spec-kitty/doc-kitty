/**
 * Shared plumbing for the Doc Kitty route handlers: read the `docs` collection
 * and adapt Astro entries to the framework-agnostic `DocEntry` shape used by
 * the metadata helpers.
 */
import { getCollection } from 'astro:content';
import type { DocEntry, DocKittyFrontmatter } from '../metadata.js';

/**
 * Load every docs entry as a `DocEntry`. With the README-as-index loader, an
 * entry's `id` is already the route slug ("" for the root, "how-to/pages", …).
 */
export async function collectDocEntries(): Promise<DocEntry[]> {
  const entries = await getCollection('docs');
  return entries.map((entry) => ({
    slug: entry.id,
    data: entry.data as unknown as DocKittyFrontmatter,
  }));
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
