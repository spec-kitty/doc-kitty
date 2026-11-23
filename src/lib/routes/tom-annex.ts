/**
 * `tomAnnexRoute` -- the evidence index at `/api/tom-annex.json` (#401).
 *
 * **Evidence index, not the contractual annex.** For each measure of the
 * effective catalog it lists the published pages that evidence it, grouped by
 * scope, and the measures no page evidences (ADR-0080). Not legal advice.
 *
 * The `doc-kitty:tom-annex` integration injects this route only on a site with
 * a published classified page (FR-012). It reads the shared site graph (one
 * build per site build, C-004) and serialises it with the core, so the bytes
 * are the same wherever the index is produced.
 */
import type { APIRoute } from 'astro';
import type { IndexBasenameOption } from '../metadata.js';
import { buildTomAnnex, serializeTomAnnex } from '../tom-annex/core.mjs';
import { siteContentGraph } from './site-graph.js';

export interface TomAnnexRouteOptions {
  /** The docs directory, relative to the project root (the integration's `docsDir`). */
  docsDir: string;
  indexBasename?: IndexBasenameOption;
}

export function tomAnnexRoute({ docsDir, indexBasename }: TomAnnexRouteOptions): APIRoute {
  return async ({ site }) => {
    const { graph, measures, docsRoot } = await siteContentGraph({ docsDir, indexBasename });
    // The mount was decided by a frontmatter scan at config time (scan.mjs). A
    // mounted route with nothing to index means the two disagree: fail loudly
    // rather than publish an empty index.
    if (!graph.edges.some((edge) => edge.rel === 'classified-as')) {
      throw new Error(
        `[dk-tom-annex] the route is mounted but the content graph has no classified-as edge: the config-time scan and the graph disagree (${docsRoot})`,
      );
    }
    const annex = buildTomAnnex(graph, measures, { site, base: import.meta.env.BASE_URL });
    return new Response(serializeTomAnnex(annex), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
