// Static file server for the already-built `example/dist` — the artifact the a11y
// lane consumes (WP09 T039). This is deliberately NOT `astro dev`/`astro preview`:
// the lane asserts against the exact bytes CI publishes, served from disk.
//
// The example builds with `base: '/doc-kitty'` (example/astro.config.mjs), so every
// asset and link in dist is absolute under `/doc-kitty/...` while the files live at
// the dist root. This server therefore mounts dist UNDER that base: it strips the
// leading `/doc-kitty` prefix and resolves the remainder inside dist. A request that
// does not carry the base 404s — mirroring GitHub Pages, so a base-path regression
// surfaces here instead of silently resolving.
//
// Dependency-free (Node built-ins only): no runtime dep is added for the harness.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, normalize, extname } from 'node:path';

const DIST = fileURLToPath(new URL('../../example/dist', import.meta.url));
const BASE = '/doc-kitty';
const PORT = Number(process.env.A11Y_PORT ?? 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function resolveFile(pathname) {
  // Only serve what lives under the site base; everything else is a 404.
  if (pathname !== BASE && !pathname.startsWith(BASE + '/')) return null;
  let rel = pathname.slice(BASE.length); // '' or '/...'
  rel = decodeURIComponent(rel);

  // Directory-style route → its index.html (Astro's directory output format).
  let candidate = rel === '' || rel.endsWith('/') ? join(rel, 'index.html') : rel;

  // Contain traversal to the dist root.
  const abs = normalize(join(DIST, candidate));
  if (!abs.startsWith(DIST)) return null;

  try {
    const s = await stat(abs);
    if (s.isDirectory()) {
      const idx = join(abs, 'index.html');
      await stat(idx);
      return idx;
    }
    return abs;
  } catch {
    // Extension-less path that is really a directory route (e.g. `/doc-kitty/context`).
    try {
      const idx = normalize(join(DIST, candidate, 'index.html'));
      if (!idx.startsWith(DIST)) return null;
      await stat(idx);
      return idx;
    } catch {
      return null;
    }
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const file = await resolveFile(url.pathname);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${url.pathname}`);
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`500 ${err?.message ?? err}`);
  }
});

// The lane is written against a dist built with DK_PUBLISH_DRAFTS=on, like the
// one ci.yml's build-example job hands over: the sidebar on every page lists the
// example's draft pages. That is what `pnpm build` produces by default. A build
// made with DK_PUBLISH_DRAFTS=off leaves drafts out, and the sidebar-dependent
// checks then fail for a reason that has nothing to do with the change under
// test. `adr/template/` is a draft page of the example; if it is ever
// published, pick another draft route here.
const DRAFT_SENTINEL = 'adr/template/index.html';
try {
  await stat(join(DIST, 'index.html'));
  try {
    await stat(join(DIST, DRAFT_SENTINEL));
  } catch {
    process.stderr.write(
      `a11y static server: WARNING: ${DIST} has no draft pages (${DRAFT_SENTINEL} is missing). ` +
        'The lane expects a build with DK_PUBLISH_DRAFTS=on. Run `pnpm build:a11y`, then retry.\n',
    );
  }
} catch {
  // No dist at all: the requests below 404 and Playwright reports it.
}

server.listen(PORT, () => {
  process.stdout.write(`a11y static server: ${DIST} → http://localhost:${PORT}${BASE}/\n`);
});
