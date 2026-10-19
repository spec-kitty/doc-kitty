// Throttled static server for `example/dist`, for `sidebar-reveal.spec.ts`
// (WP03 T011; FR-004, NFR-005).
//
// Why a real Node server and not a Playwright `page.route` handler: the HTML-tail
// scenario needs a document that arrives in TWO flushes, so the browser parses and
// paints the first part while the rest is still on the wire. `route.fulfill()`
// hands the browser one complete body and cannot stream, so it cannot hold back
// the tail. A raw `http` server writes the first chunk, waits, then ends the
// response; Chromium parses (and may paint) the first chunk in the meantime.
//
// Like `serve-dist.mjs`, it mounts dist under the site base `/doc-kitty` and 404s
// anything outside it. It is started in-process by the spec on its own port, so it
// never collides with the lane's `webServer`. Node built-ins only.
//
// Modes (switch with `setMode`; the spec runs its tests serially):
//   - 'none'           every file is served at once;
//   - 'html-tail'      an HTML page is sent up to the end of the sidebar region
//                      (the `</nav>` that closes the sidebar after
//                      `</sl-sidebar-state-persist>`), then the rest after
//                      `delayMs`;
//   - 'module-scripts' every `/_astro/*.js` response is held for `delayMs`, so
//                      module scripts (and with them `DOMContentLoaded`) are late.
//
// Every HTML page with a sidebar also gets an inert sentinel, `SIDEBAR_END_SENTINEL`
// (a `<template>`, never rendered), as the last child of the sidebar `<nav>`. Its
// presence in the DOM means the parser has consumed the WHOLE sidebar region, so
// the spec can tell "the sidebar is fully there" from "the parser yielded half-way
// through it" (Chromium may render a frame mid-parse under load). It sits inside
// the `<nav>`, so no sibling selector between the sidebar and the reading column
// changes.
//
// The HTML split point is the end of the sidebar region, not
// `</sl-sidebar-state-persist>` itself: Starlight's `Sidebar` component renders the
// mobile menu footer after the persisted tree, inside the same sidebar slot, so
// anything a `Sidebar` override renders after Starlight's default necessarily
// follows that footer. Cutting inside the slot would test the network, not the
// page. The reading column (`.main-frame`) is what arrives late.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname } from 'node:path';

const DIST = fileURLToPath(new URL('../../../example/dist', import.meta.url));
const BASE = '/doc-kitty';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const PERSIST_CLOSE = '</sl-sidebar-state-persist>';
/** Inert marker injected as the sidebar `<nav>`'s last child. */
export const SIDEBAR_END_SENTINEL = 'template[data-dk-probe="sidebar-end"]';
const SENTINEL_HTML = '<template data-dk-probe="sidebar-end"></template>';

/**
 * The page with the sentinel injected before the `</nav>` that closes the
 * sidebar, and the index just past that `</nav>` (the end of the sidebar
 * region); `at` is -1 when the page has no persisted sidebar tree.
 * @param {string} html
 * @returns {{ html: string, at: number }}
 */
export function markSidebarEnd(html) {
  const persist = html.indexOf(PERSIST_CLOSE);
  if (persist === -1) return { html, at: -1 };
  const nav = html.indexOf('</nav>', persist);
  if (nav === -1) return { html, at: -1 };
  const marked = html.slice(0, nav) + SENTINEL_HTML + html.slice(nav);
  return { html: marked, at: nav + SENTINEL_HTML.length + '</nav>'.length };
}

/** @param {string} pathname */
async function resolveFile(pathname) {
  if (pathname !== BASE && !pathname.startsWith(BASE + '/')) return null;
  const rel = decodeURIComponent(pathname.slice(BASE.length));
  const candidate = rel === '' || rel.endsWith('/') ? join(rel, 'index.html') : rel;
  const abs = normalize(join(DIST, candidate));
  if (!abs.startsWith(DIST)) return null;
  try {
    const s = await stat(abs);
    if (!s.isDirectory()) return abs;
    const idx = join(abs, 'index.html');
    await stat(idx);
    return idx;
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Start the server.
 * @param {{ port: number, delayMs?: number, mode?: 'none' | 'html-tail' | 'module-scripts' }} options
 * @returns {Promise<{ origin: string, setMode: (mode: 'none' | 'html-tail' | 'module-scripts') => void, close: () => Promise<void> }>}
 */
export async function startSlowServer({ port, delayMs = 2000, mode = 'none' }) {
  let current = mode;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`);
      const file = await resolveFile(url.pathname);
      if (!file) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end(`404 Not Found: ${url.pathname}`);
        return;
      }
      const ext = extname(file);
      let body = await readFile(file);
      const headers = {
        'content-type': MIME[ext] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      };
      if (current === 'module-scripts' && ext === '.js' && url.pathname.startsWith(`${BASE}/_astro/`)) {
        await sleep(delayMs);
      }
      if (ext === '.html') {
        const { html, at } = markSidebarEnd(body.toString('utf8'));
        body = Buffer.from(html, 'utf8');
        if (current === 'html-tail' && at !== -1) {
          // No content-length: the response is chunked, so the first write is
          // delivered (and parsed) on its own.
          res.writeHead(200, headers);
          res.write(html.slice(0, at));
          await sleep(delayMs);
          res.end(html.slice(at));
          return;
        }
      }
      res.writeHead(200, { ...headers, 'content-length': body.length });
      res.end(body);
    } catch (err) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`500 ${err?.message ?? err}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(undefined));
  });
  return {
    origin: `http://localhost:${port}`,
    setMode(next) {
      current = next;
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
