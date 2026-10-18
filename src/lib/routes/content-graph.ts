/**
 * `contentGraphRoute` -- the content graph at `/api/content-graph.json` (#176,
 * FR-010): every published page, persona, catalog entry and external resource as a
 * node, and the frontmatter relations between them as edges. The relations come
 * from the same resolvers as the rendered Related / Audience / External-references
 * blocks (see `buildContentGraph`), so the graph cannot disagree with the pages.
 *
 * The `doc-kitty:content-graph` integration injects this route on every site; a
 * site mounts nothing. Drafts are left out whatever `DK_PUBLISH_DRAFTS` says.
 */
import path from 'node:path';
import process from 'node:process';
import type { APIRoute } from 'astro';
import { walkMarkdownPaths } from '../docs-walk.mjs';
import { buildContentGraph, collectCitationCatalog, collectDocEntries, locatePages } from '../docs-index.js';
import { siteDraftRoutes } from '../integrations/shared.js';
import type { IndexBasenameOption } from '../metadata.js';

export interface ContentGraphRouteOptions {
  /** The docs directory, relative to the project root (the integration's `docsDir`). */
  docsDir: string;
  indexBasename?: IndexBasenameOption;
}

export function contentGraphRoute({ docsDir, indexBasename }: ContentGraphRouteOptions): APIRoute {
  return async () => {
    const entries = await collectDocEntries();
    const catalog = await collectCitationCatalog();
    // The same walk the loader and the draft rule use, so ids and routes agree with both.
    const paths = walkMarkdownPaths(path.resolve(process.cwd(), docsDir));
    const graph = buildContentGraph(entries, {
      locations: locatePages(paths, indexBasename),
      draftRoutes: siteDraftRoutes(docsDir, indexBasename),
      catalog,
    });
    return new Response(`${JSON.stringify(graph, null, 2)}\n`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
