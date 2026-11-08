/**
 * The OpenAPI publication handoff: the version list (with each version's
 * operations) the config step materialised and every generic surface reads
 * (switcher, indexing, the routes, the OKF export).
 *
 * It lives here, not in `integrations/openapi-publish.ts`, so a generic route
 * never imports the integration that writes files into the build output.
 */
import type { Operation } from './operations.mjs';

/** One version of the publication handoff (`DK_OPENAPI` internal env). */
export interface OpenApiPublicationVersion {
  label: string;
  released: boolean;
  ext: string;
  sha256: string;
  title: string;
  apiVersion: string;
  operations: Operation[];
  /** The version's raw document route, base-less. */
  rawRoute: string;
}

/** The version list the `llms.txt` route reads, and WP03/WP12 project further. */
export interface OpenApiPublication {
  section: string;
  llmsOperations: boolean;
  versions: OpenApiPublicationVersion[];
}

/** Parse the `DK_OPENAPI` handoff; `undefined` when absent or malformed. */
export function readPublication(raw: string | undefined): OpenApiPublication | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw) as OpenApiPublication;
    return typeof value.section === 'string' && Array.isArray(value.versions) ? value : undefined;
  } catch {
    return undefined;
  }
}
