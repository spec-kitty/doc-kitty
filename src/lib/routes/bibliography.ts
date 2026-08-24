/**
 * `bibliographyRoute` — the machine-readable citation catalog at
 * `/api/bibliography.json`. One JSON document projecting every `bibliography`
 * record by its stable id: `{ version, count, records: [{ id, title, url, … }] }`.
 *
 * Catalog records are NOT pages — they carry no `doc_status` — so this route is
 * emitted **outside** the publication gating that filters the docs feeds
 * (ADR-0018 / FR-015): every record ships, draft site or not.
 *
 * Mount as `src/pages/api/bibliography.json.ts`:
 *
 *   import { bibliographyRoute } from '@commondocs-kitty/toolkit/routes';
 *   export const GET = bibliographyRoute();
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { BibliographyRecord } from '../metadata.js';
import { projectBibliography } from '../catalog.js';

export interface BibliographyRouteOptions {
  /** Bump when the emitted shape changes so consumers can branch on it. */
  version?: string;
}

export function bibliographyRoute(options: BibliographyRouteOptions = {}): APIRoute {
  return async () => {
    const entries = await getCollection('bibliography');
    const records = entries.map((entry) => entry.data as BibliographyRecord);
    const body = projectBibliography(records, options.version);

    return new Response(JSON.stringify(body, null, 2), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
}
