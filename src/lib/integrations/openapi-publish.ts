/**
 * Publishing the raw OpenAPI documents (mission openapi-reference-pages, WP04;
 * FR-006, FR-008, FR-012; research R5; second slice WP02: bytes from the
 * materialised list, and the extended publication).
 *
 * At the end of a build each version's document is written, byte for byte, to
 * `<outDir>/<section>/<label>/openapi.<ext>` with a `sha256sum`-format sidecar
 * `openapi.<ext>.sha256` (`<hex>  openapi.<ext>\n`). The renderer writes only the
 * pages, so what is written here follows ADR-0049 section 3 for files DocKitty
 * writes itself:
 *
 *  - generated marker: a raw document is "ours" only while its sidecar exists and
 *    records the document's own digest. A raw document cannot carry a marker (it is
 *    byte-identical to the input), so the sidecar is the marker;
 *  - an authored file at an output path (for example from `public/`) stops the build,
 *    and the path is named;
 *  - stale outputs (a removed version, a changed extension) are pruned, but only
 *    generated ones, found by their marker;
 *  - a broken second spec leaves the output exactly as it was (no partial output):
 *    the whole plan is computed before the first write or removal.
 *
 * The bytes come from the materialised list (WP02, FR-007): the publisher never
 * reads a file, so a source changed after config time cannot reach the output,
 * and the only input check left is the invariant that every spec's bytes still
 * hash to its recorded sha256.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { MaterialisedSpec } from '../openapi/materialise.mjs';
import type { Operation } from '../openapi/operations.mjs';

const PREFIX = '[dk-openapi]';

/** What the publisher needs of a materialised version. */
export interface PublishedSpec {
  label: string;
  /** Extension without the dot; the published name is `openapi.<ext>`. */
  ext: string;
  /** The config-time bytes (FR-007): never re-read from disk. */
  bytes: Buffer;
  /** sha256 of `bytes`; the publisher asserts the invariant before writing. */
  sha256: string;
}

/** What the publisher needs of the normalised option. */
export interface PublishOptions {
  section: string;
  specs: PublishedSpec[];
}

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

/** The option fields the publication reads. */
export interface PublicationOptions {
  section: string;
  llmsOperations: boolean;
}

/** The sidecar's content: `sha256sum -c` format. */
export function checksumLine(digest: string, name: string): string {
  return `${digest}  ${name}\n`;
}

/** The publication handoff for the `llms.txt` route, from the materialised list. */
export function toPublication(options: PublicationOptions, specs: MaterialisedSpec[]): OpenApiPublication {
  return {
    section: options.section,
    llmsOperations: options.llmsOperations,
    versions: specs.map((spec) => ({
      label: spec.label,
      released: spec.released,
      ext: spec.ext,
      sha256: spec.sha256,
      title: spec.title,
      apiVersion: spec.apiVersion,
      operations: spec.operations,
      rawRoute: `/${options.section}/${spec.label}/openapi.${spec.ext}`,
    })),
  };
}

/**
 * The `llms.txt` version and operation lines. The body lives in
 * `src/lib/openapi/llms.ts` (WP04), the seam the plan's registry names; this
 * re-export keeps the module the route and the publisher tests import.
 */
export { openApiLlmsLines } from '../openapi/llms.js';

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

interface Planned {
  dir: string;
  rawPath: string;
  sumPath: string;
  name: string;
  bytes: Buffer;
  line: string;
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

/** True when `file` is a raw document this publisher wrote: its sidecar records its digest. */
function isGenerated(rawPath: string): boolean {
  const sumPath = `${rawPath}.sha256`;
  if (!existsSync(rawPath) || !existsSync(sumPath)) return false;
  const expected = checksumLine(sha256(readFileSync(rawPath)), path.basename(rawPath));
  return readFileSync(sumPath, 'utf8') === expected;
}

/** Plan every write before anything happens; asserts the bytes/digest invariant. */
function plan(outDir: string, options: PublishOptions): Planned[] {
  return options.specs.map((spec, index) => {
    const entry = `specs[${index}] "${spec.label}"`;
    if (sha256(spec.bytes) !== spec.sha256) {
      throw new Error(
        `${PREFIX} ${entry}: sha256 mismatch: the materialised bytes no longer hash to their recorded digest; nothing was published`,
      );
    }
    const name = `openapi.${spec.ext}`;
    const dir = path.join(outDir, ...options.section.split('/'), spec.label);
    return { dir, rawPath: path.join(dir, name), sumPath: path.join(dir, `${name}.sha256`), name, bytes: spec.bytes, line: checksumLine(spec.sha256, name) };
  });
}

/** Fail on any output path that holds a file we did not generate. */
function assertNoAuthored(planned: Planned[]): void {
  for (const { rawPath, sumPath } of planned) {
    for (const file of [rawPath, sumPath]) {
      if (existsSync(file) && !isGenerated(file.endsWith('.sha256') ? file.slice(0, -'.sha256'.length) : file)) {
        throw new Error(
          `${PREFIX} an authored file is at the path the raw document is published to: ${file}. ` +
            'Move or remove it, or change the version label or the section. Nothing was published.',
        );
      }
    }
  }
}

/** Remove generated raw documents under the section that no version produces. */
function pruneStale(outDir: string, options: PublishOptions, planned: Planned[]): string[] {
  const keep = new Set(planned.flatMap((p) => [p.rawPath, p.sumPath]));
  const root = path.join(outDir, ...options.section.split('/'));
  const pruned: string[] = [];
  if (!existsSync(root)) return pruned;
  for (const label of readdirSync(root, { withFileTypes: true })) {
    if (!label.isDirectory()) continue;
    const dir = path.join(root, label.name);
    for (const file of readdirSync(dir)) {
      const rawPath = path.join(dir, file);
      if (!/^openapi\.[a-z]+$/.test(file) || keep.has(rawPath) || !isGenerated(rawPath)) continue;
      rmSync(rawPath);
      rmSync(`${rawPath}.sha256`);
      pruned.push(rawPath);
    }
  }
  return pruned;
}

/**
 * Publish every version's raw document and checksum into `outDir`. Returns the files
 * written. Throws before touching `outDir` when a spec's bytes no longer hash to
 * their recorded sha256, or when an authored file is in the way.
 */
export function publishOpenApiDocuments(
  outDir: string,
  options: PublishOptions,
  onPrune?: (rawPath: string) => void,
): string[] {
  const planned = plan(outDir, options);
  assertNoAuthored(planned);
  for (const rawPath of pruneStale(outDir, options, planned)) onPrune?.(rawPath);
  const written: string[] = [];
  for (const p of planned) {
    mkdirSync(p.dir, { recursive: true });
    writeFileSync(p.rawPath, p.bytes);
    writeFileSync(p.sumPath, p.line);
    written.push(p.rawPath, p.sumPath);
  }
  return written;
}

/** Drop directories a prune left empty, up to the section root. */
export function removeEmptyDirs(outDir: string, section: string): void {
  const root = path.join(outDir, ...section.split('/'));
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const dir = path.join(root, entry.name);
    if (entry.isDirectory() && readdirSync(dir).length === 0) rmdirSync(dir);
  }
}

/** The Astro hook that publishes at the end of a build. */
export function openApiPublishHooks(options: PublishOptions) {
  return {
    'astro:build:done': ({ dir, logger }: { dir: URL; logger?: { warn(message: string): void } }) => {
      const outDir = fileURLToPath(dir);
      // Astro empties the output folder before a build, so a stale raw document
      // here was copied from public/, or left by an earlier build of this site.
      // Removing it is right only for an old generated copy; say so, so a
      // hand-published file is never lost silently.
      publishOpenApiDocuments(outDir, options, (rawPath) =>
        logger?.warn(
          `${PREFIX} removed ${rawPath} and its checksum: no configured version publishes it ` +
            '(it was copied from public/, or left by an earlier build of this site). ' +
            'Remove it from public/, or add its version to openapi.specs or openapi.archive.',
        ),
      );
      removeEmptyDirs(outDir, options.section);
    },
  };
}
