/**
 * Raw OpenAPI documents in `astro dev` (mission openapi-second-slice-01M6WXJ4,
 * WP04; FR-016, FR-028; research R3).
 *
 * `astro build` publishes each version's document and its `.sha256` sidecar
 * (WP02's publisher); in dev the same URLs must serve the same bytes. This is a
 * Connect middleware registered through the plan registry's `devHandlers` seam,
 * answering from the materialised list in memory: nothing is read from disk, and
 * no file is written into `public/` or the source tree, so the two surfaces
 * cannot drift (NFR-007).
 *
 * FR-028 bounds the surface:
 *
 *  - an exact route allowlist after base-aware parsing —
 *    `/<base><section>/<label>/openapi.<ext>` and its `.sha256` — and nothing
 *    else, so no arbitrary path is reachable through it;
 *  - GET and HEAD only; any other method on an allowed route is 405 with `Allow`;
 *  - dot segments, `%2e`, encoded slashes (`%2f`) and backslashes (`%5c`) are
 *    refused (404) before anything is matched, never resolved;
 *  - any other request (and a request that is not ours at all) is passed to the
 *    dev server with `next()`.
 *
 * The base is Astro's own, captured from `astro:config:setup` where the
 * integration sees the Astro config; Astro's dev server strips it before user
 * middleware, so both the prefixed and the already-stripped form are accepted.
 */
import type { MaterialisedSpec } from '../openapi/materialise.mjs';
import { devHandlers } from '../openapi/materialise.mjs';
import { routeOfSlug } from '../vocabulary-core.mjs';
import { checksumLine } from './openapi-publish.js';

/** What the handler needs of the normalised option and the materialised list. */
export interface OpenApiDevOptions {
  section: string;
  specs: MaterialisedSpec[];
}

/** One servable route: the exact bytes and their media type. */
interface DevRoute {
  body: Buffer;
  contentType: string;
}

/** The dev server's view of this site, kept per Vite server instance. */
interface DevState {
  /** The site base without a trailing slash ('' at the root). */
  base: string;
  /** The exact allowlist, keyed by the base-less site route. */
  routes: Map<string, DevRoute>;
  /** `/<section>/`, the namespace this middleware claims for refusals. */
  prefix: string;
}

/** The `/<section>/` namespace this middleware claims for refusals, through the one route rule (FR-003, issue 134). */
function sectionPrefix(section: string): string {
  return routeOfSlug(section);
}

interface DevRequest {
  method?: string;
  url?: string;
}

interface DevResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: Buffer | string): void;
}

type Next = (error?: unknown) => void;

interface DevServer {
  middlewares: { use(handler: (request: DevRequest, response: DevResponse, next: Next) => void): void };
}

interface DevSetupParams {
  server?: DevServer;
}

type DevSetup = (params: DevSetupParams) => void;

/**
 * The setups this module registered. A dev restart re-runs `config:setup`; the
 * newest registration replaces the older ones in `devHandlers`, so a stale
 * in-memory copy can never win a request.
 */
const registered = new Set<DevSetup>();

/** Servable state per Vite server, so a restart updates instead of stacking. */
const states = new WeakMap<DevServer, DevState>();

/** The media type of a raw document, by its published extension. */
function contentTypeOf(ext: string): string {
  return ext === 'json' ? 'application/json; charset=utf-8' : 'text/yaml; charset=utf-8';
}

/** Astro's base (`/`, `/docs/`) as this middleware compares it ('' or `/docs`). */
function normaliseBase(base: string): string {
  if (typeof base !== 'string') return '';
  const trimmed = base.replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '' : `/${trimmed}`;
}

/** The exact allowlist of the materialised list. */
function routesOf(options: OpenApiDevOptions): Map<string, DevRoute> {
  const routes = new Map<string, DevRoute>();
  for (const spec of options.specs) {
    const name = `openapi.${spec.ext}`;
    const dir = `/${options.section}/${spec.label}`;
    routes.set(`${dir}/${name}`, { body: spec.bytes, contentType: contentTypeOf(spec.ext) });
    routes.set(`${dir}/${name}.sha256`, {
      body: Buffer.from(checksumLine(spec.sha256, name), 'utf8'),
      contentType: 'text/plain; charset=utf-8',
    });
  }
  return routes;
}

/** True for any traversal signal: a dot segment, `%2e`, an encoded separator, a NUL. */
function isTraversal(pathname: string): boolean {
  if (/%2e|%2f|%5c|%00/i.test(pathname)) return true;
  if (pathname.includes('\\') || pathname.includes('\0')) return true;
  return pathname.split('/').some((segment) => segment === '.' || segment === '..');
}

/** The base-less site route of a request path, when it carries this site's base. */
function withoutBase(pathname: string, base: string): string {
  if (base !== '' && (pathname === base || pathname.startsWith(`${base}/`))) {
    return pathname.slice(base.length) || '/';
  }
  return pathname;
}

/** The request's path and query, without the fragment. */
function pathnameOf(request: DevRequest): string {
  return (request.url ?? '').split(/[?#]/, 1)[0] ?? '';
}

/** Answer with a status and no body. */
function end(response: DevResponse, status: number): void {
  response.statusCode = status;
  response.end();
}

/**
 * Answer one request: a traversal signal is refused everywhere, a route outside
 * this middleware's namespace is passed on, and only an exact allowlist entry is
 * served (GET/HEAD).
 */
function handle(state: DevState, request: DevRequest, response: DevResponse, next: Next): void {
  const method = (request.method ?? 'GET').toUpperCase();
  const rawPath = pathnameOf(request);
  let pathname: string;
  try {
    pathname = decodeURIComponent(rawPath);
  } catch {
    // Malformed percent-encoding: only a request in this middleware's namespace
    // is refused; anything else is the dev server's to answer.
    return withoutBase(rawPath, state.base).startsWith(state.prefix) ? end(response, 404) : next();
  }
  // Refused before any matching: a traversal attempt is never a legitimate URL.
  if (isTraversal(rawPath) || isTraversal(pathname)) return end(response, 404);
  const route = withoutBase(pathname, state.base);
  if (!route.startsWith(state.prefix)) return next();
  if (method !== 'GET' && method !== 'HEAD') {
    response.statusCode = 405;
    response.setHeader('Allow', 'GET, HEAD');
    return response.end();
  }
  const entry = state.routes.get(route);
  if (entry === undefined) return next();
  response.statusCode = 200;
  response.setHeader('Content-Type', entry.contentType);
  response.setHeader('Content-Length', String(entry.body.length));
  if (method === 'HEAD') response.end();
  else response.end(entry.body);
}

/**
 * The `devHandlers` entry for one site. `base` is Astro's `config.base`; the
 * returned setup registers the middleware once per dev server and refreshes the
 * served routes on a restart. A setup without a server (or without Connect's
 * `use`) does nothing, so a caller can pass the hook params through unguarded.
 */
export function openApiDevHandler(options: OpenApiDevOptions, base: string): DevSetup {
  const setup: DevSetup = (params) => {
    const server = params?.server;
    if (server === undefined || typeof server.middlewares?.use !== 'function') return;
    let state = states.get(server);
    if (state === undefined) {
      const created: DevState = { base: '', routes: new Map(), prefix: sectionPrefix(options.section) };
      states.set(server, created);
      server.middlewares.use((request, response, next) => handle(created, request, response, next));
      state = created;
    }
    state.base = normaliseBase(base);
    state.prefix = sectionPrefix(options.section);
    state.routes = routesOf(options);
  };
  const list = devHandlers as unknown as DevSetup[];
  for (const stale of registered) {
    const index = list.indexOf(stale);
    if (index !== -1) list.splice(index, 1);
  }
  registered.clear();
  registered.add(setup);
  return setup;
}
