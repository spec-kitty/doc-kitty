/**
 * `siteContentGraph` -- the content graph of a site, built once per site build
 * and shared by the routes that read it (#401, C-004, NFR-002):
 * `/api/content-graph.json` and `/api/tom-annex.json` (the evidence index).
 *
 * It is exactly the graph the content-graph route has always built: every
 * published page, persona, catalog entry and external resource, and the
 * frontmatter relations between them, with drafts left out whatever
 * `DK_PUBLISH_DRAFTS` says (`buildContentGraph`). The content-graph route adds
 * the OpenAPI resource nodes on its own copy; callers never mutate the shared
 * graph.
 *
 * In a build the promise is memoised per docs root and index basename, so
 * concurrent route renders share one build. In dev it is rebuilt on every
 * call, so an edit is never served stale.
 */
import path from 'node:path';
import process from 'node:process';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { buildContentGraph, collectCitationCatalog, collectDocEntries, locatePages } from '../docs-index.js';
import type { ContentGraph, PageLocation } from '../docs-index.js';
import { siteDraftRoutes } from '../integrations/shared.js';
import { loadMeasuresCatalog } from '../measures-loader.mjs';
import type { MeasureRecord } from '../measures-core.mjs';
import type { IndexBasenameOption } from '../metadata.js';

export interface SiteGraphOptions {
  /** The docs directory, relative to the project root (the integration's `docsDir`). */
  docsDir: string;
  indexBasename?: IndexBasenameOption;
}

export interface SiteGraph {
  /** The content graph. Shared: treat it as read-only. */
  graph: ContentGraph;
  /** The effective measures catalog the graph was resolved against (ADR-0080). */
  measures: {
    index: ReadonlyMap<string, MeasureRecord>;
    records: readonly MeasureRecord[];
    source: string;
    isDefault: boolean;
  };
  /** The absolute docs root. */
  docsRoot: string;
  /** Every page's id, route and source file, keyed by route slug (`locatePages`). */
  locations: Readonly<Record<string, PageLocation>>;
}

const memo = new Map<string, Promise<SiteGraph>>();

async function build({ docsDir, indexBasename }: SiteGraphOptions): Promise<SiteGraph> {
  const entries = await collectDocEntries();
  const catalog = await collectCitationCatalog();
  const docsRoot = path.resolve(process.cwd(), docsDir);
  const { index, records, source, isDefault } = loadMeasuresCatalog(docsRoot);
  // The same walk the loader and the draft rule use, so ids and routes agree with both.
  const locations = locatePages(walkMarkdownPaths(docsRoot), indexBasename);
  const graph = buildContentGraph(entries, {
    locations,
    draftRoutes: siteDraftRoutes(docsDir, indexBasename),
    catalog,
    measures: { index, source },
  });
  return { graph, measures: { index, records, source, isDefault }, docsRoot, locations };
}

/**
 * The site's content graph: built once per site build, rebuilt on every call
 * in dev.
 */
export function siteContentGraph(options: SiteGraphOptions): Promise<SiteGraph> {
  // The exact `import.meta.env.DEV` form: Vite rewrites only this spelling (as `with-base.ts` relies on).
  if (import.meta.env.DEV) return build(options);
  const key = `${path.resolve(process.cwd(), options.docsDir)}\0${options.indexBasename ?? ''}`;
  let pending = memo.get(key);
  if (!pending) {
    pending = build(options);
    memo.set(key, pending);
    // A failed build must not be served from the memo on the next call.
    pending.catch(() => memo.delete(key));
  }
  return pending;
}

/** Forget every memoised graph (tests that build several sites in one process). */
export function resetSiteContentGraph(): void {
  memo.clear();
}
