/**
 * The OpenAPI publication handoff: the version list (with each version's
 * operations) the config step materialised and every generic surface reads
 * (switcher, indexing, the routes, the OKF export).
 *
 * It lives here, not in `integrations/openapi-publish.ts`, so a generic route
 * never imports the integration that writes files into the build output.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeCacheAtomic } from './cache.mjs';
import type { Operation } from './operations.mjs';

/** One version of the publication handoff (the file `DK_OPENAPI` points to). */
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

/**
 * Write the publication to `<cacheDir>/<sha256>.publication.json` (atomically, by
 * the shared cache writer) and return the absolute path. The name is the digest
 * of the JSON, so the same publication always lands at the same path.
 *
 * The handoff is a file, not the JSON in `process.env`: Linux refuses `execve`
 * for any one environment string over 128 KiB (`E2BIG`), and a site with a
 * thousand operations across its versions passes that, which would fail every
 * child process spawned afterwards.
 */
export function writePublication(cacheDir: string, publication: OpenApiPublication): string {
  const bytes = Buffer.from(JSON.stringify(publication), 'utf8');
  const digest = createHash('sha256').update(bytes).digest('hex');
  return writeCacheAtomic(cacheDir, digest, 'publication.json', bytes);
}

/** Parsed publications by absolute path: a file is read and parsed once. */
const memo = new Map<string, OpenApiPublication>();

/**
 * Read the publication the `DK_OPENAPI` handoff points to, an absolute file path.
 * `undefined` when the handoff is absent, the file is missing or the content is
 * malformed. A successful read is memoised per path; a path is content-addressed
 * (see {@link writePublication}), so a memoised value cannot go stale.
 */
export function readPublication(file: string | undefined): OpenApiPublication | undefined {
  if (!file) return undefined;
  const known = memo.get(file);
  if (known) return known;
  try {
    const value = JSON.parse(readFileSync(file, 'utf8')) as OpenApiPublication;
    if (typeof value.section !== 'string' || !Array.isArray(value.versions)) return undefined;
    memo.set(file, value);
    return value;
  } catch {
    return undefined;
  }
}
