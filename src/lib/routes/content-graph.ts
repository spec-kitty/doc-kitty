/**
 * `contentGraphRoute` -- the content graph at `/api/content-graph.json` (#176,
 * FR-010): every published page, persona, catalog entry and external resource as a
 * node, and the frontmatter relations between them as edges. The relations come
 * from the same resolvers as the rendered Related / Audience / External-references
 * blocks (see `buildContentGraph`), so the graph cannot disagree with the pages.
 *
 * The `doc-kitty:content-graph` integration injects this route on every site; a
 * site mounts nothing. Drafts are left out whatever `DK_PUBLISH_DRAFTS` says.
 *
 * It also loads the measures catalog of `docsDir` (ADR-0080): the consumer's
 * `_meta/measures.yaml`, else the shipped default. Because every site serves this
 * route, an unknown measure id or a malformed catalog fails every build.
 */
import process from 'node:process';
import type { APIRoute } from 'astro';
import type { GraphNode } from '../docs-index.js';
import { DK_OPENAPI_ENV } from '../internal-env.mjs';
import type { IndexBasenameOption } from '../metadata.js';
import { flattenText } from '../openapi/summary.mjs';
import { readPublication } from '../openapi/publication.js';
import { compareCodeUnit, routeOfSlug } from '../vocabulary-core.mjs';
import { absolute } from './shared.js';
import { siteContentGraph } from './site-graph.js';

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
    return {
      id: `openapi:${version.label}`,
      kind: 'resource',
      title: flattenText(version.title),
      url: absolute(site, version.rawRoute),
      openapi: {
        sha256: version.sha256,
        released: version.released,
        overview: absolute(site, routeOfSlug(`${publication.section}/${version.label}`)),
      },
    };
  });
}

export function contentGraphRoute({ docsDir, indexBasename }: ContentGraphRouteOptions): APIRoute {
  return async ({ site }) => {
    // The shared graph (one build per site build, #401): never mutated here, so
    // the evidence-index route reads it without the OpenAPI resource nodes.
    const { graph: shared } = await siteContentGraph({ docsDir, indexBasename });
    const openApiNodes = openApiGraphNodes(site);
    const graph =
      openApiNodes.length > 0
        ? { ...shared, nodes: [...shared.nodes, ...openApiNodes].sort((a, b) => compareCodeUnit(a.id, b.id)) }
        : shared;
    return new Response(`${JSON.stringify(graph, null, 2)}\n`, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
