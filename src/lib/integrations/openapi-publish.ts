/**
 * Publishing the raw OpenAPI documents (mission openapi-reference-pages, WP04;
 * FR-006, FR-008, FR-012; research R5).
 *
 * At the end of a build each version's input file is copied, byte for byte, to
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
 *  - an empty or unreadable input never deletes anything: every input is read and
 *    checked before the first write or removal, so a broken second spec leaves the
 *    output exactly as it was (no partial output).
 *
 * The bytes are never parsed or re-serialised.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = '[dk-openapi]';

/** What the publisher needs of a normalised version. */
export interface PublishedSpec {
  label: string;
  /** Input file, absolute. */
  absPath: string;
  /** Extension without the dot; the published name is `openapi.<ext>`. */
  ext: string;
  released: boolean;
}

/** What the publisher needs of the normalised option. */
export interface PublishOptions {
  section: string;
  specs: PublishedSpec[];
}

/** The version list the `llms.txt` route reads (`DK_OPENAPI` internal env). */
export interface OpenApiPublication {
  section: string;
  versions: Array<{ label: string; released: boolean; ext: string }>;
}

/** The sidecar's content: `sha256sum -c` format. */
export function checksumLine(digest: string, name: string): string {
  return `${digest}  ${name}\n`;
}

/** The publication handoff for the `llms.txt` route. */
export function toPublication(options: PublishOptions): OpenApiPublication {
  return {
    section: options.section,
    versions: options.specs.map(({ label, released, ext }) => ({ label, released, ext })),
  };
}

/**
 * The `llms.txt` lines, one per version: `- [<label>](<absolute raw URL>)`, with
 * ` (unreleased)` appended after the link for an unreleased version. `rawUrl` maps a
 * site route (no base) to an absolute URL.
 */
export function openApiLlmsLines(publication: OpenApiPublication, rawUrl: (route: string) => string): string[] {
  return publication.versions.map(({ label, released, ext }) => {
    const url = rawUrl(`/${publication.section}/${label}/openapi.${ext}`);
    return `- [${label}](${url})${released ? '' : ' (unreleased)'}`;
  });
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

/** Read every input before anything is written; throws on the first unreadable or empty one. */
function plan(outDir: string, options: PublishOptions): Planned[] {
  return options.specs.map((spec, index) => {
    const entry = `specs[${index}] "${spec.label}"`;
    let bytes: Buffer;
    try {
      bytes = readFileSync(spec.absPath);
    } catch {
      throw new Error(`${PREFIX} ${entry}: cannot read the file to publish (${spec.absPath}); nothing was published`);
    }
    if (bytes.toString('utf8').trim() === '') {
      throw new Error(`${PREFIX} ${entry}: the file is empty (${spec.absPath}); nothing was published and existing output is kept`);
    }
    const name = `openapi.${spec.ext}`;
    const dir = path.join(outDir, ...options.section.split('/'), spec.label);
    return { dir, rawPath: path.join(dir, name), sumPath: path.join(dir, `${name}.sha256`), name, bytes, line: checksumLine(sha256(bytes), name) };
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
 * written. Throws before touching `outDir` when any input is unreadable or empty or
 * when an authored file is in the way.
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
    'astro:build:done': ({ dir, logger }: { dir: URL; logger: { warn(message: string): void } }) => {
      const outDir = fileURLToPath(dir);
      // Astro empties the output folder before a build, so a stale raw document
      // here was copied from public/. Removing it is right only for an old
      // generated copy; say so, so a hand-published file is never lost silently.
      publishOpenApiDocuments(outDir, options, (rawPath) =>
        logger.warn(
          `${PREFIX} removed ${rawPath} and its checksum: no configured version publishes it ` +
            '(it was copied from public/). Remove it from public/, or add its version to openapi.specs.',
        ),
      );
      removeEmptyDirs(outDir, options.section);
    },
  };
}
