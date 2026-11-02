/**
 * The corpus port: how the snapshot loader talks to "a doc-kitty corpus out
 * there", plus everything both adapters and the loader must agree on -
 * identity derivation, verbosity hooks, and the hand-rolled shape guards
 * (NFR-003: no schema-library import).
 *
 * Layering:
 *   - Adapters (http-source.ts / fs-source.ts) own TRANSPORT: fetch/read,
 *     retry, timeouts, ref-to-location mapping, and (fs) link re-origining.
 *     They return raw artifact TEXT and never interpret it.
 *   - The loader (snapshot.ts) owns INTERPRETATION: shape guards (the
 *     functions at the bottom of this file), the version handshake, the
 *     buildId compare-all, gating detection and the snapshot assembly.
 *
 * Page identity comes from the index records' artifact references verbatim,
 * never from slug arithmetic (research.md R4: the home page has slug "" and
 * maps to api/pages/home.json - naive slug joining provably 404s).
 */
import type { AgentIndex, AgentPagePayload, ScenarioIndex } from '@spec-kitty/doc-toolkit/contract';
import { MalformedCorpusError } from '../errors.js';

/**
 * Structured load events (T008: total-budget instrumentation for the
 * NFR-001 measurement in the conformance suite). Synchronous, never awaited.
 */
export interface LoadEvent {
  /** Pipeline phase the event belongs to. */
  phase: 'index' | 'pages' | 'scenarios' | 'snapshot';
  event: 'start' | 'end' | 'retry' | 'warning';
  /** Wall time of the phase, on 'end'. */
  ms?: number;
  /** Artifact reference (URL), when the event is per-artifact. */
  ref?: string;
  /** Artifact filesystem path (fs adapter), when the event is per-artifact. */
  path?: string;
  /** Retry attempt number, on 'retry'. */
  attempt?: number;
  /** Detail for 'warning'/'retry'. */
  message?: string;
}

export type LoadLogger = (event: LoadEvent) => void;

/** One per-page artifact the loader wants, identified from the index record. */
export interface PageArtifactRef {
  /**
   * The pinned page id: the artifact path relative to `api/pages/` minus
   * `.json` (home => 'home'; nested pages keep slashes).
   */
  id: string;
  /** The record's `_links.self.href`, verbatim. */
  href: string;
}

export interface CorpusSource {
  readonly kind: 'https' | 'fs';
  /** Launch-config identity of the source: the site base URL or the local dir. */
  readonly base: string;
  /** The machine index (`api/index.json`) as raw text. */
  loadIndex(log?: LoadLogger): Promise<string>;
  /**
   * Every per-page artifact for the given refs, in ref order when iterated
   * through the returned map (insertion order = ref order = registry order).
   */
  loadPages(refs: readonly PageArtifactRef[], log?: LoadLogger): Promise<ReadonlyMap<string, string>>;
  /** `api/scenarios.json` as raw text; the loader calls this only when the index links the surface. */
  loadScenarios(href: string, log?: LoadLogger): Promise<string>;
}

/**
 * The pinned page-id derivation (contracts + data model): artifact path
 * relative to `api/pages/`, minus the `.json` suffix. The home page yields
 * `home`; nested pages keep slashes.
 */
export function pageIdFromArtifactRef(href: string): string {
  const pathname = artifactPathname(href);
  const marker = '/api/pages/';
  const at = pathname.indexOf(marker);
  if (at < 0) {
    throw new MalformedCorpusError(
      `api/index.json: _links.self.href '${href}' is not under '/api/pages/' - page ids derive from artifact refs, never from slug arithmetic`,
    );
  }
  const rest = pathname.slice(at + marker.length);
  if (!rest.endsWith('.json') || rest.length === '.json'.length) {
    throw new MalformedCorpusError(`api/index.json: _links.self.href '${href}' does not name a .json page artifact`);
  }
  const id = rest.slice(0, -'.json'.length);
  if (!isSafePageId(id)) {
    throw new MalformedCorpusError(
      `api/index.json: page id '${id}' derived from '${href}' is not a safe relative artifact path`,
    );
  }
  return id;
}

/** Pathname of an absolute artifact URL; relative refs are rejected at load. */
function artifactPathname(href: string): string {
  try {
    return new URL(href).pathname;
  } catch {
    // The contract resolves record refs to absolute URLs; a non-URL is a
    // malformed corpus, surfaced by the caller with path context.
    throw new MalformedCorpusError(`api/index.json: artifact ref '${href}' is not an absolute URL`);
  }
}

/**
 * A page id is a dist-relative path segment chain; refuse anything that could
 * escape the directory (fs adapter maps ids onto the filesystem).
 */
function isSafePageId(id: string): boolean {
  if (id.length === 0 || id.includes('\\') || id.startsWith('/')) return false;
  return !id.split('/').some((segment) => segment === '..' || segment === '.' || segment.length === 0);
}

/**
 * The site URL with scheme, base path components are preserved by callers;
 * for derivation see {@link declaredBaseFromIndex}: the baked origin+base a
 * build was stamped with, from the index's own `_links.self` (it ends with
 * `/api/index.json`).
 */
export function declaredBaseFromIndexSelf(selfHref: string): string {
  const suffix = '/api/index.json';
  if (!selfHref.endsWith(suffix)) {
    throw new MalformedCorpusError(`api/index.json: _links.self.href '${selfHref}' does not end with '${suffix}'`);
  }
  return selfHref.slice(0, -suffix.length);
}

// ---------------------------------------------------------------------------
// Hand-rolled presence/shape guards (NFR-003 + plan D7). Each violation raises
// MALFORMED_CORPUS naming the artifact path and the offending key. Guards
// cover exactly the surface the server consumes (C-006): fields the snapshot
// and the WP03/WP04 surfaces read. Everything else is pass-THROUGH, uninspected
// - the snapshot keeps the parsed structure and the raw text of every artifact.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isPlainObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, key: string, expectation: string): never {
  throw new MalformedCorpusError(`${path}: ${key} - expected ${expectation}`);
}

function wantString(path: string, key: string, value: unknown, { nonEmpty = false } = {}): string {
  if (typeof value !== 'string' || (nonEmpty && value.length === 0)) {
    fail(path, key, nonEmpty ? 'a non-empty string' : 'a string');
  }
  return value;
}

function wantNullableString(path: string, key: string, value: unknown): string | null {
  if (value !== null && typeof value !== 'string') fail(path, key, 'a string or null');
  return value;
}

function wantNumber(path: string, key: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, key, 'a finite number');
  return value;
}

function wantArray<T>(path: string, key: string, value: unknown, item?: (p: string, v: unknown) => T): T[] | unknown[] {
  if (!Array.isArray(value)) fail(path, key, 'an array');
  if (item) return value.map((v, i) => item(`${key}[${i}]`, v));
  return value;
}

function wantLink(path: string, key: string, value: unknown): void {
  if (!isPlainObject(value)) fail(path, key, 'an object with a string href');
  wantString(path, `${key}.href`, value.href);
}

/** Guard one index page record (`api/index.json` -> pages[i]). */
function wantIndexRecord(path: string, key: string, value: unknown): void {
  if (!isPlainObject(value)) fail(path, key, 'an object');
  wantString(path, `${key}.slug`, value.slug);
  wantString(path, `${key}.section`, value.section); // may be '' (legacy home value; loader maps it)
  wantString(path, `${key}.title`, value.title, { nonEmpty: true });
  wantString(path, `${key}.description`, value.description);
  wantNullableString(path, `${key}.type`, value.type);
  wantString(path, `${key}.doc_status`, value.doc_status);
  wantString(path, `${key}.kind`, value.kind);
  wantArray(path, `${key}.tags`, value.tags, (k, v) => wantString(path, k, v));
  wantArray(path, `${key}.related`, value.related);
  wantArray(path, `${key}.audience`, value.audience);
  wantNumber(path, `${key}.priority`, value.priority);
  wantNullableString(path, `${key}.updated`, value.updated);
  wantString(path, `${key}.source`, value.source);
  wantString(path, `${key}.url`, value.url);
  if (!isPlainObject(value._links)) fail(path, `${key}._links`, 'an object');
  // `self` is the per-page artifact pointer, ABSENT when the site gates the
  // pages surface off (links.pages: false); the loader detects that exactly
  // here-by-absence, so the guard only checks shape when present.
  if (value._links.self !== undefined) wantLink(path, `${key}._links.self`, value._links.self);
  wantLink(path, `${key}._links.html`, value._links.html);
  wantArray(path, `${key}._links.related`, value._links.related, (k, v) => {
    wantLink(path, k, v);
    return v;
  });
}

/** Guard the machine index (parse target of `api/index.json`). */
export function assertIndexShape(value: unknown, path = 'api/index.json'): asserts value is AgentIndex {
  if (!isPlainObject(value)) fail(path, '(root)', 'an object');
  wantString(path, 'title', value.title, { nonEmpty: true });
  wantString(path, 'version', value.version, { nonEmpty: true });
  wantNumber(path, 'count', value.count);
  // buildId is optional: absent on pre-FR-008 corpora (loader migrates with a
  // warning); a NON-string value when present is nevertheless malformed.
  if (value.buildId !== undefined) wantString(path, 'buildId', value.buildId, { nonEmpty: true });
  // sections[] entered the contract with WP01; absent before it - tolerated.
  if (value.sections !== undefined) {
    wantArray(path, 'sections', value.sections, (k, v) => {
      if (!isPlainObject(v)) fail(path, k, 'an object');
      wantString(path, `${k}.id`, v.id);
      wantString(path, `${k}.label`, v.label);
      wantNumber(path, `${k}.order`, v.order);
      if (v.purpose !== undefined) wantString(path, `${k}.purpose`, v.purpose);
      return v;
    });
  }
  wantArray(path, 'pages', value.pages, (k, v) => {
    wantIndexRecord(path, k, v);
    return v;
  });
  if (!isPlainObject(value._links)) fail(path, '_links', 'an object');
  wantLink(path, '_links.self', value._links.self);
  if (value._links.scenarios !== undefined) wantLink(path, '_links.scenarios', value._links.scenarios);
}

/** Guard one per-page artifact (`api/pages/<id>.json`). */
export function assertPageShape(value: unknown, path: string): asserts value is AgentPagePayload {
  if (!isPlainObject(value)) fail(path, '(root)', 'an object');
  wantString(path, 'slug', value.slug);
  wantString(path, 'section', value.section);
  wantString(path, 'title', value.title, { nonEmpty: true });
  wantString(path, 'description', value.description);
  wantString(path, 'doc_status', value.doc_status);
  wantArray(path, 'authors', value.authors);
  // Search-surface fields (FR-004); both must exist on a real payload.
  wantArray(path, 'keywords', value.keywords, (k, v) => wantString(path, k, v));
  wantString(path, 'markdown', value.markdown);
  wantString(path, 'url', value.url);
  wantString(path, 'source', value.source);
  if (value.buildId !== undefined) wantString(path, 'buildId', value.buildId, { nonEmpty: true });
  if (!isPlainObject(value._links)) fail(path, '_links', 'an object');
  wantLink(path, '_links.self', value._links.self);
  wantLink(path, '_links.html', value._links.html);
}

/** Guard the scenario index (`api/scenarios.json`), shallow on the inner records. */
export function assertScenariosShape(value: unknown, path = 'api/scenarios.json'): asserts value is ScenarioIndex {
  if (!isPlainObject(value)) fail(path, '(root)', 'an object');
  wantString(path, 'version', value.version, { nonEmpty: true });
  wantString(path, 'generated_by', value.generated_by, { nonEmpty: true });
  wantNumber(path, 'count', value.count);
  if (value.buildId !== undefined) wantString(path, 'buildId', value.buildId, { nonEmpty: true });
  wantArray(path, 'features', value.features, (k, v) => {
    if (!isPlainObject(v)) fail(path, k, 'an object');
    wantString(path, `${k}.id`, v.id, { nonEmpty: true });
    wantString(path, `${k}.title`, v.title, { nonEmpty: true });
    wantString(path, `${k}.url`, v.url);
    wantString(path, `${k}.source`, v.source);
    wantArray(path, `${k}.scenarios`, v.scenarios);
    return v;
  });
}

/** Parse raw artifact text; invalid JSON is a malformed corpus, named with path. */
export function parseArtifact(text: string, path: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MalformedCorpusError(`${path}: not valid JSON - ${(error as Error).message}`, { cause: error });
  }
}
