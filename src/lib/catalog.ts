/**
 * Framework-agnostic citation-catalog model for the
 * **Common Docs — Kitty Variation**.
 *
 * WP01 (`./metadata.ts`) owns the pure resolution primitive `resolveCitation`
 * and the record types. This module adds the thin, Astro-free layer a route (or
 * a test) needs on top of it: turn loaded record *arrays* into the id-keyed
 * {@link CitationCatalog} `resolveCitation` expects, and project the
 * bibliography into the stable shape `/api/bibliography.json` emits.
 *
 * Free of `astro:content` / Starlight imports on purpose: the route reads the
 * collections and hands the record arrays in, so this stays unit-testable in
 * bare Node (`src/tests/catalog.test.ts`) and re-usable by any consumer.
 */
import {
  resolveCitation,
  type BibliographyRecord,
  type ToolRecord,
  type CitationCatalog,
} from './metadata.js';

// Re-export the WP01 resolver + shapes so a consumer imports the whole catalog
// surface from one module (the route wants both `buildCatalog` and the resolver).
export { resolveCitation };
export type {
  BibliographyRecord,
  ToolRecord,
  CitationCatalog,
  ExternalReference,
  ResolvedCitation,
} from './metadata.js';

/**
 * Index a record list by its stable `id`, rejecting duplicates. A duplicate id
 * is fatal: two records sharing a citation key make resolution ambiguous, which
 * the standalone `validate-catalog.mjs` gate reports the same way (parity).
 */
function indexById<T extends { id: string }>(records: readonly T[], kind: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const record of records) {
    if (record.id in out) {
      throw new Error(`buildCatalog: duplicate ${kind} id "${record.id}" (ids must be unique).`);
    }
    out[record.id] = record;
  }
  return out;
}

/**
 * Assemble the id-keyed {@link CitationCatalog} `resolveCitation` consumes from
 * the two loaded record arrays. A route calls this once per request with the
 * results of `getCollection('bibliography')` / `getCollection('tools')`.
 */
export function buildCatalog(
  bibliography: readonly BibliographyRecord[],
  tools: readonly ToolRecord[],
): CitationCatalog {
  return {
    bibliography: indexById(bibliography, 'bibliography'),
    tools: indexById(tools, 'tool'),
  };
}

/** Current schema version of the `/api/bibliography.json` projection. */
export const BIBLIOGRAPHY_API_VERSION = '1';

/** The `/api/bibliography.json` body: a stable, un-gated bibliography projection. */
export interface BibliographyProjection {
  version: string;
  count: number;
  records: BibliographyRecord[];
}

/**
 * Project a bibliography record list into the endpoint body. Records are
 * ordered by stable `id` so the emitted JSON is deterministic regardless of the
 * collection's load order. Catalog records carry no `doc_status`, so this is
 * emitted *outside* the page-publication gating (ADR-0018 / FR-015).
 */
export function projectBibliography(
  records: readonly BibliographyRecord[],
  version: string = BIBLIOGRAPHY_API_VERSION,
): BibliographyProjection {
  const sorted = [...records].sort((a, b) => a.id.localeCompare(b.id));
  return { version, count: sorted.length, records: sorted };
}
