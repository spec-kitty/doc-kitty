#!/usr/bin/env node
/**
 * `dockitty-pdf` — print a built site's print documents to PDF (ADR-0081, #392).
 *
 *   dockitty-pdf --dist <dir> --base <path> [--sections a,b] [--out <dir>] [--timeout <ms>]
 *
 * Reads `<dist>/print/manifest.json` (written by the print route at build end), serves
 * `<dist>` under `--base` on a loopback port, and prints each document (or the
 * `--sections` subset; `site` names the whole-site PDF) to `<out|dist>/pdf/<name>.pdf`.
 *
 * Per document it opens the route with the light theme stored, sets
 * `data-theme="light"` (Chromium's `page.pdf()` never fires `beforeprint`), emulates
 * print media, waits for fonts and, where client-mode diagrams exist, for the renderer
 * to report a light render (`html[data-dk-diagram-theme="light"]`). Then
 * `page.pdf({ tagged, outline, preferCSSPageSize })`, without background graphics so
 * only the print layer's `print-color-adjust: exact` blocks keep their fills. Finally
 * the post-pass pins both dates to `SOURCE_DATE_EPOCH` (else the last commit time) and
 * sets `Title` and `Producer`.
 *
 * Browser: the `playwright` package the toolkit already lists as an optional peer
 * (build-mode diagrams use it), and the Chromium installed for it. It never downloads one.
 *
 * Exit codes, as `dockitty-export-okf`: 0 success; 1 a print, wait or post-pass
 * failed; 2 a usage error or missing input.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { pinPdf } from './pdf-postprocess.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
export const PRODUCER = `doc-kitty-pdf/${VERSION}`;
const DEFAULT_TIMEOUT_MS = 30_000;

export class UsageError extends Error {}

/** Parse argv (without node and the script). */
export function parseArgs(argv) {
  const out = { dist: undefined, base: undefined, sections: undefined, out: undefined, timeout: DEFAULT_TIMEOUT_MS };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} needs a value`);
      return v;
    };
    if (flag === '--dist') out.dist = value();
    else if (flag === '--base') out.base = value();
    else if (flag === '--sections') out.sections = value().split(',').map((s) => s.trim()).filter(Boolean);
    else if (flag === '--out') out.out = value();
    else if (flag === '--timeout') {
      out.timeout = Number(value());
      if (!Number.isFinite(out.timeout) || out.timeout <= 0) throw new UsageError('--timeout must be a positive number of milliseconds');
    } else if (flag === '--help' || flag === '-h') throw new UsageError('help');
    else throw new UsageError(`unknown argument ${flag}`);
  }
  if (!out.dist) throw new UsageError('--dist is required');
  if (out.base === undefined) throw new UsageError('--base is required (use / for a site at the root)');
  out.base = `/${out.base}`.replace(/\/+/g, '/').replace(/\/$/, '');
  return out;
}

/** `SOURCE_DATE_EPOCH`, else the last commit time; throws a UsageError when neither exists. */
export function sourceDateEpoch(env = process.env, cwd = process.cwd()) {
  const raw = env.SOURCE_DATE_EPOCH;
  if (raw !== undefined && raw !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) throw new UsageError(`SOURCE_DATE_EPOCH must be whole seconds, got ${raw}`);
    return n;
  }
  try {
    const n = Number(execFileSync('git', ['log', '-1', '--format=%ct'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
    if (Number.isInteger(n) && n > 0) return n;
  } catch {
    /* no git */
  }
  throw new UsageError('no date to pin the PDFs to: set SOURCE_DATE_EPOCH, or run inside a git checkout');
}

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
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serve `dist` under `base` on 127.0.0.1, like GitHub Pages: a request without the base is a 404. */
export function serveDist(dist, base) {
  const root = path.resolve(dist);
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (base !== '' && pathname !== base && !pathname.startsWith(`${base}/`)) throw new Error('outside base');
      let rel = decodeURIComponent(pathname.slice(base.length)) || '/';
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, `.${path.posix.normalize(rel)}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('outside dist');
      const target = existsSync(file) && statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': MIME[path.extname(target)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function loadChromium() {
  for (const name of ['playwright', '@playwright/test']) {
    try {
      const mod = await import(name);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch {
      /* try the next */
    }
  }
  throw new UsageError('Playwright is not installed: add the `playwright` peer dependency (the same one build-mode diagrams use)');
}

/**
 * Runs in the page: is it light, as printed? The theme must be light, and the body
 * text dark. The print layer forces a white page, so the background proves nothing; the
 * text colour comes from the theme's tokens. Colours are resolved to sRGB through a
 * canvas first, so `oklch()` or `color()` values compare like `rgb()` ones. A dark page
 * here means the force-light step failed, and its PDF would be the near-black print this
 * command exists to prevent (#377).
 */
export function lightCheck() {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const luminance = (css) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = '#000';
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const style = getComputedStyle(document.body);
  const theme = document.documentElement.getAttribute('data-theme');
  return {
    background: style.backgroundColor,
    text: style.color,
    theme,
    light: theme === 'light' && luminance(style.backgroundColor) > 200 && luminance(style.color) < 120,
  };
}

/** Print one document; returns the PDF bytes before the post-pass. */
async function printDocument(browser, origin, doc, timeout) {
  const context = await browser.newContext();
  try {
    await context.addInitScript(() => {
      try {
        window.localStorage.setItem('starlight-theme', 'light');
      } catch {
        /* storage off: the attribute below still applies */
      }
    });
    const page = await context.newPage();
    // Print media from the start: the print layer shows every tab panel and opens every
    // disclosure, so client-mode diagrams inside them are boxed, and drawn, on load.
    // Under screen media they would be skipped and print as their Mermaid source.
    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    const response = await page.goto(`${origin}${doc.route}`, { waitUntil: 'load', timeout });
    if (!response || !response.ok()) throw new Error(`${doc.route} answered ${response?.status() ?? 'nothing'}`);
    // Switch only when needed: setting the same value still notifies the diagram
    // renderer's observer, which would reset every diagram while the old "light" signal
    // still stands. On a switch, clear the signal so the wait below sees the new render.
    await page.evaluate(() => {
      const root = document.documentElement;
      if (root.getAttribute('data-theme') === 'light') return;
      root.removeAttribute('data-dk-diagram-theme');
      root.setAttribute('data-theme', 'light');
    });
    // Lazy images below the fold would print blank, or not, depending on timing: load
    // every image now and wait for each to decode (a broken one is not this command's
    // concern; the link gates own it).
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const img of images) img.loading = 'eager';
      await Promise.all(images.map((img) => (img.complete ? img.decode() : new Promise((r) => {
        img.addEventListener('load', r, { once: true });
        img.addEventListener('error', r, { once: true });
      })).catch(() => undefined)));
      await document.fonts.ready;
    });
    await page.waitForLoadState('networkidle', { timeout });
    if ((await page.locator('pre.mermaid').count()) > 0) {
      try {
        await page.waitForSelector('html[data-dk-diagram-theme="light"]', { state: 'attached', timeout });
      } catch {
        throw new Error(`${doc.route}: client-mode diagrams did not finish a light render within ${timeout} ms`);
      }
    }
    const colours = await page.evaluate(lightCheck);
    if (!colours.light) {
      throw new Error(`${doc.route}: the page is not light at print time (theme ${colours.theme}, background ${colours.background}, text ${colours.text})`);
    }
    return await page.pdf({ tagged: true, outline: true, preferCSSPageSize: true, printBackground: false });
  } finally {
    await context.close();
  }
}

/**
 * Print every selected document. Returns the written files.
 * @param {{ dist: string, base: string, sections?: string[], out?: string, timeout: number }} options
 * @param {{ epochSeconds: number, log?: (m: string) => void }} context
 */
export async function printPdfs(options, { epochSeconds, log = (m) => process.stdout.write(`${m}\n`) }) {
  const manifestPath = path.join(options.dist, 'print', 'manifest.json');
  if (!existsSync(manifestPath)) throw new UsageError(`${manifestPath} is missing: build the site with PDFs enabled first`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let documents = manifest.documents ?? [];
  if (options.sections) {
    const unknown = options.sections.filter((name) => !documents.some((doc) => doc.name === name));
    if (unknown.length) throw new UsageError(`no print document named ${unknown.join(', ')} (have: ${documents.map((d) => d.name).join(', ')})`);
    documents = documents.filter((doc) => options.sections.includes(doc.name));
  }
  if (documents.length === 0) throw new UsageError('the manifest lists no print document');
  const chromium = await loadChromium();
  const outDir = path.join(options.out ?? options.dist, 'pdf');
  mkdirSync(outDir, { recursive: true });
  const { server, origin } = await serveDist(options.dist, options.base);
  // A container's small /dev/shm can crash Chromium on a long document (as in the a11y lane).
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const written = [];
  try {
    for (const doc of documents) {
      const started = Date.now();
      const raw = await printDocument(browser, origin, doc, options.timeout);
      const pdf = pinPdf(raw, { epochSeconds, title: doc.title, producer: PRODUCER });
      const file = path.join(outDir, `${doc.name}.pdf`);
      writeFileSync(file, pdf);
      written.push(file);
      log(`dockitty-pdf: ${path.relative(process.cwd(), file)} (${doc.pages} page(s) printed, ${pdf.length} bytes, ${Date.now() - started} ms)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  return written;
}

const HELP = 'usage: dockitty-pdf --dist <dir> --base <path> [--sections a,b] [--out <dir>] [--timeout <ms>]';

async function main() {
  let options;
  let epochSeconds;
  try {
    options = parseArgs(process.argv.slice(2));
    if (!existsSync(options.dist)) throw new UsageError(`--dist ${options.dist}: no such directory`);
    epochSeconds = sourceDateEpoch();
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(err.message === 'help' ? `${HELP}\n` : `dockitty-pdf: ${err.message}\n${HELP}\n`);
      process.exit(err.message === 'help' ? 0 : 2);
    }
    throw err;
  }
  try {
    await printPdfs(options, { epochSeconds });
  } catch (err) {
    process.stderr.write(`dockitty-pdf: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(err instanceof UsageError ? 2 : 1);
  }
}

/** True when run as a command (directly or through a package `bin` link), not imported. */
function isMain() {
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1] ?? '')).href;
  } catch {
    return false;
  }
}

if (isMain()) await main();
