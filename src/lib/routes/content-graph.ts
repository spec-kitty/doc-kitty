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
import type { GraphNode } from '../docs-index.js';
import { siteDraftRoutes } from '../integrations/shared.js';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import type { IndexBasenameOption } from '../metadata.js';
import { flattenText } from '../openapi/summary.mjs';
import { readPublication } from '../integrations/openapi-publish.js';
import { compareCodeUnit, routeOfSlug } from '../vocabulary-core.mjs';
import { absolute } from './shared.js';

export interface ContentGraphRouteOptions {
  /** The docs directory, relative to the project root (the integration's `docsDir`). */
  docsDir: string;
  indexBasename?: IndexBasenameOption;
}

/** Project each published version onto the existing resource-node shape (R11). */
function openApiGraphNodes(site: URL | undefined): GraphNode[] {
  const publication = readPublication(process.env[DK_OPENAPI_ENV]);
  if (!publication) return [];
  return publication.versions.map((version) => {
    const node: GraphNode = {
      id: `openapi:${version.label}`,
      kind: 'resource',
      title: flattenText(version.title),
      url: absolute(site, version.rawRoute),
    };
    return Object.assign(node, {
      resource: {
        sha256: version.sha256,
        released: version.released,
        overview: absolute(site, routeOfSlug(`${publication.section}/${version.label}`)),
      },
    });
  });
}

export function contentGraphRoute({ docsDir, indexBasename }: ContentGraphRouteOptions): APIRoute {
  return async ({ site }) => {
    const entries = await collectDocEntries();
    const catalog = await collectCitationCatalog();
    // The same walk the loader and the draft rule use, so ids and routes agree with both.
    const paths = walkMarkdownPaths(path.resolve(process.cwd(), docsDir));
    const graph = buildContentGraph(entries, {
      locations: locatePages(paths, indexBasename),
      draftRoutes: siteDraftRoutes(docsDir, indexBasename),
      catalog,
    });
    const openApiNodes = openApiGraphNodes(site);
    if (openApiNodes.length > 0) {
      graph.nodes = [...graph.nodes, ...openApiNodes].sort((a, b) => compareCodeUnit(a.id, b.id));
    }
    return new Response(`${JSON.stringify(graph, null, 2)}\n`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
