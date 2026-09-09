/**
 * WP04 T013 — STRUCTURAL no-flash proof (contract C-5, NFR-001).
 *
 * The `toc-rail-prepaint.test.ts` node suite already pins the pre-paint script's
 * SOURCE shape (a classic, non-module/defer/async body). That is necessary but
 * not sufficient: it proves the STRING is well-formed, not that Astro/Starlight
 * actually EMIT it inline in `<head>` before `<body>` — and it says nothing about
 * the sheet. This suite closes that gap by asserting against the REAL built HTML
 * ("the example IS the test", mirroring `example-adopter.test.ts`):
 *
 *   1. the pre-paint `<script>` is an INLINE (no `src`) node inside `<head>`,
 *      positioned BEFORE `<body>`, and carries NO `type="module"`/`defer`/`async`
 *      — so it runs synchronously during head parse, before first paint; and
 *   2. `toc-rail.css` reaches the reader as RENDER-BLOCKING `<head>` CSS (its rules
 *      are delivered by a `<head>` stylesheet, and at least one render-blocking
 *      `<link rel="stylesheet">` is present in `<head>`).
 *
 * Together these two facts prove zero-flash BY CONSTRUCTION (C-5): a returning
 * reader with a collapsed preference gets the attribute set AND the collapsing
 * rules applied before anything paints, so the outline never flashes expanded.
 *
 * The build runs ONCE in `beforeAll`, into a DEDICATED out-of-tree `outDir` (the
 * `DK_OUTDIR` seam, example/astro.config.mjs) so it never races the shared
 * `example/dist` that the a11y lane serves nor the two build suites in
 * vitest.workspace's `build` project. Like `example-adopter.test.ts` it does NOT
 * clear the shared `example/.astro` content cache (only its own outDir), and it
 * strips the Vitest-injected `BASE_URL` from the child env so the child computes
 * the site `base` from `example/astro.config.mjs` (the review-cycle-1 lesson).
 *
 * Mission: collapsible-toc-rail-01M23HNA, WP04.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PRE_PAINT_SCRIPT } from '../lib/toc-rail/pre-paint.js';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
// A DEDICATED out-of-tree output dir (the WP10 `DK_OUTDIR` seam) — NEVER
// `example/dist` (served by the a11y lane) and NEVER a name another build suite
// uses — so a concurrent build never corrupts this one's output.
const OUT_DIR_NAME = 'dist-wp04-tocrail-noflash-test';
const OUT_DIR = path.join(REPO_ROOT, 'example', OUT_DIR_NAME);
// The site base (example/astro.config.mjs). dist files live at the dist ROOT; the
// base is a URL prefix only (serve-dist.mjs), so home is `<outDir>/index.html`
// and an asset advertised at `/doc-kitty/_astro/x.css` lives at `<outDir>/_astro/x.css`.
const SITE_BASE = '/doc-kitty';

// A sentinel unique to toc-rail.css (`.dk-toc-toggle` is defined nowhere else),
// so finding it in a head-delivered stylesheet proves it is toc-rail's rules —
// robust to bundling/minification (the class-selector token survives both).
const TOC_RAIL_CSS_SENTINEL = 'dk-toc-toggle';

let buildResult: { status: number | null; stdout: string; stderr: string };
let html = '';

/** Read a built file from the dedicated outDir, or fail with a precise path. */
function readOut(relPath: string): string {
  const abs = path.join(OUT_DIR, relPath);
  if (!existsSync(abs)) {
    throw new Error(`expected built file missing: ${relPath} (${abs}) — did the example build?`);
  }
  return readFileSync(abs, 'utf8');
}

/** Map an in-page asset href (`/doc-kitty/_astro/x.css`) to its dist file path. */
function distFileForHref(href: string): string | null {
  // Only same-origin absolute hrefs resolve to a dist file (external / data: /
  // relative are not built assets). A base-prefixed href drops the base; a
  // base-less absolute (shouldn't happen post-#61) resolves from the dist root.
  if (!href.startsWith('/')) return null;
  const rel = href.startsWith(SITE_BASE + '/') ? href.slice(SITE_BASE.length) : href;
  const abs = path.join(OUT_DIR, rel.replace(/^\/+/, ''));
  return existsSync(abs) ? abs : null;
}

/** The `<head>` region: everything before the opening `<body>` tag. */
function headRegion(doc: string): string {
  const bodyIdx = doc.search(/<body[\s>]/i);
  return bodyIdx > -1 ? doc.slice(0, bodyIdx) : doc;
}

interface ScriptNode {
  attrs: string;
  body: string;
}

/** Every `<script …>…</script>` node in a chunk of HTML. */
function scriptNodes(chunk: string): ScriptNode[] {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  const out: ScriptNode[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) out.push({ attrs: m[1], body: m[2] });
  return out;
}

/** Every `<link …>` tag in a chunk of HTML (self-closing / void). */
function linkTags(chunk: string): string[] {
  const re = /<link\b[^>]*>/gi;
  return chunk.match(re) ?? [];
}

/** Every `<style>…</style>` body in a chunk of HTML. */
function styleBodies(chunk: string): string[] {
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk)) !== null) out.push(m[1]);
  return out;
}

describe('WP04 T013 — structural no-flash proof against the BUILT HTML (C-5 / NFR-001)', () => {
  beforeAll(() => {
    // Remove only OUR OWN prior output (never the shared example/.astro cache or
    // example/dist — a concurrent build suite may own clearing those).
    rmSync(OUT_DIR, { recursive: true, force: true });
    // Strip the Vitest-injected `BASE_URL` (mirrors example/import.meta.env) so the
    // child `astro build` computes its own base from example/astro.config.mjs — a
    // naive passthrough silently overrides the site base for every SSR render.
    const childEnv = { ...process.env };
    delete childEnv.BASE_URL;
    buildResult = spawnSync('pnpm', ['--filter', 'example', 'build'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: { ...childEnv, DK_OUTDIR: OUT_DIR_NAME },
    });
    if (buildResult.status === 0 && existsSync(path.join(OUT_DIR, 'index.html'))) {
      html = readOut('index.html');
    }
  }, 180_000);

  it('the example build succeeds', () => {
    expect(buildResult.status, `build stderr:\n${buildResult.stderr}`).toBe(0);
    expect(existsSync(path.join(OUT_DIR, 'index.html'))).toBe(true);
  });

  it('emits the pre-paint script INLINE in <head>, before <body>, with no module/defer/async', () => {
    const head = headRegion(html);

    // The pre-paint node is identified by its own distinctive body (it sets the
    // `data-toc-collapsed` attribute from the `dk-toc-collapsed` key). It must be
    // an INLINE script (a `content:` head entry — no `src`).
    const prePaint = scriptNodes(head).find(
      (s) =>
        s.body.includes('dk-toc-collapsed') &&
        s.body.includes('data-toc-collapsed') &&
        s.body.includes('setAttribute'),
    );
    expect(
      prePaint,
      'the pre-paint inline <script> (sets data-toc-collapsed from dk-toc-collapsed) must be present in <head>',
    ).toBeDefined();

    // Verbatim: Astro renders a head `content:` entry untouched, so the exact
    // source string ships inline (the strongest possible fidelity check).
    expect(html, 'the exact PRE_PAINT_SCRIPT source must ship inline').toContain(PRE_PAINT_SCRIPT);

    // Inline (no `src`) — a `src` node would be a network fetch, not a synchronous
    // head script.
    expect(/\bsrc\s*=/.test(prePaint!.attrs), 'the pre-paint script must be inline (no src)').toBe(
      false,
    );

    // A CLASSIC synchronous script — NONE of the deferring attributes that would
    // let first paint happen before it runs (the whole no-flash contract).
    expect(/type\s*=\s*["']?module/i.test(prePaint!.attrs), 'no type="module"').toBe(false);
    expect(/\bdefer\b/i.test(prePaint!.attrs), 'no defer').toBe(false);
    expect(/\basync\b/i.test(prePaint!.attrs), 'no async').toBe(false);

    // Position: the whole node sits BEFORE <body>. (`headRegion` already cut at
    // <body>; this is the belt-and-braces global-offset check.)
    const scriptOffset = html.indexOf(PRE_PAINT_SCRIPT);
    const bodyOffset = html.search(/<body[\s>]/i);
    expect(scriptOffset, 'the pre-paint script must appear in the document').toBeGreaterThan(-1);
    expect(bodyOffset, 'the document must have a <body>').toBeGreaterThan(-1);
    expect(scriptOffset, 'the pre-paint script must appear BEFORE <body>').toBeLessThan(bodyOffset);
  });

  it('delivers toc-rail.css as render-blocking <head> CSS (contract C-5)', () => {
    const head = headRegion(html);

    // A render-blocking stylesheet <link> must exist in <head> at all (the
    // delivery mechanism the contract names). Starlight + the token/component
    // bundle guarantee at least one.
    const headStylesheetLinks = linkTags(head).filter((tag) =>
      /rel\s*=\s*["']?stylesheet/i.test(tag),
    );
    expect(
      headStylesheetLinks.length,
      'at least one render-blocking <link rel="stylesheet"> must be in <head>',
    ).toBeGreaterThan(0);

    // toc-rail's rules must be delivered by <head> CSS. Astro bundles global
    // `customCss` into hashed `_astro/*.css` files, so we resolve each head
    // stylesheet <link> to its dist file and look for the toc-rail sentinel
    // (`.dk-toc-toggle`, defined nowhere else). The auto-inline path (a small
    // sheet emitted as an inline <style>) is also accepted as render-blocking
    // <head> CSS, so the proof is robust to Astro's inlineStylesheets: 'auto'.
    const inLinkedSheet = headStylesheetLinks.some((tag) => {
      const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
      if (!hrefMatch) return false;
      const file = distFileForHref(hrefMatch[1]);
      return file ? readFileSync(file, 'utf8').includes(TOC_RAIL_CSS_SENTINEL) : false;
    });
    const inInlineStyle = styleBodies(head).some((body) =>
      body.includes(TOC_RAIL_CSS_SENTINEL),
    );

    expect(
      inLinkedSheet || inInlineStyle,
      'toc-rail.css rules (.dk-toc-toggle) must be delivered by render-blocking <head> CSS',
    ).toBe(true);
  });
});
