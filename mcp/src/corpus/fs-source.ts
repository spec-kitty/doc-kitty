/**
 * Filesystem corpus adapter (FR-002): load the corpus from a local build
 * output directory - expected layout
 *
 *   <dir>/api/index.json
 *   <dir>/api/pages/*.json
 *   <dir>/api/scenarios.json      (only when the index links it)
 *
 * Two hard rules:
 *
 * 1. ZERO network access. This module imports no fetch/socket API; the fs
 *    adapter exists so an author can read an undeployed build with no server
 *    running, and the conformance suite proves it with networking blocked.
 *
 * 2. Re-origining (FR-007): the artifacts bake absolute URLs of the deploy
 *    origin at build time (e.g. https://spec-kitty.github.io/doc-kitty/...),
 *    which misleads a local reader. This adapter rewrites EXACTLY the link
 *    fields named by the contract carve-out - record `source`/`url`, and any
 *    `href` inside a `links`/`_links` container - from the baked base to the
 *    effective link base:
 *
 *      explicit --link-base, else the site's declared deploy origin, derived
 *      from the index's own `_links.self` (which ends in /api/index.json).
 *
 *    `markdown` and every other content field are NEVER rewritten (C-004 ADR
 *    records re-origining as link-projection only). When the effective link
 *    base equals the declared one the bytes pass through untouched - no
 *    stringify round-trip, so byte-equality (FR-010) cannot drift on a
 *    serializer detail.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { UnreachableEndpointError } from '../errors.js';
import { declaredBaseFromIndexSelf, parseArtifact } from './source.js';
import type { CorpusSource, LoadLogger, PageArtifactRef } from './source.js';

export interface FsCorpusSourceOptions {
  /** Explicit FR-007 rewrite target; defaults to the site's declared origin. */
  linkBase?: string;
}

/** The exact carve-out field set (contracts/mcp-surface.md, FR-010 data). */
const LINK_CONTAINER_KEYS = new Set(['links', '_links']);
const LINK_STRING_KEYS = new Set(['source', 'url']);

export class FsCorpusSource implements CorpusSource {
  readonly kind = 'fs' as const;
  /** The resolved absolute directory the corpus is read from. */
  readonly base: string;

  private readonly dir: string;
  private readonly linkBase?: string;
  private declaredBase: string | undefined;

  constructor(dir: string, options: FsCorpusSourceOptions = {}) {
    this.dir = path.resolve(dir);
    this.base = this.dir;
    this.linkBase = options.linkBase === undefined ? undefined : normalizeBase(options.linkBase);
  }

  async loadIndex(log?: LoadLogger): Promise<string> {
    const indexPath = path.join(this.dir, 'api', 'index.json');
    log?.({ phase: 'index', event: 'start', path: indexPath });
    const started = Date.now();
    const raw = await this.readArtifact(indexPath);
    // Derive the declared deploy base for FR-007 rewriting. Derivation reads
    // `_links.self.href` verbatim (it is how the site NAMES itself); a missing
    // or odd value downgrades rewriting to a warning rather than a refusal -
    // the shape guard in the loader decides validity, not this adapter.
    try {
      const index = parseArtifact(raw, indexPath);
      const self = (index as { _links?: { self?: { href?: unknown } } })._links?.self?.href;
      this.declaredBase = typeof self === 'string' ? declaredBaseFromIndexSelf(self) : undefined;
    } catch {
      this.declaredBase = undefined;
    }
    const text = this.rewriteArtifactText(raw, indexPath, log);
    log?.({ phase: 'index', event: 'end', path: indexPath, ms: Date.now() - started });
    return text;
  }

  async loadPages(refs: readonly PageArtifactRef[], log?: LoadLogger): Promise<ReadonlyMap<string, string>> {
    log?.({ phase: 'pages', event: 'start', message: `${refs.length} page artifacts` });
    const started = Date.now();
    const result = new Map<string, string>();
    for (const ref of refs) {
      // id is the pinned derivation (artifact path relative to api/pages/
      // minus .json), already traversal-screened by pageIdFromArtifactRef.
      const filePath = path.join(this.dir, 'api', 'pages', `${ref.id}.json`);
      const raw = await this.readArtifact(filePath);
      result.set(ref.id, this.rewriteArtifactText(raw, filePath, log));
    }
    log?.({ phase: 'pages', event: 'end', ms: Date.now() - started, message: `${refs.length} page artifacts` });
    return result;
  }

  async loadScenarios(href: string, log?: LoadLogger): Promise<string> {
    const filePath = path.join(this.dir, 'api', 'scenarios.json');
    log?.({ phase: 'scenarios', event: 'start', path: filePath, ref: href });
    const started = Date.now();
    const raw = await this.readArtifact(filePath);
    const text = this.rewriteArtifactText(raw, filePath, log);
    log?.({ phase: 'scenarios', event: 'end', path: filePath, ms: Date.now() - started });
    return text;
  }

  /** A missing/unreadable promised artifact is an unreachable source, named with the path. */
  private async readArtifact(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf8');
    } catch (error) {
      throw new UnreachableEndpointError(`${filePath}: cannot read artifact (${describeFsError(error)})`, {
        cause: error,
      });
    }
  }

  /**
   * Re-origining, identity-aware: no configured link base (or one equal to
   * the declared base) returns the raw bytes unchanged; otherwise the JSON is
   * parsed, link fields are rewritten, and the structure is re-serialized
   * with the emitter's own formatting (2-space JSON.stringify), so content
   * fields stay byte-stable through the round-trip.
   */
  private rewriteArtifactText(raw: string, artifactPath: string, log?: LoadLogger): string {
    const declared = this.declaredBase;
    const target = this.linkBase ?? declared;
    if (target === undefined || declared === undefined) {
      if (this.linkBase !== undefined && declared === undefined) {
        log?.({
          phase: 'snapshot',
          event: 'warning',
          path: artifactPath,
          message: `-link-base '${this.linkBase}' given but the index declares no origin (_links.self missing or odd); links passed through unrewritten`,
        });
      }
      return raw;
    }
    if (target === declared) return raw; // identity - never round-trip bytes
    const parsed = parseArtifact(raw, artifactPath); // invalid JSON -> MALFORMED_CORPUS with path
    rewriteLinkFields(parsed, declared, target);
    return JSON.stringify(parsed, null, 2);
  }
}

/**
 * Rewrite, in place, every value that belongs to the carve-out link fields:
 * strings under `source`/`url`, and `href` strings anywhere inside a `links`
 * or `_links` container (its `title` siblings are content and never touched).
 * Only values baked from the declared base (exact base or base + '/...') are
 * rewritten; anything else (external links, relative refs) passes through.
 */
export function rewriteLinkFields(node: unknown, declaredBase: string, linkBase: string): void {
  walk(node, false);
  function walk(value: unknown, inLinkContainer: boolean): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, inLinkContainer);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'href' && inLinkContainer && typeof child === 'string') {
        (value as Record<string, unknown>)[key] = rebase(child, declaredBase, linkBase);
      } else if (LINK_STRING_KEYS.has(key) && typeof child === 'string') {
        (value as Record<string, unknown>)[key] = rebase(child, declaredBase, linkBase);
      } else if (LINK_CONTAINER_KEYS.has(key)) {
        walk(child, true);
      } else {
        walk(child, inLinkContainer);
      }
    }
  }
}

function rebase(value: string, declaredBase: string, linkBase: string): string {
  if (value === declaredBase) return linkBase;
  if (value.startsWith(`${declaredBase}/`)) return `${linkBase}${value.slice(declaredBase.length)}`;
  return value;
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '');
}

function describeFsError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException)?.code;
  if (typeof code === 'string') return code;
  return error instanceof Error ? error.message : String(error);
}
