/**
 * Test helper: the `DK_OPENAPI` handoff is the path of a publication file, so a
 * test that wants a publication in the env writes one to a temp directory and
 * assigns the returned path.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writePublication, type OpenApiPublication } from '../../lib/openapi/publication.js';

let dir: string | undefined;

/** Write `publication` to a temp file (content-addressed) and return its absolute path. */
export function publicationFile(publication: unknown): string {
  dir ??= mkdtempSync(path.join(tmpdir(), 'dk-publication-'));
  return writePublication(dir, publication as OpenApiPublication);
}
