/**
 * Shared plumbing for the Doc Kitty route handlers: read the `docs` collection
 * and adapt Astro entries to the framework-agnostic `DocEntry` shape used by
 * the metadata helpers.
 */
import path from 'node:path';
import process from 'node:process';
import { getCollection } from 'astro:content';
import type { DocEntry, DocKittyFrontmatter, DocsIndex, IndexBasenameOption } from '../metadata.js';
import { readmeToIndexId, slugFromEntryId } from '../metadata.js';
import { withBase } from '../with-base.js';

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
 * holds uniformly for the configured index basename(s) and plain `.md` files
 * because `readmeToIndexId` collapses each to the same slug the id already
 * carries — `indexBasename` MUST be the same option the loader that produced
 * `signal.id` was configured with, or the tail-strip math disagrees (FR-003).
 */
export function docsRootFromSignal(
  signal: DocsRootSignal,
  indexBasename?: IndexBasenameOption,
): string | null {
  if (!signal.filePath) return null;
  const slug = slugFromEntryId(signal.id);
  // Normalize any OS separators to '/' so readmeToIndexId's '/'-anchored regex
  // works, then strip the '<slug>' tail (plus its joining '/').
  const normalized = readmeToIndexId(signal.filePath.split(/[\\/]/).join('/'), {
    indexBasename,
  });
  const rootRel =
    slug === ''
      ? normalized
      : normalized.slice(0, Math.max(0, normalized.length - slug.length - 1));
  // rootRel === '' means the docs tree IS the project root (docsDir '.').
  return path.resolve(process.cwd(), rootRel || '.');
}

/**
 * The env var the integration publishes the authoritative docs root through
 * (F3/F5). Kept in sync with `config.ts`'s `DK_DOCS_ROOT_ENV` by VALUE, not by
 * import: `config.ts` runs in the `astro.config` surface where `astro:content`
 * (which this module statically imports) does not resolve, so a shared import
 * would drag that virtual module into the config graph. Two literals, one name.
 */
export const DK_DOCS_ROOT_ENV = 'DK_DOCS_ROOT';

/**
 * Choose the docs root from the two signals a route can see, purely (fs-free,
 * env-free) so the precedence is unit-testable without touching `process.env` or
 * Astro. Precedence: the integration-published absolute root wins; else the
 * content-layer `filePath` derivation (#22); else `null` for the caller's default.
 */
export function docsRootFromSignals(
  publishedRoot: string | undefined,
  entries: DocsRootSignal[],
  indexBasename?: IndexBasenameOption,
): string | null {
  if (publishedRoot && publishedRoot.trim() !== '') {
    return path.resolve(publishedRoot);
  }
  for (const entry of entries) {
    const root = docsRootFromSignal(entry, indexBasename);
    if (root) return root;
  }
  return null;
}

/**
 * Resolve the docs root the discovery routes read the section registry from.
 *
 * WHY (issue #22 → F3/F5): the sidebar registry AND the sitemap draft/feeds
 * filter (config.ts) resolve against the configurable `docsDir` option, but the
 * three routes historically derived the root independently. Under the documented
 * convention (`docsDir` == the loader `base`) the two agree; if a consumer sets
 * them differently the sitemap and the routes could filter against DIFFERENT
 * `sections.yaml` files — a silent cross-surface split (#22's own acknowledged
 * limitation).
 *
 * The fix: the integration KNOWS the resolved `docsDir` and PUBLISHES it as
 * `DK_DOCS_ROOT` (config.ts, at setup). This resolver PREFERS that published
 * truth, so both surfaces resolve the identical absolute root. When it is unset —
 * a standalone `APIRoute` rendered without the integration having run, or a route
 * unit test — we fall back verbatim to #22's content-layer derivation: the one
 * signal a route can otherwise trust is the content layer itself, since
 * `getCollection('docs')` honors the loader `base` and each glob-loaded entry
 * carries a `filePath` reflecting the ACTUAL on-disk content root. If no entry
 * exposes a `filePath` either (older loaders, an empty corpus), we fall back to
 * the convention default `<cwd>/docs` — byte-identical to the previous behavior
 * (no env + no filePath → `<cwd>/docs`).
 */
export async function docsRoot(indexBasename?: IndexBasenameOption): Promise<string> {
  const published = process.env[DK_DOCS_ROOT_ENV];
  const entries = (await getCollection('docs')) as unknown as DocsRootSignal[];
  return (
    docsRootFromSignals(published, entries, indexBasename) ?? path.join(process.cwd(), 'docs')
  );
}

/**
 * Resolve an absolute URL for a route against the configured site.
 *
 * WHY (pre-PR review, #61/#62 completeness gap): RSS, llms.txt, and the
 * agent-API JSON all compose their emitted absolute URLs through this one
 * function, but `path` here is deliberately the BASE-LESS `routeFor`/
 * `toAgentRecord` contract (see `metadata.ts`'s `routeFor` doc comment, which
 * names combining it with the base as "that consumer's own concern"). Without
 * this step, every emitted feed/index absolute URL 404'd on a based
 * deployment even though the on-page `<a href>`s (`withBase`, #61/C-002) and
 * the `<head>` feed-discovery links (`discoveryHead`, config.ts) were already
 * base-prefixed.
 *
 * Routes through `withBase` — the SAME single base-prefix helper every
 * component uses — so this seam cannot independently clone/drift from it
 * (DIRECTIVE_024/#61's own root cause). `withBase` is idempotent, so a path
 * that already carries the base (or carries no base when none is configured)
 * passes through unchanged.
 */
export function absolute(site: URL | undefined, path: string): string {
  const base = site ?? new URL('http://localhost:4321');
  return new URL(withBase(path), base).href;
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
