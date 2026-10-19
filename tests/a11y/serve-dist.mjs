// Static file server for an already-built example dist — the artifact the a11y
// lane consumes (WP09 T039). Each Playwright `webServer` entry starts one instance
// (contract: kitty-specs/layout-guards-decisions-01M59CGE/contracts/a11y-server-env.md):
//   DK_A11Y_DIST           the dist to serve, relative to the repository root
//                          (default `example/dist`);
//   DK_A11Y_EXPECT_DRAFTS  `on` or `off` (default `on`): the draft mode that dist
//                          must have been built with — any other value exits 1;
//   A11Y_PORT              the port to listen on (default 4321).
//
// This is deliberately NOT `astro dev`/`astro preview`: the lane asserts against
// the exact bytes CI publishes, served from disk.
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
import { join, normalize, extname, resolve } from 'node:path';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = resolve(REPO_ROOT, process.env.DK_A11Y_DIST || 'example/dist');
const EXPECT_DRAFTS = process.env.DK_A11Y_EXPECT_DRAFTS ?? 'on';
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

// Draft-mode check (layout-guards-decisions WP08, FR-012). The lane serves BOTH
// draft modes on purpose: the `light`/`dark` projects run against the drafts-on
// dist that ci.yml's build-example job hands over (every sidebar lists the
// example's draft pages), and the `published-light`/`published-dark` projects run
// against the drafts-off dist that readers see. A server handed the wrong dist
// would measure the wrong sidebar, so a mismatch in EITHER direction is fatal
// before `listen`: the webServer never comes up and Playwright reports it. There
// is no warning fallback. `adr/template/` is a draft page of the example; if it is
// ever published, pick another draft route here.
const DRAFT_SENTINEL = 'adr/template/index.html';
const BUILD_COMMAND = {
  on: 'pnpm build:a11y',
  off: 'DK_PUBLISH_DRAFTS=off DK_OUTDIR=dist-nodrafts pnpm build',
};

function fail(message) {
  process.stderr.write(`a11y static server: ${message}\n`);
  process.exit(1);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

if (EXPECT_DRAFTS !== 'on' && EXPECT_DRAFTS !== 'off') {
  fail(`DK_A11Y_EXPECT_DRAFTS must be 'on' or 'off', got '${EXPECT_DRAFTS}'.`);
}
if (!(await exists(join(DIST, 'index.html')))) {
  fail(`${join(DIST, 'index.html')} is missing: there is no built dist to serve. Run \`${BUILD_COMMAND[EXPECT_DRAFTS]}\`, then retry.`);
}
const FOUND_DRAFTS = (await exists(join(DIST, DRAFT_SENTINEL))) ? 'on' : 'off';
if (FOUND_DRAFTS !== EXPECT_DRAFTS) {
  fail(
    `${DIST} was built with drafts ${FOUND_DRAFTS} (${DRAFT_SENTINEL} is ${FOUND_DRAFTS === 'on' ? 'present' : 'missing'}), ` +
      `but DK_A11Y_EXPECT_DRAFTS=${EXPECT_DRAFTS}. Run \`${BUILD_COMMAND[EXPECT_DRAFTS]}\` to build the drafts-${EXPECT_DRAFTS} dist, then retry.`,
  );
}

server.listen(PORT, () => {
  process.stdout.write(`a11y static server: ${DIST} (drafts ${FOUND_DRAFTS}) → http://localhost:${PORT}${BASE}/\n`);
});
