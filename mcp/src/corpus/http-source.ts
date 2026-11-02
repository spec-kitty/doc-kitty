/**
 * HTTPS corpus adapter (FR-001): load the full corpus from a deployed
 * doc-kitty site into memory, once, at server start. There is deliberately NO
 * lazy fetch path (research.md R2: latency plus torn-corpora under GitHub
 * Pages' max-age=600 makes per-request fetch a rejected trap).
 *
 * Mechanics pinned by the mission:
 *   - fetch the index first, then every per-page artifact by the verbatim
 *     `_links.self.href` from the index records (never a recomputed path);
 *   - bounded fetch parallelism (default 8; NFR-001's floor for the
 *     60 s / 1000-page bound);
 *   - one documented retry per artifact: immediate, exactly once; after the
 *     second failure -> UNREACHABLE_ENDPOINT (never a hang);
 *   - per-request timeout 15 s (configurable for tests).
 *
 * Payload shape validation and contract interpretation are the loader's job
 * (snapshot.ts calls the hand-rolled guards in source.ts); this adapter
 * returns raw text plus load events.
 */
import { MalformedCorpusError, UnreachableEndpointError } from '../errors.js';
import type { CorpusSource, LoadEvent, LoadLogger, PageArtifactRef } from './source.js';

/** Per-artifact response cap (bytes). */
export const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
/** Total corpus cap (bytes) across index, pages and scenarios. */
export const MAX_CORPUS_BYTES = 256 * 1024 * 1024;

export interface HttpCorpusSourceOptions {
  /** Per-request timeout. Default 15_000 ms (T008). */
  timeoutMs?: number;
  /** Bounded parallelism for artifact fan-out. Default 8 (NFR-001 floor). */
  concurrency?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

export class HttpCorpusSource implements CorpusSource {
  readonly kind = 'https' as const;
  /** The launch base exactly as configured (used for identity + errors). */
  readonly base: string;

  private readonly indexUrl: string;
  private readonly timeoutMs: number;
  private readonly concurrency: number;
  private readonly fetchFn: typeof fetch;
  private readonly siteOrigin: string;
  private readonly sitePathPrefix: string;
  private totalBytes = 0;

  constructor(base: string, options: HttpCorpusSourceOptions = {}) {
    const parsed = new URL(base); // throws on a non-URL; args are validated by the CLI
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new UnreachableEndpointError(`${base}: unsupported URL scheme '${parsed.protocol}' (http/https only)`);
    }
    this.base = base;
    this.siteOrigin = parsed.origin;
    this.sitePathPrefix = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    this.indexUrl = new URL('api/index.json', base.endsWith('/') ? base : `${base}/`).href;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.concurrency = Math.max(1, options.concurrency ?? 8);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async loadIndex(log?: LoadLogger): Promise<string> {
    log?.({ phase: 'index', event: 'start', ref: this.indexUrl });
    const started = Date.now();
    const text = await this.fetchWithRetry(this.indexUrl, 'index', log);
    log?.({ phase: 'index', event: 'end', ref: this.indexUrl, ms: Date.now() - started });
    return text;
  }

  async loadPages(refs: readonly PageArtifactRef[], log?: LoadLogger): Promise<ReadonlyMap<string, string>> {
    for (const ref of refs) this.assertWithinSite(ref.href, `page '${ref.id}'`);
    log?.({ phase: 'pages', event: 'start', message: `${refs.length} page artifacts` });
    const started = Date.now();
    const result = new Map<string, string>();
    // Bounded fan-out: a simple worker pool over the ref list. Results land in
    // the map keyed by the pinned page id; insertion order follows ref order
    // (registry order), never completion order.
    let next = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const i = next;
        next += 1;
        if (i >= refs.length) return;
        const ref = refs[i]!;
        const text = await this.fetchWithRetry(ref.href, 'pages', log, ref.id);
        result.set(ref.id, text);
      }
    };
    const workers = Array.from({ length: Math.min(this.concurrency, refs.length) }, () => worker());
    await Promise.all(workers);
    log?.({ phase: 'pages', event: 'end', ms: Date.now() - started, message: `${refs.length} page artifacts` });
    return result;
  }

  async loadScenarios(href: string, log?: LoadLogger): Promise<string> {
    this.assertWithinSite(href, 'scenarios');
    log?.({ phase: 'scenarios', event: 'start', ref: href });
    const started = Date.now();
    const text = await this.fetchWithRetry(href, 'scenarios', log);
    log?.({ phase: 'scenarios', event: 'end', ref: href, ms: Date.now() - started });
    return text;
  }

  /** Artifacts are fetched only from the configured site: same origin, under its base path. */
  private assertWithinSite(href: string, what: string): void {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      throw new MalformedCorpusError(`api/index.json: ${what} artifact ref '${href}' is not an absolute URL`);
    }
    if (url.origin !== this.siteOrigin || !url.pathname.startsWith(this.sitePathPrefix)) {
      throw new MalformedCorpusError(
        `api/index.json: ${what} artifact ref '${href}' is outside the configured site '${this.base}'; refusing to fetch it`,
      );
    }
  }

  /**
   * One documented retry: attempt, and on any failure attempt ONE more time,
   * immediately. The second failure is UNREACHABLE_ENDPOINT carrying the cause
   * (HTTP status, network error code or timeout).
   */
  private async fetchWithRetry(url: string, phase: LoadEvent['phase'], log?: LoadLogger, refId?: string): Promise<string> {
    let first: unknown;
    try {
      return await this.fetchOnce(url);
    } catch (error) {
      first = error;
    }
    log?.({
      phase,
      event: 'retry',
      ref: refId ?? url,
      attempt: 2,
      message: `${url}: ${describeFailure(first)} - retrying once, immediately`,
    });
    try {
      return await this.fetchOnce(url);
    } catch (error) {
      throw new UnreachableEndpointError(
        `${url}: fetch failed after the one documented retry (${describeFailure(error)})`,
        { cause: error },
      );
    }
  }

  private async fetchOnce(url: string): Promise<string> {
    // Redirects are refused: a 3xx could move the fetch off the configured site.
    const response = await this.fetchFn(url, { signal: AbortSignal.timeout(this.timeoutMs), redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      throw new Error(`HTTP ${response.status} redirect refused (artifacts are fetched only from the configured site)`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_ARTIFACT_BYTES) {
      await response.body?.cancel();
      throw new Error(`content-length ${declared} exceeds the ${MAX_ARTIFACT_BYTES}-byte artifact cap`);
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    const reader = response.body?.getReader();
    if (reader !== undefined) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_ARTIFACT_BYTES) {
          await reader.cancel();
          throw new Error(`response exceeds the ${MAX_ARTIFACT_BYTES}-byte artifact cap`);
        }
        chunks.push(value);
      }
    }
    if (this.totalBytes + received > MAX_CORPUS_BYTES) {
      throw new Error(`corpus exceeds the ${MAX_CORPUS_BYTES}-byte total cap`);
    }
    this.totalBytes += received;
    return Buffer.concat(chunks).toString('utf8');
  }
}

function describeFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
